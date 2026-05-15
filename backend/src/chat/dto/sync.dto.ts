import { IsOptional, IsString } from 'class-validator';

export class SyncDto {
  @IsOptional()
  @IsString()
  sinceMsgId?: string;
}
