import 'package:flutter/material.dart';

class AppTheme {
  static final ColorScheme _lightScheme = ColorScheme.fromSeed(
    seedColor: const Color(0xFF4A6CF7),
    brightness: Brightness.light,
  );

  static final ColorScheme _darkScheme = ColorScheme.fromSeed(
    seedColor: const Color(0xFF4A6CF7),
    brightness: Brightness.dark,
  );

  static ThemeData get light => ThemeData(
        useMaterial3: true,
        colorScheme: _lightScheme,
        scaffoldBackgroundColor: _lightScheme.surface,
      );

  static ThemeData get dark => ThemeData(
        useMaterial3: true,
        colorScheme: _darkScheme,
        scaffoldBackgroundColor: _darkScheme.surface,
      );
}
