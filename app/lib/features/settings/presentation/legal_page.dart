import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/legal_api.dart';

class LegalPage extends ConsumerWidget {
  const LegalPage({super.key, required this.kind});

  /// 'privacy' or 'terms'
  final String kind;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final doc = ref.watch(kind == 'privacy' ? privacyDocProvider : termsDocProvider);
    return Scaffold(
      appBar: AppBar(title: Text(kind == 'privacy' ? '隐私政策' : '用户协议')),
      body: doc.when(
        data: (d) => SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(d.title, style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 4),
              Text('版本 ${d.version}', style: Theme.of(context).textTheme.bodySmall),
              const SizedBox(height: 16),
              Text(d.body, style: const TextStyle(height: 1.5)),
            ],
          ),
        ),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('加载失败：$e')),
      ),
    );
  }
}
