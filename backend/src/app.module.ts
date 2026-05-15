import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { BotsModule } from './bots/bots.module';
import { ChatModule } from './chat/chat.module';
import { ConversationsModule } from './conversations/conversations.module';
import { FriendsModule } from './friends/friends.module';
import { HealthController } from './health.controller';
import { LegalController } from './legal.controller';
import { LlmModule } from './llm/llm.module';
import { MessagesModule } from './messages/messages.module';
import { PrismaModule } from './prisma/prisma.module';
import { UploadsModule } from './uploads/uploads.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    PrismaModule,
    LlmModule,
    AuthModule,
    UsersModule,
    FriendsModule,
    ConversationsModule,
    MessagesModule,
    BotsModule,
    ChatModule,
    UploadsModule,
  ],
  controllers: [HealthController, LegalController],
})
export class AppModule {}
