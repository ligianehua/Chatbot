import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../auth/presentation/auth_provider.dart';

class SettingsPage extends ConsumerWidget {
  const SettingsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('我')),
      body: auth.when(
        data: (state) {
          final u = state.user;
          return ListView(
            children: [
              if (u != null)
                ListTile(
                  leading: CircleAvatar(child: Text(u.nickname.isNotEmpty ? u.nickname[0] : '?')),
                  title: Text(u.nickname),
                  subtitle: Text(u.email ?? ''),
                ),
              const Divider(),
              ListTile(
                leading: const Icon(Icons.notifications_outlined),
                title: const Text('通知设置'),
                onTap: () {/* TODO[阶段 4 P1]: push opt-in toggles */},
              ),
              ListTile(
                leading: const Icon(Icons.lock_outline),
                title: const Text('隐私政策'),
                onTap: () => context.push('/legal/privacy'),
              ),
              ListTile(
                leading: const Icon(Icons.description_outlined),
                title: const Text('用户协议'),
                onTap: () => context.push('/legal/terms'),
              ),
              ListTile(
                leading: const Icon(Icons.dark_mode_outlined),
                title: const Text('外观'),
                onTap: () {/* TODO */},
              ),
              const Divider(),
              ListTile(
                leading: const Icon(Icons.delete_outline, color: Colors.red),
                title: const Text('注销账户', style: TextStyle(color: Colors.red)),
                subtitle: const Text('永久删除账户和所有数据'),
                onTap: () => context.push('/settings/delete-account'),
              ),
              ListTile(
                leading: const Icon(Icons.logout, color: Colors.red),
                title: const Text('退出登录', style: TextStyle(color: Colors.red)),
                onTap: () async {
                  await ref.read(authProvider.notifier).logout();
                  if (context.mounted) context.go('/login');
                },
              ),
            ],
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('错误：$e')),
      ),
    );
  }
}
