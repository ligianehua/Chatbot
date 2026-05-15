import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../data/bots_api.dart';

class BotsPage extends ConsumerWidget {
  const BotsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bots = ref.watch(myBotsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('我的 Bot')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/bots/new'),
        icon: const Icon(Icons.add),
        label: const Text('新建 Bot'),
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(myBotsProvider),
        child: bots.when(
          data: (list) {
            if (list.isEmpty) {
              return ListView(
                children: const [
                  SizedBox(height: 100),
                  Center(child: Text('还没有 Bot')),
                  SizedBox(height: 8),
                  Center(child: Text('点右下角新建一个吧')),
                ],
              );
            }
            return ListView.separated(
              itemCount: list.length,
              separatorBuilder: (_, __) => const Divider(height: 1, indent: 72),
              itemBuilder: (_, i) {
                final b = list[i];
                return ListTile(
                  leading: CircleAvatar(
                    child: Text(b.name.isNotEmpty ? b.name[0] : '?'),
                  ),
                  title: Text(b.name),
                  subtitle: Text(
                    b.bio?.isNotEmpty == true ? b.bio! : (b.occupation ?? '未设置简介'),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () async {
                    try {
                      final conv = await ref.read(botsApiProvider).openConversation(b.id);
                      final convId = conv['id'] as String;
                      if (!context.mounted) return;
                      context.push('/chat/$convId?title=${Uri.encodeComponent(b.name)}');
                    } catch (e) {
                      if (!context.mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('打开会话失败：$e')),
                      );
                    }
                  },
                );
              },
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(child: Text('加载失败：$e')),
        ),
      ),
    );
  }
}
