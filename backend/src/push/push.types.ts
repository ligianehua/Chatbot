export interface PushNotification {
  title: string;
  body: string;
  /** key/value strings only (FCM requirement). Used for deep linking. */
  data?: Record<string, string>;
}

export interface PushSendResult {
  token: string;
  success: boolean;
  /** Normalized error code so we can prune dead tokens regardless of provider. */
  errorCode?: 'invalid-token' | 'unregistered' | 'rate-limited' | 'other';
  message?: string;
}

export interface PushProvider {
  readonly name: string;
  sendMulticast(tokens: string[], notification: PushNotification): Promise<PushSendResult[]>;
}
