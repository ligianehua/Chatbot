import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/config/api_config.dart';
import '../../../core/network/dio_client.dart';

class UploadedImage {
  UploadedImage({required this.url, required this.mime, required this.size});

  factory UploadedImage.fromJson(Map<String, dynamic> json) {
    return UploadedImage(
      url: json['url'] as String,
      mime: json['mime'] as String,
      size: (json['size'] as num).toInt(),
    );
  }

  final String url; // server-relative (e.g. /uploads/...) — resolve via [absoluteUrl]
  final String mime;
  final int size;

  String get absoluteUrl {
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    final base = ApiConfig.baseUrl;
    final originEnd = base.indexOf('/api/');
    final origin = originEnd > 0 ? base.substring(0, originEnd) : base;
    return '$origin$url';
  }
}

class UploadsApi {
  UploadsApi(this._dio);
  final Dio _dio;

  Future<UploadedImage> uploadImage(File file) async {
    final form = FormData.fromMap({
      'file': await MultipartFile.fromFile(file.path),
    });
    final res = await _dio.post<Map<String, dynamic>>('/uploads/image', data: form);
    return UploadedImage.fromJson(res.data!);
  }
}

final uploadsApiProvider = Provider<UploadsApi>((ref) {
  return UploadsApi(ref.watch(dioProvider));
});
