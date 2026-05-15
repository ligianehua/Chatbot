import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { BotsModule } from './bots/bots.module';
import { ChatModule } from './chat/chat.module';
import { ConversationsModule } from './conversations/conversations.module';
import { FriendsModule } from './friends/friends.module';
import { GroupsModule } from './groups/groups.module';
import { HealthController } from './health.controller';
import { IapModule } from './iap/iap.module';
import { LegalController } from './legal.controller';
import { LlmModule } from './llm/llm.module';
import { MessagesModule } from './messages/messages.module';
import { PrismaModule } from './prisma/prisma.module';
import { PushModule } from './push/push.module';
import { UploadsModule } from './uploads/uploads.module';
import { UsersModule } from './users/users.module';
import { WalletModule } from './wallet/wallet.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    PrismaModule,
    LlmModule,
    WalletModule,
    PushModule,
    AuthModule,
    UsersModule,
    FriendsModule,
    GroupsModule,
    ConversationsModule,
    MessagesModule,
    BotsModule,
    ChatModule,
    UploadsModule,
    IapModule,
  ],
  controllers: [HealthController, LegalController],
})
export class AppModule {}
