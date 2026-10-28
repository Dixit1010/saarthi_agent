import { Page } from 'playwright';
import { DetectedFormField } from './fieldMapper.js';

export interface FormFillResult {
  filledCount: number;
  skippedCount: number;
  details: Array<{ label: string; value: string; success: boolean }>;
}

export class FormFiller {
  /**
   * Fills form fields using human-like typing and clean file uploading.
   */
  static async fillDetectedFields(page: Page, fields: DetectedFormField[]): Promise<FormFillResult> {
    const details: Array<{ label: string; value: string; success: boolean }> = [];
    let filledCount = 0;
    let skippedCount = 0;

    for (const field of fields) {
      if (!field.suggestedValue || field.type === 'UNKNOWN') {
        skippedCount++;
        continue;
      }

      try {
        const el = await page.$(field.selector).catch(() => null);
        if (!el) {
          skippedCount++;
          continue;
        }

        const isVisible = await el.isVisible().catch(() => false);
        if (!isVisible) {
          skippedCount++;
          continue;
        }

        // File upload handling
        if (field.elementType === 'file') {
          await el.setInputFiles(field.suggestedValue, { timeout: 2000 });
          details.push({ label: field.labelText, value: 'Resume PDF Uploaded', success: true });
          filledCount++;
          continue;
        }

        // Select dropdown handling
        if (field.elementType === 'select') {
          // Try selecting by label or value
          await el.selectOption({ label: field.suggestedValue }, { timeout: 2000 }).catch(async () => {
            await el.selectOption({ value: field.suggestedValue }, { timeout: 1500 }).catch(async () => {
              // Fallback to second option
              await el.selectOption({ index: 1 }, { timeout: 1500 });
            });
          });
          details.push({ label: field.labelText, value: field.suggestedValue, success: true });
          filledCount++;
          continue;
        }

        // Text & Textarea handling
        await el.focus();
        await el.fill('', { timeout: 2000 }); // Clear existing
        // Type with light randomized delay for natural input
        await el.type(field.suggestedValue, { delay: 10, timeout: 2500 });

        details.push({ label: field.labelText, value: field.suggestedValue, success: true });
        filledCount++;
      } catch (err) {
        details.push({ label: field.labelText, value: field.suggestedValue || '', success: false });
        skippedCount++;
      }
    }

    return { filledCount, skippedCount, details };
  }
}
