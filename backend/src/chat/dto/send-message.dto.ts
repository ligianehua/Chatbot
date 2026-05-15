import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  conversationId!: string;

  @IsOptional()
  @IsIn(['text', 'image'])
  type?: 'text' | 'image';

  // Required for text messages, ignored for image.
  @ValidateIf((o: SendMessageDto) => (o.type ?? 'text') === 'text')
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  text?: string;

  // Required for image messages. Accepts both absolute URLs (S3) and
  // server-relative paths (/uploads/...).
  @ValidateIf((o: SendMessageDto) => o.type === 'image')
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  url?: string;

  @ValidateIf((o: SendMessageDto) => o.type === 'image')
  @IsString()
  @MaxLength(60)
  mime?: string;

  @ValidateIf((o: SendMessageDto) => o.type === 'image')
  @IsInt()
  @Min(0)
  size?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  width?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  height?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  clientMsgId?: string;

  @IsOptional()
  @IsString()
  replyToId?: string;
}
