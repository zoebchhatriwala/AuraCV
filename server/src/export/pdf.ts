import puppeteer from 'puppeteer';

export type PdfRenderer = (html: string) => Promise<Uint8Array>;

export const renderPdfWithPuppeteer: PdfRenderer = async (html) => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  try {
    const page = await browser.newPage();
    try {
      await page.setContent(html, {
        waitUntil: ['load', 'networkidle0'],
        timeout: 15000,
      });
    } catch {
      await page.setContent(html, { waitUntil: 'load', timeout: 5000 });
    }

    try {
      await Promise.race([
        page.evaluate('document.fonts.ready'),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);
    } catch {
      // Use the template's fallback fonts when web fonts are unavailable.
    }

    return await page.pdf({
      format: 'A4',
      margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
      printBackground: true,
    });
  } finally {
    try {
      await browser.close();
    } catch (error) {
      console.warn('Failed to close browser:', error);
    }
  }
};
