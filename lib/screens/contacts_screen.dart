import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/contact.dart';
import '../providers/contacts_provider.dart';
import '../widgets/contact_avatar.dart';
import 'add_contact_screen.dart';
import 'chat_screen.dart';
import 'contact_detail_screen.dart';

class ContactsScreen extends StatelessWidget {
  const ContactsScreen({super.key});

  void _openAdd(BuildContext context) {
    Navigator.of(context).push<void>(
      MaterialPageRoute<void>(builder: (_) => const AddContactScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('通讯录'),
        actions: <Widget>[
          IconButton(
            icon: const Icon(Icons.person_add_alt_1),
            tooltip: '添加好友',
            onPressed: () => _openAdd(context),
          ),
        ],
      ),
      body: Consumer<ContactsProvider>(
        builder: (BuildContext context, ContactsProvider prov, _) {
          if (!prov.loaded) {
            return const Center(child: CircularProgressIndicator());
          }
          if (prov.contacts.isEmpty) {
            return _EmptyContacts(onAdd: () => _openAdd(context));
          }
          final List<Contact> sorted = <Contact>[...prov.contacts]
            ..sort((Contact a, Contact b) => a.name.compareTo(b.name));
          return ListView.separated(
            itemCount: sorted.length,
            separatorBuilder: (_, __) => const Divider(height: 0, indent: 72),
            itemBuilder: (BuildContext context, int i) {
              final Contact c = sorted[i];
              return ListTile(
                leading: ContactAvatar(contact: c, size: 44),
                title: Text(c.name),
                subtitle: c.description == null
                    ? null
                    : Text(
                        c.description!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                trailing: c.type == ContactType.bot
                    ? Icon(
                        Icons.smart_toy_outlined,
                        size: 16,
                        color: Theme.of(context).colorScheme.outline,
                      )
                    : null,
                onTap: () => Navigator.of(context).push<void>(
                  MaterialPageRoute<void>(
                    builder: (_) => ChatScreen(contactId: c.id),
                  ),
                ),
                onLongPress: () => Navigator.of(context).push<void>(
                  MaterialPageRoute<void>(
                    builder: (_) => ContactDetailScreen(contactId: c.id),
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

class _EmptyContacts extends StatelessWidget {
  const _EmptyContacts({required this.onAdd});

  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    final ColorScheme scheme = Theme.of(context).colorScheme;
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Icon(Icons.contacts_outlined, size: 64, color: scheme.outline),
          const SizedBox(height: 12),
          Text(
            '还没有好友',
            style: TextStyle(color: scheme.outline, fontSize: 15),
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: onAdd,
            icon: const Icon(Icons.add),
            label: const Text('添加你的第一个 Bot'),
          ),
        ],
      ),
    );
  }
}
