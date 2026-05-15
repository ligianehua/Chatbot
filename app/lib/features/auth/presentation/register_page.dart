import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'auth_provider.dart';

class RegisterPage extends ConsumerStatefulWidget {
  const RegisterPage({super.key});

  @override
  ConsumerState<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends ConsumerState<RegisterPage> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _nickname = TextEditingController();

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _nickname.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    await ref.read(authProvider.notifier).register(
          email: _email.text.trim(),
          password: _password.text,
          nickname: _nickname.text.trim(),
        );
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

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('注册')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextFormField(
                  controller: _nickname,
                  decoration: const InputDecoration(labelText: '昵称'),
                  validator: (v) => (v == null || v.trim().isEmpty) ? '请输入昵称' : null,
                ),
                const SizedBox(height: 16),
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
                  decoration: const InputDecoration(labelText: '密码（至少 8 位，含字母+数字）'),
                  validator: (v) {
                    if (v == null || v.length < 8) return '至少 8 位';
                    if (!RegExp(r'[A-Za-z]').hasMatch(v) || !RegExp(r'\d').hasMatch(v)) {
                      return '需包含字母和数字';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: auth.isLoading ? null : _submit,
                  child: auth.isLoading
                      ? const SizedBox(
                          height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Text('注册'),
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
    if (code == 409) return '邮箱已被注册';
    if (code == 400) {
      final msg = e.response?.data is Map ? (e.response!.data as Map)['message'] : null;
      return msg is List ? msg.join('；') : (msg?.toString() ?? '请求格式错误');
    }
    return '网络错误，请稍后再试';
  }
  return e.toString();
}
