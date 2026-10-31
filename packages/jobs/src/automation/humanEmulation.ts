import { Page, ElementHandle } from 'playwright';

/**
 * Human Emulation Engine
 * Emulates natural human physical gestures: curved mouse trajectories, jitter,
 * micro-pauses, smooth variable-speed scrolling, reading time, and variable keystroke cadence.
 */
export class HumanEmulation {
  private static lastMouseX = 420;
  private static lastMouseY = 340;

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
   * Moves mouse in a natural curved Bézier trajectory from its last position rather than a robotic straight line.
   */
  static async humanMouseMove(page: Page, targetX: number, targetY: number): Promise<void> {
    try {
      const startX = HumanEmulation.lastMouseX || HumanEmulation.randomBetween(250, 650);
      const startY = HumanEmulation.lastMouseY || HumanEmulation.randomBetween(200, 520);

      const steps = HumanEmulation.randomBetween(16, 28);
      // Control point offset for natural human wrist arc
      const cpX = (startX + targetX) / 2 + HumanEmulation.randomBetween(-75, 75);
      const cpY = (startY + targetY) / 2 + HumanEmulation.randomBetween(-55, 55);

      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        // Quadratic Bézier curve formula: B(t) = (1-t)^2 * P0 + 2(1-t)t * P1 + t^2 * P2
        const x = Math.round(Math.pow(1 - t, 2) * startX + 2 * (1 - t) * t * cpX + Math.pow(t, 2) * targetX);
        const y = Math.round(Math.pow(1 - t, 2) * startY + 2 * (1 - t) * t * cpY + Math.pow(t, 2) * targetY);

        // Add subtle ±1px physiological tremor
        const jitterX = x + (i < steps ? HumanEmulation.randomBetween(-1, 1) : 0);
        const jitterY = y + (i < steps ? HumanEmulation.randomBetween(-1, 1) : 0);

        await page.mouse.move(jitterX, jitterY);
        await new Promise((r) => setTimeout(r, HumanEmulation.randomBetween(7, 18)));
      }

      HumanEmulation.lastMouseX = targetX;
      HumanEmulation.lastMouseY = targetY;
      await HumanEmulation.sleep(90, 220);
    } catch {
      await page.mouse.move(targetX, targetY).catch(() => {});
      HumanEmulation.lastMouseX = targetX;
      HumanEmulation.lastMouseY = targetY;
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
   * Clicks on an element naturally by scrolling it into view, moving to an organic inner offset,
   * pausing for hover hesitation, pressing down, and releasing.
   */
  static async naturalClick(page: Page, element: ElementHandle | null): Promise<boolean> {
    if (!element) return false;
    try {
      await element.scrollIntoViewIfNeeded().catch(() => {});
      await HumanEmulation.sleep(120, 260);

      const box = await element.boundingBox();
      if (!box || box.width <= 0 || box.height <= 0) {
        await element.click({ timeout: 5000 });
        return true;
      }

      // Target within the safe inner 30%–70% area of the element (never dead-center 50%/50% every time)
      const ratioX = 0.3 + Math.random() * 0.4;
      const ratioY = 0.3 + Math.random() * 0.4;
      const targetX = Math.round(box.x + box.width * ratioX);
      const targetY = Math.round(box.y + box.height * ratioY);

      await HumanEmulation.humanMouseMove(page, targetX, targetY);
      await HumanEmulation.sleep(90, 240); // Hover hesitation

      await page.mouse.down();
      await HumanEmulation.sleep(45, 115); // Mouse click hold duration
      await page.mouse.up();

      await HumanEmulation.sleep(180, 420);
      return true;
    } catch {
      await element.click({ timeout: 5000 }).catch(() => {});
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
