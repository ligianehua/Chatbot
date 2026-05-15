import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/socket/socket_client.dart';
import '../data/chat_api.dart';
import '../data/chat_models.dart';

class ChatsPage extends ConsumerStatefulWidget {
  const ChatsPage({super.key});

  @override
  ConsumerState<ChatsPage> createState() => _ChatsPageState();
}

class _ChatsPageState extends ConsumerState<ChatsPage> {
  StreamSubscription? _sub;

  @override
  void initState() {
    super.initState();
    final socket = ref.read(socketClientProvider);
    socket.connect();
    // refresh conversation list whenever a new message arrives
    _sub = socket.newMessages.listen((_) => ref.invalidate(conversationsProvider));
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final convs = ref.watch(conversationsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('消息')),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(conversationsProvider),
        child: convs.when(
          data: (list) {
            if (list.isEmpty) {
              return ListView(
                children: const [
                  SizedBox(height: 80),
                  Center(child: Text('还没有会话')),
                  SizedBox(height: 8),
                  Center(child: Text('在通讯录里点好友开始聊天')),
                ],
              );
            }
            return ListView.separated(
              itemCount: list.length,
              separatorBuilder: (_, __) => const Divider(height: 1, indent: 72),
              itemBuilder: (_, i) => _ConversationTile(c: list[i]),
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(child: Text('加载失败：$e')),
        ),
      ),
    );
  }
}

class _ConversationTile extends StatelessWidget {
  const _ConversationTile({required this.c});
  final ConversationSummary c;

  @override
  Widget build(BuildContext context) {
    final preview = c.preview;
    return ListTile(
      leading: CircleAvatar(child: Text(c.title.isNotEmpty ? c.title[0] : '?')),
      title: Text(c.title),
      subtitle: preview.isEmpty ? null : Text(preview, maxLines: 1, overflow: TextOverflow.ellipsis),
      trailing: c.unreadCount > 0
          ? Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: const BoxDecoration(color: Colors.red, shape: BoxShape.circle),
              constraints: const BoxConstraints(minWidth: 22, minHeight: 22),
              child: Center(
                child: Text('${c.unreadCount}',
                    style: const TextStyle(color: Colors.white, fontSize: 12)),
              ),
            )
          : null,
      onTap: () {
        final peerName = c.peer?.nickname ?? c.title;
        context.push('/chat/${c.id}?title=${Uri.encodeComponent(peerName)}');
      },
    );
  }
}
