class Message {
  Message({
    required this.id,
    required this.contactId,
    required this.text,
    required this.isUser,
    DateTime? timestamp,
  }) : timestamp = timestamp ?? DateTime.now();

  final String id;
  final String contactId;
  final String text;
  final bool isUser;
  final DateTime timestamp;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'id': id,
        'contactId': contactId,
        'text': text,
        'isUser': isUser,
        'timestamp': timestamp.toIso8601String(),
      };

  factory Message.fromJson(Map<String, dynamic> json) => Message(
        id: json['id'] as String,
        contactId: json['contactId'] as String,
        text: json['text'] as String,
        isUser: json['isUser'] as bool,
        timestamp: DateTime.parse(json['timestamp'] as String),
      );
}
