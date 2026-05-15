import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FcmProvider } from './providers/fcm.provider';
import { MockPushProvider } from './providers/mock.provider';
import { PushController } from './push.controller';
import { PushService } from './push.service';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [PushController],
  providers: [PushService, FcmProvider, MockPushProvider],
  exports: [PushService],
})
export class PushModule {}
