import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/presentation/auth_provider.dart';
import '../../features/auth/presentation/forgot_password_page.dart';
import '../../features/auth/presentation/login_page.dart';
import '../../features/auth/presentation/register_page.dart';
import '../../features/bots/presentation/bot_edit_page.dart';
import '../../features/bots/presentation/bots_page.dart';
import '../../features/chat/presentation/chat_detail_page.dart';
import '../../features/chat/presentation/chats_page.dart';
import '../../features/groups/presentation/group_create_page.dart';
import '../../features/groups/presentation/group_info_page.dart';
import '../../features/contacts/presentation/add_friend_page.dart';
import '../../features/contacts/presentation/contacts_page.dart';
import '../../features/contacts/presentation/friend_requests_page.dart';
import '../../features/settings/presentation/delete_account_page.dart';
import '../../features/settings/presentation/legal_page.dart';
import '../../features/settings/presentation/settings_page.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final authStream = ref.watch(authProvider);
  final isAuthed = authStream.valueOrNull?.isAuthenticated ?? false;

  return GoRouter(
    initialLocation: '/chats',
    refreshListenable: _AuthListenable(ref),
    redirect: (context, state) {
      final loc = state.matchedLocation;
      const authPaths = {'/login', '/register', '/forgot-password'};
      // Legal pages must be reachable without login (App Store reviewer).
      final isPublic = authPaths.contains(loc) || loc.startsWith('/legal/');
      if (!isAuthed && !isPublic) return '/login';
      if (isAuthed && authPaths.contains(loc)) return '/chats';
      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (_, __) => const LoginPage()),
      GoRoute(path: '/register', builder: (_, __) => const RegisterPage()),
      GoRoute(path: '/forgot-password', builder: (_, __) => const ForgotPasswordPage()),
      GoRoute(path: '/contacts/add', builder: (_, __) => const AddFriendPage()),
      GoRoute(path: '/contacts/requests', builder: (_, __) => const FriendRequestsPage()),
      GoRoute(path: '/bots/new', builder: (_, __) => const BotEditPage()),
      GoRoute(path: '/groups/new', builder: (_, __) => const GroupCreatePage()),
      GoRoute(
        path: '/groups/:id',
        builder: (_, state) => GroupInfoPage(groupId: state.pathParameters['id']!),
      ),
      GoRoute(path: '/legal/privacy', builder: (_, __) => const LegalPage(kind: 'privacy')),
      GoRoute(path: '/legal/terms', builder: (_, __) => const LegalPage(kind: 'terms')),
      GoRoute(path: '/settings/delete-account', builder: (_, __) => const DeleteAccountPage()),
      GoRoute(
        path: '/chat/:id',
        builder: (_, state) => ChatDetailPage(
          conversationId: state.pathParameters['id']!,
          title: state.uri.queryParameters['title'],
          type: state.uri.queryParameters['type'],
          peerId: state.uri.queryParameters['peerId'],
        ),
      ),
      ShellRoute(
        builder: (context, state, child) => MainShell(child: child),
        routes: [
          GoRoute(path: '/chats', builder: (_, __) => const ChatsPage()),
          GoRoute(path: '/contacts', builder: (_, __) => const ContactsPage()),
          GoRoute(path: '/bots', builder: (_, __) => const BotsPage()),
          GoRoute(path: '/settings', builder: (_, __) => const SettingsPage()),
        ],
      ),
    ],
  );
});

class _AuthListenable extends ChangeNotifier {
  _AuthListenable(this._ref) {
    _ref.listen(authProvider, (_, __) => notifyListeners());
  }
  final Ref _ref;
}

class MainShell extends StatelessWidget {
  const MainShell({super.key, required this.child});

  final Widget child;

  static const _tabs = <_TabDef>[
    _TabDef('/chats', Icons.chat_bubble_outline, '消息'),
    _TabDef('/contacts', Icons.people_outline, '通讯录'),
    _TabDef('/bots', Icons.smart_toy_outlined, 'Bot'),
    _TabDef('/settings', Icons.settings_outlined, '我'),
  ];

  int _indexFor(String location) {
    for (var i = 0; i < _tabs.length; i++) {
      if (location.startsWith(_tabs[i].path)) return i;
    }
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).uri.toString();
    final index = _indexFor(location);

    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (i) => context.go(_tabs[i].path),
        destinations: [
          for (final t in _tabs) NavigationDestination(icon: Icon(t.icon), label: t.label),
        ],
      ),
    );
  }
}

class _TabDef {
  const _TabDef(this.path, this.icon, this.label);
  final String path;
  final IconData icon;
  final String label;
}
