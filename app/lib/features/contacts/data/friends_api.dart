import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/dio_client.dart';
import 'friend_models.dart';

class FriendsApi {
  FriendsApi(this._dio);
  final Dio _dio;

  Future<List<Friend>> list() async {
    final res = await _dio.get<List<dynamic>>('/friends');
    return (res.data ?? [])
        .map((e) => Friend.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<FriendRequest>> incoming() async {
    final res = await _dio.get<List<dynamic>>('/friends/requests/incoming');
    return (res.data ?? [])
        .map((e) => FriendRequest.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<PublicUser>> searchUsers(String query) async {
    final res = await _dio.get<List<dynamic>>('/users/search', queryParameters: {'q': query});
    return (res.data ?? [])
        .map((e) => PublicUser.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> sendRequest({required String friendId, String? remark}) async {
    await _dio.post<void>(
      '/friends/requests',
      data: {'friendId': friendId, if (remark != null) 'remark': remark},
    );
  }

  Future<void> accept(String requesterId) async {
    await _dio.post<void>('/friends/requests/$requesterId/accept');
  }

  Future<void> reject(String requesterId) async {
    await _dio.post<void>('/friends/requests/$requesterId/reject');
  }

  Future<void> remove(String friendId) async {
    await _dio.delete<void>('/friends/$friendId');
  }
}

final friendsApiProvider = Provider<FriendsApi>((ref) {
  return FriendsApi(ref.watch(dioProvider));
});

final friendsListProvider = FutureProvider.autoDispose<List<Friend>>((ref) async {
  return ref.watch(friendsApiProvider).list();
});

final incomingRequestsProvider = FutureProvider.autoDispose<List<FriendRequest>>((ref) async {
  return ref.watch(friendsApiProvider).incoming();
});
