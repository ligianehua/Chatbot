import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

enum ContactType { bot, user }

@immutable
class Contact {
  Contact({
    required this.id,
    required this.type,
    required this.name,
    required this.emoji,
    required this.avatarColorValue,
    required this.createdAt,
    this.description,
    this.systemPrompt,
  });

  final String id;
  final ContactType type;
  final String name;
  final String emoji;
  final int avatarColorValue;
  final String? description;
  final String? systemPrompt;
  final DateTime createdAt;

  Color get avatarColor => Color(avatarColorValue);

  Contact copyWith({
    String? name,
    String? emoji,
    int? avatarColorValue,
    String? description,
    String? systemPrompt,
  }) {
    return Contact(
      id: id,
      type: type,
      name: name ?? this.name,
      emoji: emoji ?? this.emoji,
      avatarColorValue: avatarColorValue ?? this.avatarColorValue,
      description: description ?? this.description,
      systemPrompt: systemPrompt ?? this.systemPrompt,
      createdAt: createdAt,
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
        'id': id,
        'type': type.name,
        'name': name,
        'emoji': emoji,
        'avatarColorValue': avatarColorValue,
        'description': description,
        'systemPrompt': systemPrompt,
        'createdAt': createdAt.toIso8601String(),
      };

  factory Contact.fromJson(Map<String, dynamic> json) => Contact(
        id: json['id'] as String,
        type: ContactType.values.firstWhere(
          (ContactType t) => t.name == json['type'],
          orElse: () => ContactType.bot,
        ),
        name: json['name'] as String,
        emoji: json['emoji'] as String,
        avatarColorValue: json['avatarColorValue'] as int,
        description: json['description'] as String?,
        systemPrompt: json['systemPrompt'] as String?,
        createdAt: DateTime.parse(json['createdAt'] as String),
      );
}
