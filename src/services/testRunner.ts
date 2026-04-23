import { spawnSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export interface TestResult {
  passed: number;
  failed: number;
  skipped: number;
  duration: string;
  output: string;
  errorDetails: string;
  success: boolean;
}

export function runTests(testFilePath: string): TestResult {
  const projectRoot = path.join(__dirname, '../../');
  const configPath = path.join(projectRoot, 'playwright.runner.config.ts');

  // Ensure the test file exists
  if (!fs.existsSync(testFilePath)) {
    return {
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: '0s',
      output: '',
      errorDetails: `Test file not found: ${testFilePath}`,
      success: false,
    };
  }

  const result = spawnSync(
    'npx',
    [
      'playwright',
      'test',
      testFilePath,
      '--config',
      configPath,
      '--reporter=list',
    ],
    {
      encoding: 'utf-8',
      cwd: projectRoot,
      env: { ...process.env },
      timeout: 120000,
    }
  );

  const output = (result.stdout ?? '') + (result.stderr ?? '');
  return parsePlaywrightOutput(output, result.status ?? 1);
}

function parsePlaywrightOutput(output: string, exitCode: number): TestResult {
  const passedMatch = output.match(/(\d+)\s+passed/);
  const failedMatch = output.match(/(\d+)\s+failed/);
  const skippedMatch = output.match(/(\d+)\s+skipped/);

  // Match duration in formats like "(45.9s)", "(1m 23s)", "(890ms)"
  const durationMatch = output.match(/\((\d+(?:\.\d+)?(?:m\s+)?\d*(?:\.\d+)?[ms]+)\)/);

  const passed = parseInt(passedMatch?.[1] ?? '0', 10);
  const failed = parseInt(failedMatch?.[1] ?? '0', 10);
  const skipped = parseInt(skippedMatch?.[1] ?? '0', 10);
  const duration = durationMatch?.[1] ?? 'unknown';

  // Extract failure details (lines after the summary failure block)
  const errorDetails = extractErrorDetails(output);

  return {
    passed,
    failed,
    skipped,
    duration,
    output,
    errorDetails,
    success: exitCode === 0,
  };
}

function extractErrorDetails(output: string): string {
  const lines = output.split('\n');
  const errorLines: string[] = [];
  let inErrorBlock = false;

  for (const line of lines) {
    if (line.match(/^\s+\d+\)\s+/)) {
      inErrorBlock = true;
    }
    if (inErrorBlock) {
      errorLines.push(line);
      if (errorLines.length > 40) break;
    }
  }

  return errorLines.join('\n').trim();
}
