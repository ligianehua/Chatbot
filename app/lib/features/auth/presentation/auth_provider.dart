import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/storage/auth_storage.dart';
import '../data/auth_api.dart';
import '../data/auth_models.dart';

class AuthState {
  const AuthState({this.user, this.loading = false});

  final AuthUser? user;
  final bool loading;

  bool get isAuthenticated => user != null;

  AuthState copyWith({AuthUser? user, bool? loading, bool clearUser = false}) {
    return AuthState(
      user: clearUser ? null : (user ?? this.user),
      loading: loading ?? this.loading,
    );
  }
}

class AuthNotifier extends AsyncNotifier<AuthState> {
  late final AuthApi _api = ref.read(authApiProvider);
  late final AuthStorage _storage = ref.read(authStorageProvider);

  @override
  Future<AuthState> build() async {
    final access = await _storage.readAccess();
    if (access == null) return const AuthState();
    try {
      final user = await _api.me();
      return AuthState(user: user);
    } catch (_) {
      await _storage.clear();
      return const AuthState();
    }
  }

  Future<void> register({
    required String email,
    required String password,
    required String nickname,
  }) async {
    state = const AsyncValue.loading();
    try {
      final result = await _api.register(email: email, password: password, nickname: nickname);
      await _storage.save(
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        userId: result.user.id,
      );
      state = AsyncValue.data(AuthState(user: result.user));
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> login({required String email, required String password}) async {
    state = const AsyncValue.loading();
    try {
      final result = await _api.login(email: email, password: password);
      await _storage.save(
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        userId: result.user.id,
      );
      state = AsyncValue.data(AuthState(user: result.user));
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> logout() async {
    final refresh = await _storage.readRefresh();
    if (refresh != null) {
      try {
        await _api.logout(refresh);
      } catch (_) {/* ignore — clear local anyway */}
    }
    await _storage.clear();
    state = const AsyncValue.data(AuthState());
  }
}

final authProvider = AsyncNotifierProvider<AuthNotifier, AuthState>(AuthNotifier.new);
