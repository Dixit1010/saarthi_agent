import { chromium, Browser, BrowserContext, Page } from 'playwright';
import path from 'path';
import os from 'os';
import fs from 'fs';

export interface BrowserManagerOptions {
  headless?: boolean;
  channel?: 'chrome' | 'msedge';
  slowMo?: number;
  persistent?: boolean;
  profileDir?: string;
}

export class BrowserProfileLockedError extends Error {
  readonly profileDir: string;
  constructor(profileDir: string, originalError?: string) {
    super(
      `Persistent browser profile is locked or in use at "${profileDir}". ` +
      `Please close any open Chrome/Chromium windows using this profile before running the agent.` +
      (originalError ? ` [Error: ${originalError}]` : '')
    );
    this.name = 'BrowserProfileLockedError';
    this.profileDir = profileDir;
  }
}

export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private activePage: Page | null = null;

  async init(options: BrowserManagerOptions = {}): Promise<Page> {
    const headless = options.headless ?? true;
    const slowMo = options.slowMo ?? (headless ? 0 : 40);
    const usePersistent = options.persistent ?? true;

    const profileDir = options.profileDir
      ? path.resolve(options.profileDir)
      : path.resolve(process.env.LOCALAPPDATA || os.homedir(), 'SaarthiAgent', 'browser_profile');

    if (!fs.existsSync(profileDir)) {
      fs.mkdirSync(profileDir, { recursive: true });
    }

    const commonArgs = [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-infobars',
      ...(headless ? [] : ['--start-maximized']),
    ];

    if (usePersistent) {
      const channelsToTry: Array<string | undefined> = [
        options.channel || 'chrome',
        'msedge',
        undefined, // default bundled chromium
      ];

      for (const ch of channelsToTry) {
        try {
          this.context = await chromium.launchPersistentContext(profileDir, {
            channel: ch,
            headless,
            slowMo,
            viewport: { width: 1280, height: 850 },
            userAgent:
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            locale: 'en-US',
            timezoneId: 'Asia/Kolkata',
            args: commonArgs,
          });
          break;
        } catch (err: any) {
          const msg = (err?.message || '').toLowerCase();
          // If the persistent profile is locked by another active Chrome window, break out and fall back to an isolated browser instance
          if (
            msg.includes('processsingleton') ||
            msg.includes('profile is already in use') ||
            msg.includes('ebusy') ||
            msg.includes('target page, context or browser has been closed') ||
            msg.includes('singletonlock') ||
            msg.includes('lock')
          ) {
            console.warn(`[BrowserManager] Persistent profile at "${profileDir}" is in use; falling back to isolated browser session.`);
            break;
          }
        }
      }
    }

    if (!this.context) {
      // Isolated browser launch if persistent was disabled or if primary profile was locked by another session
      try {
        this.browser = await chromium.launch({
          channel: options.channel || 'chrome',
          headless,
          slowMo,
          args: commonArgs,
        });
      } catch {
        try {
          this.browser = await chromium.launch({
            channel: 'msedge',
            headless,
            slowMo,
            args: commonArgs,
          });
        } catch {
          this.browser = await chromium.launch({
            headless,
            slowMo,
            args: commonArgs,
          });
        }
      }

      this.context = await this.browser.newContext({
        viewport: { width: 1280, height: 850 },
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        locale: 'en-US',
        timezoneId: 'Asia/Kolkata',
      });
    }

    // Inject Stealth Scripts for Anti-Bot Bypass
    await this.context.addInitScript(() => {
      // 1. Mask navigator.webdriver
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      // 2. Real browser plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      // 3. Real languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en', 'hi'],
      });

      // 4. Genuine chrome window object
      (window as any).chrome = {
        runtime: {},
        loadTimes: function () {},
        csi: function () {},
        app: {},
      };
    });

    // Inject authenticated platform session cookies (LinkedIn li_at / Instahyre sessionid)
    await this.injectSessionCookies();

    const pages = this.context.pages();
    const resolvedPage = pages.length > 0 && pages[0] ? pages[0] : await this.context.newPage();
    this.activePage = resolvedPage;
    return resolvedPage;
  }

  private async injectSessionCookies(): Promise<void> {
    if (!this.context) return;

    // Resolve .env values across workspace directories if not already in process.env
    let liAt = (process.env.LINKEDIN_LI_AT || '').trim();
    let instaSession = (process.env.INSTAHYRE_SESSIONID || '').trim();
    let instaCsrf = (process.env.INSTAHYRE_CSRFTOKEN || '').trim();

    if (!liAt || !instaSession) {
      const candidateEnvPaths = [
        path.resolve(process.cwd(), '.env'),
        path.resolve(process.cwd(), '../../.env'),
        path.resolve(process.cwd(), 'tracker-agent/.env'),
      ];
      for (const p of candidateEnvPaths) {
        if (fs.existsSync(p)) {
          try {
            const raw = fs.readFileSync(p, 'utf8');
            const liMatch = raw.match(/^LINKEDIN_LI_AT=["']?([^"'\r\n]+)["']?/m);
            if (!liAt && liMatch?.[1]) liAt = liMatch[1].trim();
            const isMatch = raw.match(/^INSTAHYRE_SESSIONID=["']?([^"'\r\n]+)["']?/m);
            if (!instaSession && isMatch?.[1]) instaSession = isMatch[1].trim();
            const icMatch = raw.match(/^INSTAHYRE_CSRFTOKEN=["']?([^"'\r\n]+)["']?/m);
            if (!instaCsrf && icMatch?.[1]) instaCsrf = icMatch[1].trim();
          } catch {
            // Ignore read error
          }
        }
      }
    }

    const cookiesToAdd: Array<{
      name: string;
      value: string;
      url?: string;
      domain?: string;
      path?: string;
      httpOnly?: boolean;
      secure?: boolean;
      sameSite?: 'Lax' | 'None' | 'Strict';
    }> = [];

    if (liAt) {
      // Clear any duplicate li_at cookies from persistent storage to prevent ERR_TOO_MANY_REDIRECTS
      await this.context.clearCookies({ name: 'li_at' }).catch(() => {});
      cookiesToAdd.push({
        name: 'li_at',
        value: liAt,
        domain: '.www.linkedin.com',
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'None',
      });
    }

    if (instaSession) {
      await this.context.clearCookies({ name: 'sessionid' }).catch(() => {});
      cookiesToAdd.push({
        name: 'sessionid',
        value: instaSession,
        url: 'https://www.instahyre.com',
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
      });
    }

    if (instaCsrf) {
      await this.context.clearCookies({ name: 'csrftoken' }).catch(() => {});
      cookiesToAdd.push({
        name: 'csrftoken',
        value: instaCsrf,
        url: 'https://www.instahyre.com',
        httpOnly: false,
        secure: true,
        sameSite: 'Lax',
      });
    }

    if (cookiesToAdd.length > 0) {
      try {
        await this.context.addCookies(cookiesToAdd);
        console.log(
          `[BrowserManager] Injected ${cookiesToAdd.length} session cookie(s) (${liAt ? 'LinkedIn li_at' : ''}${
            instaSession ? ' Instahyre sessionid' : ''
          }).`
        );
      } catch (err: any) {
        console.warn(`[BrowserManager] Failed to inject session cookies: ${err.message}`);
      }
    }
  }

  getPage(): Page {
    if (!this.activePage) {
      throw new Error('Browser is not initialized. Call init() first.');
    }
    return this.activePage;
  }

  async close(): Promise<void> {
    try {
      if (this.context) await this.context.close();
      if (this.browser) await this.browser.close();
    } catch {
      // Ignored
    } finally {
      this.activePage = null;
      this.context = null;
      this.browser = null;
    }
  }
}
