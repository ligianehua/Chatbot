import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../data/friends_api.dart';

class ContactsPage extends ConsumerWidget {
  const ContactsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final friends = ref.watch(friendsListProvider);
    final requests = ref.watch(incomingRequestsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('通讯录'),
        actions: [
          IconButton(
            icon: const Icon(Icons.person_add_alt_1),
            onPressed: () => context.push('/contacts/add'),
            tooltip: '加好友',
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(friendsListProvider);
          ref.invalidate(incomingRequestsProvider);
        },
        child: ListView(
          children: [
            requests.when(
              data: (rs) => rs.isEmpty
                  ? const SizedBox.shrink()
                  : ListTile(
                      leading: const Icon(Icons.person_add),
                      title: const Text('好友请求'),
                      trailing: Container(
                        padding: const EdgeInsets.all(6),
                        decoration: const BoxDecoration(
                          color: Colors.red, shape: BoxShape.circle),
                        child: Text('${rs.length}',
                            style: const TextStyle(color: Colors.white, fontSize: 12)),
                      ),
                      onTap: () => context.push('/contacts/requests'),
                    ),
              loading: () => const SizedBox.shrink(),
              error: (_, __) => const SizedBox.shrink(),
            ),
            const Divider(height: 1),
            friends.when(
              data: (list) {
                if (list.isEmpty) {
                  return const Padding(
                    padding: EdgeInsets.all(40),
                    child: Center(child: Text('还没有好友，去加一个吧')),
                  );
                }
                return Column(
                  children: list.map((f) => ListTile(
                    leading: CircleAvatar(
                      child: Text(f.nickname.isNotEmpty ? f.nickname[0] : '?'),
                    ),
                    title: Text(f.remark?.isNotEmpty == true ? f.remark! : f.nickname),
                    subtitle: f.bio == null ? null : Text(f.bio!),
                    onTap: () {
                      // TODO[阶段 2]: open chat with this friend.
                    },
                  )).toList(),
                );
              },
              loading: () => const Padding(
                padding: EdgeInsets.all(24),
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (e, _) => Padding(
                padding: const EdgeInsets.all(24),
                child: Center(child: Text('加载失败: $e')),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
