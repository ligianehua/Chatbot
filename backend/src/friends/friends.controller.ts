import {
  Body,
  Controller,
  Delete,
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
import { SendRequestDto } from './dto/send-request.dto';
import { FriendsService } from './friends.service';

@Controller('friends')
@UseGuards(JwtAuthGuard)
export class FriendsController {
  constructor(private readonly friends: FriendsService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.friends.listFriends(user.sub);
  }

  @Post('requests')
  @HttpCode(HttpStatus.CREATED)
  send(@CurrentUser() user: JwtPayload, @Body() dto: SendRequestDto) {
    return this.friends.sendRequest(user.sub, dto.friendId, dto.remark);
  }

  @Get('requests/incoming')
  incoming(@CurrentUser() user: JwtPayload) {
    return this.friends.listIncomingRequests(user.sub);
  }

  @Get('requests/outgoing')
  outgoing(@CurrentUser() user: JwtPayload) {
    return this.friends.listOutgoingRequests(user.sub);
  }

  @Post('requests/:requesterId/accept')
  @HttpCode(HttpStatus.OK)
  accept(@CurrentUser() user: JwtPayload, @Param('requesterId') requesterId: string) {
    return this.friends.acceptRequest(user.sub, requesterId);
  }

  @Post('requests/:requesterId/reject')
  @HttpCode(HttpStatus.OK)
  reject(@CurrentUser() user: JwtPayload, @Param('requesterId') requesterId: string) {
    return this.friends.rejectRequest(user.sub, requesterId);
  }

  @Delete(':friendId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: JwtPayload, @Param('friendId') friendId: string) {
    await this.friends.removeFriend(user.sub, friendId);
  }
}
