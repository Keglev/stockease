# Architecture Documentation Generation & Deployment Guide

## Overview

The StockEase project now has a complete automated documentation pipeline that:

1. **Converts Markdown to HTML** - All 31 markdown files in `/docs/architecture/` are converted to HTML
2. **Applies Enterprise Template** - Uses a professional, navigable HTML template with sidebar, TOC, and responsive design
3. **Deploys to GitHub Pages** - Publishes to `gh-pages` branch automatically on push to `main`

---

## Documentation Structure

### Input Files

Located in: `backend/docs/architecture/`

```
architecture/
├── index.md                          # Main entry point
├── overview.md                       # System overview
├── layers.md                         # Architectural layers
├── backend.md                        # Backend architecture
├── frontend.md                       # Frontend architecture
├── security.md                       # Security architecture
├── deployment.md                     # Deployment strategy
├── testing-architecture.md           # Testing strategy
├── components/
│   ├── index.md
│   ├── authentication.md
│   ├── authorization.md
│   ├── database.md
│   ├── caching.md
│   └── ...
├── decisions/
│   ├── index.md
│   ├── adr-001-*.md
│   └── ...
├── patterns/
│   ├── index.md
│   └── ...
├── testing/
│   ├── strategy.md
│   ├── pyramid.md
│   ├── test-data-fixtures.md
│   └── ...
└── deployment/
    ├── ci-pipeline.md
    ├── docker-strategy.md
    └── ...
```

**Total: 31 markdown files**

### Output Files

Generated in: `target/docs/architecture/`

All `.md` files are converted to `.html` files with the same directory structure.

---

## Enterprise HTML Template

**File:** `backend/docs/templates/enterprise-docs.html`

### Features

