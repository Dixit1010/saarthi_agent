import { Page } from 'playwright';
import readline from 'readline';
import { SafetyValidator } from './safetyValidator.js';
import { telegramNotifier } from '../telegram/telegramNotifier.js';

export interface ManualAuthOptions {
  page: Page;
  platform: 'LINKEDIN' | 'INSTAHYRE';
  timeoutSeconds?: number;
  onLog?: (message: string) => void;
  interactive?: boolean;
}

export interface ManualAuthResult {
  authenticated: boolean;
  reason?: string;
}

export class ManualAuthHelper {
  /**
   * Checks whether the current page on the specified platform is on a login wall or security challenge.
   */
  static async checkLoginStatus(page: Page, platform: 'LINKEDIN' | 'INSTAHYRE'): Promise<{
    isLoginRequired: boolean;
    isChallenge: boolean;
    challengeReason?: string;
  }> {
    // 1. Check for anti-bot / verification challenges (Cloudflare, reCAPTCHA, etc.)
    const safety = await SafetyValidator.checkPageSafety(page);
    if (safety.isBlocked) {
      return {
        isLoginRequired: safety.blockType === 'LOGIN_REQUIRED',
        isChallenge: safety.blockType !== 'LOGIN_REQUIRED',
        challengeReason: safety.reason,
      };
    }

    // 2. Platform-specific DOM and URL checks
    if (platform === 'LINKEDIN') {
      const isLogin = await page.evaluate(() => {
        const url = window.location.href;
        const hasSessionInput = document.querySelector('input#session_key, input[name="session_key"]') !== null;
        const hasLoginForm = document.querySelector('form.login__form, form[action*="login"]') !== null;
        const isAuthWall = url.includes('/authwall') || url.includes('/login') || url.includes('/checkpoint');
        const hasLoggedInNav =
          document.querySelector('.global-nav__me, .global-nav__primary-items, .scaffold-layout__list-container') !== null;
        const hasGuestSignInBtn =
          document.querySelector('a.nav__button-secondary, .contextual-sign-in-modal, a[href*="/login"]') !== null &&
          !hasLoggedInNav;
        return isAuthWall || hasSessionInput || hasLoginForm || hasGuestSignInBtn;
      }).catch(() => false);

      return {
        isLoginRequired: isLogin,
        isChallenge: false,
      };
    }

    if (platform === 'INSTAHYRE') {
      const isLogin = await page.evaluate(() => {
        const url = window.location.href;
        const hasEmailInput = document.querySelector('input[name="email"], input#email') !== null;
        const hasLoginForm = document.querySelector('form#login-form, form[action*="login"]') !== null;
        const isLoginUrl = url.includes('/login') || url.includes('/candidate/login');
        return isLoginUrl || (hasEmailInput && hasLoginForm);
      }).catch(() => false);

      return {
        isLoginRequired: isLogin,
        isChallenge: false,
      };
    }

    return { isLoginRequired: false, isChallenge: false };
  }

  /**
   * Ensures the browser session is authenticated before continuing the workflow.
   * Prompts the user interactively if in a terminal, or polls politely up to timeoutSeconds.
   * Never attempts to bypass challenges.
   */
  static async ensureAuthenticated(options: ManualAuthOptions): Promise<ManualAuthResult> {
    const { page, platform, timeoutSeconds = 300, onLog } = options;
    const isInteractive = options.interactive ?? Boolean(process.stdin && process.stdin.isTTY);

    const log = (msg: string) => {
      if (onLog) onLog(msg);
      console.log(`[ManualAuthHelper] ${msg}`);
    };

    // Initial check
    const initialStatus = await this.checkLoginStatus(page, platform);
    if (!initialStatus.isLoginRequired && !initialStatus.isChallenge) {
      return { authenticated: true };
    }

    if (initialStatus.isChallenge) {
      log(`⚠️ Security challenge detected on ${platform}: ${initialStatus.challengeReason}`);
      log('Please complete the verification challenge manually in the visible browser window.');
    } else {
      log(`🔐 ${platform} authentication required (login / 2FA / OTP).`);
      log('Please log in manually on the visible browser window.');
      if (platform === 'LINKEDIN' && !page.url().includes('/login')) {
        await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
      }
    }

    const alertReason = initialStatus.isChallenge
      ? (initialStatus.challengeReason || 'Security verification required')
      : 'User login / 2FA / OTP required';
    void telegramNotifier.notifySecurityChallenge(platform, alertReason, timeoutSeconds);

    log(`Awaiting user authentication (timeout: ${timeoutSeconds}s)...`);

    let userConfirmedOrAborted: 'CONFIRMED' | 'ABORTED' | null = null;
    let rl: readline.Interface | null = null;

    if (isInteractive) {
      rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      console.log('\n------------------------------------------------------------');
      console.log(`👉 Press [Enter] once you have logged in to ${platform}, or type 'q' + [Enter] to abort:`);
      console.log('------------------------------------------------------------\n');

      rl.once('line', (line) => {
        if (line.trim().toLowerCase() === 'q') {
          userConfirmedOrAborted = 'ABORTED';
        } else {
          userConfirmedOrAborted = 'CONFIRMED';
        }
      });
    }

    const startTime = Date.now();
    const maxDurationMs = timeoutSeconds * 1000;
    let loopCount = 0;

    try {
      while (Date.now() - startTime < maxDurationMs) {
        if (userConfirmedOrAborted === 'ABORTED') {
          log(`Manual login was cancelled by the user.`);
          return {
            authenticated: false,
            reason: 'User cancelled manual authentication.',
          };
        }

        if (userConfirmedOrAborted === 'CONFIRMED') {
          log('User indicated login complete. Verifying session...');
          await page.waitForTimeout(2000).catch(() => {});
          const verifyStatus = await this.checkLoginStatus(page, platform);
          if (!verifyStatus.isLoginRequired && !verifyStatus.isChallenge) {
            log(`✅ ${platform} session successfully verified! Resuming workflow.`);
            return { authenticated: true };
          } else {
            log(`❌ Verification failed: ${platform} still appears unauthenticated or on a challenge page.`);
            return {
              authenticated: false,
              reason: verifyStatus.challengeReason || `Still on ${platform} login page after manual confirmation.`,
            };
          }
        }

        // Periodic background poll (every 3 seconds)
        await page.waitForTimeout(3000).catch(() => {});
        loopCount++;

        const currentStatus = await this.checkLoginStatus(page, platform);
        if (!currentStatus.isLoginRequired && !currentStatus.isChallenge) {
          log(`✅ ${platform} login detected automatically! Resuming workflow.`);
          return { authenticated: true };
        }

        // Periodic reminder in log every 24 seconds (8 iterations)
        if (loopCount % 8 === 0) {
          const remainingSec = Math.round((maxDurationMs - (Date.now() - startTime)) / 1000);
          log(`Waiting for ${platform} manual login... (${remainingSec}s remaining)`);
        }
      }

      log(`⏱️ Manual authentication wait timed out after ${timeoutSeconds}s.`);
      return {
        authenticated: false,
        reason: `Manual login timed out after ${timeoutSeconds} seconds.`,
      };
    } finally {
      if (rl) {
        rl.close();
      }
    }
  }
}
