# Documentation Generation

**Purpose**: Document how the automated pipeline converts markdown to HTML and publishes to GitHub Pages.

---

## Overview

The documentation pipeline:
1. Reads all `.md` files from `backend/docs/architecture/`
2. Converts them to HTML using Pandoc and the enterprise template
3. Generates interactive API docs from `openapi.yaml` using Redocly
4. Deploys everything to the `gh-pages` branch via GitHub Actions

**Published URL**: https://keglev.github.io/stockease/

---

## How the Pipeline Works

### Workflow Files

| Workflow | File | Trigger |
|----------|------|---------|
| Docs generation | `.github/workflows/docs-pipeline.yml` | Push to `main` when `docs/**` or `pom.xml` changes; manual dispatch |
| Coverage deploy | `.github/workflows/docs-coverage-deploy.yml` | Automatically on `docs-pipeline.yml` success |

### Pipeline Stages (docs-pipeline.yml)

1. **Checkout** — full history (`fetch-depth: 0`)
2. **Detect project root** — `detect-maven-project.sh` sets `PROJECT_DIR`
3. **Setup Node.js 18** — install `@redocly/cli`
4. **Generate API docs** — reads `docs/api/openapi.yaml` → outputs `target/docs/api-docs.html`
5. **Install Pandoc** — converts architecture markdown to HTML using `enterprise-docs.html` template + Lua filter
6. **Fix directory links** — `fix-directory-links.sh` rewrites `href="path/"` to `index.html`
7. **Copy landing page** — `.github/scripts/templates/index.html` → `target/docs/index.html`
8. **Upload artifact** — `docs-site` artifact retained for coverage deploy
9. **Deploy to gh-pages** — `peaceiris/actions-gh-pages@v3` publishes `target/docs/`

### Coverage Deploy (docs-coverage-deploy.yml)

Runs after docs-pipeline.yml succeeds:
1. Downloads `docs-site` artifact
2. Runs `mvn -B clean test` with JaCoCo
3. `generate-coverage-wrapper.sh` creates iframe wrapper
4. Deploys to `gh-pages` at `/coverage/` subfolder without overwriting root docs

---

## Enterprise HTML Template

**File**: `.github/scripts/templates/enterprise-docs.html`

Features: responsive sidebar, auto-generated table of contents from H2/H3 headers, code syntax highlighting, enterprise color scheme, mobile-friendly layout.

### Template Variables

| Variable | Source |
|----------|--------|
| `$title$` | Markdown file H1 heading |
| `$body$` | Converted markdown content |

Navigation sidebar is built via JavaScript with a hardcoded structure in the template.

### Adding Navigation Items

Edit the `navigation` object inside the template:

```javascript
const navigation = {
    'Section Name': [
        { label: 'Item Label', href: './path/to/file.html' },
    ],
};
```

After editing, push to `main` and the pipeline regenerates all pages with the updated sidebar.

---

## Pandoc Conversion

**Command used** (simplified):

```bash
pandoc "$md" \
  --template "$TEMPLATE" \
  --toc \
  --toc-depth=3 \
  --lua-filter=md-to-html-links.lua \
  -o "$out"
```

The Lua filter converts `.md` links to `.html` links automatically — no manual link changes needed in source files.

---

## Local Build

Use this to preview the generated site before pushing.

**Prerequisites**:

```bash
# macOS
brew install pandoc
npm install -g @redocly/cli

# Windows (Chocolatey)
choco install pandoc
npm install -g @redocly/cli
```

**Build commands**:

```bash
# Generate API docs
redocly build-docs backend/docs/api/openapi.yaml \
  -o backend/target/docs/api-docs.html

# Generate architecture docs
TEMPLATE="backend/.github/scripts/templates/enterprise-docs.html"
find backend/docs/architecture -name "*.md" | while read md; do
  out="backend/target/docs/architecture/${md#backend/docs/architecture/}"
  out="${out%.md}.html"
  mkdir -p "$(dirname "$out")"
  pandoc "$md" --template "$TEMPLATE" --toc -o "$out"
done

# Serve locally
python -m http.server -d backend/target/docs/
# Open: http://localhost:8000/
```

---

## GitHub Pages Setup

The `gh-pages` branch is created automatically on first workflow run.

To verify in GitHub: **Settings → Pages → Source: Deploy from branch → Branch: gh-pages / root**

Published structure:

```
https://keglev.github.io/stockease/
  /                     ← Landing page
  /api-docs.html        ← ReDoc interactive API spec
  /architecture/        ← All architecture HTML docs
  /coverage/            ← JaCoCo coverage report
```

---

[Back to Documentation Index](../index.md)
