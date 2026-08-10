import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/*
 * Guards the EN/DE locale files against divergence.
 *
 * Runtime i18n (ngx-translate) resolves messages by string key at runtime, so nothing in the
 * compiler or the production build notices a key that exists in one locale and not the other -
 * the app simply renders the raw key to whoever switched language. This spec is the
 * compile-time substitute that runtime translation lacks: it runs on every CI build and fails
 * naming the diverging paths, which is the enforcement ADR 015 records as the mitigation for
 * choosing runtime translation over @angular/localize.
 *
 * It pins ordering as well as membership. The two files have been kept byte-parallel by hand so
 * that a side-by-side diff of en.json and de.json shows only translated values; an added key
 * appended at the end of one file would preserve parity but destroy that property.
 *
 * The files are read from disk rather than imported: they live in public/, outside the spec
 * tsconfig's rootDir, and a bundled import would also mean the assertion runs against a build
 * artifact instead of the artifact the app actually fetches at runtime.
 */

const LOCALE_FILES = ['en.json', 'de.json'] as const;

/*
 * Walks up from the working directory to the folder holding public/i18n, so the spec resolves
 * the same whether the runner starts in frontend/ or at the repository root.
 */
function localeDir(): string {
  let dir = process.cwd();
  for (;;) {
    const candidate = join(dir, 'public', 'i18n');
    try {
      readFileSync(join(candidate, 'en.json'));
      return candidate;
    } catch {
      const parent = dirname(dir);
      if (parent === dir) {
        throw new Error(`public/i18n not found above ${process.cwd()}`);
      }
      dir = parent;
    }
  }
}

function readLocale(file: string): unknown {
  return JSON.parse(readFileSync(join(localeDir(), file), 'utf8'));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/* Dot-path list of every leaf, in file order - depth-first, keys in declaration order. */
function keyPaths(value: unknown, prefix = ''): string[] {
  if (!isRecord(value)) {
    return [prefix];
  }
  return Object.keys(value).flatMap((key) =>
    keyPaths(value[key], prefix ? `${prefix}.${key}` : key)
  );
}

/* Leaf path/value pairs, so a failure can point at the offending key rather than the file. */
function leaves(value: unknown, prefix = ''): [string, unknown][] {
  if (!isRecord(value)) {
    return [[prefix, value]];
  }
  return Object.keys(value).flatMap((key) =>
    leaves(value[key], prefix ? `${prefix}.${key}` : key)
  );
}

/*
 * Names what diverged: keys present on only one side, and - when both carry the same set - the
 * first position at which the declaration order differs.
 */
function describeDivergence(en: string[], de: string[]): string {
  const enSet = new Set(en);
  const deSet = new Set(de);
  const missingInDe = en.filter((path) => !deSet.has(path));
  const missingInEn = de.filter((path) => !enSet.has(path));

  const problems: string[] = [];
  if (missingInDe.length) {
    problems.push(`missing from de.json: ${missingInDe.join(', ')}`);
  }
  if (missingInEn.length) {
    problems.push(`missing from en.json: ${missingInEn.join(', ')}`);
  }
  if (!problems.length) {
    const at = en.findIndex((path, index) => path !== de[index]);
    if (at !== -1) {
      problems.push(`key order differs at index ${at}: en has "${en[at]}", de has "${de[at]}"`);
    }
  }

  return `EN and DE locale files diverged - ${problems.join('; ') || 'no difference detected'}`;
}

/*
 * The CI parity rule applied to the shipped files: the two locales carry the same key paths in the
 * same order, and no value is an empty string.
 * Out of scope: whether any translation is a good one - that is a review question, not a testable one.
 */
describe('translation parity', () => {
  it('keyPaths_enAndDe_matchExactlyIncludingOrder', () => {
    const en = keyPaths(readLocale('en.json'));
    const de = keyPaths(readLocale('de.json'));

    expect(de, describeDivergence(en, de)).toEqual(en);
  });

  it('values_bothLocales_containNoEmptyStrings', () => {
    for (const file of LOCALE_FILES) {
      const blank = leaves(readLocale(file))
        .filter(([, value]) => value === '')
        .map(([path]) => path);

      expect(blank, `${file} has empty translations: ${blank.join(', ')}`).toEqual([]);
    }
  });
});
