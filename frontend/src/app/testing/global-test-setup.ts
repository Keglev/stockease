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
 *
 * <p>What this is not is the suite's protection. Under coverage, in a worker shared by many spec
 * files, hooks registered at a file's root level - this one included - have been observed not to
 * run for most files: in that reproduction this clear ran for 31 of the suite's 795 tests, while
 * hooks registered inside a `describe` ran every time. A spec's own clear is therefore
 * load-bearing rather than a duplicate of this one, and removing those clears as redundant breaks
 * the suite under coverage even where it stays green without it.
 *
 * <p>The shortfall is environment-dependent, so treat the figure above as one observation and not
 * as what any run will show: instrumenting this hook to count its own firings and running the full
 * suite under coverage reproduced nothing, with 795 of 795 firings across all 58 files under a
 * shared environment, under a single worker, and under both together. That it cannot be summoned
 * on demand is the reason the per-file clears stay rather than the reason to doubt it.
 */
beforeEach(() => {
  localStorage.clear();
});

/**
 * Vitest's 5s default is a poor fit for this suite's slowest specs, which resolve real lazy route
 * chunks rather than stubbing the router. That work is fast in isolation and several times slower
 * under a loaded worker with coverage instrumentation on, so the same spec passes alone and times
 * out in the full run - a flake that says nothing about the code under test.
 *
 * <p>Raised globally rather than per file: the specs that pay this cost are not a fixed set. The
 * route table spec loads every feature chunk, so any spec sharing its worker can be the one pushed
 * over the edge, and pinning them individually would mean chasing the list on every change.
 *
 * <p>This is a ceiling, not a delay. A genuinely hung test still fails, just twenty seconds later.
 */
vi.setConfig({ testTimeout: 20_000 });
