import { Platform } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDeviceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  deviceId!: string;

  @IsEnum(Platform)
  platform!: Platform;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  pushToken?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  appVersion?: string;
}