- **Professional Branding** - StockEase header with navigation breadcrumbs
- **Responsive Sidebar** - Auto-generated navigation menu from predefined structure
- **Table of Contents** - Auto-generated from markdown headers (H2, H3)
- **Enterprise Styling**
  - Modern color scheme (primary blue #0066cc)
  - Clear typography hierarchy
  - Code syntax highlighting
  - Alert boxes (info, warning, success, danger)
  - Tables with alternating row colors
  - Responsive grid layout
- **Navigation Structure**
  - API Documentation section
  - Architecture section
  - Design Decisions
  - Components
  - Patterns
  - Testing
  - Deployment
  - Reference

### Template Variables

- `$title$` - Document title
- `$body$` - Converted markdown content
- Navigation is built via JavaScript (hardcoded structure in template)

### Customization

To add new navigation items, edit the `navigation` object in the template:

```javascript
const navigation = {
    'Section Name': [
        { label: 'Item Label', href: './path/to/file.html' },
        // more items...
    ],
    // more sections...
};
```

---

## CI/CD Pipeline Integration

### Workflow File

**File:** `.github/workflows/docs-pipeline.yml`

### Trigger Events

- **On Push to `main`** with changes in:
  - `backend/docs/**` - Any documentation files
  - `.github/workflows/docs-pipeline.yml` - Workflow file itself
- **Manual Trigger** - Via GitHub Actions UI (workflow_dispatch)

### Pipeline Steps

#### 1. Detect Project Root
- Checks for `openapi.yaml` and `pom.xml`
- Determines if root project or backend subdirectory

#### 2. Install Dependencies
- Node.js 18
- @redocly/cli (for API docs generation)
- pandoc (for markdown conversion)

#### 3. Generate API Documentation
- Input: `backend/docs/api/openapi.yaml` (modular structure)
- Output: `target/docs/index.html` (ReDoc interactive docs)
- Uses: @redocly/cli `build-docs` command

#### 4. Convert Architecture Markdown to HTML
- Input: All `.md` files in `backend/docs/architecture/`
- Template: `backend/docs/templates/enterprise-docs.html`
- Output: Matching `.html` files in `target/docs/architecture/`
- Command: `pandoc --template <template> --toc --toc-depth=3`

#### 5. Create Documentation Index
- Generates main `target/docs/index.html`
- Landing page with cards linking to:
  - API Documentation
  - Architecture Overview
  - Backend Architecture
  - Frontend Architecture
  - Security Architecture
  - Deployment Strategy
  - Testing Architecture
  - Design Decisions

#### 6. Verify Generation
- Counts generated HTML/JSON files
- Shows directory size
- Confirms completion

#### 7. Deploy to GitHub Pages
- Uses: `peaceiris/actions-gh-pages@v3`
- Publishes: `target/docs/` directory
- Branch: `gh-pages`
- Automatic on successful build

---

## Accessing Generated Documentation

### Before First Deployment

The workflow must run at least once (automatically when code is pushed to `main`).

### After Deployment

**URL:** `https://keglev.github.io/stockease/`

Structure:
- `/` - Main documentation index (landing page)
- `/index.html` - API documentation (ReDoc)
- `/architecture/` - Architecture documentation
- `/architecture/overview.html` - Architecture overview
- `/architecture/backend.html` - Backend architecture
- `/architecture/frontend.html` - Frontend architecture
- etc.

### GitHub Pages Settings

The `gh-pages` branch is created automatically by the workflow.

To verify/configure:

1. Go to GitHub repo → Settings → Pages
2. Source: `Deploy from a branch`
3. Branch: `gh-pages` / `/ (root)`

---

## Local Testing (Optional)

### Prerequisites

```bash
# Install pandoc (on Windows via Chocolatey)
choco install pandoc

# Install @redocly/cli
npm install -g @redocly/cli
```

### Manual Local Build

```bash
# Generate ReDoc docs
redocly build-docs backend/docs/api/openapi.yaml -o backend/target/docs/index.html

# Generate architecture docs
TEMPLATE="backend/docs/templates/enterprise-docs.html"
find backend/docs/architecture -name "*.md" | while read md; do
  out="backend/target/docs/architecture/${md#backend/docs/architecture/}"
  out="${out%.md}.html"
  mkdir -p "$(dirname "$out")"
  pandoc "$md" --template "$TEMPLATE" --toc -o "$out"
done

# View locally
python -m http.server -d backend/target/docs/
# Then open http://localhost:8000/
```

---

## File Manifest

### New/Modified Files

| File | Purpose | Status |
|------|---------|--------|
| `docs/templates/enterprise-docs.html` | Enterprise HTML template | ✅ Created |
| `.github/workflows/docs-pipeline.yml` | CI/CD workflow | ✅ Updated |

### Documentation Sources

- `docs/architecture/*.md` - 31 markdown files (existing)
- `docs/api/openapi.yaml` - API specification (existing)
- `docs/api/paths/*.yaml` - Modular API paths (existing)

### Generated (on GitHub Pages)

- `target/docs/index.html` - Landing page
- `target/docs/index.html` (from ReDoc) - API docs
- `target/docs/architecture/*.html` - 31 architecture docs

---

## Navigation Map

### Main Entry Point

**`https://keglev.github.io/stockease/`**

Landing page with 8 cards linking to:

1. **API Documentation** → ReDoc interactive specification
2. **Architecture Overview** → System design and layers
3. **Backend Architecture** → Spring Boot application structure
4. **Frontend Architecture** → React/TypeScript structure
5. **Security Architecture** → JWT, auth, access control
6. **Deployment Strategy** → Docker, CI/CD, cloud
7. **Testing Architecture** → Test pyramid and strategies
8. **Design Decisions** → ADRs and technical justifications

### Sidebar Navigation (in each doc)

Each HTML page has a sidebar with sections:

- **API Documentation** - Link to API docs
- **Architecture** - 6 main architecture pages
- **Design Decisions** - Link to decisions index
- **Components** - Link to components index
- **Patterns** - Link to patterns index
- **Testing** - 4 testing-related pages
- **Deployment** - 2 deployment pages
- **Reference** - 3 reference documents

---

## Deployment Status

| Component | Status | Details |
|-----------|--------|---------|
| Template | ✅ Ready | Enterprise design, responsive, professional |
| Workflow | ✅ Ready | Runs on push, converts all docs, deploys to gh-pages |
| API Docs | ✅ Ready | ReDoc interactive spec (index.html) |
| Architecture Docs | ✅ Ready | 31 files converted to HTML with navigation |
| GitHub Pages | ⏳ Ready | Configured, will activate on first workflow run |
| Landing Page | ✅ Ready | Custom HTML with card layout |

---

## Next Steps

1. **Trigger Workflow** (Automatic on next push to `main`)
   - Or manually via GitHub Actions UI
   - Converts all docs to HTML with template
   - Deploys to gh-pages branch

2. **Verify GitHub Pages** (After workflow completes ~2-3 min)
   - Check: Settings → Pages
   - Visit: https://keglev.github.io/stockease/

3. **Monitor Workflow**
   - Go to: Actions tab on GitHub
   - Watch "Docs Pipeline" workflow
   - Check logs for any errors

4. **Iterate** (if needed)
   - Edit markdown files
   - Push to main
   - Workflow auto-runs
   - Changes appear on gh-pages in ~3-5 minutes

---

## Architecture

```
GitHub Repository
├── main branch
│   ├── backend/docs/architecture/ (31 .md files)
│   ├── backend/docs/api/ (openapi.yaml + modular paths)
│   ├── backend/docs/templates/ (enterprise-docs.html)
│   └── .github/workflows/docs-pipeline.yml
│
├── [Workflow Triggers on Push]
│   ├── Install deps (pandoc, redocly)
│   ├── Generate API docs (ReDoc)
│   ├── Convert architecture docs (Markdown → HTML)
│   ├── Create landing page
│   └── Deploy to gh-pages
│
└── gh-pages branch
    └── target/docs/ (published to GitHub Pages)
        ├── index.html (landing page)
        ├── index.html (API docs from ReDoc)
        ├── architecture/
        │   ├── overview.html
        │   ├── backend.html
        │   ├── frontend.html
        │   ├── security.html
        │   ├── deployment.html
        │   ├── testing-architecture.html
        │   ├── components/
        │   ├── decisions/
        │   ├── patterns/
        │   ├── testing/
        │   └── deployment/
        └── ... (all other converted docs)

Live at: https://keglev.github.io/stockease/
```

---

## Summary

✅ **Complete End-to-End Documentation System**

- **31 Markdown files** → Converted to professional HTML
- **Enterprise Template** → Modern, responsive, navigable
- **Automated Deployment** → GitHub Actions workflow
- **GitHub Pages Hosting** → Free, automatic, reliable
- **Professional Navigation** → Sidebar + TOC + breadcrumbs
- **Responsive Design** → Works on desktop, tablet, mobile

**Ready to deploy on next push to `main` branch!**
