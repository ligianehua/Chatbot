import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/config/api_config.dart';
import '../data/chat_models.dart';
import 'chat_provider.dart';

class ChatDetailPage extends ConsumerStatefulWidget {
  const ChatDetailPage({
    super.key,
    required this.conversationId,
    this.title,
    this.type,
    this.peerId,
  });

  final String conversationId;
  final String? title;
  final String? type; // direct | group | bot
  final String? peerId;

  @override
  ConsumerState<ChatDetailPage> createState() => _ChatDetailPageState();
}

class _ChatDetailPageState extends ConsumerState<ChatDetailPage> {
  final _input = TextEditingController();
  final _scroll = ScrollController();
  final _picker = ImagePicker();
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
    _scrollToBottom();
  }

  Future<void> _pickAndSendImage() async {
    final picked = await _picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 85,
      maxWidth: 2048,
    );
    if (picked == null) return;
    try {
      await ref
          .read(chatRoomProvider(widget.conversationId).notifier)
          .sendImage(File(picked.path));
      _scrollToBottom();
    } on DioException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_friendlyUploadError(e))),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('发送失败：$e')));
    }
  }

  String _friendlyUploadError(DioException e) {
    final code = e.response?.statusCode;
    final body = e.response?.data;
    if (code == 400 && body is Map) {
      final categories = body['categories'];
      if (categories is List && categories.isNotEmpty) {
        return '图片被内容策略拦截（${categories.join(', ')}），请换一张';
      }
      final msg = body['message'];
      return msg is String ? '图片上传失败：$msg' : '图片上传失败';
    }
    if (code == 413) return '图片太大（上限 10MB）';
    return '图片上传失败';
  }

  void _scrollToBottom() {
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
      appBar: AppBar(
        title: Text(widget.title ?? '聊天'),
        actions: [
          if (widget.type == 'group' && widget.peerId != null)
            IconButton(
              icon: const Icon(Icons.info_outline),
              tooltip: '群聊信息',
              onPressed: () => context.push('/groups/${widget.peerId}'),
            ),
        ],
      ),
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
                  IconButton(
                    icon: const Icon(Icons.image_outlined),
                    tooltip: '发送图片',
                    onPressed: _pickAndSendImage,
                  ),
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
    if (m.senderId == null) return false;
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
              padding: message.type == 'image'
                  ? const EdgeInsets.all(4)
                  : const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: bg,
                borderRadius: BorderRadius.circular(12),
              ),
              child: _body(fg),
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

  Widget _body(Color fg) {
    if (message.type == 'image') {
      final localPath = message.content['localPath'];
      if (localPath is String && localPath.isNotEmpty) {
        return ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: Image.file(File(localPath), width: 220, fit: BoxFit.cover),
        );
      }
      final relUrl = message.content['url'] as String?;
      if (relUrl == null) return Text('[图片缺失]', style: TextStyle(color: fg));
      final abs = _absolute(relUrl);
      return ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: CachedNetworkImage(
          imageUrl: abs,
          width: 220,
          fit: BoxFit.cover,
          placeholder: (_, __) => const SizedBox(
            width: 220, height: 220, child: Center(child: CircularProgressIndicator()),
          ),
          errorWidget: (_, __, ___) => SizedBox(
            width: 220, height: 100,
            child: Center(child: Text('图片加载失败', style: TextStyle(color: fg))),
          ),
        ),
      );
    }
    return Text(message.text, style: TextStyle(color: fg));
  }

  String _absolute(String url) {
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    final base = ApiConfig.baseUrl;
    final originEnd = base.indexOf('/api/');
    final origin = originEnd > 0 ? base.substring(0, originEnd) : base;
    return '$origin$url';
  }
}
