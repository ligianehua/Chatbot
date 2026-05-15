import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/dio_client.dart';

class IapProduct {
  IapProduct({
    required this.productId,
    required this.amountCents,
    required this.kind,
    required this.label,
  });

  factory IapProduct.fromJson(Map<String, dynamic> j) => IapProduct(
        productId: j['productId'] as String,
        amountCents: (j['amountCents'] as num).toInt(),
        kind: j['kind'] as String,
        label: j['label'] as String,
      );

  final String productId;
  final int amountCents;
  final String kind;
  final String label;
}

class RedeemResult {
  RedeemResult({required this.balanceCents, required this.idempotent});
  factory RedeemResult.fromJson(Map<String, dynamic> j) {
    final w = (j['wallet'] as Map).cast<String, dynamic>();
    return RedeemResult(
      balanceCents: (w['balanceCents'] as num).toInt(),
      idempotent: (j['idempotent'] as bool?) ?? false,
    );
  }
  final int balanceCents;
  final bool idempotent;
}

class IapApi {
  IapApi(this._dio);
  final Dio _dio;

  Future<List<IapProduct>> catalog() async {
    final res = await _dio.get<List<dynamic>>('/iap/products');
    return (res.data ?? [])
        .map((e) => IapProduct.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<RedeemResult> redeem({
    required String provider,
    required String productId,
    required String receipt,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/iap/redeem',
      data: {'provider': provider, 'productId': productId, 'receipt': receipt},
    );
    return RedeemResult.fromJson(res.data!);
  }
}

final iapApiProvider = Provider<IapApi>((ref) {
  return IapApi(ref.watch(dioProvider));
});

final iapCatalogProvider = FutureProvider.autoDispose<List<IapProduct>>((ref) async {
  return ref.watch(iapApiProvider).catalog();
});
