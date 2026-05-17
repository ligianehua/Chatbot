import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';

import '../models/contact.dart';
import '../services/storage_service.dart';

class ContactsProvider extends ChangeNotifier {
  ContactsProvider(this._storage);

  final StorageService _storage;
  static const Uuid _uuid = Uuid();

  final List<Contact> _contacts = <Contact>[];
  bool _loaded = false;

  List<Contact> get contacts => List<Contact>.unmodifiable(_contacts);
  bool get loaded => _loaded;

  Future<void> load() async {
    if (_loaded) return;
    final List<Contact> stored = await _storage.loadContacts();
    if (stored.isEmpty) {
      _contacts.addAll(_seedContacts());
      await _storage.saveContacts(_contacts);
    } else {
      _contacts.addAll(stored);
    }
    _loaded = true;
    notifyListeners();
  }

  Contact? findById(String id) {
    for (final Contact c in _contacts) {
      if (c.id == id) return c;
    }
    return null;
  }

  Future<Contact> addBot({
    required String name,
    required String emoji,
    required int avatarColorValue,
    String? description,
    String? systemPrompt,
  }) async {
    final Contact contact = Contact(
      id: _uuid.v4(),
      type: ContactType.bot,
      name: name,
      emoji: emoji,
      avatarColorValue: avatarColorValue,
      description: description,
      systemPrompt: systemPrompt,
      createdAt: DateTime.now(),
    );
    _contacts.add(contact);
    await _storage.saveContacts(_contacts);
    notifyListeners();
    return contact;
  }

  Future<void> updateContact(Contact contact) async {
    final int idx = _contacts.indexWhere((Contact c) => c.id == contact.id);
    if (idx == -1) return;
    _contacts[idx] = contact;
    await _storage.saveContacts(_contacts);
    notifyListeners();
  }

  Future<void> removeContact(String id) async {
    _contacts.removeWhere((Contact c) => c.id == id);
    await _storage.saveContacts(_contacts);
    notifyListeners();
  }

  List<Contact> _seedContacts() {
    final DateTime now = DateTime.now();
    return <Contact>[
      Contact(
        id: _uuid.v4(),
        type: ContactType.bot,
        name: 'Claude 助手',
        emoji: '🤖',
        avatarColorValue: 0xFF5B8DEF,
        description: '全能型 AI 助手,擅长解答各种问题',
        systemPrompt: '你是一个友好、专业的助手,回答清晰、准确、友善。',
        createdAt: now,
      ),
      Contact(
        id: _uuid.v4(),
        type: ContactType.bot,
        name: '代码导师',
        emoji: '👨‍💻',
        avatarColorValue: 0xFF34C759,
        description: '编程辅导,代码 review,debug 帮手',
        systemPrompt: '你是一名资深程序员导师,擅长 Flutter、Python、JavaScript,'
            '回答时给出代码示例并说明思路。',
        createdAt: now,
      ),
      Contact(
        id: _uuid.v4(),
        type: ContactType.bot,
        name: '段子手',
        emoji: '😄',
        avatarColorValue: 0xFFFF9500,
        description: '讲笑话陪聊,放松心情',
        systemPrompt: '你是一个幽默风趣的朋友,经常用程序员段子和日常段子让人开心。',
        createdAt: now,
      ),
    ];
  }
}
