import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../models/contact.dart';
import '../models/message.dart';

class StorageService {
  static const String _contactsKey = 'contacts_v1';
  static const String _messagesKey = 'messages_v1';

  Future<List<Contact>> loadContacts() async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final String? raw = prefs.getString(_contactsKey);
    if (raw == null || raw.isEmpty) return <Contact>[];
    final List<dynamic> list = json.decode(raw) as List<dynamic>;
    return list
        .map((dynamic e) => Contact.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> saveContacts(List<Contact> contacts) async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final String encoded =
        json.encode(contacts.map((Contact c) => c.toJson()).toList());
    await prefs.setString(_contactsKey, encoded);
  }

  Future<List<Message>> loadMessages() async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final String? raw = prefs.getString(_messagesKey);
    if (raw == null || raw.isEmpty) return <Message>[];
    final List<dynamic> list = json.decode(raw) as List<dynamic>;
    return list
        .map((dynamic e) => Message.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> saveMessages(List<Message> messages) async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final String encoded =
        json.encode(messages.map((Message m) => m.toJson()).toList());
    await prefs.setString(_messagesKey, encoded);
  }
}
