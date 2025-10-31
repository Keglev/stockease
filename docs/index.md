# StockEase Backend Documentation

Welcome to the StockEase backend documentation. This is the source documentation for the system architecture, API design, and deployment infrastructure.

**Generated documentation is published at:** [StockEase Docs (GitHub Pages)](https://Keglev.github.io/stockease/)

## 📚 Documentation Sections

### [Architecture Documentation](./architecture/)
- **[overview.md](./architecture/overview.md)** — System architecture, business context, C4 model
- **[layers.md](./architecture/layers.md)** — Service layers, components, data flow
- **[security.md](./architecture/security.md)** — Authentication, authorization, security patterns
- **[deployment.md](./architecture/deployment.md)** — Infrastructure, CI/CD, monitoring, disaster recovery

### [API Documentation](./api/)
- **OpenAPI Spec** — Auto-generated from code annotations
- **Redoc Interactive Docs** — Generated from OpenAPI spec by CI pipeline

### [Coverage Reports](./coverage/)
- **JaCoCo Test Coverage** — Generated per build

## 🔄 Documentation Pipeline

```
Source (Markdown, OpenAPI specs)
    ↓
GitHub Actions (docs-ci.yml)
    ↓
Generate HTML (Markdown → HTML, OpenAPI → Redoc, JaCoCo → Coverage)
    ↓
Commit to docs branch
    ↓
GitHub Pages (Published automatically)
```

## 🛠️ How to Contribute

1. **Edit .md files** in `/backend/docs/` on `main` branch
2. **Add @Operation annotations** to API controllers (auto-generates OpenAPI spec)
3. **Push to main** → CI pipeline automatically converts to HTML and deploys to docs branch
4. **View live** at https://Keglev.github.io/stockease/

## 📖 Documentation Types

| Section | Purpose | Audience | Longevity |
|---------|---------|----------|-----------|
| **Architecture** | System design, decisions, rationale | Architects, reviewers, future maintainers | Stable; updated on design changes |
| **API Docs** | Endpoint reference, parameters, examples | API consumers, frontend developers | Changes per API changes |
| **Coverage** | Test coverage metrics | Team, CI/CD monitoring | Generated per build |

## 🔗 Quick Links

- **GitHub Pages:** https://Keglev.github.io/stockease/
- **API Reference:** https://Keglev.github.io/stockease/api/
- **Architecture:** https://Keglev.github.io/stockease/architecture/
- **Coverage:** https://Keglev.github.io/stockease/coverage/

## 📝 Directory Structure

```
docs/
├── index.md                          # This file
├── architecture/
│   ├── overview.md                  # System architecture & business context
│   ├── layers.md                    # Component layers & interactions
│   ├── security.md                  # Security patterns & auth flow
│   └── deployment.md                # Infrastructure & deployment
├── api/
│   ├── openapi/                     # OpenAPI spec (auto-generated)
│   └── redoc/                       # Redoc HTML (CI-generated)
└── coverage/                        # JaCoCo coverage reports (CI-generated)
```

---

**Last Updated:** $(date)  
**Branch:** main  
**Deployment:** Automated via GitHub Actions
