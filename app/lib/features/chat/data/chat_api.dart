import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/dio_client.dart';
import 'chat_models.dart';

class ChatApi {
  ChatApi(this._dio);
  final Dio _dio;

  Future<List<ConversationSummary>> listConversations() async {
    final res = await _dio.get<List<dynamic>>('/conversations');
    return (res.data ?? [])
        .map((e) => ConversationSummary.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<Map<String, dynamic>> openDirect(String peerId) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/conversations/direct',
      data: {'peerId': peerId},
    );
    return res.data!;
  }

  Future<List<ChatMessage>> history(String conversationId, {String? before, int limit = 50}) async {
    final res = await _dio.get<List<dynamic>>(
      '/conversations/$conversationId/messages',
      queryParameters: {if (before != null) 'before': before, 'limit': limit},
    );
    return (res.data ?? [])
        .map((e) => ChatMessage.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<void> markRead(String conversationId, String upToMsgId) async {
    await _dio.post<void>('/conversations/$conversationId/read', data: {'upToMsgId': upToMsgId});
  }
}

final chatApiProvider = Provider<ChatApi>((ref) {
  return ChatApi(ref.watch(dioProvider));
});

final conversationsProvider = FutureProvider.autoDispose<List<ConversationSummary>>((ref) async {
  return ref.watch(chatApiProvider).listConversations();
});
