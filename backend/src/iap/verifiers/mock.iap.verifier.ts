import { Injectable } from '@nestjs/common';
import { IapVerifier, IapVerifyInput, IapVerifyResult } from '../iap.types';

/**
 * Test verifier. Enabled when IAP_MODE=mock. Receipts use one of:
 *   - mock:<productId>:<transactionId>          → valid
 *   - bad:<reason>                              → invalid
 *
 * Never enable in production.
 */
@Injectable()
export class MockIapVerifier implements IapVerifier {
  readonly provider = 'apple' as const; // selected per-call by IapService

  async verify(input: IapVerifyInput): Promise<IapVerifyResult> {
    if (input.receipt.startsWith('bad:')) {
      return { valid: false, transactionId: '', productId: input.productId, reason: input.receipt.slice(4) };
    }
    if (!input.receipt.startsWith('mock:')) {
      return { valid: false, transactionId: '', productId: input.productId, reason: 'receipt must be mock:<prod>:<txn>' };
    }
    const parts = input.receipt.split(':');
    if (parts.length !== 3) {
      return { valid: false, transactionId: '', productId: input.productId, reason: 'bad receipt format' };
    }
    const [, productId, txnId] = parts;
    return {
      valid: true,
      productId,
      transactionId: txnId,
      purchaseTimeMs: Date.now(),
    };
  }
}
