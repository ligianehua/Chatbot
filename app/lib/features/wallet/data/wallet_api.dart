import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/dio_client.dart';

class WalletBalance {
  WalletBalance({required this.balanceCents, required this.currency});
  factory WalletBalance.fromJson(Map<String, dynamic> j) => WalletBalance(
        balanceCents: (j['balanceCents'] as num).toInt(),
        currency: j['currency'] as String,
      );
  final int balanceCents;
  final String currency;
  String get label {
    final amount = (balanceCents / 100).toStringAsFixed(2);
    final sign = currency == 'CNY' ? '¥' : (currency == 'USD' ? '\$' : '');
    return '$sign$amount';
  }
}

class WalletTxn {
  WalletTxn({
    required this.id,
    required this.type,
    required this.amountCents,
    required this.currency,
    required this.status,
    required this.createdAt,
    this.relatedId,
  });
  factory WalletTxn.fromJson(Map<String, dynamic> j) => WalletTxn(
        id: j['id'] as String,
        type: j['type'] as String,
        amountCents: (j['amountCents'] as num).toInt(),
        currency: j['currency'] as String,
        status: j['status'] as String,
        relatedId: j['relatedId'] as String?,
        createdAt: DateTime.parse(j['createdAt'] as String),
      );
  final String id;
  final String type; // recharge | consume | withdraw | income | refund
  final int amountCents;
  final String currency;
  final String status;
  final String? relatedId;
  final DateTime createdAt;

  String get sign {
    if (type == 'recharge' || type == 'income' || type == 'refund') return '+';
    return '−';
  }

  String get label {
    final amount = (amountCents / 100).toStringAsFixed(2);
    final c = currency == 'CNY' ? '¥' : (currency == 'USD' ? '\$' : '');
    return '$sign$c$amount';
  }

  String get typeLabel {
    switch (type) {
      case 'recharge':
        return '充值';
      case 'consume':
        return '消费';
      case 'income':
        return '收入';
      case 'withdraw':
        return '提现';
      case 'refund':
        return '退款';
      default:
        return type;
    }
  }
}

class WalletApi {
  WalletApi(this._dio);
  final Dio _dio;

  Future<WalletBalance> balance() async {
    final res = await _dio.get<Map<String, dynamic>>('/wallet');
    return WalletBalance.fromJson(res.data!);
  }

  Future<List<WalletTxn>> transactions({int limit = 50}) async {
    final res = await _dio.get<List<dynamic>>('/wallet/transactions',
        queryParameters: {'limit': limit});
    return (res.data ?? [])
        .map((e) => WalletTxn.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  /// Dev-only. Production replaces with IAP receipt verification.
  Future<void> recharge(int amountCents) async {
    await _dio.post<void>('/wallet/recharge', data: {'amountCents': amountCents});
  }
}

final walletApiProvider = Provider<WalletApi>((ref) {
  return WalletApi(ref.watch(dioProvider));
});

final walletBalanceProvider = FutureProvider.autoDispose<WalletBalance>((ref) async {
  return ref.watch(walletApiProvider).balance();
});

final walletTransactionsProvider =
    FutureProvider.autoDispose<List<WalletTxn>>((ref) async {
  return ref.watch(walletApiProvider).transactions();
});
