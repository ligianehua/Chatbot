import { IsString, MinLength } from 'class-validator';

export class CreateDirectDto {
  @IsString()
  @MinLength(1)
  peerId!: string;
}
