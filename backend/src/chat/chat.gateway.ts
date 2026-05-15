import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ConversationType, MessageType, Prisma } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { BotsService } from '../bots/bots.service';
import { Snowflake } from '../common/snowflake';
import { ConversationsService } from '../conversations/conversations.service';
import { LlmService } from '../llm/llm.service';
import { ModerationService } from '../llm/moderation.service';
import { MessagesService } from '../messages/messages.service';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { SendMessageDto } from './dto/send-message.dto';
import { SyncDto } from './dto/sync.dto';

interface AuthedSocket extends Socket {
  data: { userId: string };
}

/**
 * Single-node Socket.io gateway.
 * Multi-node deployment requires @socket.io/redis-adapter (not added in MVP).
 */
@WebSocketGateway({
  cors: { origin: '*' },
  path: '/socket.io',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  // userId -> set of socketIds
  private readonly userSockets = new Map<string, Set<string>>();

  @WebSocketServer() server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly messages: MessagesService,
    private readonly conversations: ConversationsService,
    private readonly bots: BotsService,
    private readonly llm: LlmService,
    private readonly moderation: ModerationService,
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  async handleConnection(client: Socket) {
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      (client.handshake.headers.authorization?.toString().replace(/^Bearer\s+/i, ''));

    if (!token) {
      client.emit('connect:error', { reason: 'no token' });
      client.disconnect(true);
      return;
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      client.emit('connect:error', { reason: 'invalid token' });
      client.disconnect(true);
      return;
    }

    (client.data as { userId?: string }).userId = payload.sub;
    let set = this.userSockets.get(payload.sub);
    if (!set) {
      set = new Set();
      this.userSockets.set(payload.sub, set);
    }
    set.add(client.id);
    this.logger.log(`socket connect user=${payload.sub} sid=${client.id}`);
    client.emit('connect:ready', { userId: payload.sub });
  }

  handleDisconnect(client: Socket) {
    const userId = (client.data as { userId?: string }).userId;
    if (!userId) return;
    const set = this.userSockets.get(userId);
    if (!set) return;
    set.delete(client.id);
    if (set.size === 0) this.userSockets.delete(userId);
    this.logger.log(`socket disconnect user=${userId} sid=${client.id}`);
  }

  @SubscribeMessage('message:send')
  async onMessageSend(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody(new ValidationPipe({ whitelist: true, transform: true })) dto: SendMessageDto,
  ) {
    const userId = client.data.userId;
    const type = dto.type ?? 'text';
    try {
      // Content moderation only screens text messages for now.
      // Image moderation (阿里云内容安全) is planned for阶段 4 P1.
      if (type === 'text') {
        const allowed = await this.moderation.check({
          contentId: dto.clientMsgId ?? 'unknown',
          type: 'text',
          text: dto.text ?? '',
        });
        if (!allowed) {
          client.emit('message:error', {
            clientMsgId: dto.clientMsgId,
            reason: 'content moderation rejected',
          });
          return { ok: false, reason: 'moderation' };
        }
      }

      const conv = await this.conversations.findById(dto.conversationId);
      const message =
        type === 'image'
          ? await this.messages.sendImage({
              conversationId: dto.conversationId,
              senderId: userId,
              url: dto.url!,
              mime: dto.mime!,
              size: dto.size!,
              width: dto.width,
              height: dto.height,
              clientMsgId: dto.clientMsgId,
              replyToId: dto.replyToId,
            })
          : await this.messages.sendText({
              conversationId: dto.conversationId,
              senderId: userId,
              text: dto.text!,
              clientMsgId: dto.clientMsgId,
              replyToId: dto.replyToId,
            });

      client.emit('message:ack', {
        clientMsgId: dto.clientMsgId,
        message,
      });

      // Direct/group: fan out to other connected members, push to offline ones.
      if (conv.type !== ConversationType.bot) {
        const memberIds = await this.conversations.getMembers(dto.conversationId);
        const senderName = await this.lookupNickname(userId);
        for (const memberId of memberIds) {
          if (memberId === userId) continue;
          const sockets = this.userSockets.get(memberId);
          if (sockets && sockets.size > 0) {
            for (const sid of sockets) {
              if (sid === client.id) continue;
              this.server.to(sid).emit('message:new', { message });
            }
          } else {
            // Offline → push notification. Fire-and-forget so we don't block the ack.
            void this.push.sendToUser(memberId, {
              title: senderName,
              body: this.previewFor(type, dto.text),
              data: {
                type: 'message',
                conversationId: dto.conversationId,
                messageId: message.id,
              },
            });
          }
        }
        return { ok: true };
      }

      // Bot conversation: stream the LLM reply for text only. Image / other
      // media gets persisted but does not trigger an LLM call in MVP.
      if (type === 'text') {
        this.runBotReply(client, dto.conversationId, userId).catch((e) => {
          this.logger.error(`bot reply failed: ${e instanceof Error ? e.message : e}`);
        });
      }
      return { ok: true };
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'unknown';
      client.emit('message:error', { clientMsgId: dto.clientMsgId, reason });
      return { ok: false, reason };
    }
  }

  private async runBotReply(client: AuthedSocket, conversationId: string, userId: string) {
    const bot = await this.bots.resolveBotForConversation(conversationId, userId);
    const replyClientMsgId = `bot-${Snowflake.generate()}`;

    client.emit('bot:start', { conversationId, clientMsgId: replyClientMsgId, botId: bot.id });

    let fullText = '';
    const result = await this.llm.streamForBot({
      botId: bot.id,
      userId,
      conversationId,
      onChunk: (delta) => {
        fullText += delta;
        client.emit('bot:chunk', {
          conversationId,
          clientMsgId: replyClientMsgId,
          delta,
        });
      },
    });

    // Output-side moderation. On reject, replace with a neutral notice.
    let outText = result.fullText || fullText;
    const outOk = await this.moderation.check({
      contentId: replyClientMsgId,
      type: 'text',
      text: outText,
    });
    if (!outOk) outText = '[内容被安全策略屏蔽]';

    const id = Snowflake.generate();
    const now = new Date();
    const persisted = await this.prisma.$transaction(async (tx) => {
      const m = await tx.message.create({
        data: {
          id,
          conversationId,
          senderId: null, // bot
          type: MessageType.text,
          content: { text: outText, botId: bot.id, model: result.model } as Prisma.InputJsonValue,
          createdAt: now,
        },
      });
      await tx.conversation.update({
        where: { id: conversationId },
        data: { lastMsgId: id, lastMsgAt: now },
      });
      await tx.conversationMember.update({
        where: { conversationId_userId: { conversationId, userId } },
        data: { unreadCount: { increment: 1 } },
      });
      return m;
    });

    client.emit('bot:done', {
      conversationId,
      clientMsgId: replyClientMsgId,
      message: persisted,
    });
  }

  private async lookupNickname(userId: string): Promise<string> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { nickname: true },
    });
    return u?.nickname ?? '新消息';
  }

  private previewFor(type: string, text?: string): string {
    if (type === 'text') return (text ?? '').slice(0, 80);
    if (type === 'image') return '[图片]';
    if (type === 'voice') return '[语音]';
    if (type === 'video') return '[视频]';
    if (type === 'file') return '[文件]';
    return '[新消息]';
  }

  @SubscribeMessage('message:sync')
  async onMessageSync(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody(new ValidationPipe({ whitelist: true, transform: true })) dto: SyncDto,
  ) {
    const userId = client.data.userId;
    const messages = await this.messages.syncSince(userId, dto.sinceMsgId);
    return { messages };
  }
}
