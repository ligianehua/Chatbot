import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class RechargeDto {
  @IsInt()
  @Min(1)
  @Max(1000000) // $10k cap in cents — dev-only endpoint anyway
  amountCents!: number;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  externalOrderId?: string;
}
