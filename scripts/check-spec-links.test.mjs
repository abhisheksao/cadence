import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  auditSourceCodeForMarkdownRefs,
  checkMarkdownLinks,
  runCheck,
  validateSpecs,
} from './check-spec-links.mjs';

const REPO_ROOT = join(__dirname, '..');

describe('check-spec-links', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'cadence-spec-check-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('validateSpecs', () => {
    it('passes when every spec directory has spec.md, plan.md, and tasks.md', () => {
      const specsDir = join(tempDir, 'specs', '001-test');
      mkdirSync(specsDir, { recursive: true });
      writeFileSync(join(specsDir, 'spec.md'), '# Spec');
      writeFileSync(join(specsDir, 'plan.md'), '# Plan');
      writeFileSync(join(specsDir, 'tasks.md'), '# Tasks');

      const result = validateSpecs(tempDir);
      expect(result.missingDocs).toEqual([]);
      expect(result.specsChecked).toBe(1);
    });

    it('reports missing required documents in spec directories', () => {
      const specsDir = join(tempDir, 'specs', '002-incomplete');
      mkdirSync(specsDir, { recursive: true });
      writeFileSync(join(specsDir, 'spec.md'), '# Spec');
      // missing plan.md and tasks.md

      const result = validateSpecs(tempDir);
      expect(result.missingDocs).toEqual([
        {
          dir: 'specs/002-incomplete',
          missing: ['plan.md', 'tasks.md'],
        },
      ]);
    });
  });

  describe('checkMarkdownLinks', () => {
    it('detects broken internal markdown links', () => {
      const docsDir = join(tempDir, 'docs');
      mkdirSync(docsDir, { recursive: true });
      writeFileSync(join(docsDir, 'index.md'), 'See [Missing](missing-file.md) and [Valid](valid.md)');
      writeFileSync(join(docsDir, 'valid.md'), '# Valid');

      const result = checkMarkdownLinks(tempDir);
      expect(result.brokenLinks).toEqual([
        {
          sourceFile: join(docsDir, 'index.md'),
          target: 'missing-file.md',
        },
      ]);
    });

    it('ignores external URLs, anchors, and mailto links', () => {
      const docsDir = join(tempDir, 'docs');
      mkdirSync(docsDir, { recursive: true });
      writeFileSync(
        join(docsDir, 'readme.md'),
        '[Google](https://google.com) [Anchor](#heading) [Email](mailto:test@example.com)',
      );

      const result = checkMarkdownLinks(tempDir);
      expect(result.brokenLinks).toEqual([]);
    });
  });

  describe('auditSourceCodeForMarkdownRefs', () => {
    it('detects .md references in src/ files and comments', () => {
      const srcDir = join(tempDir, 'src');
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(
        join(srcDir, 'bad.ts'),
        '// See docs/spec.md\nexport const x = 1;\n',
      );

      const result = auditSourceCodeForMarkdownRefs(tempDir);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0]).toMatchObject({
        line: 1,
        match: 'docs/spec.md',
      });
    });

    it('passes when src/ has no .md references', () => {
      const srcDir = join(tempDir, 'src');
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(
        join(srcDir, 'good.ts'),
        '// Pure code with zero markdown references\nexport const x = 1;\n',
      );

      const result = auditSourceCodeForMarkdownRefs(tempDir);
      expect(result.violations).toEqual([]);
    });
  });

  describe('runCheck on real repository', () => {
    it('passes clean validation on the Cadence repository', () => {
      const result = runCheck(REPO_ROOT);
      expect(result.ok).toBe(true);
      expect(result.missingDocs).toEqual([]);
      expect(result.brokenLinks).toEqual([]);
      expect(result.violations).toEqual([]);
    });
  });
});

describe('package.json CI and coverage configuration (T003)', () => {
  it('defines coverage threshold on core logic (engine, session, modes, storage)', () => {
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'));

    expect(pkg.scripts['test:coverage']).toBeDefined();
    expect(pkg.scripts['check:specs']).toBe('node scripts/check-spec-links.mjs');

    const jestConfig = pkg.jest;
    expect(jestConfig.coverageThreshold).toBeDefined();

    const targets = ['./src/engine/', './src/session/', './src/modes/', './src/storage/'];
    for (const target of targets) {
      expect(jestConfig.coverageThreshold[target]).toMatchObject({
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      });
    }
  });
});
