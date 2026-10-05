import { expect, test, type Page } from '@playwright/test';

// Native <select> lists and date pickers are drawn by the browser: they must follow the app theme
// (they used to open as a white list with near-white text in dark mode).
async function dropdownColours(page: Page) {
  return page.evaluate(() => {
    const toRgba = (css: string): [number, number, number, number] => {
      const c = document.createElement('canvas').getContext('2d')!;
      c.fillStyle = css;
      c.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = c.getImageData(0, 0, 1, 1).data;
      return [r, g, b, a];
    };
    const select = document.createElement('select');
    select.innerHTML = '<option>Missing</option><option>Received</option>';
    document.body.append(select);
    const option = select.querySelector('option')!;
    const cs = getComputedStyle(option);
    const out = { scheme: getComputedStyle(document.documentElement).colorScheme, bg: toRgba(cs.backgroundColor), fg: toRgba(cs.color) };
    select.remove();
    return out;
  });
}

const luminance = ([r, g, b]: number[]) => {
  const f = (v: number) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a: number[], b: number[]) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

test.describe('dark theme', () => {
  test.use({ colorScheme: 'dark' });
  test('dropdown lists are dark with readable text', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('html')).toHaveClass(/dark/);
    const r = await dropdownColours(page);
    expect(r.scheme).toBe('dark'); // tells the browser to draw its own controls dark
    expect(r.bg[3]).toBe(255); // an explicit, opaque list background (transparent would show the browser's default white)
    expect(luminance(r.bg)).toBeLessThan(0.1); // a dark list, not the browser's white one
    expect(contrast(r.bg, r.fg)).toBeGreaterThanOrEqual(7);
  });
});

test.describe('light theme', () => {
  test.use({ colorScheme: 'light' });
  test('dropdown lists stay light with readable text', async ({ page }) => {
    await page.goto('/login');
    const r = await dropdownColours(page);
    expect(r.scheme).toBe('light');
    expect(r.bg[3]).toBe(255);
    expect(luminance(r.bg)).toBeGreaterThan(0.8);
    expect(contrast(r.bg, r.fg)).toBeGreaterThanOrEqual(7);
  });
});
