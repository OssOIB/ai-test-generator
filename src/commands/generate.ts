import { crawlPage } from '../services/pageCrawler';
import { generateTests } from '../services/aiGenerator';
import { runTests } from '../services/testRunner';
import { saveGeneratedTest, extractCodeBlock } from '../utils/fileManager';
import { logger } from '../utils/logger';

interface GenerateOptions {
  output?: string;
  run?: boolean;
  browser?: 'chromium' | 'firefox' | 'webkit';
}

export async function generate(url: string, options: GenerateOptions): Promise<void> {
  const shouldRun = options.run !== false;
  const browser = options.browser ?? 'chromium';

  logger.banner();

  // ── Step 1: Validate URL ───────────────────────────────────────────────
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    logger.error(`Invalid URL: "${url}". Include the protocol, e.g. https://example.com`);
    process.exit(1);
  }

  const TOTAL_STEPS = shouldRun ? 4 : 3;

  // ── Step 2: Crawl the page ─────────────────────────────────────────────
  logger.step(1, TOTAL_STEPS, `Crawling ${parsedUrl.href} with ${browser}...`);

  let pageData;
  try {
    pageData = await crawlPage(url, browser);
  } catch (err) {
    logger.error(`Failed to crawl page: ${(err as Error).message}`);
    process.exit(1);
  }

  logger.success(`Page crawled: "${pageData.title}"`);
  logger.dim(`${pageData.forms.length} form(s), ${pageData.buttons.length} button(s), ${pageData.links.length} link(s) detected`);

  if (pageData.hasAuth)    logger.dim('Auth flow detected (login / register)');
  if (pageData.hasSearch)  logger.dim('Search input detected');
  if (pageData.hasPagination) logger.dim('Pagination detected');

  // ── Step 3: Generate tests with AI ────────────────────────────────────
  logger.newline();
  logger.step(2, TOTAL_STEPS, 'Generating Playwright tests with Claude Sonnet 4.6...');
  logger.section('AI Output (streaming)');

  let result;
  try {
    result = await generateTests(pageData, (chunk) => {
      logger.raw(chunk);
    });
  } catch (err) {
    logger.newline();
    logger.error(`AI generation failed: ${(err as Error).message}`);
    process.exit(1);
  }

  logger.newline();
  logger.newline();

  // Token usage summary
  logger.dim(
    `Tokens — input: ${result.inputTokens} | output: ${result.outputTokens}` +
    (result.cacheReadTokens > 0 ? ` | cache hit: ${result.cacheReadTokens}` : '') +
    (result.cacheWriteTokens > 0 ? ` | cache write: ${result.cacheWriteTokens}` : '')
  );

  // ── Step 4: Save the generated test ───────────────────────────────────
  logger.step(3, TOTAL_STEPS, 'Saving generated test file...');

  const code = extractCodeBlock(result.code);

  if (!code || code.length < 50) {
    logger.error('AI returned an empty or invalid test. Try again or check your API key.');
    process.exit(1);
  }

  const testFilePath = saveGeneratedTest(code, options.output);
  logger.success(`Test saved → ${testFilePath}`);

  if (!shouldRun) {
    logger.newline();
    logger.info('Skipping test run (--no-run). Done.');
    return;
  }

  // ── Step 5: Run the tests ─────────────────────────────────────────────
  logger.newline();
  logger.step(4, TOTAL_STEPS, 'Running generated tests with Playwright...');
  logger.section('Playwright Output');

  const testResult = runTests(testFilePath);

  logger.newline();
  logger.testReport(testResult.passed, testResult.failed, testResult.duration);

  if (testResult.errorDetails) {
    logger.section('Failure Details');
    console.log(testResult.errorDetails);
    logger.newline();
  }

  // Exit with non-zero if tests failed so CI picks it up
  if (!testResult.success) {
    process.exit(1);
  }
}
