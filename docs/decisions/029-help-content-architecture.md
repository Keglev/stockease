# ADR 029: Help Content as Typed, Lazy-Loaded Modules

**Scope**: [Frontend]
**Status**: Accepted
**Date**: August 3, 2026

---

## Context

The application ships an in-app manual at `/app/help`: eight topics of prose,
each several paragraphs long, in English and German. That is a large body of
text by this application's standards - considerably more words than the entire
rest of the interface put together.

The obvious home for it is `public/i18n/en.json` and `de.json`, which is where
every other translated string lives. Those two files have three properties that
make them the wrong home for prose:

- **They are loaded eagerly, in full, before the first screen paints.** The
  ngx-translate HTTP loader fetches one file per language and the app waits for
  it. Every byte of help prose would be downloaded by a visitor who came to look
  at the dashboard and will never open the manual.
- **They are already large enough to be a known problem.** Splitting them per
  feature is a pending piece of work (ADR 015 chose runtime translation and
  accepted this file as the cost). Multiplying their size by the help text
  first would make that split harder, not easier.
- **They give prose no structure.** A help topic is not a string: it is an
  ordered list of sections, each a heading plus paragraphs plus an optional
  bullet list. Expressed as flat keys, that structure lives only in the
  template that happens to read them, and the two languages agree on it only by
  convention.

The parity question is the sharpest of the three. CI enforces key parity across
`en.json` and `de.json`, so a missing translation is caught. But parity of
*keys* is not parity of *structure*: nothing would stop the German manual from
growing a section the English one lacks, and nothing would order the two the
same way.

## Decision

**Help prose lives in typed TypeScript modules inside the help feature, loaded
with the help route. Only the topic titles go through ngx-translate.**

Three files beside the component:

- `help-content.types.ts` - the `HelpTopicId` union, and the `HelpSection` and
  `HelpTopic` interfaces. The id union is the same value in three places: the
  route's `:topic` segment, the `help.topics.*` translation key, and the key
  the two language modules are paired on.
- `help-content.en.ts` and `help-content.de.ts` - each exporting
  `HELP_TOPICS: readonly HelpTopic[]`, typed against those interfaces.

Both modules are imported by the help component, which the router loads lazily,
so the prose travels in the help chunk and is fetched the first time somebody
opens the manual. Nothing outside the help feature imports them.

**Parity is guaranteed twice, structurally and by test.** The shared interfaces
force the shape - a section without a heading or paragraphs will not compile.
`help-content.spec.ts` forces the rest: identical topic ids in identical order,
identical section ids within each topic, and no empty heading, paragraph or
bullet in either language. That is a stronger guarantee than the i18n files get,
because key parity would not have caught a reordered or extra section.

**Topic titles stay in `en.json` / `de.json`** as `help.topics.*`, plus
`help.selectTopic` for the mobile picker. They are short, they are needed by the
nav rather than by the body, and routing them through the normal pipe means the
nav re-renders on a language change exactly like every other label in the app.
The body follows by selecting the matching module from the same language signal,
so both halves switch together with no reload and no request.

## Alternatives considered

**Keys in `en.json` / `de.json`, like everything else.** Rejected. It puts the
largest text in the application into the one bundle that is fetched before the
first paint, for a page most visitors never open, and it makes the pending split
of those files worse in proportion to how good the manual gets. It also flattens
the section structure into a naming convention, so the two languages would agree
on shape only by discipline.

**Separate JSON files behind a second ngx-translate loader.** Rejected, and this
is the closer call, because it keeps the prose out of the eager bundle. But
those files would sit outside the parity check CI runs over `en.json` and
`de.json` - the guarantee would be recreated as a gap rather than kept. JSON
also gives up the type safety: a mistyped field is a runtime blank instead of a
build failure, and there is nothing to assert against but the file itself.

**Markdown files rendered at runtime.** Rejected. It reads well as an authoring
format, but it needs a Markdown parser - a new dependency for one page - and
rendering authored HTML means either trusting the pipeline or sanitising it. The
prose here is paragraphs and bullets; the structure the interfaces describe
covers it without a parser.

## Consequences

- **The eagerly-loaded translation files stay the size they are.** The manual
  costs nothing to a visitor who never opens it, and the pending per-feature
  split of `en.json` / `de.json` is no harder than it was.
- **Prose is type-checked.** A topic missing from one language is a compile
  error at the `HelpTopicId` union; a malformed section is a compile error at
  the interface.
- **The parity guarantee is testable, and tested.** `help-content.spec.ts` was
  verified to fail by temporarily renaming one German section id - the check is
  not vacuous.
- **Translators need a TypeScript file, not a JSON file.** This is the real cost
  of the decision and it is worth stating plainly: help prose can no longer be
  edited by someone who only knows the translation files. The modules are plain
  string literals in an array, so the edit is mechanical, but it is an edit in
  source and it goes through review and CI like any other.
- **The pattern is available, not mandated.** Nothing else in the application
  has enough prose to need it. If a second long-form page appears - a printable
  invoice guide, an onboarding tour - this is the shape it should take, and if
  none does, the help feature carries the pattern alone without imposing it.

[Back to Decisions Index](index.md)
