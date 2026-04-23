#!/usr/bin/env node
import { Command } from 'commander';
import * as dotenv from 'dotenv';
import { generate } from './commands/generate';

dotenv.config();

const program = new Command();

program
  .name('ai-test-generator')
  .description(
    'AI-powered Playwright test generator.\n' +
    'Analyzes any URL with Claude AI and produces a runnable TypeScript test suite.'
  )
  .version('1.0.0');

program
  .argument('<url>', 'URL to analyze and generate Playwright tests for')
  .option(
    '-o, --output <path>',
    'Save the generated test to a specific file path (default: OS temp dir)'
  )
  .option(
    '--no-run',
    'Generate tests without running them (print only)'
  )
  .option(
    '-b, --browser <browser>',
    'Browser to use for page crawling: chromium | firefox | webkit',
    'chromium'
  )
  .action(async (url: string, options: { output?: string; run?: boolean; browser?: string }) => {
    const browser = (['chromium', 'firefox', 'webkit'] as const).find(
      b => b === options.browser
    ) ?? 'chromium';

    await generate(url, { ...options, browser });
  });

program.parse(process.argv);
