import 'dart:io' show Platform;

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'auth_provider.dart';

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    await ref.read(authProvider.notifier).login(
          email: _email.text.trim(),
          password: _password.text,
        );
    _afterAuth();
  }

  Future<void> _signInWithApple() async {
    await ref.read(authProvider.notifier).signInWithApple();
    _afterAuth();
  }

  Future<void> _signInWithGoogle() async {
    await ref.read(authProvider.notifier).signInWithGoogle();
    _afterAuth();
  }

  void _afterAuth() {
    if (!mounted) return;
    final state = ref.read(authProvider);
    state.when(
      data: (s) {
        if (s.isAuthenticated) context.go('/chats');
      },
      loading: () {},
      error: (e, _) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_friendlyError(e))),
        );
      },
    );
  }

  bool get _supportsApple => !kIsWeb && (Platform.isIOS || Platform.isMacOS);

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('登录')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextFormField(
                  controller: _email,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(labelText: '邮箱'),
                  validator: (v) => (v == null || !v.contains('@')) ? '请输入有效邮箱' : null,
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _password,
                  obscureText: true,
                  decoration: const InputDecoration(labelText: '密码'),
                  validator: (v) => (v == null || v.length < 8) ? '至少 8 位' : null,
                ),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: auth.isLoading ? null : _submit,
                  child: auth.isLoading
                      ? const SizedBox(
                          height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Text('登录'),
                ),
                const SizedBox(height: 12),
                TextButton(
                  onPressed: () => context.push('/register'),
                  child: const Text('还没有账号？去注册'),
                ),
                TextButton(
                  onPressed: () => context.push('/forgot-password'),
                  child: const Text('忘记密码？'),
                ),
                const SizedBox(height: 20),
                const Row(children: [
                  Expanded(child: Divider()),
                  Padding(
                    padding: EdgeInsets.symmetric(horizontal: 8),
                    child: Text('或', style: TextStyle(color: Colors.grey)),
                  ),
                  Expanded(child: Divider()),
                ]),
                const SizedBox(height: 12),
                if (_supportsApple) ...[
                  OutlinedButton.icon(
                    onPressed: auth.isLoading ? null : _signInWithApple,
                    icon: const Icon(Icons.apple),
                    label: const Text('使用 Apple 登录'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Theme.of(context).colorScheme.onSurface,
                    ),
                  ),
                  const SizedBox(height: 8),
                ],
                OutlinedButton.icon(
                  onPressed: auth.isLoading ? null : _signInWithGoogle,
                  icon: const Icon(Icons.g_mobiledata, size: 28),
                  label: const Text('使用 Google 登录'),
                ),
                const SizedBox(height: 24),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    TextButton(
                      onPressed: () => context.push('/legal/privacy'),
                      child: const Text('隐私政策', style: TextStyle(fontSize: 12)),
                    ),
                    const Text('·', style: TextStyle(color: Colors.grey)),
                    TextButton(
                      onPressed: () => context.push('/legal/terms'),
                      child: const Text('用户协议', style: TextStyle(fontSize: 12)),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

String _friendlyError(Object e) {
  if (e is DioException) {
    final code = e.response?.statusCode;
    if (code == 401) return '邮箱或密码错误';
    if (code == 409) return '邮箱已被注册';
    if (code == 400) {
      final msg = e.response?.data is Map ? (e.response!.data as Map)['message'] : null;
      return msg is List ? msg.join('；') : (msg?.toString() ?? '请求格式错误');
    }
    return '网络错误，请稍后再试';
  }
  return e.toString();
}
