import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../contacts/data/friend_models.dart';
import '../../contacts/data/friends_api.dart';
import '../data/groups_api.dart';

class GroupCreatePage extends ConsumerStatefulWidget {
  const GroupCreatePage({super.key});

  @override
  ConsumerState<GroupCreatePage> createState() => _GroupCreatePageState();
}

class _GroupCreatePageState extends ConsumerState<GroupCreatePage> {
  final _name = TextEditingController();
  final Set<String> _selected = {};
  bool _submitting = false;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final name = _name.text.trim();
    if (name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('请输入群名')));
      return;
    }
    if (_selected.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('至少选择 1 位好友')));
      return;
    }
    setState(() => _submitting = true);
    try {
      final group = await ref.read(groupsApiProvider).create(
            name: name,
            memberIds: _selected.toList(),
          );
      final conv = await ref.read(groupsApiProvider).openConversation(group.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('已创建：${group.name}')));
      context.go('/chats');
      context.push('/chat/${conv['id']}?title=${Uri.encodeComponent(group.name)}&type=group&peerId=${group.id}');
    } on DioException catch (e) {
      if (!mounted) return;
      final msg = e.response?.data is Map ? (e.response!.data as Map)['message'] : null;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(msg is List ? msg.join('；') : (msg?.toString() ?? '创建失败')),
      ));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final friends = ref.watch(friendsListProvider);
    return Scaffold(
      appBar: AppBar(
        title: Text('新建群聊${_selected.isEmpty ? '' : '（${_selected.length}）'}'),
        actions: [
          TextButton(
            onPressed: _submitting ? null : _submit,
            child: _submitting
                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('完成'),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              controller: _name,
              decoration: const InputDecoration(labelText: '群名'),
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: friends.when(
              data: (list) {
                if (list.isEmpty) return const Center(child: Text('还没有好友'));
                return ListView.builder(
                  itemCount: list.length,
                  itemBuilder: (_, i) => _FriendRow(
                    friend: list[i],
                    selected: _selected.contains(list[i].id),
                    onToggle: (v) => setState(() {
                      if (v) {
                        _selected.add(list[i].id);
                      } else {
                        _selected.remove(list[i].id);
                      }
                    }),
                  ),
                );
              },
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(child: Text('加载失败：$e')),
            ),
          ),
        ],
      ),
    );
  }
}

class _FriendRow extends StatelessWidget {
  const _FriendRow({required this.friend, required this.selected, required this.onToggle});
  final Friend friend;
  final bool selected;
  final ValueChanged<bool> onToggle;

  @override
  Widget build(BuildContext context) {
    return CheckboxListTile(
      value: selected,
      onChanged: (v) => onToggle(v ?? false),
      controlAffinity: ListTileControlAffinity.trailing,
      secondary: CircleAvatar(child: Text(friend.nickname.isNotEmpty ? friend.nickname[0] : '?')),
      title: Text(friend.remark?.isNotEmpty == true ? friend.remark! : friend.nickname),
      subtitle: friend.bio == null ? null : Text(friend.bio!, maxLines: 1, overflow: TextOverflow.ellipsis),
    );
  }
}
