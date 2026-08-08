# StockEase - Size, Style, and Comment Standards (rev 7, 2026-08-08)

Supersedes rev 6 (2026-08-08). Changes: exemption rows for generated, content
and route files; a frontend spec band row; a docs/_theme section; and the
no-emoji rule.

Internal working standard for refactor missions; it is not published to the
docs site. Temporary - this file is deleted when the refactoring phases close.

## Cross-cutting (both stacks)

- Size limits count CODE LINES ONLY (comments/Javadoc/blanks excluded). Line
  count is the LAST reason to split; split on: >1 responsibility, >1
  abstraction level, unrelated change-reasons, >3 injected deps, 3+ repeated
  patterns.
  - *[rev 4 clarification, #186 owner ruling]*: physical line count is NEVER a
    split reason; a file under its code-line target is WITHIN regardless of how
    much documentation it carries. The counting rule excludes prose precisely so
    documentation never creates split pressure.
- Hard cap for NEW code: 300 code lines/file. Retrofit existing files only when
  a pass already touches them.
- Comments explain WHY, never WHAT. Never comment self-evident code.
- Waiver mechanism: above-alarm survivors of the split criteria are WAIVED with
  an in-file comment + a register entry below.
- Test naming: `method_state_expected` (house rule); no Javadoc on test methods;
  backend test methods 20 code lines max.
- DEFERRED WORK: `// TODO(BL-nn): text` at the site; marker removed in the PR
  that closes its backlog entry. Untracked bare TODOs are a finding in any
  review pass.
- COUNTING METHODS *[rev 4, from the session-7 error ledger]*: counts used in
  premises or findings are produced by exact-token methods, not substring greps
  (annotation counts count the annotation, not the string "Mapping"); every
  stated total is recomputed from its own parts; any classifier or counter is
  validated against a known file/site before its numbers are believed (the
  cross-check rule, now universal).
- GENERATED FILES *[rev 7]*: exempt from every size band, and from dead-code and
  comment sweeps. The file header names its generator and states that it must not
  be edited by hand. Exemplar: `app/core/api/api-types.ts`.
- CONTENT/DATA MODULES *[rev 7]*: typed content modules (ADR 029 artifacts, e.g.
  `features/help/help-content.en.ts` and `.de.ts`) are exempt from the size bands.
  They split on editorial grounds only, never on line count.
- ROUTE TABLES *[rev 7]*: `app.routes.ts`, and any route table added later, is
  exempt from the Util band and watched against the 300 code-line hard cap only.
- NO EMOJIS *[rev 7]*: comments and documentation prose carry no emojis (owner
  directive, 2026-08-08).

## Backend (Spring tables)

controller 50-150 (>200, Javadoc every endpoint); service 100-250 (>300;
framework-integration exempt); service method <=20 (>30); repository 20-80
(>150; native SQL for sanctioned bypasses only; never repo-injects-repo);
entity 30-100 (>150); config 50-150 (>200); security 50-200 (>300); DTO/record
20-80 (>120; mapping resolves in the service); exception advice 10-50 (>100;
status mapping only in `GlobalExceptionHandler`); validation 20-80 (>120);
enums 10-40 (>80).

*[rev 4, R4]* domain event listener (`@EventListener` component) 10-50 (>80);
plain exception class (distinct from exception advice) 5-30 (>60).

*[rev 4, R2]* SERIALIZATION STANCE: StockEase never serializes exceptions; the
six shared exceptions carry NO `serialVersionUID` and NO
`@SuppressWarnings("serial")` - the javac `[serial]` warnings are accepted as
the project stance. Do not "fix" them.

Shell scripts ~70 code lines; workflow YAML ~150 code lines; inline shell in
workflows >5 lines -> a script (`build-frontend-api.sh` pattern). DELIVERY
PREMISE (from #177): verify WHAT the workflow checks out before extracting.
SHELL COMMENT EXEMPLAR: `.github/scripts/deploy/demo-reset.sh`.

*[rev 6]* `tools/` DEV SCRIPTS 100-250 (>300). Standalone developer instruments
run by hand, not by CI. A header comment states what it measures or does, its
provenance, one-line usage, and why it is not a gate. Node dependencies belong
to an existing workspace rather than a new root manifest.

*[rev 5]* WORKFLOW HEADERS: every workflow file opens with a 2-5 line plain `#`
prose header stating WHY - what the workflow does that its `name:` key does not
say, and its trigger-chain position where non-obvious (what triggers it, what it
feeds). No banner rules. A header that restates WHAT the file plainly shows is a
defect, not compliance. A header longer than 5 lines is waiver-register material:
it is above the alarm and survives only with a register entry. WORKFLOW HEADER
EXEMPLAR: `.github/workflows/demo-reset.yml`.

Test files: controller/integration 250 (>300), others 150 (>200); entity tests
only for custom logic.

JAVADOC: every public class + method; omit `@author`/`@version`; no `@see` to
local `.md`; the `DemoDataService`/`DemoTemporalSpread` prose register is the
reference standard - raise files TO it. The four report family services (#187)
meet the register standard.

*[rev 4, #181]* TEST SUPPRESSIONS: `@SuppressWarnings("unused")` on JUnit
lifecycle methods carries the same-line WHY
`// invoked by JUnit via reflection, not by direct call`. Zero bare
suppressions is the enforced state; a bare one is a finding in any review pass.

## Split conduct *[rev 4 - codified from #182-#187]*

- "Moved UNCHANGED" binds TEST BODIES. Class-level annotations and imports
  FOLLOW CONSUMPTION: each destination file carries only the annotations,
  extensions, and imports its members actually need, with any justification
  comment moved verbatim to where it still applies (#185).
- Fixtures classes: package-private, in the tested package. Membership by the
  2+ rule (a helper consumed by 2+ destination files), with two refinements:
  (a) consumption by another fixtures member counts as a call site - fixtures
  never depend on their consumers (#184, `product()`); (b) shared MUTABLE or
  UNIQUENESS-BEARING state (counters, sequences) is MANDATORY fixtures content
  regardless of call-site count when the tests commit - a per-class copy
  restarting its sequence collides with committed data (#186, the
  invoice-number counter). The WHY goes on the field.
- Spec files carry a class-level plain block comment naming the contract under
  test + out-of-scope note, and NAME THEIR SIBLING files for the concerns split
  away (#184-#186).
- Integration-test splits keep IDENTICAL context configuration
  (`@SpringBootTest` + profile + base class) across the new files so Spring's
  context cache serves them all - a configuration difference forks the context
  and slows the suite (#186).
- Section-divider comments survive only where they still organise something in
  the destination file (#185).
- Standing rulings on comment forms: helper comments moved into fixtures classes
  use `/* */` (spec-file dialect); ones staying in spec files may keep original
  `/** */`; mixed forms are acceptable until a comment sweep aligns them for
  free.

## Frontend (Angular table)

Components 40-100 (>150); Dialogs 50-120 (>160); Pages 60-140 (>180); Services
40-120 (>160); Signal stores 40-90 (>120); Pipes/directives 10-40 (>80);
Guards/interceptors 10-50 (>80); Utils 20-80 (>120); Templates soft 150 (>200);
Functions aim <40, >75 alarm. Standalone, signals, `inject()`, `--mat-sys-*`
tokens only, DI seams over module mocks.

*[rev 7]* FRONTEND SPEC FILES: component/page specs 100-350 (>450); service,
pipe, guard and util specs 40-150 (>200); `it()` body <=20 code lines (>30);
`describe` nesting <=2.

## Frontend doc dialect

- Class/service-level TSDoc (summary + `@remarks` WHY), not file-level headers;
  TypeDoc is the publisher.
- Real `@param`/`@returns`/`@throws` where non-obvious; no TSDoc on trivial
  members; backticks not `{@code}`.
- Spec files: plain block comment naming the contract + out-of-scope note.
- SCSS: block header only where non-obvious.

## docs/_theme (Pandoc theme files)

*[rev 7]* CSS 30-200 (>250); Pandoc HTML template 30-100 (>150); theme JS 30-100
(>150). Every theme file opens with a plain prose header stating what it is and
why it exists; the nav partials (`templates/nav-*.html`) are the exemplar. No
banner-rule headers, consistent with the workflow-header ruling.

## i18n

`en.json` + `de.json`, CI parity (membership AND ordering), EN review reference,
no in-code fallbacks. Baseline 406 leaf keys / 19 namespaces / 570 lines each
side. PROTECTED DYNAMIC SUBTREES: the 12 verified patterns PLUS `*.columns.*` -
orphan scans exclude BY CONSTRUCTION SITE.

## Error-to-UI contract

Backend messages are never user-facing copy; UI renders translated keys off the
envelope; machine `code` is the discriminator; matching backend prose is
forbidden. *[rev 4 cross-reference: BL-13 records that several tests assert
exception-message prose - non-contract coupling, ruling pending.]*

## OpenAPI / declarative YAML

No line caps; domain cohesion with `$ref`; version bumps with every contract
change.

## Waiver register (StockEase)

**PENDING:** (none)

**GRANTED:**

- `shared/web/GlobalExceptionHandler.java` - 150 code lines vs exception-advice
  alarm >100 (R1, #180, 2026-08-07). The "status mapping only in
  `GlobalExceptionHandler`" rule concentrates status mapping here by design; the
  length is the rule working, not a missing split. In-file comment at L33-36.
- `.github/scripts/docs/build-architecture-docs.sh` - 76 vs ~70 (#179,
  2026-08-07). In-file comment present.
- `.github/workflows/docs-pr-check.yml` - 17-line header vs the 2-5 line rule
  (2026-08-07). The header documents the branch-protection mechanism - that the
  required check is a NAME, not a workflow - which is load-bearing WHY with no
  better home; trimming it would delete the content the header rule exists to
  preserve. No in-file comment: workflow headers do not carry waiver
  annotations, so this register entry is the record.

**RESOLVED WITHOUT WAIVER:**

- `.github/scripts/docs/build-docs.sh` - 90 -> 60 (#179).

**RESOLVED BY SPLIT** (survey fix phase, #182-#187): the six other ABOVE-ALARM
files - see plan v18 scoreboard.
