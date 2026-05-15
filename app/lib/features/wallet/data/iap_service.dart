import 'dart:async';
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:in_app_purchase/in_app_purchase.dart';

import 'iap_api.dart';

/// Bridges the platform `in_app_purchase` plugin and our backend
/// `/iap/redeem` endpoint.
///
/// Lifecycle:
///   1. The wallet page calls [refreshProducts] to fetch ProductDetails
///      using the catalog IDs the backend advertises.
///   2. User taps a buy button → [buy] kicks off the native purchase UI.
///   3. The plugin's purchaseStream emits PurchaseDetails — we forward
///      the verification data to the backend, then call completePurchase.
///   4. A successful redemption pushes a new value to [redeemed] so the
///      wallet page can refresh its balance + transaction history.
class IapPurchaseService {
  IapPurchaseService(this._iap, this._api);

  final InAppPurchase _iap;
  final IapApi _api;

  StreamSubscription<List<PurchaseDetails>>? _sub;
  final _redeemed = StreamController<int>.broadcast(); // emits new balanceCents
  final _errors = StreamController<String>.broadcast();

  Stream<int> get redeemed => _redeemed.stream;
  Stream<String> get errors => _errors.stream;

  bool _started = false;
  bool _available = false;

  Future<bool> start() async {
    if (_started) return _available;
    _started = true;
    _available = await _iap.isAvailable();
    if (!_available) return false;
    _sub = _iap.purchaseStream.listen(_onPurchases, onError: (e) {
      _errors.add('purchase stream: $e');
    });
    return true;
  }

  Future<List<ProductDetails>> queryProducts(Set<String> productIds) async {
    if (!_available) return const [];
    final response = await _iap.queryProductDetails(productIds);
    if (response.notFoundIDs.isNotEmpty) {
      debugPrint('iap: products not found on store: ${response.notFoundIDs}');
    }
    return response.productDetails;
  }

  Future<void> buy(ProductDetails product) async {
    if (!_available) {
      _errors.add('在线商店不可用');
      return;
    }
    final param = PurchaseParam(productDetails: product);
    await _iap.buyConsumable(purchaseParam: param);
  }

  Future<void> _onPurchases(List<PurchaseDetails> purchases) async {
    for (final p in purchases) {
      switch (p.status) {
        case PurchaseStatus.purchased:
        case PurchaseStatus.restored:
          await _verifyAndCredit(p);
          break;
        case PurchaseStatus.error:
          _errors.add(p.error?.message ?? '购买失败');
          break;
        case PurchaseStatus.canceled:
          // User cancelled — silent.
          break;
        case PurchaseStatus.pending:
          // Awaiting parental approval / SCA — just wait.
          break;
      }
      if (p.pendingCompletePurchase) {
        await _iap.completePurchase(p);
      }
    }
  }

  Future<void> _verifyAndCredit(PurchaseDetails p) async {
    final provider = Platform.isIOS || Platform.isMacOS ? 'apple' : 'google';
    try {
      final result = await _api.redeem(
        provider: provider,
        productId: p.productID,
        receipt: p.verificationData.serverVerificationData,
      );
      _redeemed.add(result.balanceCents);
    } catch (e) {
      _errors.add('校验失败：$e');
    }
  }

  Future<void> dispose() async {
    await _sub?.cancel();
    await _redeemed.close();
    await _errors.close();
  }
}

final iapServiceProvider = Provider<IapPurchaseService>((ref) {
  final svc = IapPurchaseService(InAppPurchase.instance, ref.watch(iapApiProvider));
  ref.onDispose(() => svc.dispose());
  return svc;
});
