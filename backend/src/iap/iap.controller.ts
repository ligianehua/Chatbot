import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { RedeemDto } from './dto/redeem.dto';
import { IapService } from './iap.service';

@Controller('iap')
@UseGuards(JwtAuthGuard)
export class IapController {
  constructor(private readonly iap: IapService) {}

  /** Catalog of available IAP products. Client uses these productIds to
   *  query Apple/Google for prices and display the buy buttons. */
  @Get('products')
  products() {
    return this.iap.catalogList();
  }

  /** Server-side verification + wallet credit. Always-200 on idempotent
   *  replays — the body includes `idempotent: true` so the client knows. */
  @Post('redeem')
  @HttpCode(HttpStatus.OK)
  redeem(@CurrentUser() user: JwtPayload, @Body() dto: RedeemDto) {
    return this.iap.redeem({
      userId: user.sub,
      provider: dto.provider,
      productId: dto.productId,
      receipt: dto.receipt,
    });
  }
}
