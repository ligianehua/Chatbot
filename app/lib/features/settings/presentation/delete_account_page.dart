import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/dio_client.dart';
import '../../auth/presentation/auth_provider.dart';

class DeleteAccountPage extends ConsumerStatefulWidget {
  const DeleteAccountPage({super.key});

  @override
  ConsumerState<DeleteAccountPage> createState() => _DeleteAccountPageState();
}

class _DeleteAccountPageState extends ConsumerState<DeleteAccountPage> {
  bool _confirmed = false;
  bool _busy = false;

  Future<void> _delete() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('确认删除账户'),
        content: const Text(
            '此操作不可撤销。你的资料、好友关系、创建的 Bot 和所有消息将被永久删除。'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('取消')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('删除'),
          ),
        ],
      ),
    );
    if (ok != true) return;

    setState(() => _busy = true);
    try {
      final dio = ref.read(dioProvider);
      await dio.delete<void>('/users/me');
      await ref.read(authProvider.notifier).logout();
      if (!mounted) return;
      context.go('/login');
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('账户已删除')),
      );
    } on DioException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('删除失败：${e.message ?? e.response?.statusCode}')),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('注销账户')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                '删除账户会立即清除：\n\n'
                '• 个人资料、头像、设置\n'
                '• 好友关系与好友请求\n'
                '• 你创建的所有 Bot\n'
                '• 全部聊天记录（含图片）\n'
                '• 钱包余额（若有未提取部分将作废）\n\n'
                '此操作不可撤销。',
                style: TextStyle(height: 1.5),
              ),
              const SizedBox(height: 24),
              CheckboxListTile(
                value: _confirmed,
                onChanged: (v) => setState(() => _confirmed = v ?? false),
                title: const Text('我已了解，确认删除我的账户'),
                contentPadding: EdgeInsets.zero,
              ),
              const SizedBox(height: 16),
              FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: Colors.red,
                  disabledBackgroundColor: Colors.grey,
                ),
                onPressed: (_confirmed && !_busy) ? _delete : null,
                child: _busy
                    ? const SizedBox(
                        height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('永久删除账户'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
