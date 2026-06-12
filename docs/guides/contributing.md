# Contributing to Documentation

**Purpose**: Guide for writing, updating, and maintaining StockEase architecture documentation.

---

## Principles

Documentation is a first-class artifact — treated the same as code. It must be updated when the code it describes changes, reviewed during code review, and kept accurate enough that a new developer can onboard from it alone.

---

## When to Update Documentation

| Change Type | Action |
|-------------|--------|
| New feature or endpoint | Add or update the relevant architecture doc before merging |
| Bug fix that changes behavior | Update the doc that describes that behavior |
| Refactor | Update affected docs to reflect the new structure |
| New test pattern | Document in the relevant `/testing/` file |
| Infrastructure change | Update `/deployment/` docs |
| Architecture decision | Add or update an ADR in `/decisions/` |

---

## Where Files Belong

| Content Type | Directory |
|-------------|-----------|
| System architecture (layers, components, security) | `/architecture/system/` |
| Test strategy, patterns, coverage | `/architecture/testing/` |
| CI/CD, Docker, environments | `/architecture/deployment/` |
| Why decisions were made | `/architecture/decisions/` |
| How patterns are implemented | `/architecture/patterns/` |
| Specific component detail | `/architecture/components/` |
| Pipeline and contribution guides | `/docs/guides/` |

---

## File and Format Rules

**File naming**: lowercase, hyphen-separated. Example: `security-patterns.md`.

**ADR naming**: `NNN-brief-description.md`. Example: `003-authentication-mechanism.md`.

**File length**: 150–250 lines per file. If a file exceeds that, split by concern.

**Back links**: every file must end with a link back to its directory index.

**Mermaid diagrams**: use Mermaid for all diagrams — no ASCII art. Maximum 15–20 nodes per diagram. Split into multiple diagrams if larger.

**Code examples**: use only code that exists in the actual codebase. No aspirational or planned code in architecture docs.

**Future/planned content**: does not belong in architecture docs. Create an ADR if a significant decision is pending, or track in the backlog.

---

## Writing Style

Be direct. One file, one topic. No meta-sections explaining how the document is structured. No "Best Practices" sections that repeat content from other files. No filler introductions.

Lead with what the document covers, then the content, then the back link. Nothing else.

---

## Link Format

All links must be relative:

```markdown
[System Overview](./overview.md)           ← same directory
[Backend](../system/backend.md)            ← parent then child
[Decisions Index](../decisions/index.md)   ← sibling directory
```

The Lua filter in the pipeline converts `.md` links to `.html` automatically — always use `.md` extensions in source files.

---

## Adding a New Document

1. Create the file in the correct directory following naming rules
2. Add a back link at the bottom pointing to the directory index
3. Add the file to the directory's `index.md`
4. If it is a new ADR, follow the ADR format: Status, Date, Context, Decision, Rationale, Alternatives Considered, Consequences, Implementation Status
5. If the doc introduces a new directory, create an `index.md` for that directory and add it to the root `/docs/index.md`

---

## Maintenance Cadence

**Before each release**: verify that `deployment/infrastructure.md` and `system/overview.md` match the actual production setup.

**After a refactor**: update all affected docs in the same PR as the code change.

**Monthly**: scan for docs that reference deleted files, non-existent components, or outdated version numbers.

---

## Finding Things

Each directory has an `index.md` with a full document list. The root entry point is [`/docs/index.md`](../index.md). Use GitHub's file search (`t` key in the repository) or VS Code (`Ctrl+P`) to find files by name.

---

[Back to Documentation Index](../index.md)
