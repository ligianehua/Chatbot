import { Gender } from '@prisma/client';
import { IsEnum, IsISO8601, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  nickname?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  avatarUrl?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsISO8601()
  birthday?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  region?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  bio?: string;
}
