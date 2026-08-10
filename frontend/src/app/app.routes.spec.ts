import { Route, Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';
import { routes } from './app.routes';

/*
 * The route table is configuration that only executes on navigation, so a broken lazy import - a
 * moved file, a renamed export - stays invisible until someone opens that page in a browser.
 * These specs resolve every loader and pin the ordering rules the file itself calls load-bearing.
 */

/* Every route in the table, parents before children, with its full path for readable failures. */
function flatten(table: Routes, prefix = ''): { path: string; route: Route }[] {
  return table.flatMap((route) => {
    const path = [prefix, route.path].filter((part) => part !== undefined && part !== '').join('/');
    return [{ path: path || '(index)', route }, ...flatten(route.children ?? [], path)];
  });
}

const ALL = flatten(routes);

const LAZY = ALL.filter((entry) => entry.route.loadComponent !== undefined);

/*
 * The compiled class name. The build renames declarations, so `LandingComponent` arrives here as
 * `_LandingComponent`; the leading underscore is an artefact of the bundler rather than anything
 * the route table controls.
 */
function nameOf(loaded: unknown): string {
  return (loaded as { name: string }).name.replace(/^_+/, '');
}

/* Paths of `parent`'s direct children, in declaration order. */
function childPaths(parentPath: string): (string | undefined)[] {
  return (ALL.find((entry) => entry.path === parentPath)?.route.children ?? []).map((c) => c.path);
}

/*
 * Pins the route table itself: every lazy route resolves to a component, the guarded area is
 * guarded, and the two orderings that are silent when wrong - 'invoices/new' before 'invoices/:id',
 * the wildcard last - stay that way.
 * Out of scope: what any routed component renders. Each has its own spec.
 */
describe('app.routes', () => {
  // 60s for this one test, against the suite's 20s ceiling: resolving 18 lazy chunks compiles all
  // of them, which legitimately exceeds the ceiling on a cold .angular/cache or a loaded worker.
  // The global value stays a ceiling for everything else - it is raised here, not there, because
  // this is the only test whose work is known to justify it (three timeouts on this one so far).
  it('table_everyLazyRoute_resolvesToAComponent', async () => {
    // Resolving the loader is the point: it executes the dynamic import and the export lookup,
    // which is exactly where a moved file or renamed class fails.
    const resolved = await Promise.all(
      LAZY.map(async (entry) => {
        const loaded = await (entry.route.loadComponent as () => Promise<unknown>)();
        return { path: entry.path, loaded };
      })
    );

    expect(resolved).toHaveLength(LAZY.length);
    for (const { path, loaded } of resolved) {
      // A missing export resolves to undefined rather than throwing, so this is the assertion
      // that would actually catch it.
      expect(loaded, `route "${path}" resolved to nothing`).toBeTypeOf('function');
    }
  }, 60_000);

  // The same 60s, for the ordering rather than for a measurement: this test resolves the same 18
  // loaders one at a time, so it is the slower of the pair whenever it is the one that compiles
  // them. Usually it is not - the test above runs first and warms the module cache - but nothing
  // declares or enforces that order, and Vitest is free to change it.
  //
  // Seen once, in #156: with the test above aborted at 1ms, this one ran 20004ms and failed on the
  // global ceiling. It has not been reproducible on demand since - clearing .angular/cache and
  // skipping the test above was not enough to push it over - so this budget is precautionary. It
  // is here because a margin that depends on which sibling ran first is not a margin, not because
  // the failure is expected.
  it('table_lazyRoutes_loadTheComponentNamedForTheirPath', async () => {
    const expected: Record<string, string> = {
      '(index)': 'LandingComponent',
      login: 'LoginComponent',
      logout: 'LogoutComponent',
      app: 'ShellComponent',
      'app/products': 'ProductListComponent',
      'app/invoices': 'InvoiceListComponent',
      'app/invoices/new': 'InvoiceCreateComponent',
      'app/invoices/:id': 'InvoiceDetailComponent',
      'app/movements': 'MovementRecordComponent',
      'app/audit/products/:productId': 'ChangeHistoryComponent',
      'app/audit/users/:userId': 'ChangeHistoryComponent',
      'app/reports': 'ReportsPageComponent',
      'app/suppliers': 'SupplierListComponent',
      'app/customers': 'CustomerListComponent',
      'app/settings': 'SettingsComponent',
      'app/help/:topic': 'HelpComponent',
      '**': 'NotFoundComponent'
    };

    for (const entry of LAZY) {
      const loaded = await (entry.route.loadComponent as () => Promise<unknown>)();
      // The dashboard is the shell's index child, so its path collides with the shell's own key
      // once flattened; it is asserted separately below rather than special-cased here.
      if (entry.path === 'app') continue;
      if (expected[entry.path] !== undefined) {
        expect(nameOf(loaded), `route "${entry.path}"`).toBe(expected[entry.path]);
      }
    }
  }, 60_000);

  it('appChildren_indexRoute_loadsTheDashboard', async () => {
    const index = (ALL.find((e) => e.path === 'app')?.route.children ?? []).find((c) => c.path === '');
    const loaded = await (index?.loadComponent as () => Promise<unknown>)();

    expect(nameOf(loaded)).toBe('DashboardComponent');
  });

  it('appRoute_always_isGuarded', () => {
    const app = ALL.find((entry) => entry.path === 'app')?.route;

    // Everything behind the shell is authenticated surface; losing this guard would expose the
    // whole application, and nothing else in the table re-checks it.
    expect(app?.canActivate).toContain(authGuard);
  });

  it('invoiceRoutes_newBeforeParameterised_soNewIsNotCapturedAsAnId', () => {
    const children = childPaths('app');

    // The router takes the first match. Reversed, "/app/invoices/new" would match 'invoices/:id'
    // with id="new" and open the detail page on a nonexistent invoice.
    expect(children.indexOf('invoices/new')).toBeLessThan(children.indexOf('invoices/:id'));
  });

  it('wildcardRoute_always_isDeclaredLast', () => {
    // Declared any earlier it would swallow every route beneath it, which no other assertion here
    // would notice: each loader would still resolve.
    expect(routes.at(-1)?.path).toBe('**');
    expect(routes.filter((route) => route.path === '**')).toHaveLength(1);
  });

  it('helpRedirect_bareHelpPath_redirectsFullMatchOnly', () => {
    const help = (ALL.find((e) => e.path === 'app')?.route.children ?? []).find(
      (c) => c.path === 'help'
    );

    // Without pathMatch 'full' the redirect also swallows /app/help/products, so every topic link
    // would bounce back to the overview.
    expect(help?.pathMatch).toBe('full');
    expect(help?.redirectTo).toBe('help/overview');
  });
});
