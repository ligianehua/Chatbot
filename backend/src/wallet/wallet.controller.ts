import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { RechargeDto } from './dto/recharge.dto';
import { WalletService } from './wallet.service';

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get()
  balance(@CurrentUser() user: JwtPayload) {
    return this.wallet.balance(user.sub);
  }

  @Get('transactions')
  list(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit?: string,
  ) {
    return this.wallet.listTransactions(user.sub, limit ? parseInt(limit, 10) : 50);
  }

  /**
   * MVP/dev-only direct recharge. Production replaces this with IAP receipt
   * verification (Apple App Store Server API, Google Play Developer API) +
   * Stripe webhooks. Disabled when NODE_ENV=production.
   */
  @Post('recharge')
  @HttpCode(HttpStatus.OK)
  recharge(@CurrentUser() user: JwtPayload, @Body() dto: RechargeDto) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('direct recharge disabled in production — use IAP');
    }
    return this.wallet.devRecharge(user.sub, dto.amountCents, dto.externalOrderId);
  }
}
