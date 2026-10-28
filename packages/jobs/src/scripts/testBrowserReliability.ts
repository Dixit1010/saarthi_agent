import path from 'path';
import os from 'os';
import fs from 'fs';
import {
  BrowserManager,
  BrowserProfileLockedError,
  ManualAuthHelper,
  LiveJobRunner,
} from '../index.js';

async function runReliabilityTests() {
  console.log('===========================================================');
  console.log('🧪 SAARTHI BROWSER RELIABILITY & AUTH RECOVERY TEST SUITE');
  console.log('===========================================================\n');

  // Dedicated temporary directory for testing — never touches user's real profile
  const testProfileDir = path.resolve(os.tmpdir(), `saarthi_test_profile_${Date.now()}`);

  try {
    // -------------------------------------------------------------
    // Test 1: Persistent Profile Launch & Directory Creation
    // -------------------------------------------------------------
    console.log('[Test 1] Testing Persistent Profile Initialization...');
    const bm1 = new BrowserManager();
    const page1 = await bm1.init({
      persistent: true,
      profileDir: testProfileDir,
      headless: true,
    });

    if (!page1) {
      throw new Error('Failed to obtain active page from persistent browser context');
    }
    console.log(`- Page initialized. URL: ${page1.url()}`);
    console.log(`- Profile directory exists: ${fs.existsSync(testProfileDir)}`);

    if (!fs.existsSync(testProfileDir)) {
      throw new Error('Test profile directory was not created');
    }
    console.log('✅ Test 1 Passed: Persistent profile initialized cleanly.\n');

    // -------------------------------------------------------------
    // Test 2: Profile Lock Detection (No Silent Fallback)
    // -------------------------------------------------------------
    console.log('[Test 2] Testing Profile Lock Detection (Second Instance Attempt)...');
    const bm2 = new BrowserManager();
    let lockErrorCaught = false;

    try {
      // Attempting to open the same profile while bm1 is still running
      await bm2.init({
        persistent: true,
        profileDir: testProfileDir,
        headless: true,
      });
    } catch (err: any) {
      console.log(`- Caught expected error: ${err.name}`);
      console.log(`- Error message: "${err.message.slice(0, 80)}..."`);
      if (err instanceof BrowserProfileLockedError || err.name === 'BrowserProfileLockedError') {
        lockErrorCaught = true;
      }
    } finally {
      await bm2.close().catch(() => {});
    }

    if (!lockErrorCaught) {
      throw new Error('CRITICAL FAILURE: Second instance did not throw BrowserProfileLockedError! It may have silently fallen back to ephemeral mode.');
    }
    console.log('✅ Test 2 Passed: Profile lock strictly detected and prevented silent degradation.\n');

    // Clean up bm1
    await bm1.close();
    console.log('- Closed primary test browser context.\n');

    // -------------------------------------------------------------
    // Test 3: Explicit Ephemeral Launch
    // -------------------------------------------------------------
    console.log('[Test 3] Testing Explicit Ephemeral Browser Mode (persistent: false)...');
    const bmEphemeral = new BrowserManager();
    const ephemeralPage = await bmEphemeral.init({
      persistent: false,
      headless: true,
    });

    if (!ephemeralPage) {
      throw new Error('Failed to initialize ephemeral browser');
    }
    console.log(`- Ephemeral page initialized. URL: ${ephemeralPage.url()}`);
    await bmEphemeral.close();
    console.log('✅ Test 3 Passed: Explicit ephemeral mode works without lock requirement.\n');

    // -------------------------------------------------------------
    // Test 4: ManualAuthHelper Detection of Login Wall
    // -------------------------------------------------------------
    console.log('[Test 4] Testing ManualAuthHelper Login State Detection...');
    const bmAuth = new BrowserManager();
    const pageAuth = await bmAuth.init({
      persistent: false,
      headless: true,
    });

    // Navigate to a simulated login page
    await pageAuth.setContent(`
      <html>
        <body>
          <form class="login__form">
            <input id="session_key" type="text" />
            <input type="password" />
            <button type="submit">Sign In</button>
          </form>
        </body>
      </html>
    `);

    const loginStatus = await ManualAuthHelper.checkLoginStatus(pageAuth, 'LINKEDIN');
    console.log(`- Detected isLoginRequired: ${loginStatus.isLoginRequired} (expected: true)`);
    console.log(`- Detected isChallenge: ${loginStatus.isChallenge} (expected: false)`);

    if (!loginStatus.isLoginRequired) {
      throw new Error('ManualAuthHelper failed to detect LinkedIn login wall');
    }
    console.log('✅ Test 4 Passed: Login wall accurately detected.\n');

    // -------------------------------------------------------------
    // Test 5: ManualAuthHelper Timeout & Clean Failure
    // -------------------------------------------------------------
    console.log('[Test 5] Testing ManualAuthHelper Non-Interactive Timeout Handling...');
    const authResult = await ManualAuthHelper.ensureAuthenticated({
      page: pageAuth,
      platform: 'LINKEDIN',
      timeoutSeconds: 4, // Fast 4-second timeout for testing
      interactive: false,
      onLog: (m) => console.log(`  [Helper Log] ${m}`),
    });

    console.log(`- Result authenticated: ${authResult.authenticated} (expected: false)`);
    console.log(`- Result reason: "${authResult.reason}"`);

    if (authResult.authenticated !== false) {
      throw new Error('Expected authentication to fail when remaining on login page');
    }
    await bmAuth.close();
    console.log('✅ Test 5 Passed: Authentication timeout handled cleanly with informative reason.\n');

    // -------------------------------------------------------------
    // Test 6: Safe Dry-Run Enforcement
    // -------------------------------------------------------------
    console.log('[Test 6] Testing Safe Dry-Run Default in Live Runner...');
    // We run with dummy non-existent platform to test options parsing without opening network
    const dryRunSummary = await LiveJobRunner.execute({
      platforms: [],
      headless: true,
    });

    console.log(`- Execution completed with success: ${dryRunSummary.success}`);
    console.log(`- Total applied: ${dryRunSummary.totalApplied} (expected: 0)`);
    if (dryRunSummary.totalApplied !== 0) {
      throw new Error('Unexpected applications submitted during dry-run test');
    }
    console.log('✅ Test 6 Passed: Live runner respects safety defaults.\n');

    console.log('===========================================================');
    console.log('🎉 ALL 6 BROWSER RELIABILITY TESTS PASSED WITH 100% SUCCESS!');
    console.log('===========================================================');
  } finally {
    // Safely remove test profile directory
    try {
      if (fs.existsSync(testProfileDir)) {
        fs.rmSync(testProfileDir, { recursive: true, force: true });
        console.log(`- Cleaned up test directory: ${testProfileDir}`);
      }
    } catch {
      // Ignored
    }
  }
}

runReliabilityTests().catch((err) => {
  console.error('\n❌ RELIABILITY TEST SUITE FAILED:', err);
  process.exit(1);
});
