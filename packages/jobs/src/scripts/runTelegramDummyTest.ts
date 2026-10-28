import fs from 'fs';
import path from 'path';
import { DummyTelegramTestRunner } from '../testing/dummyTestRunner.js';
import { telegramNotifier } from '../telegram/telegramNotifier.js';

// Zero-dependency .env loader for reliable cross-package execution
function loadEnv() {
  const possiblePaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../../.env'),
    path.resolve(process.cwd(), 'apps/api/.env'),
  ];

  for (const envPath of possiblePaths) {
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
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

async function main() {
  loadEnv();
  telegramNotifier.refreshCredentials();

  const isMockMode = process.argv.includes('--mock') || !telegramNotifier.isConfigured();

  console.log('================================================================');
  console.log('🧪 SAARTHI AI — TELEGRAM DUMMY DATA TEST HARNESS');
  console.log('================================================================');
  console.log(`Mode: ${isMockMode ? 'MOCK (Offline)' : 'LIVE TELEGRAM (Real alerts to phone)'}`);
  console.log(`Telegram Bot Configured: ${telegramNotifier.isConfigured()}`);
  console.log(`Target Chat ID: ${process.env.TELEGRAM_CHAT_ID || 'none'}`);
  console.log('----------------------------------------------------------------\n');

  if (isMockMode && !telegramNotifier.isConfigured()) {
    console.log('Notice: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured; running in mock interceptor mode.\n');
  }

  const runner = new DummyTelegramTestRunner();
  const startTime = Date.now();

  const report = await runner.runAllScenarios({
    sendToTelegram: !isMockMode,
    delayMs: 1200, // Safe delay between Telegram messages to respect rate limits
  });

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n================================================================');
  console.log('📋 TEST SCENARIOS EXECUTION REPORT');
  console.log('================================================================');

  report.scenarioResults.forEach((res, idx) => {
    const icon = res.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`[${idx + 1}/8] ${icon} — ${res.scenario}`);
    console.log(`      Job ID: ${res.jobId} | Details: ${res.details}`);
    console.log(`      Notification Dispatched: ${res.notificationSent ? 'Yes' : 'Skipped (Mock)'}`);
  });

  console.log('----------------------------------------------------------------');
  console.log(`• Deduplication Verification: ${report.deduplicationVerified ? '✅ VERIFIED (Duplicates suppressed)' : '❌ FAILED'}`);
  console.log(`• Isolated Approval Safety:  ${report.approvalSafetyVerified ? '✅ VERIFIED (Zero live side-effects)' : '❌ FAILED'}`);
  console.log(`• Total Scenarios Passed:    ${report.totalScenariosPassed} / ${report.totalScenariosCount}`);
  console.log(`• Total Time Elapsed:        ${durationSec}s`);
  console.log('================================================================\n');

  if (report.totalScenariosPassed === report.totalScenariosCount && report.deduplicationVerified && report.approvalSafetyVerified) {
    console.log('🎉 ALL DUMMY-DATA TEST SCENARIOS COMPLETED WITH 100% SUCCESS!\n');
    process.exit(0);
  } else {
    console.error('⚠️ Some dummy test scenarios failed or were not verified.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
