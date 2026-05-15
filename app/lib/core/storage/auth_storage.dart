import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AuthStorage {
  AuthStorage(this._storage);

  final FlutterSecureStorage _storage;

  static const _accessKey = 'auth.accessToken';
  static const _refreshKey = 'auth.refreshToken';
  static const _userIdKey = 'auth.userId';

  Future<void> save({
    required String accessToken,
    required String refreshToken,
    required String userId,
  }) async {
    await _storage.write(key: _accessKey, value: accessToken);
    await _storage.write(key: _refreshKey, value: refreshToken);
    await _storage.write(key: _userIdKey, value: userId);
  }

  Future<String?> readAccess() => _storage.read(key: _accessKey);
  Future<String?> readRefresh() => _storage.read(key: _refreshKey);
  Future<String?> readUserId() => _storage.read(key: _userIdKey);

  Future<void> writeAccess(String token) =>
      _storage.write(key: _accessKey, value: token);

  Future<void> writeRefresh(String token) =>
      _storage.write(key: _refreshKey, value: token);

  Future<void> clear() async {
    await _storage.delete(key: _accessKey);
    await _storage.delete(key: _refreshKey);
    await _storage.delete(key: _userIdKey);
  }
}

final authStorageProvider = Provider<AuthStorage>((ref) {
  return AuthStorage(const FlutterSecureStorage());
});
