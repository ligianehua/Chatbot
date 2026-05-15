class ConversationPeer {
  ConversationPeer({required this.id, required this.nickname, this.avatarUrl});

  factory ConversationPeer.fromJson(Map<String, dynamic> json) {
    return ConversationPeer(
      id: json['id'] as String,
      nickname: json['nickname'] as String,
      avatarUrl: json['avatarUrl'] as String?,
    );
  }

  final String id;
  final String nickname;
  final String? avatarUrl;
}

class ConversationSummary {
  ConversationSummary({
    required this.id,
    required this.type,
    this.peer,
    required this.unreadCount,
    required this.muted,
    this.lastMsgAt,
    this.lastMessage,
  });

  factory ConversationSummary.fromJson(Map<String, dynamic> json) {
    return ConversationSummary(
      id: json['id'] as String,
      type: json['type'] as String,
      peer: json['peer'] is Map
          ? ConversationPeer.fromJson((json['peer'] as Map).cast<String, dynamic>())
          : null,
      unreadCount: (json['unreadCount'] as num?)?.toInt() ?? 0,
      muted: json['muted'] as bool? ?? false,
      lastMsgAt: json['lastMsgAt'] == null ? null : DateTime.parse(json['lastMsgAt'] as String),
      lastMessage: json['lastMessage'] is Map
          ? ChatMessage.fromJson((json['lastMessage'] as Map).cast<String, dynamic>())
          : null,
    );
  }

  final String id;
  final String type; // direct | group | bot
  final ConversationPeer? peer;
  final int unreadCount;
  final bool muted;
  final DateTime? lastMsgAt;
  final ChatMessage? lastMessage;

  String get title => peer?.nickname ?? '会话';
  String get preview {
    final m = lastMessage;
    if (m == null) return '';
    if (m.type == 'text') {
      final text = m.content['text'];
      return text is String ? text : '';
    }
    if (m.type == 'image') return '[图片]';
    if (m.type == 'voice') return '[语音]';
    if (m.type == 'video') return '[视频]';
    if (m.type == 'file') return '[文件]';
    return '[${m.type}]';
  }
}

class ChatMessage {
  ChatMessage({
    required this.id,
    required this.conversationId,
    this.senderId,
    required this.type,
    required this.content,
    required this.createdAt,
    this.replyToId,
    this.clientMsgId,
    this.status = MessageStatus.sent,
  });

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    return ChatMessage(
      id: json['id'] as String,
      conversationId: json['conversationId'] as String,
      senderId: json['senderId'] as String?,
      type: json['type'] as String,
      content: (json['content'] as Map).cast<String, dynamic>(),
      createdAt: DateTime.parse(json['createdAt'] as String),
      replyToId: json['replyToId'] as String?,
    );
  }

  final String id;
  final String conversationId;
  final String? senderId;
  final String type;
  final Map<String, dynamic> content;
  final DateTime createdAt;
  final String? replyToId;
  final String? clientMsgId;
  final MessageStatus status;

  String get text {
    final t = content['text'];
    return t is String ? t : '';
  }

  ChatMessage copyWith({
    MessageStatus? status,
    String? id,
    DateTime? createdAt,
  }) {
    return ChatMessage(
      id: id ?? this.id,
      conversationId: conversationId,
      senderId: senderId,
      type: type,
      content: content,
      createdAt: createdAt ?? this.createdAt,
      replyToId: replyToId,
      clientMsgId: clientMsgId,
      status: status ?? this.status,
    );
  }
}

enum MessageStatus { sending, sent, failed }
