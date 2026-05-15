import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SendRequestDto {
  @IsString()
  @MinLength(1)
  friendId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  remark?: string;
}
