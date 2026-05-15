class ApiConfig {
  // Override at build time:
  //   flutter run --dart-define=API_BASE_URL=https://api.example.com/api/v1
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:3000/api/v1', // Android emulator → host
  );
}
