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
import { Server, Socket } from 'socket.io';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { ConversationsService } from '../conversations/conversations.service';
import { MessagesService } from '../messages/messages.service';
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
    try {
      const message = await this.messages.sendText({
        conversationId: dto.conversationId,
        senderId: userId,
        text: dto.text,
        clientMsgId: dto.clientMsgId,
        replyToId: dto.replyToId,
      });

      // Ack to sender (with both client and server ids).
      client.emit('message:ack', {
        clientMsgId: dto.clientMsgId,
        message,
      });

      // Broadcast to all other connected members.
      const memberIds = await this.conversations.getMembers(dto.conversationId);
      for (const memberId of memberIds) {
        const sockets = this.userSockets.get(memberId);
        if (!sockets) continue;
        for (const sid of sockets) {
          if (sid === client.id) continue;
          this.server.to(sid).emit('message:new', { message });
        }
      }

      return { ok: true };
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'unknown';
      client.emit('message:error', { clientMsgId: dto.clientMsgId, reason });
      return { ok: false, reason };
    }
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
