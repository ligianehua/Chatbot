import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/contact.dart';
import '../models/message.dart';
import '../providers/contacts_provider.dart';
import '../providers/messages_provider.dart';
import '../widgets/chat_list_tile.dart';
import 'chat_screen.dart';

class ChatsScreen extends StatelessWidget {
  const ChatsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('聊天')),
      body: Consumer2<ContactsProvider, MessagesProvider>(
        builder: (
          BuildContext context,
          ContactsProvider contactsProv,
          MessagesProvider messagesProv,
          _,
        ) {
          if (!contactsProv.loaded || !messagesProv.loaded) {
            return const Center(child: CircularProgressIndicator());
          }

          final List<Contact> withMsgs = contactsProv.contacts
              .where((Contact c) => messagesProv.lastMessageFor(c.id) != null)
              .toList()
            ..sort((Contact a, Contact b) {
              final Message? am = messagesProv.lastMessageFor(a.id);
              final Message? bm = messagesProv.lastMessageFor(b.id);
              return bm!.timestamp.compareTo(am!.timestamp);
            });

          if (withMsgs.isEmpty) {
            return _EmptyChats();
          }

          return ListView.separated(
            itemCount: withMsgs.length,
            separatorBuilder: (_, __) => const Divider(height: 0, indent: 76),
            itemBuilder: (BuildContext context, int i) {
              final Contact c = withMsgs[i];
              return ChatListTile(
                contact: c,
                lastMessage: messagesProv.lastMessageFor(c.id),
                onTap: () => Navigator.of(context).push<void>(
                  MaterialPageRoute<void>(
                    builder: (_) => ChatScreen(contactId: c.id),
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}

class _EmptyChats extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final ColorScheme scheme = Theme.of(context).colorScheme;
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Icon(Icons.chat_bubble_outline, size: 64, color: scheme.outline),
          const SizedBox(height: 12),
          Text(
            '还没有聊天记录',
            style: TextStyle(color: scheme.outline, fontSize: 15),
          ),
          const SizedBox(height: 4),
          Text(
            '去"通讯录"选个 Bot 开始聊天',
            style: TextStyle(color: scheme.outline, fontSize: 12),
          ),
        ],
      ),
    );
  }
}
