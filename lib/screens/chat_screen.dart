import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/contact.dart';
import '../models/message.dart';
import '../providers/contacts_provider.dart';
import '../providers/messages_provider.dart';
import '../widgets/chat_input.dart';
import '../widgets/contact_avatar.dart';
import '../widgets/message_bubble.dart';
import 'contact_detail_screen.dart';

class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key, required this.contactId});

  final String contactId;

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final ScrollController _scrollController = ScrollController();

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) return;
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    return Consumer2<ContactsProvider, MessagesProvider>(
      builder: (
        BuildContext context,
        ContactsProvider contactsProv,
        MessagesProvider messagesProv,
        _,
      ) {
        final Contact? contact = contactsProv.findById(widget.contactId);
        if (contact == null) {
          return Scaffold(
            appBar: AppBar(),
            body: const Center(child: Text('联系人已删除')),
          );
        }

        final List<Message> messages =
            messagesProv.messagesFor(widget.contactId);
        final bool isTyping = messagesProv.isTyping(widget.contactId);

        _scrollToBottom();

        return Scaffold(
          appBar: AppBar(
            titleSpacing: 0,
            title: Row(
              children: <Widget>[
                ContactAvatar(contact: contact, size: 36),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: <Widget>[
                      Text(
                        contact.name,
                        style: const TextStyle(fontSize: 16),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (isTyping)
                        Text(
                          '正在输入…',
                          style: TextStyle(
                            fontSize: 11,
                            color: Theme.of(context).colorScheme.primary,
                          ),
                        )
                      else if (contact.description != null)
                        Text(
                          contact.description!,
                          style: TextStyle(
                            fontSize: 11,
                            color: Theme.of(context).colorScheme.outline,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                    ],
                  ),
                ),
              ],
            ),
            actions: <Widget>[
              IconButton(
                icon: const Icon(Icons.more_horiz),
                tooltip: '详情',
                onPressed: () => Navigator.of(context).push<void>(
                  MaterialPageRoute<void>(
                    builder: (_) => ContactDetailScreen(contactId: contact.id),
                  ),
                ),
              ),
            ],
          ),
          body: Column(
            children: <Widget>[
              Expanded(
                child: messages.isEmpty && !isTyping
                    ? _ChatEmptyState(contact: contact)
                    : ListView.builder(
                        controller: _scrollController,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        itemCount: messages.length + (isTyping ? 1 : 0),
                        itemBuilder: (BuildContext context, int index) {
                          if (index < messages.length) {
                            return MessageBubble(message: messages[index]);
                          }
                          return const _TypingIndicator();
                        },
                      ),
              ),
              ChatInput(contactId: widget.contactId),
            ],
          ),
        );
      },
    );
  }
}

class _ChatEmptyState extends StatelessWidget {
  const _ChatEmptyState({required this.contact});

  final Contact contact;

  @override
  Widget build(BuildContext context) {
    final ColorScheme scheme = Theme.of(context).colorScheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            ContactAvatar(contact: contact, size: 72),
            const SizedBox(height: 12),
            Text(
              contact.name,
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w500),
            ),
            const SizedBox(height: 6),
            if (contact.description != null)
              Text(
                contact.description!,
                textAlign: TextAlign.center,
                style: TextStyle(color: scheme.outline, fontSize: 13),
              ),
            const SizedBox(height: 12),
            Text(
              '发条消息开始聊天吧',
              style: TextStyle(color: scheme.outline, fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }
}

class _TypingIndicator extends StatelessWidget {
  const _TypingIndicator();

  @override
  Widget build(BuildContext context) {
    final ColorScheme scheme = Theme.of(context).colorScheme;
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4, horizontal: 12),
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 14),
        decoration: BoxDecoration(
          color: scheme.surfaceContainerHighest,
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(16),
            topRight: Radius.circular(16),
            bottomLeft: Radius.circular(4),
            bottomRight: Radius.circular(16),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            SizedBox(
              width: 14,
              height: 14,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: scheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(width: 8),
            Text(
              '正在输入…',
              style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 14),
            ),
          ],
        ),
      ),
    );
  }
}
