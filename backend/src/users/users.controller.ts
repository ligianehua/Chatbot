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
import { RegisterDeviceDto } from './dto/register-device.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return this.users.getMe(user.sub);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: JwtPayload, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.sub, dto);
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMe(@CurrentUser() user: JwtPayload) {
    await this.users.deleteAccount(user.sub);
  }

  @Post('me/devices')
  @HttpCode(HttpStatus.OK)
  registerDevice(@CurrentUser() user: JwtPayload, @Body() dto: RegisterDeviceDto) {
    return this.users.registerDevice(user.sub, dto);
  }

  @Get('search')
  search(@Query('q') q: string) {
    return this.users.searchByEmailOrId(q ?? '');
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.users.getById(id);
  }
}
