# Phase 3: Deployment Infrastructure Guide
## CI/CD Pipeline for Documentation Generation and GitHub Pages Deployment

**Goal**: Automate OpenAPI documentation generation, convert markdown to HTML, and deploy to GitHub Pages.

---

## Overview: 5 Core Tasks

| Task | Item | Description | Status |
|------|------|-------------|--------|
| **3.8** | Extract OpenAPI | Extract `/v3/api-docs` from running Spring Boot app → `openapi.json` | ⏳ |
| **3.9** | Generate Redoc | Convert `openapi.json` → Redoc HTML (`index.html`) | ⏳ |
| **3.10** | Convert Markdown | Convert all `.md` files → HTML with table of contents | ⏳ |
| **3.11** | Deploy to Pages | Push generated HTML to `gh-pages` branch | ⏳ |
| **3.13** | Create Docs Branch | Create orphan `docs-source` branch with source files | ⏳ |

---

## Prerequisites

### Installed Tools
- ✅ Java 17 (for Spring Boot compilation)
- ✅ Maven 3.9.x (pom.xml configured)
- ✅ SpringDoc OpenAPI 2.4.0 (in pom.xml)
- ⏳ Node.js (for Redoc CLI + markdown tools)
- ⏳ Pandoc (for markdown → HTML conversion)

### Repository Configuration
- ✅ Git configured with SSH or HTTPS
- ✅ GitHub repository: `Keglev/stockease`
- ✅ Default branch: `main`
- ⏳ GitHub Pages enabled (Settings → Pages → Source: `gh-pages` branch)

---

## Detailed Implementation Steps

### Step 1: Extract OpenAPI Specification (Item 3.8)

#### What: Extract JSON specification from `/v3/api-docs`

**Why**: SpringDoc automatically exposes OpenAPI spec at `/v3/api-docs`.
Redoc needs this JSON file to generate interactive API documentation.

**How**:

```bash
# Option A: Local Testing
cd backend
mvn clean package -q -DskipTests

# Start Spring Boot app in background
java -jar target/stockease-0.0.1-SNAPSHOT.jar &
APP_PID=$!
sleep 10  # Wait for startup

# Extract OpenAPI spec
curl -s http://localhost:8080/v3/api-docs > target/docs/openapi.json

# Verify extraction
cat target/docs/openapi.json | jq '.info.title'  # Should show "StockEase API"

# Stop app
kill $APP_PID
```

**GitHub Actions Implementation** (see `.github/workflows/docs-pipeline.yml`):
- Builds app with `mvn clean package`
- Runs app in background
- Waits 10 seconds for Tomcat startup
- Extracts spec with `curl`
- Validates JSON format
- Kills process

**Output**: `backend/target/docs/openapi.json`

---

### Step 2: Generate Redoc HTML (Item 3.9)

#### What: Convert OpenAPI JSON → Interactive HTML documentation

**Why**: Redoc provides:
- Single-page interactive API reference
- Search functionality
- Request/Response examples
- Authentication documentation

**How**:

```bash
# Install Redoc CLI
npm install -g redoc-cli

# Generate HTML from OpenAPI spec
redoc-cli build backend/target/docs/openapi.json \
  -o backend/target/docs/api/index.html \
  --title "StockEase API Documentation"

# Verify output
ls -lah backend/target/docs/api/index.html
```

**GitHub Actions Implementation**:
```yaml
- name: Generate Redoc HTML
  run: |
    npm install -g redoc-cli
    redoc-cli build backend/target/docs/openapi.json \
      -o backend/target/docs/api/index.html \
      --title "StockEase API Documentation"
```

**Output**: `backend/target/docs/api/index.html` (~2-3 MB single-page app)

**Customize Redoc**:
```html
<!-- Custom logo, colors, sidebar settings -->
<redoc spec-url="/openapi.json"></redoc>
```

---

### Step 3: Convert Markdown to HTML (Item 3.10)

#### What: Convert all documentation `.md` files → HTML with table of contents

