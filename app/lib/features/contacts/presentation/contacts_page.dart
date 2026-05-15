import 'package:flutter/material.dart';

class ContactsPage extends StatelessWidget {
  const ContactsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('通讯录')),
      body: const Center(child: Text('Contacts Page (TODO 阶段 1)')),
    );
  }
}
