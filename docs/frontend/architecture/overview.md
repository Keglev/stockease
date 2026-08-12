# Frontend Architecture

StockEase's frontend is a single-page Angular application over the backend's
REST API: product master data, suppliers and customers, purchase and sales
invoices, stock movements, a change history and a reporting area, behind one
authenticated shell.

> **This is a one-page summary.** For the introduction and goals of the frontend
> context - quality goals, audience and the scope boundary against the backend -
> see [Introduction and Goals](index.md).

## Technology stack

| Component        | Technology                        | Version |
|------------------|-----------------------------------|---------|
| Language         | TypeScript                        | 6.0     |
| Framework        | Angular (standalone, signals)     | 22.0    |
| UI components    | Angular Material and CDK          | 22.0    |
| Charts           | Apache ECharts, used directly     | 6.1.0   |
| Translation      | ngx-translate                     | 18.0    |
| Async            | RxJS                              | 7.8     |
| Testing          | Vitest with jsdom                 | 4.0     |
| Build            | Angular CLI (`@angular/build`)    | 22.0    |
| CI/CD            | GitHub Actions                    | -       |
| Hosting          | Vercel CDN                        | -       |

## Application shape

The application is standalone throughout: it declares no `NgModule` anywhere,
and `main.ts` bootstraps a single root component with a provider list in
`app/app.config.ts`. `zone.js` is neither installed nor present in the
production bundle, and `angular.json` configures no polyfills entry; components
hold their state in signals and expose it with `input()` and `output()`.

Routing is lazy without exception. Every entry in `app/app.routes.ts` uses
`loadComponent`, so no feature is in the initial bundle. Three routes are
public - the landing page, login and logout - and everything else is a child of
`/app`, which loads the shell component behind an auth guard. A wildcard route
declared last renders the not-found page.

## Shell, pages and cards

Three roles divide the work, and the division is enforced by review rather than
by the framework:

- **The shell** (`shared/shell`) is the frame around every authenticated page:
  toolbar, navigation drawer and the routed outlet. It owns the idle-logout
  timer, which is why that timer cannot run while a visitor reads a public page.
- **A page** owns its data. It calls the services, holds the loaded rows, shows
  the error banner, computes everything its children draw, and decides what is
  loaded lazily.
- **A card** is presentational. Its figures arrive as inputs already computed,
  and its controls announce a decision through an output rather than acting on
  it. The reports area is the worked example: each tab body is a card, and the
  page behind them owns every fetch and every derivation.

## Where state lives

There is no global store. State is held where it is used:

- **Services** (`app/core`) own everything cross-cutting and long-lived: the
  session and token, the current language, the theme, formatting, notifications
  and health. They are `providedIn: 'root'` and expose signals.
- **Components** hold their own view state in signals, deriving with `computed`
  rather than recalculating in the template.
- **Two shared signal stores** carry patterns that repeated often enough to be
  worth naming: `shared/list/list-page-store.ts` for register pages that load a
  bounded list once and page over it client-side, and
  `shared/dialog/dialog-submit-store.ts` for dialog submission state.

## Talking to the backend

Feature services call the API through Angular's `HttpClient`, with the base URL
supplied per build by `src/environments/`. Two functional interceptors sit in
front of every request: one attaches the bearer token, the other converts a
failed response into an `ApiError` carrying the status and the backend's
machine-readable code. Most endpoints answer inside a `success`/`message`/`data`
envelope, which feature services unwrap - deliberately not the interceptor,
because the report endpoints return their payload directly.

## Language and formatting

The interface ships in English and German. Translations are authored as one file
per namespace per language under `frontend/src/i18n/` and assembled at build
time into the two bundles the application fetches at runtime (ADR 037).
ngx-translate resolves keys at runtime, so the language switches without a
reload (ADR 015), and bootstrap waits for the first bundle so no page renders
raw keys. Dates and currency are formatted through `Intl` at render time rather
than by a compile-time locale (ADR 031).

## Testing

Vitest runs the suite through Angular's `unit-test` builder against jsdom.
Coverage thresholds are configured in `angular.json` as regression floors below
the achieved numbers, and the frontend workflow runs lint, a production build,
the suite with coverage, and a drift check that re-assembles the translation
bundles and fails if the committed ones differ.

## Documentation map

- [Introduction and Goals](index.md) (English) - [Deutsche Fassung](index-de.md)
- [Architecture decisions](../../decisions/index.md)
- [Backend architecture](../../backend/architecture/overview.md)
