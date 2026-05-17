import 'package:flutter/material.dart';

import '../models/contact.dart';
import '../models/message.dart';
import 'contact_avatar.dart';

class ChatListTile extends StatelessWidget {
  const ChatListTile({
    super.key,
    required this.contact,
    required this.lastMessage,
    this.onTap,
  });

  final Contact contact;
  final Message? lastMessage;
  final VoidCallback? onTap;

  String _formatTime(DateTime ts) {
    final DateTime now = DateTime.now();
    final Duration diff = now.difference(ts);
    if (diff.inSeconds < 60) return '刚刚';
    if (diff.inMinutes < 60) return '${diff.inMinutes} 分钟前';
    if (now.year == ts.year && now.month == ts.month && now.day == ts.day) {
      return '${ts.hour.toString().padLeft(2, '0')}:'
          '${ts.minute.toString().padLeft(2, '0')}';
    }
    if (now.year == ts.year) return '${ts.month}/${ts.day}';
    return '${ts.year}/${ts.month}/${ts.day}';
  }

  @override
  Widget build(BuildContext context) {
    final ColorScheme scheme = Theme.of(context).colorScheme;
    final Message? lm = lastMessage;
    final String subtitle = lm == null
        ? ''
        : (lm.isUser ? '我: ${lm.text}' : lm.text);

    return ListTile(
      leading: ContactAvatar(contact: contact, size: 48),
      title: Text(
        contact.name,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(fontWeight: FontWeight.w500),
      ),
      subtitle: Text(
        subtitle,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      trailing: lm == null
          ? null
          : Text(
              _formatTime(lm.timestamp),
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(color: scheme.outline),
            ),
      onTap: onTap,
    );
  }
}
