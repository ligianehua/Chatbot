import { Injectable } from '@nestjs/common';

export interface IapProduct {
  productId: string;
  amountCents: number;
  /** consumable = wallet top-up, never expires. */
  kind: 'consumable';
  /** Display label for app stores; mostly informational here. */
  label: string;
}

/**
 * Hard-coded MVP catalog. Product IDs must match what you configure in
 * App Store Connect (as Consumable IAPs) and Google Play Console (as
 * Managed Products / Consumable). Migrate to a DB table when you need to
 * change prices without redeploy.
 */
@Injectable()
export class IapCatalog {
  static readonly PRODUCTS: Record<string, IapProduct> = {
    wallet_topup_100: { productId: 'wallet_topup_100', amountCents: 100, kind: 'consumable', label: '$1.00 wallet credit' },
    wallet_topup_500: { productId: 'wallet_topup_500', amountCents: 500, kind: 'consumable', label: '$5.00 wallet credit' },
    wallet_topup_1000: { productId: 'wallet_topup_1000', amountCents: 1000, kind: 'consumable', label: '$10.00 wallet credit' },
    wallet_topup_5000: { productId: 'wallet_topup_5000', amountCents: 5000, kind: 'consumable', label: '$50.00 wallet credit' },
  };

  get(productId: string): IapProduct | undefined {
    return IapCatalog.PRODUCTS[productId];
  }

  list(): IapProduct[] {
    return Object.values(IapCatalog.PRODUCTS);
  }
}
