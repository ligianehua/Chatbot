import 'dart:io' show Platform;
import 'dart:math';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../network/dio_client.dart';

const _deviceIdKey = 'device.id';

/// Bridges Firebase Messaging ↔ our `/users/me/devices` endpoint.
///
/// Flow:
///   1. main.dart calls [initFirebase] once at app start.
///   2. After the user is authenticated, [register] is invoked to:
///        - request notification permission (iOS),
///        - obtain or generate a stable per-install device id,
///        - fetch the current FCM token,
///        - POST to /users/me/devices,
///        - subscribe to token refresh and notification tap events.
///   3. Notification taps fire the [onMessageOpened] callback, where the
///      router can deep-link to the relevant conversation.
class PushSetup {
  PushSetup(this._ref, this._storage);

  final Ref _ref;
  final FlutterSecureStorage _storage;
  static bool _firebaseInitialized = false;

  void Function(RemoteMessage message)? onMessageOpened;
  void Function(RemoteMessage message)? onForegroundMessage;

  static Future<void> initFirebase() async {
    if (_firebaseInitialized) return;
    // The default options come from native config files (google-services.json
    // / GoogleService-Info.plist). On platforms without firebase configured,
    // this throws — we let the caller catch and degrade gracefully.
    await Firebase.initializeApp();
    _firebaseInitialized = true;
  }

  Future<void> register() async {
    if (!_firebaseInitialized) {
      debugPrint('PushSetup: Firebase not initialized; skipping');
      return;
    }
    if (kIsWeb) return;
    final messaging = FirebaseMessaging.instance;

    // iOS prompts; Android grants by default but Android 13+ requires runtime permission.
    final settings = await messaging.requestPermission(
      alert: true, badge: true, sound: true,
    );
    if (settings.authorizationStatus != AuthorizationStatus.authorized &&
        settings.authorizationStatus != AuthorizationStatus.provisional) {
      debugPrint('PushSetup: user denied notification permission');
      return;
    }

    final token = await messaging.getToken();
    if (token == null) {
      debugPrint('PushSetup: getToken returned null');
      return;
    }

    final deviceId = await _stableDeviceId();
    await _postDevice(deviceId: deviceId, pushToken: token);

    messaging.onTokenRefresh.listen((newToken) async {
      try { await _postDevice(deviceId: deviceId, pushToken: newToken); }
      catch (e) { debugPrint('PushSetup: token refresh post failed: $e'); }
    });

    FirebaseMessaging.onMessage.listen((msg) {
      onForegroundMessage?.call(msg);
    });
    FirebaseMessaging.onMessageOpenedApp.listen((msg) {
      onMessageOpened?.call(msg);
    });
    // App launched from a tap while terminated.
    final initial = await messaging.getInitialMessage();
    if (initial != null) onMessageOpened?.call(initial);
  }

  Future<void> _postDevice({required String deviceId, required String pushToken}) async {
    final dio = _ref.read(dioProvider);
    final platform = Platform.isIOS || Platform.isMacOS
        ? 'ios'
        : Platform.isAndroid
            ? 'android'
            : 'web';
    await dio.post<void>('/users/me/devices', data: {
      'deviceId': deviceId,
      'platform': platform,
      'pushToken': pushToken,
    });
  }

  Future<String> _stableDeviceId() async {
    final existing = await _storage.read(key: _deviceIdKey);
    if (existing != null && existing.isNotEmpty) return existing;
    final id = _newDeviceId();
    await _storage.write(key: _deviceIdKey, value: id);
    return id;
  }

  String _newDeviceId() {
    final r = Random.secure();
    return List.generate(24, (_) => r.nextInt(16).toRadixString(16)).join();
  }
}

final pushSetupProvider = Provider<PushSetup>((ref) {
  return PushSetup(ref, const FlutterSecureStorage());
});
