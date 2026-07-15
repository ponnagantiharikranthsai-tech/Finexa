export interface SMSProvider {
  sendMessage(to: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }>;
}
