class Friend {
  Friend({
    required this.id,
    required this.nickname,
    this.avatarUrl,
    this.bio,
    this.remark,
  });

  factory Friend.fromJson(Map<String, dynamic> json) {
    return Friend(
      id: json['id'] as String,
      nickname: json['nickname'] as String,
      avatarUrl: json['avatarUrl'] as String?,
      bio: json['bio'] as String?,
      remark: json['remark'] as String?,
    );
  }

  final String id;
  final String nickname;
  final String? avatarUrl;
  final String? bio;
  final String? remark;
}

class FriendRequest {
  FriendRequest({required this.from, this.remark, required this.createdAt});

  factory FriendRequest.fromJson(Map<String, dynamic> json) {
    return FriendRequest(
      from: PublicUser.fromJson(json['from'] as Map<String, dynamic>),
      remark: json['remark'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  final PublicUser from;
  final String? remark;
  final DateTime createdAt;
}

class PublicUser {
  PublicUser({
    required this.id,
    required this.nickname,
    this.avatarUrl,
    this.bio,
  });

  factory PublicUser.fromJson(Map<String, dynamic> json) {
    return PublicUser(
      id: json['id'] as String,
      nickname: json['nickname'] as String,
      avatarUrl: json['avatarUrl'] as String?,
      bio: json['bio'] as String?,
    );
  }

  final String id;
  final String nickname;
  final String? avatarUrl;
  final String? bio;
}
