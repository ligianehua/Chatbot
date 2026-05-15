import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/dio_client.dart';
import 'bot_models.dart';

class BotsApi {
  BotsApi(this._dio);
  final Dio _dio;

  Future<List<Bot>> listMine() async {
    final res = await _dio.get<List<dynamic>>('/bots/mine');
    return (res.data ?? [])
        .map((e) => Bot.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<Bot> get(String id) async {
    final res = await _dio.get<Map<String, dynamic>>('/bots/$id');
    return Bot.fromJson(res.data!);
  }

  Future<Bot> create(CreateBotInput input) async {
    final res = await _dio.post<Map<String, dynamic>>('/bots', data: input.toJson());
    return Bot.fromJson(res.data!);
  }

  Future<Bot> update(String id, Map<String, dynamic> patch) async {
    final res = await _dio.patch<Map<String, dynamic>>('/bots/$id', data: patch);
    return Bot.fromJson(res.data!);
  }

  Future<void> delete(String id) async {
    await _dio.delete<void>('/bots/$id');
  }

  Future<Map<String, dynamic>> openConversation(String botId) async {
    final res = await _dio.post<Map<String, dynamic>>('/bots/$botId/conversation');
    return res.data!;
  }
}

final botsApiProvider = Provider<BotsApi>((ref) {
  return BotsApi(ref.watch(dioProvider));
});

final myBotsProvider = FutureProvider.autoDispose<List<Bot>>((ref) async {
  return ref.watch(botsApiProvider).listMine();
});
