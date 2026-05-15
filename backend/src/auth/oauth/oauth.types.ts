export interface OAuthVerifiedClaims {
  /** Provider-issued stable user id (Apple `sub`, Google `sub`). */
  sub: string;
  email?: string | null;
  /** Whether the email is verified by the provider. */
  emailVerified?: boolean;
  name?: string | null;
  picture?: string | null;
}

export interface OAuthVerifier {
  readonly provider: 'apple' | 'google';
  verify(idToken: string): Promise<OAuthVerifiedClaims>;
}
