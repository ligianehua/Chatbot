import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/dio_client.dart';

class LegalDoc {
  LegalDoc({required this.version, required this.title, required this.body});

  factory LegalDoc.fromJson(Map<String, dynamic> json) {
    return LegalDoc(
      version: json['version'] as String,
      title: json['title'] as String,
      body: json['body'] as String,
    );
  }

  final String version;
  final String title;
  final String body;
}

class LegalApi {
  LegalApi(this._dio);
  final Dio _dio;

  Future<LegalDoc> privacy() async {
    final res = await _dio.get<Map<String, dynamic>>('/legal/privacy');
    return LegalDoc.fromJson(res.data!);
  }

  Future<LegalDoc> terms() async {
    final res = await _dio.get<Map<String, dynamic>>('/legal/terms');
    return LegalDoc.fromJson(res.data!);
  }
}

final legalApiProvider = Provider<LegalApi>((ref) {
  return LegalApi(ref.watch(dioProvider));
});

final privacyDocProvider = FutureProvider.autoDispose<LegalDoc>(
  (ref) => ref.watch(legalApiProvider).privacy(),
);

final termsDocProvider = FutureProvider.autoDispose<LegalDoc>(
  (ref) => ref.watch(legalApiProvider).terms(),
);
