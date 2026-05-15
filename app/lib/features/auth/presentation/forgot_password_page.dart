import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/auth_api.dart';

class ForgotPasswordPage extends ConsumerStatefulWidget {
  const ForgotPasswordPage({super.key});

  @override
  ConsumerState<ForgotPasswordPage> createState() => _ForgotPasswordPageState();
}

class _ForgotPasswordPageState extends ConsumerState<ForgotPasswordPage> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  bool _sending = false;
  String? _devToken;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _sending = true);
    try {
      final token = await ref.read(authApiProvider).forgotPassword(_email.text.trim());
      setState(() => _devToken = token);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('如果该邮箱已注册，已发送重置链接')),
      );
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('忘记密码')),
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
                  decoration: const InputDecoration(labelText: '注册邮箱'),
                  validator: (v) => (v == null || !v.contains('@')) ? '请输入有效邮箱' : null,
                ),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: _sending ? null : _submit,
                  child: _sending
                      ? const SizedBox(
                          height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Text('发送重置链接'),
                ),
                if (_devToken != null) ...[
                  const SizedBox(height: 24),
                  const Text(
                    'DEV-only token (邮件服务未配置时返回)：',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                  SelectableText(_devToken!),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
