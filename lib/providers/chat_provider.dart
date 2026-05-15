import 'dart:math';

import 'package:flutter/foundation.dart';

import '../models/message.dart';

class ChatProvider extends ChangeNotifier {
  final List<Message> _messages = <Message>[];
  bool _isTyping = false;

  static const List<String> _fallbackReplies = <String>[
    '收到!这是一个 mock 回复,后续会接入真实模型。',
    '我正在思考中…(这里是占位回复)',
    '有意思,能再多说一点吗?',
    '好的,我记下了。',
    '这是一个示例响应,等接入 API 后会换成真实回答。',
  ];

  List<Message> get messages => List<Message>.unmodifiable(_messages);
  bool get isTyping => _isTyping;

  Future<void> sendMessage(String text) async {
    final String trimmed = text.trim();
    if (trimmed.isEmpty) {
      return;
    }

    _messages.add(Message(text: trimmed, isUser: true));
    _isTyping = true;
    notifyListeners();

    await Future<void>.delayed(const Duration(milliseconds: 800));

    final String reply = await _generateReply(trimmed);
    _messages.add(Message(text: reply, isUser: false));
    _isTyping = false;
    notifyListeners();
  }

  void clear() {
    _messages.clear();
    _isTyping = false;
    notifyListeners();
  }

  // 接入真实 LLM API 时,只需替换这一个方法的实现。
  Future<String> _generateReply(String userText) async {
    final String lower = userText.toLowerCase();
    if (lower.contains('你好') || lower.contains('hi') || lower.contains('hello')) {
      return '你好!我是 Chatbot,有什么可以帮你的?';
    }
    if (lower.contains('时间') || lower.contains('几点')) {
      final DateTime now = DateTime.now();
      return '现在是 ${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}。';
    }
    if (lower.contains('谢谢') || lower.contains('thanks')) {
      return '不客气~';
    }
    final Random rng = Random();
    return _fallbackReplies[rng.nextInt(_fallbackReplies.length)];
  }
}
