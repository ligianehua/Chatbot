import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/dio_client.dart';
import 'auth_models.dart';

class AuthApi {
  AuthApi(this._dio);
  final Dio _dio;

  Future<AuthResult> register({
    required String email,
    required String password,
    required String nickname,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/auth/register',
      data: {'email': email, 'password': password, 'nickname': nickname},
    );
    return AuthResult.fromJson(res.data!);
  }

  Future<AuthResult> login({required String email, required String password}) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/auth/login',
      data: {'email': email, 'password': password},
    );
    return AuthResult.fromJson(res.data!);
  }

  /// Exchanges a verified Apple/Google identity token for our own JWT pair.
  /// The backend verifies the JWT against the provider's JWKS.
  Future<AuthResult> oauth({
    required String provider, // 'apple' | 'google'
    required String idToken,
    String? nickname,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/auth/oauth',
      data: {
        'provider': provider,
        'idToken': idToken,
        if (nickname != null && nickname.isNotEmpty) 'nickname': nickname,
      },
    );
    return AuthResult.fromJson(res.data!);
  }

  Future<void> logout(String refreshToken) async {
    await _dio.post<void>('/auth/logout', data: {'refreshToken': refreshToken});
  }

  Future<String?> forgotPassword(String email) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/auth/forgot-password',
      data: {'email': email},
    );
    return res.data?['devToken'] as String?;
  }

  Future<void> resetPassword({required String token, required String newPassword}) async {
    await _dio.post<void>(
      '/auth/reset-password',
      data: {'token': token, 'newPassword': newPassword},
    );
  }

  Future<AuthUser> me() async {
    final res = await _dio.get<Map<String, dynamic>>('/users/me');
    return AuthUser.fromJson(res.data!);
  }
}

final authApiProvider = Provider<AuthApi>((ref) {
  return AuthApi(ref.watch(dioProvider));
});
