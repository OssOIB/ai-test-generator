import Anthropic from '@anthropic-ai/sdk';
import type { PageData } from './pageCrawler';

// Static system prompt — cached via cache_control to avoid re-tokenizing
// on every request (breaks even after 2 requests at Sonnet 4.6 pricing).
const SYSTEM_PROMPT = `You are an expert QA automation engineer specializing in Playwright TypeScript testing.
Your task: analyze a webpage's structure and generate a comprehensive, production-ready Playwright test suite.

## Test Structure
- Import: \`import { test, expect } from '@playwright/test';\`
- Use \`test.describe\` blocks with clear, meaningful names
- Use \`test.beforeEach\` for navigation setup
- Group by feature: Loading, Content, Forms, Navigation, etc.

## Selector Priority (most → least preferred)
1. \`data-testid\`: \`page.locator('[data-testid="login-btn"]')\`
2. ARIA role + name: \`page.getByRole('button', { name: 'Log In' })\`
3. Label: \`page.getByLabel('Email address')\`
4. Placeholder: \`page.getByPlaceholder('Enter your email')\`
5. Text: \`page.getByText('Submit')\`
6. CSS last resort: \`page.locator('.submit-button')\`

## Coverage Requirements
1. **Page Load** — correct URL, title, and key visible elements
2. **Content Integrity** — headings, main content present
3. **Interactive Elements** — all buttons, links clickable
4. **Forms** (for each form found):
   - Happy path: valid data → success
   - Required fields: empty submit → error messages
   - Field validation: wrong format → inline errors
5. **Auth flows** (if login/register detected): valid + invalid credentials
6. **Navigation** — internal links resolve, breadcrumbs work
7. **Search** (if present) — input, submit, results appear

## Code Quality Rules
- All tests are \`async\`
- Use \`await\` for all Playwright actions
- Add \`expect(page).toHaveURL()\` after navigations
- Use \`toBeVisible()\`, \`toHaveText()\`, \`toHaveValue()\`, \`toBeEnabled()\` appropriately
- Add a brief inline comment only when the assertion is non-obvious
- Do NOT add error handling — Playwright auto-retries assertions
- Do NOT use \`page.waitForTimeout()\` — use \`waitForSelector\` or assertion retries

## Output
Return ONLY raw TypeScript code. No markdown fences, no explanations, no prose.
Start directly with: import { test, expect } from '@playwright/test';`;

export interface GenerationResult {
  code: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export async function generateTests(
  pageData: PageData,
  onChunk: (text: string) => void
): Promise<GenerationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. Create a .env file from .env.example.'
    );
  }

  // claude-sonnet-4-20250514 is deprecated (retires 2026-06-15).
  // claude-sonnet-4-6 is the current recommended alias.
  const model = process.env.AI_MODEL ?? 'claude-sonnet-4-6';
  const maxTokens = parseInt(process.env.MAX_TOKENS ?? '8000', 10);

  const client = new Anthropic({ apiKey });

  const userContent = buildUserPrompt(pageData);

  const stream = client.messages.stream({
    model,
    max_tokens: maxTokens,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        // Cache the static system prompt — saves ~$0.003/request after first call
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: userContent,
      },
    ],
  });

  let fullText = '';

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      onChunk(event.delta.text);
      fullText += event.delta.text;
    }
  }

  const finalMessage = await stream.finalMessage();
  const usage = finalMessage.usage as Anthropic.Usage & {
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };

  return {
    code: fullText,
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
  };
}

function buildUserPrompt(pageData: PageData): string {
  const lines: string[] = [
    `Analyze this webpage and generate comprehensive Playwright tests.`,
    ``,
    `## Target URL`,
    pageData.finalUrl,
    ``,
    `## Page Metadata`,
    `Title: ${pageData.title}`,
    `Description: ${pageData.description || '(none)'}`,
    ``,
  ];

  if (pageData.headings.length > 0) {
    lines.push('## Headings');
    for (const h of pageData.headings) {
      lines.push(`  H${h.level}: ${h.text}`);
    }
    lines.push('');
  }

  if (pageData.forms.length > 0) {
    lines.push('## Forms');
    for (const form of pageData.forms) {
      lines.push(`  Form (id="${form.id}", method=${form.method}, action="${form.action}")`);
      for (const f of form.fields) {
        const parts = [
          `type=${f.type}`,
          f.name ? `name="${f.name}"` : '',
          f.id ? `id="${f.id}"` : '',
          f.placeholder ? `placeholder="${f.placeholder}"` : '',
          f.label ? `label="${f.label}"` : '',
          f.testId ? `data-testid="${f.testId}"` : '',
          f.required ? 'required' : '',
        ].filter(Boolean);
        lines.push(`    <${f.tag} ${parts.join(', ')}>`);
      }
      for (const btn of form.submitButtons) {
        lines.push(
          `    <button type="${btn.type}"${btn.testId ? ` data-testid="${btn.testId}"` : ''}>${btn.text}</button>`
        );
      }
    }
    lines.push('');
  }

  if (pageData.buttons.length > 0) {
    lines.push('## Buttons & Clickable Elements');
    for (const b of pageData.buttons.slice(0, 15)) {
      const parts = [
        b.ariaLabel ? `aria-label="${b.ariaLabel}"` : '',
        b.testId ? `data-testid="${b.testId}"` : '',
      ].filter(Boolean);
      lines.push(`  <${b.tag}${parts.length ? ' ' + parts.join(', ') : ''}>${b.text}</${b.tag}>`);
    }
    lines.push('');
  }

  if (pageData.links.length > 0) {
    lines.push('## Navigation Links');
    for (const l of pageData.links.slice(0, 15)) {
      lines.push(`  [${l.text}] → ${l.href}`);
    }
    lines.push('');
  }

  lines.push('## Page Flags');
  lines.push(`  Has authentication: ${pageData.hasAuth}`);
  lines.push(`  Has search: ${pageData.hasSearch}`);
  lines.push(`  Has pagination: ${pageData.hasPagination}`);
  lines.push('');

  if (pageData.visibleText) {
    lines.push('## Visible Page Text (excerpt)');
    lines.push(pageData.visibleText.slice(0, 800));
    lines.push('');
  }

  lines.push(
    'Generate a complete Playwright TypeScript test file for this page. Cover all forms, interactive elements, and key user journeys.'
  );

  return lines.join('\n');
}
