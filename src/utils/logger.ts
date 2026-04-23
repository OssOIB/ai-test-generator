const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

const FG = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

function colorize(color: string, text: string): string {
  return `${color}${text}${RESET}`;
}

export const logger = {
  banner(): void {
    console.log('');
    console.log(colorize(FG.cyan + BOLD, '╔══════════════════════════════════════════╗'));
    console.log(colorize(FG.cyan + BOLD, '║      AI Test Generator  🤖  v1.0.0      ║'));
    console.log(colorize(FG.cyan + BOLD, '║   Powered by Claude Sonnet 4.6 + Playwright  ║'));
    console.log(colorize(FG.cyan + BOLD, '╚══════════════════════════════════════════╝'));
    console.log('');
  },

  step(n: number, total: number, msg: string): void {
    const step = colorize(FG.cyan + BOLD, `[${n}/${total}]`);
    console.log(`${step} ${msg}`);
  },

  info(msg: string): void {
    console.log(`${colorize(FG.blue, '  ℹ')} ${msg}`);
  },

  success(msg: string): void {
    console.log(`${colorize(FG.green, '  ✓')} ${msg}`);
  },

  warn(msg: string): void {
    console.log(`${colorize(FG.yellow, '  ⚠')} ${msg}`);
  },

  error(msg: string): void {
    console.error(`${colorize(FG.red, '  ✗')} ${msg}`);
  },

  dim(msg: string): void {
    console.log(colorize(DIM, `    ${msg}`));
  },

  section(title: string): void {
    console.log('');
    console.log(colorize(FG.magenta + BOLD, `  ── ${title} ──`));
  },

  raw(text: string): void {
    process.stdout.write(text);
  },

  newline(): void {
    console.log('');
  },

  testReport(passed: number, failed: number, duration: string): void {
    console.log('');
    console.log(colorize(FG.white + BOLD, '  ┌─────────────────────────────────────┐'));
    console.log(colorize(FG.white + BOLD, '  │           TEST RESULTS              │'));
    console.log(colorize(FG.white + BOLD, '  ├─────────────────────────────────────┤'));

    const passLine = `  │  ${colorize(FG.green + BOLD, `✓ Passed: ${passed}`)}`;
    const failLine = `  │  ${colorize(failed > 0 ? FG.red + BOLD : FG.gray, `✗ Failed: ${failed}`)}`;
    const durLine  = `  │  ${colorize(FG.gray, `⏱ Duration: ${duration}`)}`;

    console.log(passLine);
    console.log(failLine);
    console.log(durLine);
    console.log(colorize(FG.white + BOLD, '  └─────────────────────────────────────┘'));
    console.log('');

    if (failed === 0 && passed > 0) {
      console.log(colorize(FG.green + BOLD, '  🎉 All tests passed!'));
    } else if (failed > 0) {
      console.log(colorize(FG.red + BOLD, `  ❌ ${failed} test(s) failed. Check output above.`));
    } else {
      console.log(colorize(FG.yellow, '  ⚠ No tests were collected.'));
    }
    console.log('');
  },
};
