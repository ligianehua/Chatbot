import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/contacts_provider.dart';

class AddContactScreen extends StatefulWidget {
  const AddContactScreen({super.key});

  @override
  State<AddContactScreen> createState() => _AddContactScreenState();
}

class _AddContactScreenState extends State<AddContactScreen> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _descController = TextEditingController();
  final TextEditingController _promptController = TextEditingController();
  String _emoji = '🤖';
  int _colorValue = 0xFF5B8DEF;
  bool _showAdvanced = false;
  bool _saving = false;

  static const List<String> _emojiPool = <String>[
    '🤖', '🧠', '👨‍💻', '👩‍🎨', '🦄', '😄', '🐱', '🐶',
    '🐼', '🐯', '🦊', '🐸', '👻', '🌟', '🌈', '🎨',
    '☕', '📚', '🎮', '🎵', '⚽', '🍜',
  ];

  static const List<int> _colorPool = <int>[
    0xFF5B8DEF, 0xFF34C759, 0xFFFF9500, 0xFFFF3B30,
    0xFFAF52DE, 0xFF00C7BE, 0xFFFFCC00, 0xFFFF2D55,
  ];

  @override
  void dispose() {
    _nameController.dispose();
    _descController.dispose();
    _promptController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_saving) return;
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      await context.read<ContactsProvider>().addBot(
            name: _nameController.text.trim(),
            emoji: _emoji,
            avatarColorValue: _colorValue,
            description: _descController.text.trim().isEmpty
                ? null
                : _descController.text.trim(),
            systemPrompt: _promptController.text.trim().isEmpty
                ? null
                : _promptController.text.trim(),
          );
      if (mounted) Navigator.pop(context);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ColorScheme scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        title: const Text('添加好友'),
        actions: <Widget>[
          TextButton(
            onPressed: _saving ? null : _save,
            child: const Text('完成'),
          ),
        ],
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: <Widget>[
            Center(
              child: Container(
                width: 88,
                height: 88,
                decoration: BoxDecoration(
                  color: Color(_colorValue),
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: Text(_emoji, style: const TextStyle(fontSize: 44)),
              ),
            ),
            const SizedBox(height: 24),
            TextFormField(
              controller: _nameController,
              textInputAction: TextInputAction.next,
              decoration: const InputDecoration(
                labelText: '名字 *',
                border: OutlineInputBorder(),
              ),
              validator: (String? v) =>
                  (v == null || v.trim().isEmpty) ? '请输入名字' : null,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _descController,
              maxLines: 2,
              decoration: const InputDecoration(
                labelText: '简介(可选)',
                hintText: '比如:擅长 Flutter 开发的 AI 助手',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 24),
            Text(
              '表情',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: scheme.outline,
              ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _emojiPool.map((String e) {
                final bool selected = _emoji == e;
                return GestureDetector(
                  onTap: () => setState(() => _emoji = e),
                  child: Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      border: Border.all(
                        color: selected ? scheme.primary : Colors.transparent,
                        width: 2,
                      ),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    alignment: Alignment.center,
                    child: Text(e, style: const TextStyle(fontSize: 24)),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 16),
            Text(
              '颜色',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: scheme.outline,
              ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: _colorPool.map((int c) {
                final bool selected = _colorValue == c;
                return GestureDetector(
                  onTap: () => setState(() => _colorValue = c),
                  child: Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: Color(c),
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: selected ? scheme.primary : Colors.transparent,
                        width: 3,
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 24),
            TextButton.icon(
              onPressed: () =>
                  setState(() => _showAdvanced = !_showAdvanced),
              icon: Icon(
                _showAdvanced ? Icons.expand_less : Icons.expand_more,
              ),
              label: const Text('高级设置(人设 / System Prompt)'),
            ),
            if (_showAdvanced) ...<Widget>[
              const SizedBox(height: 8),
              TextFormField(
                controller: _promptController,
                maxLines: 5,
                decoration: const InputDecoration(
                  labelText: 'System Prompt',
                  hintText: '后续接 API 后会作为人设传给模型,\n'
                      '比如:你是一个友好的 Flutter 助手,回答时给出代码示例。',
                  border: OutlineInputBorder(),
                ),
              ),
            ],
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}
