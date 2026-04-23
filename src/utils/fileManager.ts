import * as fs from 'fs';
import * as path from 'path';

export function saveGeneratedTest(code: string, outputPath?: string): string {
  // Default to generated-tests/ inside the project so the Playwright runner
  // config (testDir: 'generated-tests') can discover the file without a glob.
  const projectRoot = path.join(__dirname, '../../');
  const target = outputPath ?? path.join(
    projectRoot,
    'generated-tests',
    `ai-generated-${Date.now()}.spec.ts`
  );

  const dir = path.dirname(target);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(target, code, 'utf-8');
  return target;
}

export function deleteFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // best-effort cleanup
  }
}

export function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

export function extractCodeBlock(text: string): string {
  // Extract from ```typescript ... ``` or ```ts ... ```
  const tsBlock = text.match(/```(?:typescript|ts)\n([\s\S]*?)```/);
  if (tsBlock) return tsBlock[1].trim();

  // Fallback: if the response looks like raw TypeScript
  const trimmed = text.trim();
  if (
    trimmed.startsWith('import') ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('/*') ||
    trimmed.startsWith('const') ||
    trimmed.startsWith('test(')
  ) {
    return trimmed;
  }

  // Last resort: strip any leading explanation and return
  const importIdx = trimmed.indexOf('import {');
  if (importIdx !== -1) return trimmed.slice(importIdx);

  return trimmed;
}
