#!/usr/bin/env node
// check-vercel-cache-rules.mjs - asserts that the immutable cache rule in vercel.json actually
// covers every hashed file the production build emits.
//
// WHY this exists: the rule was first written as `-([A-Za-z0-9_-]{8})\.(js|css)`, on the belief
// that Angular's output hashes are eight characters. They are not uniformly - 26 of the 67 hashed
// files in a build carried a NINE-character hash (`chunk-BOSB2x3E2.js` and its like, deterministic
// across rebuilds). Vercel matches `source` against the whole path, so those 26 matched nothing,
// fell through to the platform default, and silently kept `max-age=0, must-revalidate` - roughly a
// third of the application's JavaScript revalidating on every load, which is the exact cost the
// rule was added to remove. Nothing failed; the files simply were not covered, and counting them
// was the only way to find out.
//
// So the pattern is no longer trusted to be right by inspection. This runs after the production
// build and checks it against the real filenames, which turns the next change in Angular's naming
// into a failed build rather than a quiet regression nobody measures.
//
// Usage: node scripts/check-vercel-cache-rules.mjs   (from the frontend workspace)
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const VERCEL_CONFIG = join(frontendRoot, 'vercel.json');
const BUILD_DIR = join(frontendRoot, 'dist', 'stockease', 'browser');

function fail(message) {
  console.error(message);
  process.exit(1);
}

const config = JSON.parse(readFileSync(VERCEL_CONFIG, 'utf8'));

// The first rule that grants immutability: that is the one making the promise this script checks.
// Any other header rule is free to match whatever it likes.
const rule = (config.headers ?? []).find((entry) =>
  (entry.headers ?? []).some((header) => String(header.value).includes('immutable'))
);

if (!rule) {
  fail('FAIL: vercel.json has no headers rule granting an immutable cache policy.');
}

// Anchored at both ends because that is how Vercel matches: `source` is tested against the entire
// path, not searched within it. An unanchored test here would pass patterns that Vercel rejects,
// which would make this script agree with a broken deployment.
const pattern = new RegExp(`^${rule.source}$`);

if (!existsSync(BUILD_DIR)) {
  fail(`FAIL: no build at ${BUILD_DIR} - run the production build first.`);
}

const hashed = readdirSync(BUILD_DIR, { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name)
  .filter((name) => name.endsWith('.js') || name.endsWith('.css'));

// An empty build proves nothing. Passing here would mean the check silently stops checking the day
// the build output moves, which is the failure mode this script is supposed to be immune to.
if (hashed.length === 0) {
  fail(`FAIL: no .js or .css files in ${BUILD_DIR} - nothing to prove.`);
}

// Vercel's source is a path, so the leading slash is part of what the pattern has to match.
const unmatched = hashed.filter((name) => !pattern.test(`/${name}`));

if (unmatched.length > 0) {
  for (const name of unmatched) {
    console.error(name);
  }
  fail(
    `FAIL: ${unmatched.length} of ${hashed.length} hashed files fall through to the default cache policy`
  );
}

console.log(`vercel cache rule covers ${hashed.length}/${hashed.length} hashed files`);
