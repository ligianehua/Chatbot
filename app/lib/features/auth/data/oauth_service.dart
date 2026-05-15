import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';

/// Thin wrapper around the platform SDKs that hands back a verified
/// identity token + optional display name (Apple only sends the name in
/// the first auth response, so we forward it to the backend).
class OAuthService {
  OAuthService(this._google);

  final GoogleSignIn _google;

  Future<({String idToken, String? nickname})?> signInWithApple() async {
    final credential = await SignInWithApple.getAppleIDCredential(
      scopes: const [
        AppleIDAuthorizationScopes.email,
        AppleIDAuthorizationScopes.fullName,
      ],
    );
    final token = credential.identityToken;
    if (token == null) return null;
    final first = credential.givenName ?? '';
    final last = credential.familyName ?? '';
    final fullName = ('$first $last').trim();
    return (idToken: token, nickname: fullName.isEmpty ? null : fullName);
  }

  Future<({String idToken, String? nickname})?> signInWithGoogle() async {
    final account = await _google.signIn();
    if (account == null) return null; // user cancelled
    final auth = await account.authentication;
    final token = auth.idToken;
    if (token == null) return null;
    return (idToken: token, nickname: account.displayName);
  }

  Future<void> signOutGoogle() async {
    try {
      await _google.signOut();
    } catch (_) {/* best-effort */}
  }
}

final oauthServiceProvider = Provider<OAuthService>((ref) {
  // Server-side check uses the audience in the token — `clientId` here is
  // optional on iOS/Android (resolved from native config) but required on web.
  final google = GoogleSignIn(scopes: const ['email', 'profile']);
  return OAuthService(google);
});
