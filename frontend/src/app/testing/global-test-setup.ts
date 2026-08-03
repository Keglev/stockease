/**
 * Runs before every spec file, wired through the unit-test builder's `setupFiles` option.
 *
 * <p>Its whole job is to stop one spec file's storage from reaching the next. Several services
 * resolve their startup state from `localStorage` before anything else - `LanguageService` reads
 * `stockease.lang` ahead of the browser language, and `ThemeService` and `FormatService` do the
 * same with their own keys - so a spec that never cleared it inherited whatever the previously-run
 * file happened to leave behind.
 *
 * <p>That was invisible until PR #136 made rendered output depend on the language: a currency
 * assertion in the customer-summary spec passed locally and failed in CI on the same commit,
 * because Vitest orders spec files differently on different runners. Two specs were repaired
 * point-wise there; this removes the class rather than waiting for the next one to surface.
 *
 * <p>A file's own `beforeEach` still runs after this one, so specs that deliberately seed or pin
 * storage are unaffected - they set their state after the slate is wiped, which is the order they
 * already assumed.
 */
beforeEach(() => {
  localStorage.clear();
});
