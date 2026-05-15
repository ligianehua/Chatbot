import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/wallet_api.dart';

class WalletPage extends ConsumerWidget {
  const WalletPage({super.key});

  Future<void> _recharge(BuildContext context, WidgetRef ref, int cents) async {
    try {
      await ref.read(walletApiProvider).recharge(cents);
      ref.invalidate(walletBalanceProvider);
      ref.invalidate(walletTransactionsProvider);
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('已充值 \$${(cents / 100).toStringAsFixed(2)}')),
      );
    } on DioException catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('充值失败：${e.message ?? e.response?.statusCode}')),
      );
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
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
                        loading: () => const SizedBox(height: 36, child: CircularProgressIndicator()),
                        error: (e, _) => Text('错误：$e'),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'DEV 充值（生产环境会替换为 Apple IAP / Google Play）',
                    style: TextStyle(fontSize: 12, color: Colors.grey),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    children: [
                      for (final cents in const [100, 500, 1000, 5000])
                        OutlinedButton(
                          onPressed: () => _recharge(context, ref, cents),
                          child: Text('\$${(cents / 100).toStringAsFixed(2)}'),
                        ),
                    ],
                  ),
                ],
              ),
            ),
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
                            leading: Icon(_iconFor(t.type),
                                color: _colorFor(t.type)),
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
