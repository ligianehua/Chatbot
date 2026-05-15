import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WalletService } from '../wallet/wallet.service';
import { IapCatalog } from './iap.catalog';
import { IapProvider, IapVerifier } from './iap.types';
import { AppleIapVerifier } from './verifiers/apple.iap.verifier';
import { GoogleIapVerifier } from './verifiers/google.iap.verifier';
import { MockIapVerifier } from './verifiers/mock.iap.verifier';

@Injectable()
export class IapService {
  private readonly logger = new Logger(IapService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly catalog: IapCatalog,
    private readonly wallet: WalletService,
    private readonly apple: AppleIapVerifier,
    private readonly google: GoogleIapVerifier,
    private readonly mock: MockIapVerifier,
  ) {}

  private pickVerifier(provider: IapProvider): IapVerifier {
    const mode = this.config.get<string>('IAP_MODE', '');
    if (mode === 'mock') {
      this.logger.warn(`IAP_MODE=mock — using MockIapVerifier for ${provider}`);
      return this.mock;
    }
    return provider === 'apple' ? this.apple : this.google;
  }

  catalogList() {
    return this.catalog.list();
  }

  /**
   * Verifies a purchase with the store, then credits the wallet idempotently.
   * Returns the updated wallet so the client can refresh without a second call.
   */
  async redeem(args: {
    userId: string;
    provider: IapProvider;
    productId: string;
    receipt: string;
  }) {
    const product = this.catalog.get(args.productId);
    if (!product) throw new BadRequestException(`unknown productId ${args.productId}`);

    const verifier = this.pickVerifier(args.provider);
    const result = await verifier.verify({ receipt: args.receipt, productId: args.productId });
    if (!result.valid) {
      throw new BadRequestException(`receipt invalid: ${result.reason ?? 'unknown'}`);
    }
    if (result.productId !== args.productId) {
      throw new BadRequestException(`receipt product ${result.productId} != requested ${args.productId}`);
    }

    const externalOrderId = `${args.provider}:${result.transactionId}`;
    const credit = await this.wallet.creditFromExternalOrder({
      userId: args.userId,
      amountCents: product.amountCents,
      externalOrderId,
    });

    return {
      wallet: { balanceCents: credit.wallet.balanceCents, currency: credit.wallet.currency },
      transaction: credit.transaction,
      idempotent: credit.idempotent,
      product: { productId: product.productId, amountCents: product.amountCents },
    };
  }
}