**Why**: 
- Consistent styling across all docs
- Automatic table of contents generation
- Searchable content on GitHub Pages

**Files to Convert**:
```
backend/docs/
├── index.md                              → docs/index.html
├── JAVADOC-GUIDE.md                      → docs/javadoc-guide.html
├── JAVADOC-PROGRESS.md                   → docs/javadoc-progress.html
└── architecture/
    ├── index.md                          → docs/architecture/index.html
    ├── backend.md                        → docs/architecture/backend.html
    ├── frontend.md                       → docs/architecture/frontend.html
    ├── deployment.md                     → docs/architecture/deployment.html
    ├── security.md                       → docs/architecture/security.html
    ├── overview.md                       → docs/architecture/overview.html
    └── decisions/
        ├── 001-database-choice.md        → docs/architecture/decisions/001.html
        └── 002-validation-strategy.md    → docs/architecture/decisions/002.html
```

**How**:

```bash
# Install tools
sudo apt-get install pandoc  # On Linux
npm install -g markdown-it-cli

# Convert all .md files with table of contents
find backend/docs -name "*.md" -type f | while read md_file; do
  dir_path=$(dirname "$md_file" | sed 's|backend/docs|docs|')
  mkdir -p "$dir_path"
  
  html_file="${md_file%.md}.html"
  html_file=$(echo "$html_file" | sed 's|backend/docs|docs|')
  
  # Generate HTML with TOC
  pandoc "$md_file" \
    -f markdown \
    -t html \
    --toc \
    --toc-depth=3 \
    -s \
    -c /css/style.css \
    -o "$html_file"
done
```

**GitHub Actions Implementation**:
```yaml
- name: Convert Markdown to HTML
  run: |
    sudo apt-get update && apt-get install -y pandoc
    mkdir -p docs/generated
    
    find backend/docs -name "*.md" -type f | while read md_file; do
      html_path="docs/generated/$(basename "$md_file" .md).html"
      pandoc "$md_file" -f markdown -t html --toc -s -o "$html_path"
    done
```

**HTML Output Features**:
- Auto-generated table of contents from headers
- Syntax highlighting for code blocks
- Responsive mobile-friendly styling
- Navigation breadcrumbs

**Output Directory**: `docs/generated/*.html`

---

### Step 4: Deploy to GitHub Pages (Item 3.11)

#### What: Push generated HTML to `gh-pages` branch

**Why**: 
- GitHub automatically serves content from `gh-pages` branch
- Free static hosting
- No additional infrastructure needed

**How**:

```bash
# GitHub Pages automatically deploys from gh-pages branch
# Use GitHub Actions peaceiris/actions-gh-pages@v3
```

**GitHub Actions Implementation**:
```yaml
- name: Deploy to GitHub Pages
  uses: peaceiris/actions-gh-pages@v3
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    publish_dir: ./docs/generated
    cname: stockease-docs.keglev.github.io  # Optional custom domain
```

**Workflow**:
1. Action pushes `docs/generated/*` content to `gh-pages` branch
2. GitHub Pages detects change
3. Content available at: `https://keglev.github.io/stockease/`

**URL Structure**:
- API Docs: `https://keglev.github.io/stockease/api/`
- Architecture: `https://keglev.github.io/stockease/docs/architecture/`
- Getting Started: `https://keglev.github.io/stockease/docs/getting-started.html`

---

### Step 5: Create Documentation Source Branch (Item 3.13)

#### What: Create `docs-source` branch with source `.md` files (no generated files)

**Why**:
- Version control for documentation sources
- Separate from generated artifacts
- Easy to track documentation changes

**How**:

```bash
# Create orphan branch (no history)
git checkout --orphan docs-source

# Remove all files
git rm -rf .

# Copy only source documentation
git checkout HEAD -- backend/docs backend/src/main/docs *.md

# Commit and push
git config user.email "ci@github.com"
git config user.name "GitHub CI"
git add -A
git commit -m "docs: Documentation sources (Item 3.13)"
git push origin docs-source --force
```

