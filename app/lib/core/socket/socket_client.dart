import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../config/api_config.dart';
import '../storage/auth_storage.dart';

/// Single socket.io connection shared by the whole app.
/// Manages reconnect, attaches the access token on each (re)connect, and
/// exposes [Stream]s for incoming events.
class SocketClient {
  SocketClient(this._storage);

  final AuthStorage _storage;
  io.Socket? _socket;

  final _newMessageController = StreamController<Map<String, dynamic>>.broadcast();
  final _ackController = StreamController<Map<String, dynamic>>.broadcast();
  final _errorController = StreamController<Map<String, dynamic>>.broadcast();
  final _connectionController = StreamController<bool>.broadcast();
  final _botStartController = StreamController<Map<String, dynamic>>.broadcast();
  final _botChunkController = StreamController<Map<String, dynamic>>.broadcast();
  final _botDoneController = StreamController<Map<String, dynamic>>.broadcast();

  Stream<Map<String, dynamic>> get newMessages => _newMessageController.stream;
  Stream<Map<String, dynamic>> get acks => _ackController.stream;
  Stream<Map<String, dynamic>> get errors => _errorController.stream;
  Stream<bool> get connectionState => _connectionController.stream;
  Stream<Map<String, dynamic>> get botStart => _botStartController.stream;
  Stream<Map<String, dynamic>> get botChunk => _botChunkController.stream;
  Stream<Map<String, dynamic>> get botDone => _botDoneController.stream;

  bool get isConnected => _socket?.connected ?? false;

  Future<void> connect() async {
    if (_socket?.connected == true) return;
    final token = await _storage.readAccess();
    if (token == null) return;

    final base = _wsBase();
    _socket = io.io(
      base,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .disableAutoConnect()
          .setAuth({'token': token})
          .setReconnectionAttempts(10)
          .setReconnectionDelay(1000)
          .setReconnectionDelayMax(8000)
          .build(),
    );

    _socket!
      ..on('connect:ready', (_) => _connectionController.add(true))
      ..on('disconnect', (_) => _connectionController.add(false))
      ..on('connect:error', (data) => _errorController.add(_asMap(data)))
      ..on('message:new', (data) => _newMessageController.add(_asMap(data)))
      ..on('message:ack', (data) => _ackController.add(_asMap(data)))
      ..on('message:error', (data) => _errorController.add(_asMap(data)))
      ..on('bot:start', (data) => _botStartController.add(_asMap(data)))
      ..on('bot:chunk', (data) => _botChunkController.add(_asMap(data)))
      ..on('bot:done', (data) => _botDoneController.add(_asMap(data)));

    _socket!.connect();
  }

  Future<void> disconnect() async {
    _socket?.disconnect();
    _socket = null;
    _connectionController.add(false);
  }

  void send({
    required String conversationId,
    required String text,
    required String clientMsgId,
    String? replyToId,
  }) {
    _socket?.emit('message:send', {
      'conversationId': conversationId,
      'type': 'text',
      'text': text,
      'clientMsgId': clientMsgId,
      if (replyToId != null) 'replyToId': replyToId,
    });
  }

  void sendImage({
    required String conversationId,
    required String url,
    required String mime,
    required int size,
    required String clientMsgId,
    int? width,
    int? height,
  }) {
    _socket?.emit('message:send', {
      'conversationId': conversationId,
      'type': 'image',
      'url': url,
      'mime': mime,
      'size': size,
      if (width != null) 'width': width,
      if (height != null) 'height': height,
      'clientMsgId': clientMsgId,
    });
  }

  Future<List<Map<String, dynamic>>> sync({String? sinceMsgId}) async {
    final completer = Completer<List<Map<String, dynamic>>>();
    _socket?.emitWithAck('message:sync',
        {if (sinceMsgId != null) 'sinceMsgId': sinceMsgId},
        ack: (resp) {
      final m = _asMap(resp);
      final list = (m['messages'] as List?) ?? const [];
      completer.complete(list.map((e) => _asMap(e)).toList());
    });
    return completer.future.timeout(
      const Duration(seconds: 10),
      onTimeout: () => <Map<String, dynamic>>[],
    );
  }

  Map<String, dynamic> _asMap(dynamic v) {
    if (v is Map<String, dynamic>) return v;
    if (v is Map) return v.cast<String, dynamic>();
    return <String, dynamic>{};
  }

  String _wsBase() {
    final base = ApiConfig.baseUrl;
    final lastSlash = base.lastIndexOf('/api/');
    return lastSlash > 0 ? base.substring(0, lastSlash) : base;
  }

  void dispose() {
    _socket?.dispose();
    _newMessageController.close();
    _ackController.close();
    _errorController.close();
    _connectionController.close();
    _botStartController.close();
    _botChunkController.close();
    _botDoneController.close();
  }
}

final socketClientProvider = Provider<SocketClient>((ref) {
  final client = SocketClient(ref.watch(authStorageProvider));
  ref.onDispose(client.dispose);
  return client;
});
