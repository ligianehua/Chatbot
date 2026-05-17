import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'providers/contacts_provider.dart';
import 'providers/messages_provider.dart';
import 'screens/home_screen.dart';
import 'services/storage_service.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  final StorageService storage = StorageService();
  runApp(ChatbotApp(storage: storage));
}

class ChatbotApp extends StatelessWidget {
  const ChatbotApp({super.key, required this.storage});

  final StorageService storage;

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider<ContactsProvider>(
          create: (_) => ContactsProvider(storage)..load(),
        ),
        ChangeNotifierProvider<MessagesProvider>(
          create: (_) => MessagesProvider(storage)..load(),
        ),
      ],
      child: MaterialApp(
        title: 'Chatbot',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          useMaterial3: true,
          colorScheme: ColorScheme.fromSeed(seedColor: Colors.blue),
        ),
        home: const HomeScreen(),
      ),
    );
  }
}
