import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/dio_client.dart';
import 'group_models.dart';

class GroupsApi {
  GroupsApi(this._dio);
  final Dio _dio;

  Future<GroupSummary> create({
    required String name,
    required List<String> memberIds,
    String? avatarUrl,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>('/groups', data: {
      'name': name,
      'memberIds': memberIds,
      if (avatarUrl != null) 'avatarUrl': avatarUrl,
    });
    return GroupSummary.fromJson(res.data!);
  }

  Future<GroupDetail> detail(String id) async {
    final res = await _dio.get<Map<String, dynamic>>('/groups/$id');
    return GroupDetail.fromJson(res.data!);
  }

  Future<List<GroupSummary>> listMine() async {
    final res = await _dio.get<List<dynamic>>('/groups/mine');
    return (res.data ?? [])
        .map((e) => GroupSummary.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<Map<String, dynamic>> openConversation(String id) async {
    final res = await _dio.post<Map<String, dynamic>>('/groups/$id/conversation');
    return res.data!;
  }

  Future<void> leave(String id, String userId) async {
    await _dio.delete<void>('/groups/$id/members/$userId');
  }

  Future<void> disband(String id) async {
    await _dio.delete<void>('/groups/$id');
  }

  Future<void> addMembers(String id, List<String> userIds) async {
    await _dio.post<void>('/groups/$id/members', data: {'userIds': userIds});
  }
}

final groupsApiProvider = Provider<GroupsApi>((ref) {
  return GroupsApi(ref.watch(dioProvider));
});

final groupDetailProvider = FutureProvider.autoDispose.family<GroupDetail, String>((ref, id) async {
  return ref.watch(groupsApiProvider).detail(id);
});
