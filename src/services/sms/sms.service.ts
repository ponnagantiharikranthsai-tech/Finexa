import { Fast2SMSProvider } from "./providers/fast2sms.provider";
import { SMSProvider } from "./sms.interface";

export class SMSService {
  private provider: SMSProvider;

  constructor(provider: SMSProvider = new Fast2SMSProvider()) {
    this.provider = provider;
  }

  async sendSMS(to: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    return this.provider.sendMessage(to, message);
  }
}

export const smsService = new SMSService();
