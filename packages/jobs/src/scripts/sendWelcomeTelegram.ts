import fs from 'fs';
import path from 'path';
import { TelegramClient } from '../telegram/telegramClient.js';

// Simple zero-dependency .env parser
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      }
    }
  }
}

async function main() {
  loadEnv();

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  console.log(`Checking Telegram credentials... Token present: ${Boolean(token)}, Chat ID: ${chatId}`);

  if (!token || !chatId) {
    console.error('Missing credentials in .env');
    process.exit(1);
  }

  const client = new TelegramClient(token);
  const welcomeText = [
    `🤖 <b>Saarthi AI Assistant Bot Connected!</b>`,
    ``,
    `Namaste Dixit! Your Telegram remote command and notification bridge is now active on your laptop.`,
    ``,
    `Try sending one of these commands right here:`,
    `• <b>/status</b> — View agent state, daily caps & queue`,
    `• <b>/pause</b> — Pause automatic job scans`,
    `• <b>/resume</b> — Resume agent activity`,
    `• <b>/help</b> — Show command reference`,
    ``,
    `<i>All job matches, approval requests with interactive buttons, and browser alerts will appear here in real-time.</i>`,
  ].join('\n');

  console.log('Sending welcome message to Telegram...');
  const success = await client.sendMessage(chatId, welcomeText);
  if (success) {
    console.log('✅ Welcome message sent successfully to your Telegram!');
  } else {
    console.error('❌ Failed to send message. Please ensure you have pressed [Start] on your bot in Telegram.');
  }
}

main().catch(console.error);
