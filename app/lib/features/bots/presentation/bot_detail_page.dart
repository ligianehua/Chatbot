import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/storage/auth_storage.dart';
import '../../wallet/data/wallet_api.dart';
import '../data/bot_models.dart';
import '../data/bots_api.dart';

final _botDetailProvider = FutureProvider.autoDispose.family<Bot, String>((ref, id) async {
  return ref.watch(botsApiProvider).get(id);
});

class BotDetailPage extends ConsumerWidget {
  const BotDetailPage({super.key, required this.botId});
  final String botId;

  Future<bool> _isSubscribed(WidgetRef ref) async {
    try {
      final subs = await ref.read(botsApiProvider).listSubscribed();
      return subs.any((b) => b.id == botId);
    } catch (_) {
      return false;
    }
  }

  Future<bool> _isCreator(WidgetRef ref, Bot bot) async {
    final myId = await ref.read(authStorageProvider).readUserId();
    return myId != null && myId == bot.creatorId;
  }

  Future<void> _subscribe(BuildContext context, WidgetRef ref, Bot bot) async {
    final ok = bot.priceType == BotPriceType.free
        ? true
        : await showDialog<bool>(
              context: context,
              builder: (_) => AlertDialog(
                title: const Text('确认订阅'),
                content: Text(
                  '将从你的钱包扣除 ${bot.priceLabel}。继续？',
                ),
                actions: [
                  TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('取消')),
                  FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('确认')),
                ],
              ),
            ) ??
            false;
    if (!ok) return;

    try {
      final result = await ref.read(botsApiProvider).subscribe(bot.id);
      ref.invalidate(subscribedBotsProvider);
      ref.invalidate(walletBalanceProvider);
      ref.invalidate(walletTransactionsProvider);
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(result['status'] == 'already_subscribed'
            ? '已订阅过该 Bot'
            : (bot.priceType == BotPriceType.free ? '订阅成功' : '订阅成功，已扣款')),
      ));
    } on DioException catch (e) {
      if (!context.mounted) return;
      final msg = e.response?.data is Map ? (e.response!.data as Map)['message']?.toString() : null;
      final hint = e.response?.statusCode == 400 && (msg?.contains('insufficient') == true)
          ? '余额不足，请先去钱包充值'
          : (msg ?? '订阅失败');
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(hint)));
    }
  }

  Future<void> _openChat(BuildContext context, WidgetRef ref, Bot bot) async {
    try {
      final conv = await ref.read(botsApiProvider).openConversation(bot.id);
      final convId = conv['id'] as String;
      if (!context.mounted) return;
      context.push('/chat/$convId?title=${Uri.encodeComponent(bot.name)}&type=bot&peerId=${bot.id}');
    } on DioException catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('打开对话失败：${e.response?.statusCode ?? e.message}')),
      );
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bot = ref.watch(_botDetailProvider(botId));
    return Scaffold(
      appBar: AppBar(title: const Text('Bot 详情')),
      body: bot.when(
        data: (b) => FutureBuilder<bool>(
          future: _isSubscribed(ref),
          builder: (context, subSnap) {
            return FutureBuilder<bool>(
              future: _isCreator(ref, b),
              builder: (context, ownerSnap) {
                final subscribed = subSnap.data ?? false;
                final isOwner = ownerSnap.data ?? false;
                final canChat = isOwner || subscribed;
                return ListView(
                  padding: const EdgeInsets.all(20),
                  children: [
                    Row(
                      children: [
                        CircleAvatar(
                          radius: 32,
                          child: Text(b.name.isNotEmpty ? b.name[0] : '?',
                              style: const TextStyle(fontSize: 28)),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(b.name, style: Theme.of(context).textTheme.titleLarge),
                              if (b.occupation != null)
                                Text(b.occupation!,
                                    style: Theme.of(context).textTheme.bodyMedium),
                              const SizedBox(height: 4),
                              Text(
                                b.priceLabel,
                                style: TextStyle(
                                  color: b.priceType == BotPriceType.free
                                      ? Colors.green
                                      : Theme.of(context).colorScheme.primary,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    if (b.bio?.isNotEmpty == true) ...[
                      const Text('简介', style: TextStyle(fontWeight: FontWeight.bold)),
                      const SizedBox(height: 4),
                      Text(b.bio!),
                      const SizedBox(height: 16),
                    ],
                    if (b.creator != null) ...[
                      const Text('创建者', style: TextStyle(fontWeight: FontWeight.bold)),
                      const SizedBox(height: 4),
                      Row(children: [
                        CircleAvatar(
                          radius: 14,
                          child: Text(b.creator!.nickname.isNotEmpty ? b.creator!.nickname[0] : '?',
                              style: const TextStyle(fontSize: 12)),
                        ),
                        const SizedBox(width: 8),
                        Text(b.creator!.nickname),
                      ]),
                      const SizedBox(height: 20),
                    ],
                    if (canChat)
                      FilledButton.icon(
                        onPressed: () => _openChat(context, ref, b),
                        icon: const Icon(Icons.chat_bubble_outline),
                        label: const Text('开始聊天'),
                      )
                    else
                      FilledButton.icon(
                        onPressed: () => _subscribe(context, ref, b),
                        icon: const Icon(Icons.add_circle_outline),
                        label: Text(b.priceType == BotPriceType.free
                            ? '订阅（免费）'
                            : '订阅 ${b.priceLabel}'),
                      ),
                    if (subscribed && !isOwner) ...[
                      const SizedBox(height: 8),
                      OutlinedButton.icon(
                        onPressed: () async {
                          await ref.read(botsApiProvider).unsubscribe(b.id);
                          ref.invalidate(subscribedBotsProvider);
                          if (!context.mounted) return;
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('已取消订阅')),
                          );
                        },
                        icon: const Icon(Icons.remove_circle_outline, color: Colors.red),
                        label: const Text('取消订阅', style: TextStyle(color: Colors.red)),
                      ),
                    ],
                  ],
                );
              },
            );
          },
        ),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('加载失败：$e')),
      ),
    );
  }
}