**Branch Contents**:
```
docs-source/
├── backend/
│   ├── docs/
│   │   ├── index.md
│   │   ├── architecture/
│   │   └── ...
│   └── src/main/docs/
│       └── api.md
├── frontend/
│   ├── README.md
│   └── docs/
└── README.md
```

**GitHub Actions Implementation**:
```yaml
- name: Create docs-source branch
  run: |
    git config user.email "actions@github.com"
    git config user.name "GitHub Actions"
    
    git checkout --orphan docs-source
    git rm -rf .
    git checkout HEAD -- backend/docs backend/src/main/docs
    git add -A
    git commit -m "docs: Push documentation sources"
    git push origin docs-source --force
```

---

## Complete GitHub Actions Workflow

**File**: `.github/workflows/docs-pipeline.yml`

Triggers:
- ✅ On push to `main` branch
- ✅ On changes to `backend/src/main/**`, `docs/**`, `backend/pom.xml`
- ✅ Manual trigger via `workflow_dispatch`

**Jobs**:
1. **build-docs** (ubuntu-latest)
   - Extract OpenAPI spec
   - Generate Redoc HTML
   - Convert markdown files
   - Deploy to GitHub Pages
   - Create docs-source branch

---

## Configuration: GitHub Pages Settings

### Enable GitHub Pages

1. **Repository Settings** → **Pages**
2. **Build and deployment**
   - **Source**: `Deploy from a branch`
   - **Branch**: Select `gh-pages` / `root`
3. **Save**

### Optional: Custom Domain

1. Create `CNAME` file in docs root:
   ```
   stockease-docs.example.com
   ```

2. Add DNS record:
   ```
   CNAME stockease-docs.example.com keglev.github.io
   ```

---

## Testing & Verification (Phase 4)

### Item 4.14: Configure GitHub Pages

✅ Enable Pages → Deploy from `gh-pages` branch

### Item 4.15: Test Pipeline End-to-End

```bash
# Push changes and monitor workflow
git push origin main

# Watch: GitHub → Actions tab → docs-pipeline workflow
# Verify all steps complete successfully
```

### Item 4.16: Verify Links Work

```bash
# After successful deployment
curl -I https://keglev.github.io/stockease/api/
curl -I https://keglev.github.io/stockease/docs/architecture/

# Check for 200 OK responses
```

---

## Troubleshooting

### OpenAPI spec not extracting
```bash
# Check if app started
curl -v http://localhost:8080/actuator/health

# Verify SpringDoc is properly configured
curl http://localhost:8080/v3/api-docs | jq '.info'
```

### Redoc HTML not generating
```bash
# Check OpenAPI JSON is valid
cat backend/target/docs/openapi.json | jq .

# Install redoc-cli globally
npm install -g redoc-cli
```

### Markdown conversion failing
```bash
# Verify pandoc installed
pandoc --version

# Test conversion manually
pandoc backend/docs/index.md -o test.html --toc
```

---

## Success Criteria

✅ Phase 3 Complete When:
- [ ] OpenAPI spec extracting to JSON (Item 3.8)
- [ ] Redoc HTML generating from spec (Item 3.9)
- [ ] All markdown files converting to HTML (Item 3.10)
- [ ] GitHub Pages serving documentation (Item 3.11)
- [ ] Documentation source branch created (Item 3.13)
- [ ] GitHub Actions workflow running successfully
- [ ] No build/deployment errors in Actions tab

✅ Phase 4 Complete When:
- [ ] GitHub Pages configured (Item 4.14)
- [ ] Workflow tested end-to-end (Item 4.15)
- [ ] All links verified working (Item 4.16)
- [ ] Documentation accessible at public URL

---

## Next Steps

1. **Immediate**: Set up GitHub Actions workflow (`.github/workflows/docs-pipeline.yml`)
2. **Next**: Configure GitHub Pages in repository settings
3. **Then**: Push changes to main branch and monitor workflow
4. **Finally**: Verify documentation deployed and links working

**Estimated Time**: 1-2 hours for complete setup and verification

