import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class OAuthDto {
  @IsIn(['apple', 'google'])
  provider!: 'apple' | 'google';

  @IsString()
  @MinLength(8)
  idToken!: string;

  /**
   * Optional nickname override. Apple never returns the user's name in the
   * id token (only in the first auth response on iOS); the client can
   * forward what it captured locally.
   */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  nickname?: string;
}
