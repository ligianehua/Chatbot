class AuthUser {
  AuthUser({
    required this.id,
    required this.nickname,
    this.email,
    this.avatarUrl,
  });

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    return AuthUser(
      id: json['id'] as String,
      nickname: json['nickname'] as String,
      email: json['email'] as String?,
      avatarUrl: json['avatarUrl'] as String?,
    );
  }

  final String id;
  final String nickname;
  final String? email;
  final String? avatarUrl;
}

class AuthTokens {
  AuthTokens({
    required this.accessToken,
    required this.refreshToken,
    required this.expiresIn,
  });

  factory AuthTokens.fromJson(Map<String, dynamic> json) {
    return AuthTokens(
      accessToken: json['accessToken'] as String,
      refreshToken: json['refreshToken'] as String,
      expiresIn: json['expiresIn'] as int,
    );
  }

  final String accessToken;
  final String refreshToken;
  final int expiresIn;
}

class AuthResult {
  AuthResult({required this.user, required this.tokens});

  factory AuthResult.fromJson(Map<String, dynamic> json) {
    return AuthResult(
      user: AuthUser.fromJson(json['user'] as Map<String, dynamic>),
      tokens: AuthTokens.fromJson(json['tokens'] as Map<String, dynamic>),
    );
  }

  final AuthUser user;
  final AuthTokens tokens;
}
