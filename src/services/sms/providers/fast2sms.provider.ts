import { SMSProvider } from "../sms.interface";

export class Fast2SMSProvider implements SMSProvider {
  private apiKey = process.env.FAST2SMS_API_KEY;

  async sendMessage(to: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.apiKey) {
      return { success: false, error: "FAST2SMS_API_KEY is not defined in environment variables" };
    }

    const cleanedPhone = to.replace(/[^0-9]/g, "");
    const targetPhone = cleanedPhone.length > 10 ? cleanedPhone.slice(-10) : cleanedPhone;

    try {
      const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
        method: "POST",
        headers: {
          authorization: this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          route: "q",
          message: message,
          language: "english",
          flash: 0,
          numbers: targetPhone,
        }),
      });

      const data = await response.json();
      if (data.return === true) {
        return { success: true, messageId: data.request_id };
      } else {
        const errorMsg = Array.isArray(data.message) 
          ? data.message.join(", ") 
          : typeof data.message === "string" 
          ? data.message 
          : "Unknown error";
        return { success: false, error: errorMsg };
      }
    } catch (err: any) {
      return { success: false, error: err.message || "Network request failed" };
    }
  }
}
