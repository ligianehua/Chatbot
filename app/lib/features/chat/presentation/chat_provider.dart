import 'dart:async';
import 'dart:io';
import 'dart:math';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/socket/socket_client.dart';
import '../../../core/storage/auth_storage.dart';
import '../data/chat_api.dart';
import '../data/chat_models.dart';
import '../data/uploads_api.dart';

class ChatRoomState {
  ChatRoomState({
    this.messages = const [],
    this.loadingHistory = false,
    this.hasMore = true,
    this.error,
  });

  final List<ChatMessage> messages;
  final bool loadingHistory;
  final bool hasMore;
  final Object? error;

  ChatRoomState copyWith({
    List<ChatMessage>? messages,
    bool? loadingHistory,
    bool? hasMore,
    Object? error,
    bool clearError = false,
  }) {
    return ChatRoomState(
      messages: messages ?? this.messages,
      loadingHistory: loadingHistory ?? this.loadingHistory,
      hasMore: hasMore ?? this.hasMore,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

/// Per-conversation message state. Listens to the global socket for new
/// messages routed to this conversation; loads older messages via REST.
class ChatRoomNotifier extends FamilyAsyncNotifier<ChatRoomState, String> {
  late final ChatApi _api = ref.read(chatApiProvider);
  late final SocketClient _socket = ref.read(socketClientProvider);
  late final AuthStorage _storage = ref.read(authStorageProvider);

  StreamSubscription<Map<String, dynamic>>? _newSub;
  StreamSubscription<Map<String, dynamic>>? _ackSub;
  StreamSubscription<Map<String, dynamic>>? _botStartSub;
  StreamSubscription<Map<String, dynamic>>? _botChunkSub;
  StreamSubscription<Map<String, dynamic>>? _botDoneSub;
  String? _myUserId;
  final Map<String, String> _botStreamingTextById = {}; // clientMsgId -> accumulated text

  String? get myUserId => _myUserId;

  @override
  Future<ChatRoomState> build(String conversationId) async {
    _myUserId = await _storage.readUserId();
    await _socket.connect();
    _newSub = _socket.newMessages.listen(_onIncoming);
    _ackSub = _socket.acks.listen(_onAck);
    _botStartSub = _socket.botStart.listen(_onBotStart);
    _botChunkSub = _socket.botChunk.listen(_onBotChunk);
    _botDoneSub = _socket.botDone.listen(_onBotDone);
    ref.onDispose(() {
      _newSub?.cancel();
      _ackSub?.cancel();
      _botStartSub?.cancel();
      _botChunkSub?.cancel();
      _botDoneSub?.cancel();
    });

    final history = await _api.history(conversationId, limit: 50);
    history.sort((a, b) => a.id.compareTo(b.id));
    if (history.isNotEmpty) {
      // Mark read up to last message.
      try { await _api.markRead(conversationId, history.last.id); } catch (_) {}
    }
    return ChatRoomState(messages: history, hasMore: history.length >= 50);
  }

  Future<void> loadOlder() async {
    final s = state.valueOrNull;
    if (s == null || s.loadingHistory || !s.hasMore || s.messages.isEmpty) return;
    state = AsyncValue.data(s.copyWith(loadingHistory: true));
    try {
      final older = await _api.history(arg, before: s.messages.first.id, limit: 50);
      older.sort((a, b) => a.id.compareTo(b.id));
      state = AsyncValue.data(s.copyWith(
        messages: [...older, ...s.messages],
        loadingHistory: false,
        hasMore: older.length >= 50,
      ));
    } catch (e) {
      state = AsyncValue.data(s.copyWith(loadingHistory: false, error: e));
    }
  }

  Future<void> sendText(String text) async {
    final clientMsgId = _genClientId();
    final pending = ChatMessage(
      id: 'pending-$clientMsgId',
      conversationId: arg,
      senderId: _myUserId,
      type: 'text',
      content: {'text': text},
      createdAt: DateTime.now(),
      clientMsgId: clientMsgId,
      status: MessageStatus.sending,
    );
    final s = state.valueOrNull ?? ChatRoomState();
    state = AsyncValue.data(s.copyWith(messages: [...s.messages, pending]));
    _socket.send(conversationId: arg, text: text, clientMsgId: clientMsgId);
  }

  Future<void> sendImage(File file) async {
    final clientMsgId = _genClientId();
    final pending = ChatMessage(
      id: 'pending-$clientMsgId',
      conversationId: arg,
      senderId: _myUserId,
      type: 'image',
      content: {'localPath': file.path, 'mime': 'image/*', 'size': 0},
      createdAt: DateTime.now(),
      clientMsgId: clientMsgId,
      status: MessageStatus.sending,
    );
    final s = state.valueOrNull ?? ChatRoomState();
    state = AsyncValue.data(s.copyWith(messages: [...s.messages, pending]));

    try {
      final uploaded = await ref.read(uploadsApiProvider).uploadImage(file);
      _socket.sendImage(
        conversationId: arg,
        url: uploaded.url,
        mime: uploaded.mime,
        size: uploaded.size,
        clientMsgId: clientMsgId,
      );
    } catch (e) {
      // Mark the pending bubble as failed and re-throw so the page layer
      // can show a contextual error (e.g. moderation rejection details).
      final cur = state.valueOrNull;
      if (cur != null) {
        final updated = cur.messages
            .map((m) => m.clientMsgId == clientMsgId
                ? m.copyWith(status: MessageStatus.failed)
                : m)
            .toList();
        state = AsyncValue.data(cur.copyWith(messages: updated, error: e));
      }
      rethrow;
    }
  }

  void _onIncoming(Map<String, dynamic> payload) {
    final msgRaw = payload['message'];
    if (msgRaw is! Map) return;
    final m = ChatMessage.fromJson(msgRaw.cast<String, dynamic>());
    if (m.conversationId != arg) return;
    final s = state.valueOrNull;
    if (s == null) return;
    if (s.messages.any((x) => x.id == m.id)) return; // dedupe
    final next = [...s.messages, m]..sort((a, b) => a.id.compareTo(b.id));
    state = AsyncValue.data(s.copyWith(messages: next));
    _api.markRead(arg, m.id).catchError((_) {});
  }

  void _onAck(Map<String, dynamic> payload) {
    final clientMsgId = payload['clientMsgId'] as String?;
    final msgRaw = payload['message'];
    if (clientMsgId == null || msgRaw is! Map) return;
    final server = ChatMessage.fromJson(msgRaw.cast<String, dynamic>());
    if (server.conversationId != arg) return;
    final s = state.valueOrNull;
    if (s == null) return;
    final updated = s.messages.map((m) {
      if (m.clientMsgId == clientMsgId) {
        return m.copyWith(id: server.id, createdAt: server.createdAt, status: MessageStatus.sent);
      }
      return m;
    }).toList()
      ..sort((a, b) => a.id.compareTo(b.id));
    state = AsyncValue.data(s.copyWith(messages: updated));
  }

  void _onBotStart(Map<String, dynamic> payload) {
    if (payload['conversationId'] != arg) return;
    final clientMsgId = payload['clientMsgId'] as String?;
    if (clientMsgId == null) return;
    _botStreamingTextById[clientMsgId] = '';
    final placeholder = ChatMessage(
      id: 'streaming-$clientMsgId',
      conversationId: arg,
      senderId: null, // bot
      type: 'text',
      content: const {'text': ''},
      createdAt: DateTime.now(),
      clientMsgId: clientMsgId,
      status: MessageStatus.sending,
    );
    final s = state.valueOrNull ?? ChatRoomState();
    state = AsyncValue.data(s.copyWith(messages: [...s.messages, placeholder]));
  }

  void _onBotChunk(Map<String, dynamic> payload) {
    if (payload['conversationId'] != arg) return;
    final clientMsgId = payload['clientMsgId'] as String?;
    final delta = payload['delta'] as String?;
    if (clientMsgId == null || delta == null) return;
    final acc = (_botStreamingTextById[clientMsgId] ?? '') + delta;
    _botStreamingTextById[clientMsgId] = acc;

    final s = state.valueOrNull;
    if (s == null) return;
    final updated = s.messages.map((m) {
      if (m.clientMsgId == clientMsgId && m.id.startsWith('streaming-')) {
        return ChatMessage(
          id: m.id,
          conversationId: m.conversationId,
          senderId: m.senderId,
          type: m.type,
          content: {'text': acc},
          createdAt: m.createdAt,
          clientMsgId: m.clientMsgId,
          status: m.status,
        );
      }
      return m;
    }).toList();
    state = AsyncValue.data(s.copyWith(messages: updated));
  }

  void _onBotDone(Map<String, dynamic> payload) {
    if (payload['conversationId'] != arg) return;
    final clientMsgId = payload['clientMsgId'] as String?;
    final msgRaw = payload['message'];
    if (clientMsgId == null || msgRaw is! Map) return;
    _botStreamingTextById.remove(clientMsgId);
    final final_ = ChatMessage.fromJson(msgRaw.cast<String, dynamic>());

    final s = state.valueOrNull;
    if (s == null) return;
    final updated = s.messages
        .where((m) => !(m.clientMsgId == clientMsgId && m.id.startsWith('streaming-')))
        .toList();
    if (!updated.any((m) => m.id == final_.id)) updated.add(final_);
    updated.sort((a, b) => a.id.compareTo(b.id));
    state = AsyncValue.data(s.copyWith(messages: updated));
  }

  String _genClientId() {
    final r = Random();
    return List.generate(16, (_) => r.nextInt(16).toRadixString(16)).join();
  }
}

final chatRoomProvider = AsyncNotifierProvider.family<ChatRoomNotifier, ChatRoomState, String>(
  ChatRoomNotifier.new,
);
