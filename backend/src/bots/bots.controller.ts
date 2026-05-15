import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { BotsService } from './bots.service';
import { CreateBotDto } from './dto/create-bot.dto';
import { UpdateBotDto } from './dto/update-bot.dto';

@Controller('bots')
@UseGuards(JwtAuthGuard)
export class BotsController {
  constructor(private readonly bots: BotsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateBotDto) {
    return this.bots.create(user.sub, dto);
  }

  @Get('mine')
  listMine(@CurrentUser() user: JwtPayload) {
    return this.bots.listMine(user.sub);
  }

  @Get('marketplace')
  marketplace(
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.bots.listMarketplace({
      q,
      limit: limit ? parseInt(limit, 10) : undefined,
      cursor,
    });
  }

  @Get('subscribed')
  subscribed(@CurrentUser() user: JwtPayload) {
    return this.bots.listSubscribed(user.sub);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.bots.getById(id);
  }

  @Patch(':id')
  update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateBotDto) {
    return this.bots.update(user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    await this.bots.delete(user.sub, id);
  }

  @Post(':id/subscribe')
  @HttpCode(HttpStatus.OK)
  subscribe(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.bots.subscribe(user.sub, id);
  }

  @Delete(':id/subscribe')
  @HttpCode(HttpStatus.OK)
  unsubscribe(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.bots.unsubscribe(user.sub, id);
  }

  @Post(':id/conversation')
  @HttpCode(HttpStatus.OK)
  openConversation(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.bots.openConversation(user.sub, id);
  }
}
