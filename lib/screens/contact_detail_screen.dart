import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/contact.dart';
import '../providers/contacts_provider.dart';
import '../providers/messages_provider.dart';
import '../widgets/contact_avatar.dart';

class ContactDetailScreen extends StatelessWidget {
  const ContactDetailScreen({super.key, required this.contactId});

  final String contactId;

  Future<void> _confirmDelete(BuildContext context, Contact contact) async {
    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (BuildContext ctx) => AlertDialog(
        title: const Text('删除好友'),
        content: Text('确定删除 "${contact.name}"?\n所有聊天记录也会一起被清除。'),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('删除'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    if (!context.mounted) return;

    await context.read<MessagesProvider>().clearMessagesFor(contact.id);
    if (!context.mounted) return;
    await context.read<ContactsProvider>().removeContact(contact.id);
    if (!context.mounted) return;
    Navigator.of(context).popUntil((Route<dynamic> r) => r.isFirst);
  }

  Future<void> _clearMessages(BuildContext context, Contact contact) async {
    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (BuildContext ctx) => AlertDialog(
        title: const Text('清空聊天记录'),
        content: Text('确定清空与 "${contact.name}" 的所有聊天记录?'),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('清空'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    if (!context.mounted) return;
    await context.read<MessagesProvider>().clearMessagesFor(contact.id);
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<ContactsProvider>(
      builder: (BuildContext context, ContactsProvider prov, _) {
        final Contact? contact = prov.findById(contactId);
        if (contact == null) {
          return Scaffold(
            appBar: AppBar(),
            body: const Center(child: Text('联系人已删除')),
          );
        }
        final ColorScheme scheme = Theme.of(context).colorScheme;
        return Scaffold(
          appBar: AppBar(title: const Text('详情')),
          body: ListView(
            children: <Widget>[
              const SizedBox(height: 24),
              Center(child: ContactAvatar(contact: contact, size: 96)),
              const SizedBox(height: 12),
              Center(
                child: Text(
                  contact.name,
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
              const SizedBox(height: 4),
              Center(
                child: Text(
                  contact.type == ContactType.bot ? 'AI Bot' : '用户',
                  style: TextStyle(color: scheme.outline),
                ),
              ),
              const SizedBox(height: 24),
              if (contact.description != null)
                ListTile(
                  leading: const Icon(Icons.info_outline),
                  title: const Text('简介'),
                  subtitle: Text(contact.description!),
                ),
              if (contact.systemPrompt != null)
                ListTile(
                  leading: const Icon(Icons.psychology_outlined),
                  title: const Text('人设 / System Prompt'),
                  subtitle: Text(contact.systemPrompt!),
                ),
              ListTile(
                leading: const Icon(Icons.calendar_today_outlined),
                title: const Text('创建时间'),
                subtitle: Text(
                  contact.createdAt.toIso8601String().substring(0, 16).replaceFirst('T', ' '),
                ),
              ),
              const SizedBox(height: 16),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: OutlinedButton.icon(
                  onPressed: () => _clearMessages(context, contact),
                  icon: const Icon(Icons.cleaning_services_outlined),
                  label: const Text('清空聊天记录'),
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size.fromHeight(46),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: FilledButton.tonalIcon(
                  onPressed: () => _confirmDelete(context, contact),
                  icon: const Icon(Icons.delete_outline),
                  label: const Text('删除好友'),
                  style: FilledButton.styleFrom(
                    backgroundColor: scheme.errorContainer,
                    foregroundColor: scheme.onErrorContainer,
                    minimumSize: const Size.fromHeight(46),
                  ),
                ),
              ),
              const SizedBox(height: 24),
            ],
          ),
        );
      },
    );
  }
}
