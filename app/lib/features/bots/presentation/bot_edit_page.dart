import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../data/bot_models.dart';
import '../data/bots_api.dart';

class BotEditPage extends ConsumerStatefulWidget {
  const BotEditPage({super.key});

  @override
  ConsumerState<BotEditPage> createState() => _BotEditPageState();
}

class _BotEditPageState extends ConsumerState<BotEditPage> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _occupation = TextEditingController();
  final _age = TextEditingController();
  final _bio = TextEditingController();
  final _systemPrompt = TextEditingController();
  final _welcomeMsg = TextEditingController();
  BotGender? _gender;
  double _temperature = 0.7;
  bool _submitting = false;

  @override
  void dispose() {
    _name.dispose();
    _occupation.dispose();
    _age.dispose();
    _bio.dispose();
    _systemPrompt.dispose();
    _welcomeMsg.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _submitting = true);
    try {
      final created = await ref.read(botsApiProvider).create(CreateBotInput(
            name: _name.text.trim(),
            gender: _gender,
            age: _age.text.isEmpty ? null : int.tryParse(_age.text),
            occupation: _occupation.text.trim(),
            bio: _bio.text.trim(),
            systemPrompt: _systemPrompt.text.trim(),
            temperature: _temperature,
            welcomeMsg: _welcomeMsg.text.trim(),
          ));
      ref.invalidate(myBotsProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('已创建：${created.name}')));
      context.pop();
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
    return Scaffold(
      appBar: AppBar(title: const Text('新建 Bot')),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              TextFormField(
                controller: _name,
                decoration: const InputDecoration(labelText: '姓名 *', helperText: '如：小助手、Lily'),
                validator: (v) => (v == null || v.trim().isEmpty) ? '请输入姓名' : null,
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: DropdownButtonFormField<BotGender>(
                      value: _gender,
                      decoration: const InputDecoration(labelText: '性别'),
                      items: const [
                        DropdownMenuItem(value: BotGender.male, child: Text('男')),
                        DropdownMenuItem(value: BotGender.female, child: Text('女')),
                        DropdownMenuItem(value: BotGender.other, child: Text('其他')),
                      ],
                      onChanged: (v) => setState(() => _gender = v),
                    ),
                  ),
                  const SizedBox(width: 12),
                  SizedBox(
                    width: 100,
                    child: TextFormField(
                      controller: _age,
                      decoration: const InputDecoration(labelText: '年龄'),
                      keyboardType: TextInputType.number,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _occupation,
                decoration: const InputDecoration(labelText: '职位 / 角色', helperText: '如：心理咨询师、英语老师'),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _bio,
                maxLines: 2,
                decoration: const InputDecoration(labelText: '简介', helperText: '展示给好友看的一句话介绍'),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _systemPrompt,
                maxLines: 6,
                decoration: const InputDecoration(
                  labelText: '人设 / System Prompt *',
                  helperText: '告诉 Bot 它是谁、怎么说话、能做什么',
                  alignLabelWithHint: true,
                ),
                validator: (v) {
                  if (v == null || v.trim().length < 10) return '至少 10 字';
                  return null;
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _welcomeMsg,
                decoration: const InputDecoration(
                  labelText: '开场白',
                  helperText: '用户第一次打开聊天时 Bot 会说的话',
                ),
              ),
              const SizedBox(height: 16),
              Text('Temperature: ${_temperature.toStringAsFixed(1)}'),
              Slider(
                value: _temperature,
                min: 0,
                max: 2,
                divisions: 20,
                label: _temperature.toStringAsFixed(1),
                onChanged: (v) => setState(() => _temperature = v),
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _submitting ? null : _submit,
                child: _submitting
                    ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Text('创建'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
