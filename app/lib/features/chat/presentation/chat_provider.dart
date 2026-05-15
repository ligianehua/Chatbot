import 'dart:async';
import 'dart:math';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/socket/socket_client.dart';
import '../../../core/storage/auth_storage.dart';
import '../data/chat_api.dart';
import '../data/chat_models.dart';

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
  String? _myUserId;

  String? get myUserId => _myUserId;

  @override
  Future<ChatRoomState> build(String conversationId) async {
    _myUserId = await _storage.readUserId();
    await _socket.connect();
    _newSub = _socket.newMessages.listen(_onIncoming);
    _ackSub = _socket.acks.listen(_onAck);
    ref.onDispose(() {
      _newSub?.cancel();
      _ackSub?.cancel();
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

  String _genClientId() {
    final r = Random();
    return List.generate(16, (_) => r.nextInt(16).toRadixString(16)).join();
  }
}

final chatRoomProvider = AsyncNotifierProvider.family<ChatRoomNotifier, ChatRoomState, String>(
  ChatRoomNotifier.new,
);
