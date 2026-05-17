import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';

import '../models/contact.dart';
import '../models/message.dart';
import '../services/storage_service.dart';

class MessagesProvider extends ChangeNotifier {
  MessagesProvider(this._storage);

  final StorageService _storage;
  static const Uuid _uuid = Uuid();
  final Random _rng = Random();

  final List<Message> _messages = <Message>[];
  final Set<String> _typing = <String>{};
  bool _loaded = false;

  bool get loaded => _loaded;

  List<Message> messagesFor(String contactId) {
    final List<Message> list = _messages
        .where((Message m) => m.contactId == contactId)
        .toList()
      ..sort((Message a, Message b) => a.timestamp.compareTo(b.timestamp));
    return list;
  }

  Message? lastMessageFor(String contactId) {
    Message? latest;
    for (final Message m in _messages) {
      if (m.contactId != contactId) continue;
      if (latest == null || m.timestamp.isAfter(latest.timestamp)) {
        latest = m;
      }
    }
    return latest;
  }

  bool isTyping(String contactId) => _typing.contains(contactId);

  Future<void> load() async {
    if (_loaded) return;
    _messages.addAll(await _storage.loadMessages());
    _loaded = true;
    notifyListeners();
  }

  Future<void> sendMessage(Contact contact, String text) async {
    final String trimmed = text.trim();
    if (trimmed.isEmpty) return;

    _messages.add(Message(
      id: _uuid.v4(),
      contactId: contact.id,
      text: trimmed,
      isUser: true,
    ));
    await _storage.saveMessages(_messages);
    notifyListeners();

    if (contact.type != ContactType.bot) {
      // 真人联系人:不自动回复,等后端 / 真人输入
      return;
    }

    _typing.add(contact.id);
    notifyListeners();

    await Future<void>.delayed(const Duration(milliseconds: 800));

    final String reply = _generateBotReply(contact, trimmed);
    _messages.add(Message(
      id: _uuid.v4(),
      contactId: contact.id,
      text: reply,
      isUser: false,
    ));
    _typing.remove(contact.id);
    await _storage.saveMessages(_messages);
    notifyListeners();
  }

  Future<void> clearMessagesFor(String contactId) async {
    _messages.removeWhere((Message m) => m.contactId == contactId);
    _typing.remove(contactId);
    await _storage.saveMessages(_messages);
    notifyListeners();
  }

  // 接入真实 LLM API 时,只需替换这一个方法的实现。
  // 把 contact.systemPrompt + 历史 messagesFor(contact.id) 一起发给 API。
  String _generateBotReply(Contact bot, String userText) {
    final String lower = userText.toLowerCase();

    if (bot.name.contains('代码') ||
        bot.name.toLowerCase().contains('code') ||
        bot.name.toLowerCase().contains('dev')) {
      if (lower.contains('bug') || lower.contains('错误') || lower.contains('报错')) {
        return '把报错信息和相关代码贴出来,我帮你看看哪里出问题了。';
      }
      if (lower.contains('flutter')) {
        return 'Flutter 的问题尽管问。常见坑:setState 在异步后忘了 mounted 检查、'
            'ListView 嵌 Column 没加 Expanded 之类的。';
      }
      return '代码问题尽管问,我会帮你 review 或一起 debug。';
    }

    if (bot.name.contains('段子') || bot.name.contains('笑')) {
      const List<String> jokes = <String>[
        '为什么程序员讨厌大自然?因为有太多 bug。',
        '老板说前端要"动感"一点,我把 var 全改成了 dynamic。',
        '产品经理:这个需求很简单。程序员:简单你来做。产品经理:我不会。',
        '调试的最高境界是:加一行 print,bug 没了;删掉 print,bug 又回来了。',
        'Java 程序员去相亲,女方问他做什么的,他说做 Java 的。女方说:那你应该叫贾娃。',
      ];
      return jokes[_rng.nextInt(jokes.length)];
    }

    if (lower.contains('你好') || lower.contains('hi') || lower.contains('hello')) {
      return '你好!我是 ${bot.name},有什么可以帮你的?';
    }
    if (lower.contains('时间') || lower.contains('几点')) {
      final DateTime now = DateTime.now();
      return '现在是 ${now.hour.toString().padLeft(2, '0')}:'
          '${now.minute.toString().padLeft(2, '0')}。';
    }
    if (lower.contains('谢谢') || lower.contains('thanks')) {
      return '不客气~';
    }

    const List<String> fallback = <String>[
      '收到!这是一个 mock 回复,后续接 API 后会换成真实回答。',
      '有意思,能再多说一点吗?',
      '好的,我记下了。',
      '我正在思考中…(占位回复)',
    ];
    return fallback[_rng.nextInt(fallback.length)];
  }
}
