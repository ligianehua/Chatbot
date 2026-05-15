import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/friends_api.dart';

class FriendRequestsPage extends ConsumerWidget {
  const FriendRequestsPage({super.key});

  Future<void> _accept(WidgetRef ref, String requesterId) async {
    await ref.read(friendsApiProvider).accept(requesterId);
    ref.invalidate(incomingRequestsProvider);
    ref.invalidate(friendsListProvider);
  }

  Future<void> _reject(WidgetRef ref, String requesterId) async {
    await ref.read(friendsApiProvider).reject(requesterId);
    ref.invalidate(incomingRequestsProvider);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final requests = ref.watch(incomingRequestsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('好友请求')),
      body: requests.when(
        data: (list) {
          if (list.isEmpty) return const Center(child: Text('没有待处理请求'));
          return ListView.separated(
            itemCount: list.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (_, i) {
              final r = list[i];
              return ListTile(
                leading: CircleAvatar(child: Text(r.from.nickname.isNotEmpty ? r.from.nickname[0] : '?')),
                title: Text(r.from.nickname),
                subtitle: r.remark == null ? null : Text('附言：${r.remark}'),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                      icon: const Icon(Icons.check, color: Colors.green),
                      onPressed: () => _accept(ref, r.from.id),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, color: Colors.red),
                      onPressed: () => _reject(ref, r.from.id),
                    ),
                  ],
                ),
              );
            },
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('加载失败：$e')),
      ),
    );
  }
}
