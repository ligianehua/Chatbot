import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { ConversationsService } from './conversations.service';
import { CreateDirectDto } from './dto/create-direct.dto';
import { MarkReadDto } from './dto/mark-read.dto';

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.conversations.listForUser(user.sub);
  }

  @Post('direct')
  @HttpCode(HttpStatus.OK)
  createDirect(@CurrentUser() user: JwtPayload, @Body() dto: CreateDirectDto) {
    return this.conversations.getOrCreateDirect(user.sub, dto.peerId);
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markRead(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: MarkReadDto,
  ) {
    await this.conversations.markRead(id, user.sub, dto.upToMsgId);
  }
}
