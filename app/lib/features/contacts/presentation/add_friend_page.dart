import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/friend_models.dart';
import '../data/friends_api.dart';

class AddFriendPage extends ConsumerStatefulWidget {
  const AddFriendPage({super.key});

  @override
  ConsumerState<AddFriendPage> createState() => _AddFriendPageState();
}

class _AddFriendPageState extends ConsumerState<AddFriendPage> {
  final _query = TextEditingController();
  Future<List<PublicUser>>? _future;

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  void _search() {
    final q = _query.text.trim();
    if (q.length < 2) return;
    setState(() => _future = ref.read(friendsApiProvider).searchUsers(q));
  }

  Future<void> _send(PublicUser user) async {
    try {
      await ref.read(friendsApiProvider).sendRequest(friendId: user.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('已向 ${user.nickname} 发送请求')));
      ref.invalidate(friendsListProvider);
    } on DioException catch (e) {
      if (!mounted) return;
      final msg = e.response?.statusCode == 409 ? '已经是好友或已发送过请求' : '发送失败';
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('加好友')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _query,
                    decoration: const InputDecoration(
                      labelText: '邮箱 / 用户ID / 昵称',
                      prefixIcon: Icon(Icons.search),
                    ),
                    onSubmitted: (_) => _search(),
                  ),
                ),
                const SizedBox(width: 8),
                FilledButton(onPressed: _search, child: const Text('搜索')),
              ],
            ),
            const SizedBox(height: 16),
            Expanded(
              child: _future == null
                  ? const Center(child: Text('输入邮箱、用户 ID 或昵称'))
                  : FutureBuilder<List<PublicUser>>(
                      future: _future,
                      builder: (context, snap) {
                        if (snap.connectionState == ConnectionState.waiting) {
                          return const Center(child: CircularProgressIndicator());
                        }
                        if (snap.hasError) return Center(child: Text('错误: ${snap.error}'));
                        final list = snap.data ?? const <PublicUser>[];
                        if (list.isEmpty) return const Center(child: Text('未找到匹配用户'));
                        return ListView.separated(
                          itemCount: list.length,
                          separatorBuilder: (_, __) => const Divider(height: 1),
                          itemBuilder: (_, i) {
                            final u = list[i];
                            return ListTile(
                              leading: CircleAvatar(child: Text(u.nickname.isNotEmpty ? u.nickname[0] : '?')),
                              title: Text(u.nickname),
                              subtitle: u.bio == null ? null : Text(u.bio!),
                              trailing: FilledButton.tonal(
                                onPressed: () => _send(u),
                                child: const Text('加好友'),
                              ),
                            );
                          },
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
