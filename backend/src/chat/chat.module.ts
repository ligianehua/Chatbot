import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConversationsModule } from '../conversations/conversations.module';
import { MessagesModule } from '../messages/messages.module';
import { ChatGateway } from './chat.gateway';

@Module({
  imports: [JwtModule.register({}), ConversationsModule, MessagesModule],
  providers: [ChatGateway],
})
export class ChatModule {}
