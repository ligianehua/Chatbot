class GroupSummary {
  GroupSummary({
    required this.id,
    required this.ownerId,
    required this.name,
    required this.memberCount,
    this.avatarUrl,
    this.announcement,
  });

  factory GroupSummary.fromJson(Map<String, dynamic> json) {
    return GroupSummary(
      id: json['id'] as String,
      ownerId: json['ownerId'] as String,
      name: json['name'] as String,
      avatarUrl: json['avatarUrl'] as String?,
      announcement: json['announcement'] as String?,
      memberCount: (json['memberCount'] as num).toInt(),
    );
  }

  final String id;
  final String ownerId;
  final String name;
  final String? avatarUrl;
  final String? announcement;
  final int memberCount;
}

class GroupMemberInfo {
  GroupMemberInfo({
    required this.userId,
    required this.role,
    required this.nickname,
    this.avatarUrl,
  });

  factory GroupMemberInfo.fromJson(Map<String, dynamic> json) {
    final user = (json['user'] as Map).cast<String, dynamic>();
    return GroupMemberInfo(
      userId: json['userId'] as String,
      role: json['role'] as String, // owner | admin | member
      nickname: user['nickname'] as String,
      avatarUrl: user['avatarUrl'] as String?,
    );
  }

  final String userId;
  final String role;
  final String nickname;
  final String? avatarUrl;

  bool get isOwner => role == 'owner';
  bool get isAdmin => role == 'admin' || role == 'owner';
}

class GroupDetail {
  GroupDetail({required this.group, required this.members});

  factory GroupDetail.fromJson(Map<String, dynamic> json) {
    final members = ((json['members'] as List?) ?? [])
        .map((e) => GroupMemberInfo.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
    return GroupDetail(
      group: GroupSummary.fromJson(json),
      members: members,
    );
  }

  final GroupSummary group;
  final List<GroupMemberInfo> members;
}
