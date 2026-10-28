import assert from 'assert';
import { TelegramClient, TelegramUpdate } from '../telegram/telegramClient.js';
import { telegramBot } from '../telegram/telegramBot.js';
import { approvalManager } from '../telegram/approvalManager.js';
import { agentState } from '../state/agentStateManager.js';
import { telegramNotifier } from '../telegram/telegramNotifier.js';

async function runTests() {
  console.log('🧪 Starting Saarthi Telegram Bot & Security Test Suite...\n');

  const FAKE_TOKEN = '123456789:ABCdefGHIjklMNOpqrSTUvwxYZ_test_secret';
  const AUTHORIZED_USER_ID = '987654321';
  const UNAUTHORIZED_USER_ID = '111222333';
  const PRIVATE_CHAT_ID = '987654321';

  // Setup environment for testing
  process.env.TELEGRAM_BOT_TOKEN = FAKE_TOKEN;
  process.env.TELEGRAM_ALLOWED_USER_ID = AUTHORIZED_USER_ID;
  process.env.TELEGRAM_CHAT_ID = PRIVATE_CHAT_ID;

  // Intercept fetch calls to mock Telegram API locally
  const sentMessages: Array<{ chatId: string; text: string; markup?: any }> = [];
  const answeredCallbacks: Array<{ id: string; text?: string }> = [];

  const getMsg = (idx: number = 0) => {
    const msg = sentMessages[idx];
    assert(msg, `Expected message at index ${idx}`);
    return msg;
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: any, init?: any) => {
    const urlStr = String(url);

    if (urlStr.includes('/sendMessage')) {
      const body = JSON.parse(init?.body || '{}');
      sentMessages.push({
        chatId: body.chat_id,
        text: body.text,
        markup: body.reply_markup,
      });
      return new Response(JSON.stringify({ ok: true, result: { message_id: 101 } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (urlStr.includes('/answerCallbackQuery')) {
      const body = JSON.parse(init?.body || '{}');
      answeredCallbacks.push({ id: body.callback_query_id, text: body.text });
      return new Response(JSON.stringify({ ok: true, result: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, result: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    telegramBot.reloadConfig();
    telegramNotifier.refreshCredentials();

    // -------------------------------------------------------------------
    // Test 1: Token sanitization
    // -------------------------------------------------------------------
    console.log('Test 1: Verifying Telegram token sanitization and masking...');
    const client = new TelegramClient(FAKE_TOKEN);
    const sanitized = client.sanitize(`Error communicating with token ${FAKE_TOKEN} at endpoint`);
    assert.strictEqual(
      sanitized.includes(FAKE_TOKEN),
      false,
      'Token was leaked in sanitized string!'
    );
    assert.strictEqual(
      sanitized.includes('[REDACTED_TELEGRAM_TOKEN]'),
      true,
      'Redaction marker missing!'
    );
    console.log('✅ PASS: Telegram bot token is properly redacted from error traces and logs.\n');

    // -------------------------------------------------------------------
    // Test 2: Strict Authorization (Reject unauthorized user)
    // -------------------------------------------------------------------
    console.log('Test 2: Verifying unauthorized user commands are strictly blocked...');
    sentMessages.length = 0;

    const unauthorizedUpdate: TelegramUpdate = {
      update_id: 1,
      message: {
        message_id: 1,
        from: { id: Number(UNAUTHORIZED_USER_ID), is_bot: false },
        chat: { id: Number(UNAUTHORIZED_USER_ID), type: 'private' },
        date: Math.floor(Date.now() / 1000),
        text: '/status',
      },
    };

    await telegramBot.processUpdate(unauthorizedUpdate);
    assert.strictEqual(
      sentMessages.length,
      0,
      'Unauthorized user was able to execute command!'
    );
    console.log('✅ PASS: Unauthorized messages are silently dropped without executing commands.\n');

    // -------------------------------------------------------------------
    // Test 3: Authorized Commands (/status, /pause, /resume, /help)
    // -------------------------------------------------------------------
    console.log('Test 3: Verifying authorized user commands (/help, /status, /pause, /resume)...');
    sentMessages.length = 0;

    // A. /help
    await telegramBot.processUpdate({
      update_id: 2,
      message: {
        message_id: 2,
        from: { id: Number(AUTHORIZED_USER_ID), is_bot: false },
        chat: { id: Number(PRIVATE_CHAT_ID), type: 'private' },
        date: Math.floor(Date.now() / 1000),
        text: '/help',
      },
    });
    assert.strictEqual(sentMessages.length, 1);
    assert.strictEqual(getMsg(0).chatId, PRIVATE_CHAT_ID);
    assert.strictEqual(getMsg(0).text.includes('/status'), true);

    // B. /pause
    sentMessages.length = 0;
    assert.strictEqual(agentState.isPaused(), false);
    await telegramBot.processUpdate({
      update_id: 3,
      message: {
        message_id: 3,
        from: { id: Number(AUTHORIZED_USER_ID), is_bot: false },
        chat: { id: Number(PRIVATE_CHAT_ID), type: 'private' },
        date: Math.floor(Date.now() / 1000),
        text: '/pause',
      },
    });
    assert.strictEqual(agentState.isPaused(), true, 'Agent state was not paused!');
    assert.strictEqual(getMsg(0).text.includes('Paused'), true);

    // C. /resume
    sentMessages.length = 0;
    await telegramBot.processUpdate({
      update_id: 4,
      message: {
        message_id: 4,
        from: { id: Number(AUTHORIZED_USER_ID), is_bot: false },
        chat: { id: Number(PRIVATE_CHAT_ID), type: 'private' },
        date: Math.floor(Date.now() / 1000),
        text: '/resume',
      },
    });
    assert.strictEqual(agentState.isPaused(), false, 'Agent state was not resumed!');
    assert.strictEqual(getMsg(0).text.includes('Resumed'), true);

    // D. /status
    sentMessages.length = 0;
    await telegramBot.processUpdate({
      update_id: 5,
      message: {
        message_id: 5,
        from: { id: Number(AUTHORIZED_USER_ID), is_bot: false },
        chat: { id: Number(PRIVATE_CHAT_ID), type: 'private' },
        date: Math.floor(Date.now() / 1000),
        text: '/status',
      },
    });
    assert.strictEqual(sentMessages.length, 1);
    assert.strictEqual(getMsg(0).text.includes('Saarthi Agent Status'), true);
    console.log('✅ PASS: Authorized user commands successfully processed and replied to private chat.\n');

    // -------------------------------------------------------------------
    // Test 4: Approval Lifecycle & Dry-Run Safety
    // -------------------------------------------------------------------
    console.log('Test 4: Verifying single-job approval with atomic consumption and dry-run safety...');
    approvalManager.reset();

    let executedCallCount = 0;
    const testRequest = approvalManager.createRequest({
      jobId: 'cisco_cpp_001',
      company: 'Cisco Systems',
      title: 'Software Engineer C++',
      jobUrl: 'https://cisco.jobs/test',
      matchScore: 92,
      ttlSeconds: 1800,
      executor: async () => {
        executedCallCount++;
        return {
          success: true,
          message: '[DRY-RUN] Verified form fields for Cisco without live submission.',
          dryRun: true,
        };
      },
    });

    assert.strictEqual(testRequest.status, 'PENDING');
    assert.strictEqual(approvalManager.getPendingCount(), 1);

    // Approve the request
    sentMessages.length = 0;
    await telegramBot.processUpdate({
      update_id: 6,
      message: {
        message_id: 6,
        from: { id: Number(AUTHORIZED_USER_ID), is_bot: false },
        chat: { id: Number(PRIVATE_CHAT_ID), type: 'private' },
        date: Math.floor(Date.now() / 1000),
        text: `/approve cisco_cpp_001`,
      },
    });

    assert.strictEqual(executedCallCount, 1, 'Executor was not called!');
    assert.strictEqual(testRequest.status, 'CONSUMED', 'Request was not consumed atomically!');
    assert.strictEqual(getMsg(0).text.includes('Approval Processed'), true);

    // Attempt second approval on same job (must be rejected - single-use)
    sentMessages.length = 0;
    await telegramBot.processUpdate({
      update_id: 7,
      message: {
        message_id: 7,
        from: { id: Number(AUTHORIZED_USER_ID), is_bot: false },
        chat: { id: Number(PRIVATE_CHAT_ID), type: 'private' },
        date: Math.floor(Date.now() / 1000),
        text: `/approve cisco_cpp_001`,
      },
    });
    assert.strictEqual(executedCallCount, 1, 'Executor was called twice! Double-consumption!');
    assert.strictEqual(getMsg(0).text.includes('already been processed'), true);
    console.log('✅ PASS: Approvals are strictly single-use and consumed atomically.\n');

    // -------------------------------------------------------------------
    // Test 5: Approval TTL Expiration
    // -------------------------------------------------------------------
    console.log('Test 5: Verifying approval TTL expiration...');
    const expiredRequest = approvalManager.createRequest({
      jobId: 'stale_job_999',
      company: 'Stale Tech',
      title: 'Systems Engineer',
      jobUrl: 'https://stale.jobs/test',
      matchScore: 75,
      ttlSeconds: -10, // Already expired
    });
    assert(expiredRequest);

    const expireResult = await approvalManager.approve('stale_job_999');
    assert.strictEqual(expireResult.success, false);
    assert.strictEqual(expireResult.message.includes('expired'), true);
    console.log('✅ PASS: Expired approval requests cannot be executed.\n');

    // -------------------------------------------------------------------
    // Test 6: Callback Query Authorization (Inline Buttons)
    // -------------------------------------------------------------------
    console.log('Test 6: Verifying callback query validation from inline buttons...');
    const inlineReq = approvalManager.createRequest({
      jobId: 'qualcomm_eng_123',
      company: 'Qualcomm',
      title: 'Embedded Firmware Engineer',
      jobUrl: 'https://qualcomm.jobs/123',
      matchScore: 89,
    });

    answeredCallbacks.length = 0;
    // Unauthorized callback
    await telegramBot.processUpdate({
      update_id: 8,
      callback_query: {
        id: 'cb_unauth_01',
        from: { id: Number(UNAUTHORIZED_USER_ID), is_bot: false },
        data: `approve:${inlineReq.id}`,
      },
    });
    assert.strictEqual(answeredCallbacks.some((c) => c.text === 'Unauthorized'), true);
    assert.strictEqual(inlineReq.status, 'PENDING');

    // Authorized callback
    answeredCallbacks.length = 0;
    await telegramBot.processUpdate({
      update_id: 9,
      callback_query: {
        id: 'cb_auth_02',
        from: { id: Number(AUTHORIZED_USER_ID), is_bot: false },
        data: `approve:${inlineReq.id}`,
      },
    });
    assert.strictEqual(inlineReq.status, 'CONSUMED');
    console.log('✅ PASS: Inline button callback queries strictly validate user ID.\n');

    // -------------------------------------------------------------------
    // Test 7: Notification Accuracy (Never claim dry-run is submitted)
    // -------------------------------------------------------------------
    console.log('Test 7: Verifying notification accuracy (Dry-Run vs Live)...');
    sentMessages.length = 0;

    // Send dry-run completion notification
    await telegramNotifier.notifyApplicationSubmitted({
      title: 'Embedded Firmware Engineer',
      company: 'Qualcomm',
      platform: 'LINKEDIN',
      dryRun: true,
    });
    assert.strictEqual(getMsg(0).text.includes('Dry-Run Completed'), true);
    assert.strictEqual(getMsg(0).text.includes('Not Submitted'), true);
    assert.strictEqual(
      getMsg(0).text.includes('Submission button was not pressed'),
      true
    );

    // Send live submission notification
    sentMessages.length = 0;
    await telegramNotifier.notifyApplicationSubmitted({
      title: 'Software Engineer C++',
      company: 'Cisco',
      platform: 'LINKEDIN',
      dryRun: false,
    });
    assert.strictEqual(getMsg(0).text.includes('Live Application Submitted'), true);
    assert.strictEqual(getMsg(0).text.includes('Submission confirmed'), true);
    console.log('✅ PASS: Notification dispatcher strictly separates dry-run inspections from live submissions.\n');

    console.log('🎉 ALL 7/7 TELEGRAM BOT SECURITY & INTEGRATION TESTS PASSED CLEANLY!\n');
  } finally {
    globalThis.fetch = originalFetch;
    telegramBot.stop();
  }
}

runTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
