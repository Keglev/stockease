#!/usr/bin/env node
/**
 * Assembles the shipped translation bundles from the per-namespace sources.
 *
 * The files under `src/i18n/<lang>/` are what a human edits; `public/i18n/<lang>.json`
 * is the artifact ngx-translate fetches at runtime (ADR 037). Both stay committed so the
 * runtime contract does not depend on a build step having run, which is exactly why they
 * can drift - hence `--check`, run by CI, which re-assembles and refuses any difference.
 *
 * Usage: `node tools/build-i18n.mjs` writes; `node tools/build-i18n.mjs --check` compares.
 * Not a dev instrument: `--check` is a gate, and the write mode is how the artifact is produced.
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const FRONTEND = dirname(dirname(fileURLToPath(import.meta.url)));
const SOURCE_DIR = join(FRONTEND, 'src', 'i18n');
const SHIPPED_DIR = join(FRONTEND, 'public', 'i18n');
const LANGS = ['en', 'de'];

/** Every failure path lands here: a named cause and a non-zero exit, never a warning. */
function fail(message) {
  console.error(`build-i18n: ${message}`);
  process.exit(1);
}

/** The shipped files are LF; a Windows checkout may hold CRLF. Compare content, not encoding. */
const normalize = (text) => text.replace(/\r\n/g, '\n');

const manifestPath = join(SOURCE_DIR, 'namespaces.json');
let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
} catch (error) {
  fail(`cannot read the manifest at ${manifestPath}: ${error.message}`);
}
if (!Array.isArray(manifest) || manifest.some((entry) => typeof entry !== 'string')) {
  fail(`the manifest at ${manifestPath} must be an array of namespace names`);
}

const assembled = {};

for (const lang of LANGS) {
  const langDir = join(SOURCE_DIR, lang);
  let present;
  try {
    present = readdirSync(langDir)
      .filter((name) => name.endsWith('.json'))
      .map((name) => name.slice(0, -'.json'.length));
  } catch (error) {
    fail(`cannot read the source directory ${langDir}: ${error.message}`);
  }

  // Manifest and directory must agree in both directions. A missing file would ship an
  // absent namespace; an unlisted file is authored copy the manifest silently drops.
  const presentSet = new Set(present);
  for (const ns of manifest) {
    if (!presentSet.has(ns)) {
      fail(`manifest lists "${ns}" but ${join(langDir, `${ns}.json`)} does not exist`);
    }
  }
  const manifestSet = new Set(manifest);
  for (const ns of present) {
    if (!manifestSet.has(ns)) {
      fail(`${join(langDir, `${ns}.json`)} exists but "${ns}" is absent from the manifest`);
    }
  }

  // Manifest order is the key order of the assembled object, so the EN/DE parity spec's
  // ordering assertion is satisfied by construction rather than by matching edits.
  const bundle = {};
  for (const ns of manifest) {
    const file = join(langDir, `${ns}.json`);
    try {
      bundle[ns] = JSON.parse(readFileSync(file, 'utf8'));
    } catch (error) {
      fail(`cannot parse ${file}: ${error.message}`);
    }
  }
  assembled[lang] = JSON.stringify(bundle, null, 2) + '\n';
}

const checking = process.argv.includes('--check');
let differences = 0;

for (const lang of LANGS) {
  const target = join(SHIPPED_DIR, `${lang}.json`);
  if (checking) {
    let committed;
    try {
      committed = readFileSync(target, 'utf8');
    } catch (error) {
      fail(`cannot read the shipped bundle ${target}: ${error.message}`);
    }
    if (normalize(committed) !== normalize(assembled[lang])) {
      console.error(`build-i18n: ${target} does not match the sources under ${join(SOURCE_DIR, lang)}`);
      differences += 1;
    }
  } else {
    writeFileSync(target, assembled[lang], 'utf8');
  }
}

if (differences > 0) {
  fail(`${differences} shipped bundle(s) differ from the assembled sources; run "npm run i18n:build"`);
}

console.log(
  checking
    ? `build-i18n: ${LANGS.length} bundles match their sources (${manifest.length} namespaces)`
    : `build-i18n: wrote ${LANGS.length} bundles (${manifest.length} namespaces)`,
);
