import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REQUIRED_SPEC_DOCS = ['spec.md', 'plan.md', 'tasks.md'];

/**
 * Validates that every feature spec directory contains the required documentation.
 */
export function validateSpecs(repoRoot) {
  const specsDir = join(repoRoot, 'specs');
  if (!existsSync(specsDir)) {
    return { specsChecked: 0, missingDocs: [] };
  }

  const entries = readdirSync(specsDir, { withFileTypes: true });
  const specDirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith('.'));
  const missingDocs = [];

  for (const dir of specDirs) {
    const fullPath = join(specsDir, dir.name);
    const missing = REQUIRED_SPEC_DOCS.filter((doc) => !existsSync(join(fullPath, doc)));
    if (missing.length > 0) {
      missingDocs.push({
        dir: `specs/${dir.name}`,
        missing,
      });
    }
  }

  return {
    specsChecked: specDirs.length,
    missingDocs,
  };
}

function findFiles(dir, matchExt) {
  const results = [];
  if (!existsSync(dir)) return results;

  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findFiles(fullPath, matchExt));
    } else if (matchExt(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Scans markdown files in specs/ and docs/ to verify relative links point to existing files.
 */
export function checkMarkdownLinks(repoRoot) {
  const mdFiles = [
    ...findFiles(join(repoRoot, 'specs'), (n) => n.endsWith('.md')),
    ...findFiles(join(repoRoot, 'docs'), (n) => n.endsWith('.md')),
  ];
  const rootReadme = join(repoRoot, 'README.md');
  if (existsSync(rootReadme)) mdFiles.push(rootReadme);

  const brokenLinks = [];
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

  for (const file of mdFiles) {
    const content = readFileSync(file, 'utf8');
    let match;
    while ((match = linkRegex.exec(content)) !== null) {
      const rawTarget = match[2].trim();
      if (
        rawTarget.startsWith('http:') ||
        rawTarget.startsWith('https:') ||
        rawTarget.startsWith('mailto:') ||
        rawTarget.startsWith('tel:') ||
        rawTarget.startsWith('#')
      ) {
        continue;
      }

      // Strip query parameters and anchors
      const cleanTarget = rawTarget.split('#')[0].split('?')[0].trim();
      if (!cleanTarget) continue;

      const resolved = resolve(dirname(file), cleanTarget);
      if (!existsSync(resolved)) {
        brokenLinks.push({
          sourceFile: file,
          target: rawTarget,
        });
      }
    }
  }

  return { brokenLinks };
}

/**
 * Audits source code and comments in src/ to ensure zero markdown document references.
 */
export function auditSourceCodeForMarkdownRefs(repoRoot) {
  const srcDir = join(repoRoot, 'src');
  if (!existsSync(srcDir)) return { violations: [] };

  const srcFiles = findFiles(srcDir, (n) => /\.[jt]sx?$/.test(n));
  const violations = [];
  const mdRefRegex = /[\w./-]+\.md\b/i;

  for (const file of srcFiles) {
    const content = readFileSync(file, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      const match = mdRefRegex.exec(line);
      if (match) {
        violations.push({
          file: relative(repoRoot, file),
          line: index + 1,
          match: match[0],
          text: line.trim(),
        });
      }
    });
  }

  return { violations };
}

/**
 * Runs all validation checks against the target repository root.
 */
export function runCheck(repoRoot = process.cwd()) {
  const specResult = validateSpecs(repoRoot);
  const linkResult = checkMarkdownLinks(repoRoot);
  const codeResult = auditSourceCodeForMarkdownRefs(repoRoot);

  const ok =
    specResult.missingDocs.length === 0 &&
    linkResult.brokenLinks.length === 0 &&
    codeResult.violations.length === 0;

  return {
    ok,
    specsChecked: specResult.specsChecked,
    missingDocs: specResult.missingDocs,
    brokenLinks: linkResult.brokenLinks,
    violations: codeResult.violations,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  console.log('Running spec traceability and link integrity audit...\n');
  const result = runCheck(repoRoot);

  if (result.missingDocs.length > 0) {
    console.error('❌ Missing required spec documents:');
    for (const item of result.missingDocs) {
      console.error(`  - ${item.dir}: missing ${item.missing.join(', ')}`);
    }
  }

  if (result.brokenLinks.length > 0) {
    console.error('❌ Broken relative markdown links:');
    for (const item of result.brokenLinks) {
      console.error(`  - In ${relative(repoRoot, item.sourceFile)}: -> ${item.target}`);
    }
  }

  if (result.violations.length > 0) {
    console.error('❌ Found forbidden markdown references in source code:');
    for (const item of result.violations) {
      console.error(`  - ${item.file}:${item.line}: "${item.text}"`);
    }
  }

  if (result.ok) {
    console.log(`✅ All ${result.specsChecked} specs complete, internal links valid, and source code clean.`);
    process.exit(0);
  } else {
    process.exit(1);
  }
}
