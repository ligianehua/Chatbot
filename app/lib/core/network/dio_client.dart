import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/api_config.dart';
import '../storage/auth_storage.dart';

/// Builds a [Dio] with two interceptors:
/// 1. Attach Bearer access token to every request.
/// 2. On 401, exchange refresh token for a new access token, then retry once.
///    Concurrent 401s coalesce on a single refresh call.
class DioClient {
  DioClient(this._storage)
      : _dio = Dio(BaseOptions(
          baseUrl: ApiConfig.baseUrl,
          connectTimeout: const Duration(seconds: 10),
          receiveTimeout: const Duration(seconds: 30),
          headers: {'Content-Type': 'application/json'},
        )) {
    _dio.interceptors.add(_authInterceptor());
  }

  final AuthStorage _storage;
  final Dio _dio;
  late final Dio _refreshDio = Dio(BaseOptions(baseUrl: ApiConfig.baseUrl));

  Dio get raw => _dio;

  Completer<String?>? _pendingRefresh;

  InterceptorsWrapper _authInterceptor() {
    return InterceptorsWrapper(
      onRequest: (options, handler) async {
        if (options.headers['Authorization'] == null) {
          final token = await _storage.readAccess();
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
        }
        handler.next(options);
      },
      onError: (error, handler) async {
        final response = error.response;
        final isAuthEndpoint = error.requestOptions.path.startsWith('/auth/');
        if (response?.statusCode != 401 || isAuthEndpoint) {
          return handler.next(error);
        }

        final newAccess = await _refreshOnce();
        if (newAccess == null) {
          return handler.next(error);
        }

        try {
          final retryOptions = error.requestOptions
            ..headers['Authorization'] = 'Bearer $newAccess';
          final retried = await _dio.fetch(retryOptions);
          handler.resolve(retried);
        } catch (_) {
          handler.next(error);
        }
      },
    );
  }

  Future<String?> _refreshOnce() {
    final pending = _pendingRefresh;
    if (pending != null) return pending.future;

    final completer = Completer<String?>();
    _pendingRefresh = completer;

    _doRefresh().then((token) {
      completer.complete(token);
      _pendingRefresh = null;
    }).catchError((_) {
      completer.complete(null);
      _pendingRefresh = null;
    });

    return completer.future;
  }

  Future<String?> _doRefresh() async {
    final refreshToken = await _storage.readRefresh();
    if (refreshToken == null) return null;
    try {
      final res = await _refreshDio.post<Map<String, dynamic>>(
        '/auth/refresh',
        data: {'refreshToken': refreshToken},
      );
      final access = res.data?['accessToken'] as String?;
      final newRefresh = res.data?['refreshToken'] as String?;
      if (access == null || newRefresh == null) return null;
      await _storage.writeAccess(access);
      await _storage.writeRefresh(newRefresh);
      return access;
    } catch (_) {
      await _storage.clear();
      return null;
    }
  }
}

final dioClientProvider = Provider<DioClient>((ref) {
  return DioClient(ref.watch(authStorageProvider));
});

final dioProvider = Provider<Dio>((ref) => ref.watch(dioClientProvider).raw);
