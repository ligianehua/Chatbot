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
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { AddMembersDto } from './dto/add-members.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { GroupsService } from './groups.service';

@Controller('groups')
@UseGuards(JwtAuthGuard)
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateGroupDto) {
    return this.groups.create(user.sub, dto);
  }

  @Get('mine')
  listMine(@CurrentUser() user: JwtPayload) {
    return this.groups.listMine(user.sub);
  }

  @Get(':id')
  detail(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.groups.detail(user.sub, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateGroupDto) {
    return this.groups.update(user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async disband(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    await this.groups.disband(user.sub, id);
  }

  @Post(':id/members')
  @HttpCode(HttpStatus.OK)
  addMembers(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AddMembersDto,
  ) {
    return this.groups.addMembers(user.sub, id, dto);
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
  ) {
    await this.groups.removeMember(user.sub, id, targetUserId);
  }

  @Post(':id/conversation')
  @HttpCode(HttpStatus.OK)
  openConversation(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.groups.openConversation(user.sub, id);
  }
}
