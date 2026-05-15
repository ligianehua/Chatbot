import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { IapCatalog } from './iap.catalog';
import { IapController } from './iap.controller';
import { IapService } from './iap.service';
import { AppleIapVerifier } from './verifiers/apple.iap.verifier';
import { GoogleIapVerifier } from './verifiers/google.iap.verifier';
import { MockIapVerifier } from './verifiers/mock.iap.verifier';

@Module({
  imports: [AuthModule],
  controllers: [IapController],
  providers: [
    IapService,
    IapCatalog,
    AppleIapVerifier,
    GoogleIapVerifier,
    MockIapVerifier,
  ],
  exports: [IapService],
})
export class IapModule {}
