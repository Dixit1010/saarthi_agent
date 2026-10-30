export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: {
      id: number;
      is_bot: boolean;
      first_name?: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
      title?: string;
      username?: string;
    };
    date: number;
    text?: string;
  };
  callback_query?: {
    id: string;
    from: {
      id: number;
      is_bot: boolean;
      first_name?: string;
      username?: string;
    };
    message?: {
      message_id: number;
      chat: {
        id: number;
        type: string;
      };
    };
    data?: string;
  };
}

export interface TelegramClientConfig {
  botToken: string;
  allowedUserId?: string;
  chatId?: string;
}

export class TelegramClient {
  private botToken: string;
  private baseUrl: string;

  constructor(botToken: string) {
    this.botToken = botToken;
    this.baseUrl = `https://api.telegram.org/bot${botToken}`;
  }

  /**
   * Masks any instance of the token from strings/errors
   */
  public sanitize(input: string): string {
    if (!this.botToken || this.botToken.length < 5) return input;
    return input.replaceAll(this.botToken, '[REDACTED_TELEGRAM_TOKEN]');
  }

  public async getUpdates(
    offset: number,
    timeoutSeconds: number = 25,
    signal?: AbortSignal
  ): Promise<TelegramUpdate[]> {
    const url = `${this.baseUrl}/getUpdates?offset=${offset}&timeout=${timeoutSeconds}`;
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Telegram getUpdates failed HTTP ${res.status}: ${errText}`);
      }

      const data = (await res.json()) as { ok: boolean; result: TelegramUpdate[]; description?: string };
      if (!data.ok) {
        throw new Error(`Telegram API Error: ${data.description || 'Unknown error'}`);
      }

      return data.result || [];
    } catch (err: any) {
      if (err.name === 'AbortError' || signal?.aborted) {
        return [];
      }
      throw new Error(this.sanitize(err.message || String(err)));
    }
  }

  public async sendMessage(
    chatId: string,
    text: string,
    options: {
      parse_mode?: 'HTML' | 'MarkdownV2';
      reply_markup?: any;
      disable_web_page_preview?: boolean;
    } = {}
  ): Promise<boolean> {
    const url = `${this.baseUrl}/sendMessage`;
    const body = {
      chat_id: chatId,
      text,
      parse_mode: options.parse_mode ?? 'HTML',
      reply_markup: options.reply_markup,
      disable_web_page_preview: options.disable_web_page_preview ?? true,
    };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.error(`[TelegramClient] Failed to send message: ${this.sanitize(errText)}`);
        return false;
      }

      const data = (await res.json()) as { ok: boolean; description?: string };
      return data.ok;
    } catch (err: any) {
      console.error(`[TelegramClient] Error sending message: ${this.sanitize(err.message || String(err))}`);
      return false;
    }
  }

  public async answerCallbackQuery(callbackQueryId: string, text?: string): Promise<boolean> {
    const url = `${this.baseUrl}/answerCallbackQuery`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text: text || '',
          show_alert: false,
        }),
      });
      const data = (await res.json()) as { ok: boolean };
      return data.ok;
    } catch (err: any) {
      console.error(`[TelegramClient] Error answering callback: ${this.sanitize(err.message || String(err))}`);
      return false;
    }
  }

  public async setMyCommands(commands: Array<{ command: string; description: string }>): Promise<boolean> {
    const url = `${this.baseUrl}/setMyCommands`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commands }),
      });
      const data = (await res.json()) as { ok: boolean };
      return data.ok;
    } catch {
      return false;
    }
  }
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
