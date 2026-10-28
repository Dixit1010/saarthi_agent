import { Page, ElementHandle } from 'playwright';

/**
 * Human Emulation Engine
 * Emulates natural human physical gestures: curved mouse trajectories, jitter,
 * micro-pauses, smooth variable-speed scrolling, reading time, and variable keystroke cadence.
 */
export class HumanEmulation {
  /**
   * Generates a random integer between min and max (inclusive).
   */
  static randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Natural sleep with random noise.
   */
  static async sleep(minMs: number, maxMs?: number): Promise<void> {
    const duration = maxMs ? HumanEmulation.randomBetween(minMs, maxMs) : minMs;
    await new Promise((resolve) => setTimeout(resolve, duration));
  }

  /**
   * Moves mouse in a natural curved Bézier trajectory rather than a robotic straight line.
   */
  static async humanMouseMove(page: Page, targetX: number, targetY: number): Promise<void> {
    try {
      // Get current estimated mouse position (or start from a reasonable area)
      const startX = HumanEmulation.randomBetween(200, 600);
      const startY = HumanEmulation.randomBetween(200, 500);

      const steps = HumanEmulation.randomBetween(15, 30);
      // Control point offset for natural curve
      const cpX = (startX + targetX) / 2 + HumanEmulation.randomBetween(-80, 80);
      const cpY = (startY + targetY) / 2 + HumanEmulation.randomBetween(-60, 60);

      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        // Quadratic Bézier curve formula: B(t) = (1-t)^2 * P0 + 2(1-t)t * P1 + t^2 * P2
        const x = Math.round(Math.pow(1 - t, 2) * startX + 2 * (1 - t) * t * cpX + Math.pow(t, 2) * targetX);
        const y = Math.round(Math.pow(1 - t, 2) * startY + 2 * (1 - t) * t * cpY + Math.pow(t, 2) * targetY);

        // Add 1-2px jitter
        const jitterX = x + HumanEmulation.randomBetween(-1, 1);
        const jitterY = y + HumanEmulation.randomBetween(-1, 1);

        await page.mouse.move(jitterX, jitterY);
        await new Promise((r) => setTimeout(r, HumanEmulation.randomBetween(8, 20)));
      }

      await HumanEmulation.sleep(100, 250);
    } catch {
      // Fallback
      await page.mouse.move(targetX, targetY).catch(() => {});
    }
  }

  /**
   * Simulates micro-jiggles and natural hand movements while resting or reading.
   */
  static async jiggleMouse(page: Page): Promise<void> {
    try {
      const moves = HumanEmulation.randomBetween(2, 4);
      for (let i = 0; i < moves; i++) {
        const dx = HumanEmulation.randomBetween(-15, 15);
        const dy = HumanEmulation.randomBetween(-10, 10);
        const viewport = page.viewportSize() || { width: 1280, height: 800 };
        const x = Math.min(Math.max(300 + dx, 50), viewport.width - 50);
        const y = Math.min(Math.max(300 + dy, 50), viewport.height - 50);

        await page.mouse.move(x, y);
        await HumanEmulation.sleep(60, 180);
      }
    } catch {
      // Ignored
    }
  }

  /**
   * Scrolls smoothly down an element or the window, pausing to simulate reading.
   */
  static async humanScroll(page: Page, targetSelector?: string, totalDistance = 500): Promise<void> {
    try {
      let scrolled = 0;
      const stepSize = HumanEmulation.randomBetween(120, 220);

      while (scrolled < totalDistance) {
        const currentStep = Math.min(stepSize, totalDistance - scrolled);

        if (targetSelector) {
          await page.evaluate(
            ({ selector, step }) => {
              const el = document.querySelector(selector);
              if (el) el.scrollTop += step;
            },
            { selector: targetSelector, step: currentStep }
          );
        } else {
          await page.evaluate((step) => window.scrollBy(0, step), currentStep);
        }

        scrolled += currentStep;

        // Micro-jiggle while scrolling
        await HumanEmulation.jiggleMouse(page);

        // Pause to simulate eyes skimming the paragraph
        await HumanEmulation.sleep(400, 1100);

        // Occasional human re-read: scroll back up slightly (15% chance)
        if (Math.random() < 0.2 && scrolled > 200) {
          const backStep = HumanEmulation.randomBetween(40, 80);
          if (targetSelector) {
            await page.evaluate(
              ({ selector, step }) => {
                const el = document.querySelector(selector);
                if (el) el.scrollTop -= step;
              },
              { selector: targetSelector, step: backStep }
            );
          } else {
            await page.evaluate((step) => window.scrollBy(0, -step), backStep);
          }
          await HumanEmulation.sleep(500, 1200);
        }
      }
    } catch {
      // Fallback
    }
  }

  /**
   * Simulates a human taking time to actually read a job description before deciding to apply.
   */
  static async simulateReadingJobDescription(page: Page, detailsSelector?: string): Promise<void> {
    const readingSeconds = HumanEmulation.randomBetween(4, 8); // 4 to 8 seconds reading
    const intervals = Math.floor(readingSeconds / 2);

    for (let i = 0; i < intervals; i++) {
      await HumanEmulation.humanScroll(page, detailsSelector, HumanEmulation.randomBetween(150, 250));
      await HumanEmulation.jiggleMouse(page);
      await HumanEmulation.sleep(800, 1600);
    }
  }

  /**
   * Clicks on an element naturally by moving to it first, pausing, pressing down, then releasing.
   */
  static async naturalClick(page: Page, element: ElementHandle | null): Promise<boolean> {
    if (!element) return false;
    try {
      const box = await element.boundingBox();
      if (!box) {
        await element.click();
        return true;
      }

      // Target near center but with natural human slight offset
      const targetX = box.x + box.width / 2 + HumanEmulation.randomBetween(-5, 5);
      const targetY = box.y + box.height / 2 + HumanEmulation.randomBetween(-3, 3);

      await HumanEmulation.humanMouseMove(page, targetX, targetY);
      await HumanEmulation.sleep(80, 220); // Hover hesitation

      await page.mouse.down();
      await HumanEmulation.sleep(40, 110); // Mouse click hold duration
      await page.mouse.up();

      await HumanEmulation.sleep(150, 400);
      return true;
    } catch {
      await element.click().catch(() => {});
      return true;
    }
  }

  /**
   * Types text naturally character-by-character with variable keystroke delay.
   */
  static async humanType(page: Page, element: ElementHandle, text: string): Promise<void> {
    try {
      await HumanEmulation.naturalClick(page, element);
      await HumanEmulation.sleep(100, 300);

      // Clear existing input if any
      await element.press('Control+A');
      await HumanEmulation.sleep(50, 120);
      await element.press('Backspace');
      await HumanEmulation.sleep(100, 250);

      // Type characters with natural cadence
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (!char) continue;
        await element.press(char);

        // Natural typing speed: 45ms to 130ms between letters
        let delay = HumanEmulation.randomBetween(45, 130);
        // Slightly longer pause after spaces or punctuation
        if (char === ' ' || char === ',' || char === '.') {
          delay += HumanEmulation.randomBetween(80, 200);
        }

        await new Promise((r) => setTimeout(r, delay));
      }

      await HumanEmulation.sleep(150, 400);
    } catch {
      await element.fill(text).catch(() => {});
    }
  }

  /**
   * Performs an innocuous fidget click on neutral whitespace.
   */
  static async neutralFidgetClick(page: Page): Promise<void> {
    try {
      if (Math.random() < 0.35) {
        // 35% chance to do a random neutral click
        const x = HumanEmulation.randomBetween(100, 350);
        const y = HumanEmulation.randomBetween(150, 400);
        await page.mouse.click(x, y);
        await HumanEmulation.sleep(200, 500);
      }
    } catch {
      // Ignored
    }
  }
}
