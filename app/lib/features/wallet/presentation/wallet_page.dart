import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart' show kDebugMode;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:in_app_purchase/in_app_purchase.dart';

import '../data/iap_api.dart';
import '../data/iap_service.dart';
import '../data/wallet_api.dart';

class WalletPage extends ConsumerStatefulWidget {
  const WalletPage({super.key});

  @override
  ConsumerState<WalletPage> createState() => _WalletPageState();
}

class _WalletPageState extends ConsumerState<WalletPage> {
  bool _storeAvailable = false;
  List<ProductDetails> _products = const [];
  StreamSubscription<int>? _redeemSub;
  StreamSubscription<String>? _errSub;

  @override
  void initState() {
    super.initState();
    Future.microtask(_initIap);
  }

  Future<void> _initIap() async {
    final svc = ref.read(iapServiceProvider);
    _storeAvailable = await svc.start();
    if (!mounted) return;
    setState(() {});
    if (!_storeAvailable) return;

    // Listen for backend-credited redemptions; refresh wallet on success.
    _redeemSub = svc.redeemed.listen((_) {
      if (!mounted) return;
      ref.invalidate(walletBalanceProvider);
      ref.invalidate(walletTransactionsProvider);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('充值成功')),
      );
    });
    _errSub = svc.errors.listen((msg) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    });

    // Load product list from backend catalog, then from store.
    try {
      final catalog = await ref.read(iapCatalogProvider.future);
      final details = await svc.queryProducts(catalog.map((p) => p.productId).toSet());
      if (!mounted) return;
      setState(() => _products = details);
    } catch (e) {
      debugPrint('iap product load failed: $e');
    }
  }

  @override
  void dispose() {
    _redeemSub?.cancel();
    _errSub?.cancel();
    super.dispose();
  }

  Future<void> _devRecharge(int cents) async {
    try {
      await ref.read(walletApiProvider).recharge(cents);
      ref.invalidate(walletBalanceProvider);
      ref.invalidate(walletTransactionsProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('已充值 \$${(cents / 100).toStringAsFixed(2)}')),
      );
    } on DioException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('充值失败：${e.message ?? e.response?.statusCode}')),
      );
    }
  }

  Future<void> _buy(ProductDetails p) async {
    final svc = ref.read(iapServiceProvider);
    try {
      await svc.buy(p);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('购买失败：$e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final balance = ref.watch(walletBalanceProvider);
    final txns = ref.watch(walletTransactionsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('钱包')),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(walletBalanceProvider);
          ref.invalidate(walletTransactionsProvider);
        },
        child: ListView(
          children: [
            Padding(
              padding: const EdgeInsets.all(24),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('余额', style: TextStyle(color: Colors.grey)),
                      const SizedBox(height: 8),
                      balance.when(
                        data: (b) => Text(b.label,
                            style: const TextStyle(fontSize: 36, fontWeight: FontWeight.bold)),
                        loading: () =>
                            const SizedBox(height: 36, child: CircularProgressIndicator()),
                        error: (e, _) => Text('错误：$e'),
                      ),
                    ],
                  ),
                ),
              ),
            ),

            // --- Real IAP products ---
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text('充值', style: TextStyle(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  if (!_storeAvailable)
                    const Text(
                      '应用商店暂不可用（模拟器无法购买，请用真机 + sandbox 账号测试）',
                      style: TextStyle(fontSize: 12, color: Colors.grey),
                    )
                  else if (_products.isEmpty)
                    const Text(
                      '加载商品中… 如长时间无内容，请确认 App Store Connect / Play Console 已配置对应产品并已审核通过',
                      style: TextStyle(fontSize: 12, color: Colors.grey),
                    )
                  else
                    Column(
                      children: _products
                          .map(
                            (p) => Card(
                              child: ListTile(
                                title: Text(p.title.isNotEmpty ? p.title : p.id),
                                subtitle: Text(p.description),
                                trailing: FilledButton(
                                  onPressed: () => _buy(p),
                                  child: Text(p.price),
                                ),
                              ),
                            ),
                          )
                          .toList(),
                    ),
                ],
              ),
            ),

            // --- DEV recharge (debug builds only — never ships) ---
            if (kDebugMode) ...[
              const SizedBox(height: 16),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text(
                      'DEV 快捷充值（仅 debug build 显示，生产 build 不可见）',
                      style: TextStyle(fontSize: 12, color: Colors.grey),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      children: [
                        for (final cents in const [100, 500, 1000, 5000])
                          OutlinedButton(
                            onPressed: () => _devRecharge(cents),
                            child: Text('\$${(cents / 100).toStringAsFixed(2)}'),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ],

            const SizedBox(height: 24),
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 24),
              child: Text('交易记录', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
            txns.when(
              data: (list) {
                if (list.isEmpty) {
                  return const Padding(
                    padding: EdgeInsets.all(32),
                    child: Center(child: Text('暂无交易记录')),
                  );
                }
                return Column(
                  children: list
                      .map((t) => ListTile(
                            leading: Icon(_iconFor(t.type), color: _colorFor(t.type)),
                            title: Text(t.typeLabel),
                            subtitle: Text(
                                '${t.createdAt.toLocal().toString().substring(0, 19)}\n${t.status}'),
                            isThreeLine: true,
                            trailing: Text(
                              t.label,
                              style: TextStyle(
                                color: _colorFor(t.type),
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ))
                      .toList(),
                );
              },
              loading: () => const Padding(
                padding: EdgeInsets.all(24),
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (e, _) => Padding(
                padding: const EdgeInsets.all(24),
                child: Center(child: Text('加载失败：$e')),
              ),
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  IconData _iconFor(String t) {
    switch (t) {
      case 'recharge':
        return Icons.add_circle_outline;
      case 'income':
        return Icons.trending_up;
      case 'consume':
        return Icons.shopping_bag_outlined;
      case 'withdraw':
        return Icons.account_balance_outlined;
      case 'refund':
        return Icons.replay;
      default:
        return Icons.swap_horiz;
    }
  }

  Color _colorFor(String t) {
    if (t == 'recharge' || t == 'income' || t == 'refund') return Colors.green;
    return Colors.red;
  }
}
