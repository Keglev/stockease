# StockEase frontend

The Angular application - `core/` services and guards, `shared/` shell and stores,
`features/` one folder per routed area - plus `src/i18n/`, the authored translation
sources from which `public/i18n/` is assembled.

    npm start               # dev server on http://localhost:4200
    npm run test:coverage   # full suite with coverage, non-interactive
    npm run i18n:check      # verify the shipped bundles match their sources

Editing `public/i18n/*.json` by hand will not survive: CI fails on any difference
from the sources. Run `npm run i18n:build` instead.

- [Repository README](../README.md) - overview, stack, deployment
- [Frontend architecture](https://keglev.github.io/stockease/frontend/architecture/overview.html)
- [Frontend API reference](https://keglev.github.io/stockease/frontend/api/index.html)
