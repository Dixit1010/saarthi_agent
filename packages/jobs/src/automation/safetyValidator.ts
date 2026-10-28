import { Page } from 'playwright';

export interface SafetyCheckResult {
  isBlocked: boolean;
  blockType?: 'CAPTCHA' | 'CLOUDFLARE' | 'LOGIN_REQUIRED' | 'RATE_LIMIT';
  reason?: string;
}

export class SafetyValidator {
  /**
   * Scans the active page for anti-bot barriers or verification challenges.
   * Per Prompt Section 20: STOP immediately if CAPTCHA or verification challenge appears.
   */
  static async checkPageSafety(page: Page): Promise<SafetyCheckResult> {
    const url = page.url();
    const title = await page.title().catch(() => '');
    const content = await page.content().catch(() => '');

    // 1. Cloudflare Turnstile / Challenge (by Title, URL, or DOM Content)
    if (
      title.includes('Just a moment...') ||
      title.includes('Attention Required') ||
      title.includes('Cloudflare') ||
      title.includes('Security Check') ||
      url.includes('__cf_chl') ||
      url.includes('challenges.cloudflare.com') ||
      content.includes('cf-turnstile') ||
      content.includes('cf-challenge') ||
      content.includes('challenges.cloudflare.com') ||
      content.includes('Checking your browser before accessing') ||
      content.includes('Verify you are human') ||
      content.includes('Just a moment...')
    ) {
      return {
        isBlocked: true,
        blockType: 'CLOUDFLARE',
        reason: 'Cloudflare verification challenge active on portal ("Just a moment..."). Pausing automation for safety.',
      };
    }

    // 2. Google reCAPTCHA / hCaptcha (Only trigger on visible interactive challenge frames or explicit challenge URLs, NOT invisible v3 background badges)
    if (url.includes('/checkpoint/challenge') || title.toLowerCase().includes('security verification')) {
      return {
        isBlocked: true,
        blockType: 'CAPTCHA',
        reason: 'Security verification challenge detected on page.',
      };
    }

    const visibleChallengeFrame = await page.evaluate(() => {
      const frames = Array.from(
        document.querySelectorAll(
          'iframe[src*="recaptcha/api2/bframe"], iframe[src*="recaptcha/enterprise/bframe"], iframe[src*="hcaptcha.com"][title*="challenge"]'
        )
      );
      return frames.some((el) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return (
          rect.width > 120 &&
          rect.height > 120 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.opacity !== '0'
        );
      });
    }).catch(() => false);

    if (visibleChallengeFrame) {
      return {
        isBlocked: true,
        blockType: 'CAPTCHA',
        reason: 'Interactive CAPTCHA verification challenge detected.',
      };
    }

    // 3. Login Barrier / Auth required
    if (
      (url.includes('/login') || url.includes('/signin') || url.includes('/auth')) &&
      !url.includes('apply')
    ) {
      return {
        isBlocked: true,
        blockType: 'LOGIN_REQUIRED',
        reason: 'Portal requires candidate sign-in before accessing the application form.',
      };
    }

    if (
      content.includes('Sign in to apply') ||
      content.includes('Log in to apply') ||
      content.includes('Create an account to apply')
    ) {
      return {
        isBlocked: true,
        blockType: 'LOGIN_REQUIRED',
        reason: 'Portal requires applicant account login to view the application form.',
      };
    }

    return { isBlocked: false };
  }
}
