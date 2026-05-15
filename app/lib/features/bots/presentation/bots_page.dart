import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../data/bot_models.dart';
import '../data/bots_api.dart';

class BotsPage extends ConsumerStatefulWidget {
  const BotsPage({super.key});

  @override
  ConsumerState<BotsPage> createState() => _BotsPageState();
}

class _BotsPageState extends ConsumerState<BotsPage> with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 3, vsync: this);

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Bot'),
        bottom: TabBar(
          controller: _tabs,
          tabs: const [
            Tab(text: '我的'),
            Tab(text: '已订阅'),
            Tab(text: '发现'),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/bots/new'),
        icon: const Icon(Icons.add),
        label: const Text('新建 Bot'),
      ),
      body: TabBarView(
        controller: _tabs,
        children: const [
          _MyBots(),
          _SubscribedBots(),
          _MarketplaceTab(),
        ],
      ),
    );
  }
}

class _MyBots extends ConsumerWidget {
  const _MyBots();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bots = ref.watch(myBotsProvider);
    return _BotList(bots: bots, provider: myBotsProvider, emptyText: '还没有 Bot，点右下角新建一个');
  }
}

class _SubscribedBots extends ConsumerWidget {
  const _SubscribedBots();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bots = ref.watch(subscribedBotsProvider);
    return _BotList(bots: bots, provider: subscribedBotsProvider, emptyText: '还没有订阅 Bot，去「发现」看看');
  }
}

class _MarketplaceTab extends ConsumerStatefulWidget {
  const _MarketplaceTab();
  @override
  ConsumerState<_MarketplaceTab> createState() => _MarketplaceTabState();
}

class _MarketplaceTabState extends ConsumerState<_MarketplaceTab> {
  final _q = TextEditingController();
  String _appliedQuery = '';

  @override
  void dispose() {
    _q.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final list = ref.watch(marketplaceProvider(_appliedQuery));
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
          child: TextField(
            controller: _q,
            decoration: InputDecoration(
              isDense: true,
              prefixIcon: const Icon(Icons.search),
              hintText: '搜索 Bot 名称 / 简介 / 职位',
              border: const OutlineInputBorder(),
              suffixIcon: _q.text.isEmpty
                  ? null
                  : IconButton(
                      icon: const Icon(Icons.clear),
                      onPressed: () {
                        _q.clear();
                        setState(() => _appliedQuery = '');
                      },
                    ),
            ),
            onSubmitted: (v) => setState(() => _appliedQuery = v.trim()),
          ),
        ),
        Expanded(
          child: _BotList(
            bots: list,
            provider: marketplaceProvider(_appliedQuery),
            emptyText: '没有找到匹配的 Bot',
            showPrice: true,
          ),
        ),
      ],
    );
  }
}

class _BotList extends ConsumerWidget {
  const _BotList({
    required this.bots,
    required this.provider,
    required this.emptyText,
    this.showPrice = false,
  });

  final AsyncValue<List<Bot>> bots;
  final ProviderListenable<AsyncValue<List<Bot>>> provider;
  final String emptyText;
  final bool showPrice;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return RefreshIndicator(
      onRefresh: () async => ref.invalidate(provider),
      child: bots.when(
        data: (list) {
          if (list.isEmpty) {
            return ListView(
              children: [
                const SizedBox(height: 80),
                Center(child: Text(emptyText)),
              ],
            );
          }
          return ListView.separated(
            itemCount: list.length,
            separatorBuilder: (_, __) => const Divider(height: 1, indent: 72),
            itemBuilder: (_, i) => _BotTile(bot: list[i], showPrice: showPrice),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('加载失败：$e')),
      ),
    );
  }
}

class _BotTile extends StatelessWidget {
  const _BotTile({required this.bot, required this.showPrice});
  final Bot bot;
  final bool showPrice;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: CircleAvatar(
        child: Text(bot.name.isNotEmpty ? bot.name[0] : '?'),
      ),
      title: Text(bot.name),
      subtitle: Text(
        bot.bio?.isNotEmpty == true ? bot.bio! : (bot.occupation ?? '未设置简介'),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      trailing: showPrice
          ? Text(bot.priceLabel,
              style: TextStyle(
                color: bot.priceType == BotPriceType.free
                    ? Colors.green
                    : Theme.of(context).colorScheme.primary,
                fontWeight: FontWeight.bold,
              ))
          : const Icon(Icons.chevron_right),
      onTap: () => context.push('/bots/${bot.id}'),
    );
  }
}
