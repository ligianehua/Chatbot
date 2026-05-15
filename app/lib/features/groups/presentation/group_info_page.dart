import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/storage/auth_storage.dart';
import '../../chat/data/chat_api.dart';
import '../data/groups_api.dart';

class GroupInfoPage extends ConsumerWidget {
  const GroupInfoPage({super.key, required this.groupId});

  final String groupId;

  Future<String?> _myId(WidgetRef ref) => ref.read(authStorageProvider).readUserId();

  Future<void> _leave(BuildContext context, WidgetRef ref) async {
    final myId = await _myId(ref);
    if (myId == null) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('退出群聊？'),
        content: const Text('退出后将不再收到此群消息。'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('取消')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('退出'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(groupsApiProvider).leave(groupId, myId);
      ref.invalidate(conversationsProvider);
      if (!context.mounted) return;
      context.go('/chats');
    } on DioException catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('退出失败：${e.message}')));
    }
  }

  Future<void> _disband(BuildContext context, WidgetRef ref) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('解散群聊？'),
        content: const Text('此操作不可撤销，所有成员会失去此群和聊天记录。'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('取消')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('解散'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(groupsApiProvider).disband(groupId);
      ref.invalidate(conversationsProvider);
      if (!context.mounted) return;
      context.go('/chats');
    } on DioException catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('解散失败：${e.message}')));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(groupDetailProvider(groupId));
    return Scaffold(
      appBar: AppBar(title: const Text('群聊信息')),
      body: detail.when(
        data: (d) => FutureBuilder<String?>(
          future: _myId(ref),
          builder: (context, snap) {
            final myId = snap.data;
            final me = d.members.firstWhere(
              (m) => m.userId == myId,
              orElse: () => d.members.first,
            );
            final isOwner = me.isOwner;
            return ListView(
              children: [
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 28,
                        child: Text(d.group.name.isNotEmpty ? d.group.name[0] : '?',
                            style: const TextStyle(fontSize: 24)),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(d.group.name, style: Theme.of(context).textTheme.titleLarge),
                            Text('${d.group.memberCount} 位成员',
                                style: Theme.of(context).textTheme.bodySmall),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                if (d.group.announcement?.isNotEmpty == true) ...[
                  const Divider(height: 1),
                  ListTile(
                    leading: const Icon(Icons.campaign_outlined),
                    title: const Text('群公告'),
                    subtitle: Text(d.group.announcement!),
                  ),
                ],
                const Divider(height: 1),
                ListTile(
                  title: Text('成员 (${d.members.length})',
                      style: const TextStyle(fontWeight: FontWeight.bold)),
                ),
                ...d.members.map((m) => ListTile(
                      leading: CircleAvatar(
                        child: Text(m.nickname.isNotEmpty ? m.nickname[0] : '?'),
                      ),
                      title: Row(children: [
                        Text(m.nickname),
                        if (m.isOwner) ...[
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: Colors.orange.shade100,
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: const Text('群主', style: TextStyle(fontSize: 10, color: Colors.orange)),
                          ),
                        ] else if (m.role == 'admin') ...[
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: Colors.blue.shade100,
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: const Text('管理员', style: TextStyle(fontSize: 10, color: Colors.blue)),
                          ),
                        ],
                      ]),
                    )),
                const Divider(height: 1),
                if (isOwner)
                  ListTile(
                    leading: const Icon(Icons.delete_forever, color: Colors.red),
                    title: const Text('解散群聊', style: TextStyle(color: Colors.red)),
                    onTap: () => _disband(context, ref),
                  )
                else
                  ListTile(
                    leading: const Icon(Icons.exit_to_app, color: Colors.red),
                    title: const Text('退出群聊', style: TextStyle(color: Colors.red)),
                    onTap: () => _leave(context, ref),
                  ),
                const SizedBox(height: 32),
              ],
            );
          },
        ),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('加载失败：$e')),
      ),
    );
  }
}
