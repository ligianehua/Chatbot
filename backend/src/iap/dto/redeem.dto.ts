import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class RedeemDto {
  @IsIn(['apple', 'google'])
  provider!: 'apple' | 'google';

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  productId!: string;

  /** Apple: signed JWS / receipt; Google: purchase token. */
  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  receipt!: string;
}
