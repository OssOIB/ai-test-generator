import { chromium, firefox, webkit, Browser, Page } from '@playwright/test';

export interface FormField {
  tag: string;
  type: string;
  name: string;
  id: string;
  placeholder: string;
  label: string;
  required: boolean;
  ariaLabel: string;
  testId: string;
}

export interface FormData {
  id: string;
  action: string;
  method: string;
  fields: FormField[];
  submitButtons: Array<{ text: string; type: string; testId: string }>;
}

export interface InteractiveElement {
  tag: string;
  text: string;
  type: string;
  href: string;
  ariaLabel: string;
  testId: string;
  role: string;
}

export interface PageData {
  url: string;
  finalUrl: string;
  title: string;
  description: string;
  headings: Array<{ level: number; text: string }>;
  forms: FormData[];
  buttons: InteractiveElement[];
  links: Array<{ text: string; href: string; ariaLabel: string }>;
  inputs: FormField[];
  visibleText: string;
  hasAuth: boolean;
  hasPagination: boolean;
  hasSearch: boolean;
}

type BrowserName = 'chromium' | 'firefox' | 'webkit';

export async function crawlPage(
  url: string,
  browserName: BrowserName = 'chromium'
): Promise<PageData> {
  const launchers = { chromium, firefox, webkit };
  const browser: Browser = await launchers[browserName].launch({ headless: true });

  try {
    const page: Page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    const finalUrl = page.url();

    const data = await page.evaluate(() => {
      // helpers
      const getText = (el: Element | null): string =>
        el?.textContent?.trim().replace(/\s+/g, ' ') ?? '';

      const getLabel = (input: Element): string => {
        const id = input.getAttribute('id');
        if (id) {
          const label = document.querySelector(`label[for="${id}"]`);
          if (label) return getText(label);
        }
        const parent = input.closest('label');
        if (parent) return getText(parent);
        return '';
      };

      // Title + meta
      const title = document.title;
      const description =
        document
          .querySelector('meta[name="description"]')
          ?.getAttribute('content') ?? '';

      // Headings
      const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4'))
        .map(h => ({
          level: parseInt(h.tagName.replace('H', ''), 10),
          text: getText(h),
        }))
        .filter(h => h.text.length > 0)
        .slice(0, 20);

      // Forms
      const forms = Array.from(document.querySelectorAll('form')).map((form, i) => {
        const fields = Array.from(
          form.querySelectorAll('input:not([type="hidden"]),textarea,select')
        ).map(el => ({
          tag: el.tagName.toLowerCase(),
          type: el.getAttribute('type') ?? 'text',
          name: el.getAttribute('name') ?? '',
          id: el.getAttribute('id') ?? '',
          placeholder: el.getAttribute('placeholder') ?? '',
          label: getLabel(el),
          required: el.hasAttribute('required'),
          ariaLabel: el.getAttribute('aria-label') ?? '',
          testId: el.getAttribute('data-testid') ?? '',
        }));

        const submitButtons = Array.from(
          form.querySelectorAll('button,input[type="submit"]')
        ).map(btn => ({
          text: getText(btn),
          type: btn.getAttribute('type') ?? 'submit',
          testId: btn.getAttribute('data-testid') ?? '',
        }));

        return {
          id: form.getAttribute('id') ?? `form-${i}`,
          action: form.getAttribute('action') ?? '',
          method: (form.getAttribute('method') ?? 'get').toUpperCase(),
          fields,
          submitButtons,
        };
      });

      // Standalone buttons (outside forms)
      const buttons = Array.from(document.querySelectorAll('button,a[role="button"]'))
        .map(el => ({
          tag: el.tagName.toLowerCase(),
          text: getText(el),
          type: el.getAttribute('type') ?? '',
          href: el.getAttribute('href') ?? '',
          ariaLabel: el.getAttribute('aria-label') ?? '',
          testId: el.getAttribute('data-testid') ?? '',
          role: el.getAttribute('role') ?? '',
        }))
        .filter(b => b.text.length > 0)
        .slice(0, 30);

      // Links
      const links = Array.from(document.querySelectorAll('a[href]'))
        .map(a => ({
          text: getText(a),
          href: a.getAttribute('href') ?? '',
          ariaLabel: a.getAttribute('aria-label') ?? '',
        }))
        .filter(l => l.text.length > 0 && !l.href.startsWith('javascript'))
        .slice(0, 25);

      // Standalone inputs (outside forms)
      const inputs = Array.from(
        document.querySelectorAll(
          'input:not(form input):not([type="hidden"]),textarea:not(form textarea)'
        )
      )
        .map(el => ({
          tag: el.tagName.toLowerCase(),
          type: el.getAttribute('type') ?? 'text',
          name: el.getAttribute('name') ?? '',
          id: el.getAttribute('id') ?? '',
          placeholder: el.getAttribute('placeholder') ?? '',
          label: getLabel(el),
          required: el.hasAttribute('required'),
          ariaLabel: el.getAttribute('aria-label') ?? '',
          testId: el.getAttribute('data-testid') ?? '',
        }))
        .slice(0, 20);

      // Visible text snippet
      const visibleText = (document.body?.innerText ?? '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 1500);

      // Heuristic flags
      const html = document.documentElement.innerHTML.toLowerCase();
      const hasAuth =
        html.includes('login') ||
        html.includes('sign in') ||
        html.includes('password') ||
        html.includes('register');
      const hasPagination =
        html.includes('pagination') ||
        html.includes('page-next') ||
        document.querySelectorAll('[aria-label*="page"]').length > 0;
      const hasSearch =
        !!document.querySelector('input[type="search"],input[name="q"],input[placeholder*="search" i]') ||
        html.includes('search-input');

      return {
        title,
        description,
        headings,
        forms,
        buttons,
        links,
        inputs,
        visibleText,
        hasAuth,
        hasPagination,
        hasSearch,
      };
    });

    return { url, finalUrl, ...data };
  } finally {
    await browser.close();
  }
}
