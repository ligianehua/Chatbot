import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { MessagesService } from './messages.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get('conversations/:id/messages')
  history(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('before') before?: string,
    @Query('limit') limit?: string,
  ) {
    return this.messages.listInConversation(id, user.sub, {
      before,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('messages/sync')
  sync(
    @CurrentUser() user: JwtPayload,
    @Query('since') since?: string,
    @Query('limit') limit?: string,
  ) {
    return this.messages.syncSince(user.sub, since, limit ? parseInt(limit, 10) : 500);
  }
}
