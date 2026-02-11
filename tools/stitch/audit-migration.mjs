import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TRACKER_PATH = 'docs/architecture/stitch-migration.md';
const COMPONENT_ROOT = 'frontend/src/app';
const REQUIRED_STITCH_FIELDS = [
  'stitch-project',
  'stitch-screen',
  'stitch-screen-title',
  'stitch-status',
  'stitch-last-sync'
];

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');
const trackerFilePath = path.join(repoRoot, TRACKER_PATH);
const componentRootPath = path.join(repoRoot, COMPONENT_ROOT);

const toPosixPath = (value) => value.split(path.sep).join('/');

const walk = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return walk(fullPath);
      }
      if (entry.isFile() && entry.name.endsWith('.component.ts')) {
        return [fullPath];
      }
      return [];
    })
  );
  return nested.flat();
};

const readTrackerEntries = async () => {
  const contents = await readFile(trackerFilePath, 'utf8');
  const lines = contents.split(/\r?\n/);
  const entries = new Map();

  for (const line of lines) {
    if (!line.trim().startsWith('| frontend/src/app/')) {
      continue;
    }
    const cols = line.split('|').map((col) => col.trim());
    if (cols.length < 5) {
      continue;
    }
    const componentPath = cols[1];
    const converted = cols[2];
    const stitchScreen = cols[3];
    const notes = cols[4];
    entries.set(componentPath, { converted, stitchScreen, notes });
  }

  return entries;
};

const parseStitchMetadata = (fileText) => {
  const blockMatch = fileText.match(/\/\*\*([\s\S]*?)\*\/\s*@Component\(/m);
  if (!blockMatch) {
    return { metadata: null, hasStitchTagAnywhere: /@stitch-/.test(fileText) };
  }

  const blockText = blockMatch[1];
  const hasStitchTagInComponentBlock = /@stitch-/.test(blockText);
  if (!hasStitchTagInComponentBlock) {
    return { metadata: null, hasStitchTagAnywhere: /@stitch-/.test(fileText) };
  }

  const readField = (fieldName) => {
    const match = blockText.match(new RegExp(`@${fieldName}\\s+(.+)`));
    return match ? match[1].trim() : null;
  };

  const metadata = {
    'stitch-project': readField('stitch-project'),
    'stitch-screen': readField('stitch-screen'),
    'stitch-screen-title': readField('stitch-screen-title'),
    'stitch-status': readField('stitch-status'),
    'stitch-last-sync': readField('stitch-last-sync')
  };

  return { metadata, hasStitchTagAnywhere: /@stitch-/.test(fileText) };
};

const validateMetadata = (componentPath, metadata, issues) => {
  for (const field of REQUIRED_STITCH_FIELDS) {
    if (!metadata[field]) {
      issues.push(`${componentPath}: missing @${field} in Stitch metadata block.`);
    }
  }

  if (metadata['stitch-status'] && metadata['stitch-status'] !== 'converted') {
    issues.push(`${componentPath}: @stitch-status must be "converted".`);
  }

  if (metadata['stitch-screen'] && !/^projects\/[^/]+\/screens\/[^/\s]+$/.test(metadata['stitch-screen'])) {
    issues.push(`${componentPath}: @stitch-screen must be a full Stitch screen resource name.`);
  }

  if (metadata['stitch-last-sync'] && !/^\d{4}-\d{2}-\d{2}$/.test(metadata['stitch-last-sync'])) {
    issues.push(`${componentPath}: @stitch-last-sync must use YYYY-MM-DD format.`);
  }
};

const main = async () => {
  const componentFiles = (await walk(componentRootPath)).sort((a, b) => a.localeCompare(b));
  const trackerEntries = await readTrackerEntries();
  const issues = [];
  const componentPaths = componentFiles.map((fullPath) => toPosixPath(path.relative(repoRoot, fullPath)));

  let annotatedConvertedCount = 0;
  let trackerConvertedCount = 0;

  for (const componentPath of componentPaths) {
    const fullPath = path.join(repoRoot, componentPath);
    const text = await readFile(fullPath, 'utf8');
    const { metadata, hasStitchTagAnywhere } = parseStitchMetadata(text);
    const trackerEntry = trackerEntries.get(componentPath);

    if (!trackerEntry) {
      issues.push(`${componentPath}: missing from ${TRACKER_PATH} component table.`);
      continue;
    }

    const trackerConverted = trackerEntry.converted === 'Yes';
    const trackerNotConverted = trackerEntry.converted === 'No';

    if (!trackerConverted && !trackerNotConverted) {
      issues.push(`${componentPath}: tracker Converted value must be "Yes" or "No".`);
    }

    if (trackerConverted) {
      trackerConvertedCount += 1;
    }

    if (hasStitchTagAnywhere && !metadata) {
      issues.push(`${componentPath}: Stitch metadata must be in the comment block immediately above @Component.`);
    }

    if (metadata) {
      validateMetadata(componentPath, metadata, issues);
      if (metadata['stitch-status'] === 'converted') {
        annotatedConvertedCount += 1;
      }
    }

    if (trackerConverted && !metadata) {
      issues.push(`${componentPath}: tracker says Converted=Yes but Stitch metadata block is missing.`);
    }

    if (trackerConverted && metadata) {
      if (trackerEntry.stitchScreen === '-' || !trackerEntry.stitchScreen) {
        issues.push(`${componentPath}: tracker says Converted=Yes but Stitch Screen is missing.`);
      }
      if (metadata['stitch-screen'] && trackerEntry.stitchScreen !== metadata['stitch-screen']) {
        issues.push(
          `${componentPath}: tracker Stitch Screen does not match @stitch-screen (${trackerEntry.stitchScreen} vs ${metadata['stitch-screen']}).`
        );
      }
    }

    if (trackerNotConverted && metadata?.['stitch-status'] === 'converted') {
      issues.push(`${componentPath}: Stitch metadata says converted but tracker Converted=No.`);
    }
  }

  for (const trackerPath of trackerEntries.keys()) {
    if (!componentPaths.includes(trackerPath)) {
      issues.push(`${trackerPath}: listed in ${TRACKER_PATH} but no matching component file exists.`);
    }
  }

  console.log(`[stitch-audit] Components discovered: ${componentPaths.length}`);
  console.log(`[stitch-audit] Tracker converted: ${trackerConvertedCount}`);
  console.log(`[stitch-audit] Annotated converted: ${annotatedConvertedCount}`);

  if (issues.length > 0) {
    console.error('[stitch-audit] Issues found:');
    for (const issue of issues) {
      console.error(`- ${issue}`);
    }
    process.exit(1);
  }

  const completion = componentPaths.length === 0
    ? 0
    : ((trackerConvertedCount / componentPaths.length) * 100).toFixed(1);

  console.log(`[stitch-audit] OK (${trackerConvertedCount}/${componentPaths.length}, ${completion}%)`);
};

main().catch((error) => {
  console.error('[stitch-audit] Failed to run audit:', error);
  process.exit(1);
});
