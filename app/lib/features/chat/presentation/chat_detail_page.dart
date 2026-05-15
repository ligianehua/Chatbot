import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/chat_models.dart';
import 'chat_provider.dart';

class ChatDetailPage extends ConsumerStatefulWidget {
  const ChatDetailPage({super.key, required this.conversationId, this.title});

  final String conversationId;
  final String? title;

  @override
  ConsumerState<ChatDetailPage> createState() => _ChatDetailPageState();
}

class _ChatDetailPageState extends ConsumerState<ChatDetailPage> {
  final _input = TextEditingController();
  final _scroll = ScrollController();
  String? _myUserId;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scroll.removeListener(_onScroll);
    _scroll.dispose();
    _input.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scroll.position.pixels <= 80 &&
        !_scroll.position.outOfRange &&
        _scroll.position.userScrollDirection == ScrollDirection.forward) {
      ref.read(chatRoomProvider(widget.conversationId).notifier).loadOlder();
    }
  }

  void _send() {
    final text = _input.text.trim();
    if (text.isEmpty) return;
    ref.read(chatRoomProvider(widget.conversationId).notifier).sendText(text);
    _input.clear();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(_scroll.position.maxScrollExtent,
            duration: const Duration(milliseconds: 200), curve: Curves.easeOut);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(chatRoomProvider(widget.conversationId));
    return Scaffold(
      appBar: AppBar(title: Text(widget.title ?? '聊天')),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: state.when(
                data: (s) {
                  if (s.messages.isEmpty) {
                    return const Center(child: Text('开始聊天吧'));
                  }
                  return ListView.builder(
                    controller: _scroll,
                    padding: const EdgeInsets.all(12),
                    itemCount: s.messages.length + (s.loadingHistory ? 1 : 0),
                    itemBuilder: (context, i) {
                      if (s.loadingHistory && i == 0) {
                        return const Padding(
                          padding: EdgeInsets.all(8),
                          child: Center(child: SizedBox(
                            height: 16, width: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )),
                        );
                      }
                      final idx = s.loadingHistory ? i - 1 : i;
                      final m = s.messages[idx];
                      return _MessageBubble(message: m, isMe: _isMe(m));
                    },
                  );
                },
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => Center(child: Text('错误：$e')),
              ),
            ),
            const Divider(height: 1),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _input,
                      minLines: 1,
                      maxLines: 4,
                      decoration: const InputDecoration(
                        border: OutlineInputBorder(),
                        hintText: '输入消息',
                        isDense: true,
                      ),
                      onSubmitted: (_) => _send(),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filled(
                    icon: const Icon(Icons.send),
                    onPressed: _send,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  bool _isMe(ChatMessage m) {
    // Cache user id once; first time around it may be null and we fall back to alignment by sender presence.
    _myUserId ??= ref.read(chatRoomProvider(widget.conversationId).notifier).myUserId;
    return _myUserId != null && m.senderId == _myUserId;
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({required this.message, required this.isMe});

  final ChatMessage message;
  final bool isMe;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final bg = isMe ? scheme.primaryContainer : scheme.surfaceContainerHighest;
    final fg = isMe ? scheme.onPrimaryContainer : scheme.onSurface;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: isMe ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Flexible(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: bg,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(message.text, style: TextStyle(color: fg)),
            ),
          ),
          if (isMe && message.status == MessageStatus.sending)
            const Padding(
              padding: EdgeInsets.only(left: 4),
              child: SizedBox(width: 12, height: 12, child: CircularProgressIndicator(strokeWidth: 2)),
            ),
          if (isMe && message.status == MessageStatus.failed)
            const Padding(
              padding: EdgeInsets.only(left: 4),
              child: Icon(Icons.error_outline, size: 14, color: Colors.red),
            ),
        ],
      ),
    );
  }
}
