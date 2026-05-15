import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/push/push_setup.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/presentation/auth_provider.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Firebase init must happen before any FirebaseMessaging call. We swallow
  // failures so the app still runs on environments without a Firebase config
  // (e.g. local dev with no google-services files yet).
  try {
    await PushSetup.initFirebase();
  } catch (e) {
    debugPrint('Firebase init skipped: $e');
  }
  runApp(const ProviderScope(child: ChatbotApp()));
}

class ChatbotApp extends ConsumerWidget {
  const ChatbotApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);

    // Register for push whenever the user becomes authenticated. The push
    // setup is idempotent so re-runs are cheap if the auth notifier replays
    // the same user.
    ref.listen<AsyncValue<AuthState>>(authProvider, (prev, next) {
      final wasAuthed = prev?.valueOrNull?.isAuthenticated ?? false;
      final isAuthed = next.valueOrNull?.isAuthenticated ?? false;
      if (!wasAuthed && isAuthed) {
        ref.read(pushSetupProvider).register().catchError((e) {
          debugPrint('push register failed: $e');
        });
      }
    });

    return MaterialApp.router(
      title: 'Chatbot',
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: ThemeMode.system,
      routerConfig: router,
      debugShowCheckedModeBanner: false,
    );
  }
}
