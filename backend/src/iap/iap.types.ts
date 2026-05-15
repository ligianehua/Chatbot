export type IapProvider = 'apple' | 'google';

export interface IapVerifyResult {
  valid: boolean;
  /** Provider-unique transaction id used for idempotency. */
  transactionId: string;
  /** Product id as confirmed by the provider's records. */
  productId: string;
  /** Unix ms purchase timestamp when available. */
  purchaseTimeMs?: number;
  reason?: string;
}

export interface IapVerifyInput {
  /**
   * Apple: base64 receipt or signed JWS transaction info (App Store Server API v2).
   * Google: purchase token returned by Play Billing.
   */
  receipt: string;
  productId: string;
}

export interface IapVerifier {
  readonly provider: IapProvider;
  verify(input: IapVerifyInput): Promise<IapVerifyResult>;
}
