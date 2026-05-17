import 'package:flutter/material.dart';

import '../models/contact.dart';

class ContactAvatar extends StatelessWidget {
  const ContactAvatar({super.key, required this.contact, this.size = 40});

  final Contact contact;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: contact.avatarColor,
        shape: BoxShape.circle,
      ),
      alignment: Alignment.center,
      child: Text(
        contact.emoji,
        style: TextStyle(fontSize: size * 0.55),
      ),
    );
  }
}
