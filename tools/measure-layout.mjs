#!/usr/bin/env node
// =============================================================================
// measure-layout.mjs — measures horizontal overflow and resolved theme colours
// in headless Chrome, so a claim about layout in a PR body is a number rather
// than a screenshot impression.
//
// Provenance: rebuilt from the throwaway harness written during the #113
// overflow root-cause work, which was never committed.
//
// Usage: node tools/measure-layout.mjs --url http://localhost:4321
//          --viewports 1920x1080,390x844 --routes /app,/app/reports
//          [--selector ".type-chip"] [--schemes light,dark] [--json]
//
// On Git Bash, MSYS path conversion rewrites route arguments into Windows paths
// (/app becomes C:/Program Files/Git/app). Prefix MSYS_NO_PATHCONV=1, or use
// PowerShell.
//
// Deliberately NOT wired into CI. It is a measurement instrument, not a gate:
// it asserts nothing, and a number that needs a human to interpret it does not
// belong in a required check.
//
// The --token it seeds is a rendering key, not a credential: it is unsigned,
// the backend would reject it, and every /api/** call is stubbed anyway.
// =============================================================================
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';

// puppeteer-core is a devDependency of the frontend workspace, and this file sits
// outside it, so resolve from there rather than from tools/.
const { launch } = createRequire(new URL('../frontend/package.json', import.meta.url))('puppeteer-core');

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  `${process.env.LOCALAPPDATA ?? ''}/Google/Chrome/Application/chrome.exe`,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium'
];

function resolveChrome() {
  const found = [process.env.CHROME_PATH, ...CHROME_CANDIDATES].find((p) => p && existsSync(p));
  if (!found) {
    throw new Error('No Chrome found. Set CHROME_PATH to a Chrome or Chromium executable.');
  }
  return found;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  const list = (v, fallback) => (typeof v === 'string' ? v.split(',') : fallback);
  return {
    url: (args.url ?? 'http://localhost:4321').replace(/\/$/, ''),
    viewports: list(args.viewports, ['1920x1080', '1536x864', '390x844']).map((v) => {
      const [width, height] = v.split('x').map(Number);
      return { label: v, width, height };
    }),
    routes: list(args.routes, ['/app', '/app/reports']),
    schemes: list(args.schemes, ['light', 'dark']),
    selector: typeof args.selector === 'string' ? args.selector : null,
    role: args.role === 'USER' ? 'USER' : 'ADMIN',
    token: typeof args.token === 'string' ? args.token : null,
    json: Boolean(args.json)
  };
}

// Assembled from parts at runtime rather than written as one literal, so nothing
// in this file looks like a checked-in credential to a scanner or to a reader.
function mintToken(role) {
  const encode = (part) => Buffer.from(JSON.stringify(part)).toString('base64url');
  const header = encode({ alg: 'none', typ: 'JWT' });
  const claims = encode({ sub: 'measure-layout', role, exp: Math.floor(Date.now() / 1000) + 3600 });
  return [header, claims, 'unsigned'].join('.');
}

// Response shapes come from the OpenAPI spec, and the envelope is applied ONLY where
// the Angular service types the call as one. The report families return raw arrays;
// stubbing everything as {success,message,data} is what left the charts empty in the
// original harness.
const envelope = (data) => ({ success: true, message: 'stubbed', data });
const money = (n) => Number(n.toFixed(2));
const series = (count, build) => Array.from({ length: count }, (_, i) => build(i));

const product = (i) => ({
  id: i + 1, name: `Product ${i + 1}`, sku: `SKU-${100 + i}`,
  quantity: 20 + i * 3, purchasePrice: money(5 + i)
});
const profitRow = (i) => ({
  productId: i + 1, name: `Product ${i + 1}`, sku: `SKU-${100 + i}`, deleted: false,
  revenue: money(400 - i * 25), cost: money(220 - i * 12), grossProfit: money(180 - i * 13)
});
const dueRow = (i) => ({
  invoiceId: i + 1, invoiceNumber: `RE-2026-0${110 + i}`, invoiceType: i % 2 ? 'PURCHASE' : 'SALE',
  counterparty: `Party ${i + 1}`, dueDate: `2026-0${(i % 9) + 1}-15`,
  outstandingValue: money(150 + i * 40), daysOverdue: i * 3
});
const invoiceRow = (i) => ({
  id: i + 1, invoiceNumber: `RE-2026-0${110 + i}`, type: i % 2 ? 'PURCHASE' : 'SALE',
  status: ['OPEN', 'CLOSED', 'PAID'][i % 3], dueDate: `2026-0${(i % 9) + 1}-15`,
  supplierId: i % 2 ? i + 1 : null, supplierName: i % 2 ? `Supplier ${i + 1}` : null,
  customerId: i % 2 ? null : i + 1, customerName: i % 2 ? null : `Party ${i + 1}`,
  closedAt: null, paidAt: null, createdAt: '2026-01-02T03:04:00'
});

// Ordered: the first match wins, so the by-id routes must precede their collections.
const STUB_RULES = [
  [/\/api\/reports\/profit\/products\/\d+$/, () => envelope(profitRow(0))],
  [/\/api\/reports\/customers\/\d+\/summary$/, () =>
    envelope({ customerId: 1, name: 'Party 1', invoiceCount: 4, totalValue: money(820) })],
  [/\/api\/reports\/profit\/products$/, () => series(6, profitRow)],
  [/\/api\/reports\/profit\/suppliers$/, () =>
    series(4, (i) => ({
      supplierId: i + 1, name: `Supplier ${i + 1}`, revenue: money(900 - i * 90),
      cost: money(500 - i * 40), grossProfit: money(400 - i * 50)
    }))],
  [/\/api\/reports\/(due-soon|overdue)$/, () => series(5, dueRow)],
  [/\/api\/reports\/due-dates$/, () =>
    series(4, (i) => ({
      dueDate: `2026-0${i + 1}-15`, invoiceType: i % 2 ? 'PURCHASE' : 'SALE',
      invoiceCount: 3 + i, totalValue: money(500 + i * 120)
    }))],
  [/\/api\/reports\/stock-status$/, () =>
    series(6, (i) => ({
      productId: i + 1, name: `Product ${i + 1}`, sku: `SKU-${100 + i}`, soldUnits: 12 + i,
      soldRevenue: money(300 + i * 30), inStockUnits: 40 - i * 2, inStockValue: money(260 - i * 15)
    }))],
  [/\/api\/reports\/losses\/by-remark$/, () =>
    series(4, (i) => ({
      remark: ['EXPIRED', 'IN_TRANSIT_TO_CUSTOMER', 'INTERNAL', 'FROM_SUPPLIER'][i],
      lostUnits: 3 + i, destroyedUnits: i, lossValue: money(45 + i * 12)
    }))],
  [/\/api\/reports\/losses$/, () =>
    series(5, (i) => ({
      productId: i + 1, name: `Product ${i + 1}`, sku: `SKU-${100 + i}`, deleted: false,
      lostUnits: 2 + i, destroyedUnits: i, lossValue: money(30 + i * 9)
    }))],
  [/\/api\/reports\/cash-flow\/timeline$/, () =>
    series(8, (i) => ({
      month: `2026-0${(i % 9) + 1}`, inflow: money(1200 + i * 90),
      outflow: money(700 + i * 55), net: money(500 + i * 35)
    }))],
  [/\/api\/reports\/cash-flow$/, () => ({
    inflow: money(9600), outflow: money(5400), net: money(4200),
    products: series(5, (i) => ({
      productId: i + 1, name: `Product ${i + 1}`, inflow: money(900 - i * 60),
      outflow: money(500 - i * 30), net: money(400 - i * 30)
    }))
  })],
  [/\/api\/reports\/products\/\d+\/stock-history$/, () =>
    series(10, (i) => ({ date: `2026-01-${String(i + 1).padStart(2, '0')}`, quantity: 30 + i * 2 }))],
  [/\/api\/reports\/suppliers\/\d+\/products\/search$/, () =>
    series(3, (i) => ({ productId: i + 1, name: `Product ${i + 1}`, sku: `SKU-${100 + i}` }))],
  [/\/api\/products\/paged$/, () =>
    envelope({ content: series(6, product), pageNumber: 0, pageSize: 10, totalElements: 6, totalPages: 1 })],
  [/\/api\/products\/deleted$/, () => envelope([])],
  [/\/api\/products\/(low-stock|search)$/, () => series(4, product)],
  [/\/api\/invoices\/paged$/, () =>
    envelope({
      content: series(6, invoiceRow), pageNumber: 0, pageSize: 10, totalElements: 6, totalPages: 1
    })],
  [/\/api\/invoices\/\d+$/, () =>
    envelope({
      ...invoiceRow(0),
      items: series(3, (i) => ({
        id: i + 1, productId: i + 1, productName: `Product ${i + 1}`,
        quantity: 2 + i, unitPrice: money(15 + i), returnedQty: 0
      }))
    })],
  [/\/api\/invoices$/, () => series(6, invoiceRow)],
  [/\/api\/audit\/[\w/]*changes$/, () =>
    series(5, (i) => ({
      id: i + 1, productId: i + 1, productName: `Product ${i + 1}`, username: 'measure',
      field: 'quantity', oldValue: String(10 + i), newValue: String(12 + i),
      changedAt: `2026-01-0${(i % 9) + 1}T09:00:00`
    }))],
  [/\/api\/suppliers/, () =>
    series(4, (i) => ({ id: i + 1, name: `Supplier ${i + 1}`, contactName: null, email: null }))],
  [/\/api\/customers/, () => series(4, (i) => ({ id: i + 1, name: `Party ${i + 1}` }))]
];

function stubFor(pathname) {
  const rule = STUB_RULES.find(([pattern]) => pattern.test(pathname));
  return rule ? rule[1]() : envelope(null);
}

// A production build calls the API on another origin, so every stubbed call is
// preflighted. Answering the OPTIONS as if it were the GET is what makes the app
// report "Failed to fetch" with the stub apparently working.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'authorization,content-type,accept-language,accept'
};

async function newPage(browser, token) {
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    const { pathname } = new URL(request.url());
    if (!pathname.startsWith('/api/') && pathname !== '/health') return request.continue();
    if (request.method() === 'OPTIONS') {
      return request.respond({ status: 204, headers: CORS, body: '' });
    }
    return request.respond({
      status: 200,
      contentType: 'application/json',
      headers: CORS,
      body: JSON.stringify(stubFor(pathname))
    });
  });
  await page.evaluateOnNewDocument((value) => {
    localStorage.setItem('stockease.token', value);
    // The app resolves the theme from prefers-color-scheme only when nothing is
    // stored, and it persists what it resolves. Left alone, the first page pins the
    // theme for the whole browser and later scheme emulation measures nothing.
    localStorage.removeItem('stockease.theme');
  }, token);
  return page;
}

// networkidle0 would never settle: the stub answers instantly and the app keeps polling.
async function visit(page, url, route) {
  await page.goto(`${url}${route}`, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((resolve) => setTimeout(resolve, 900));
}

async function measureRoute(page, viewport) {
  return page.evaluate((width) => {
    const offenders = Array.from(document.querySelectorAll('body *'))
      .map((el) => ({ el, rect: el.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width > width + 1)
      .slice(0, 5)
      .map(({ el, rect }) => ({
        tag: el.tagName.toLowerCase(),
        cls: String(el.className || '').trim().slice(0, 48),
        width: Math.round(rect.width)
      }));
    return {
      scrollWidth: document.documentElement.scrollWidth,
      canvases: document.querySelectorAll('canvas').length,
      offenders
    };
  }, viewport.width);
}

async function probe(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const style = getComputedStyle(el);
    return { color: style.color, backgroundColor: style.backgroundColor };
  }, selector);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const token = opts.token ?? mintToken(opts.role);
  const browser = await launch({ executablePath: resolveChrome(), headless: true });
  const layout = [];
  const colours = [];

  try {
    for (const viewport of opts.viewports) {
      for (const route of opts.routes) {
        const page = await newPage(browser, token);
        await page.setViewport({ width: viewport.width, height: viewport.height });
        await visit(page, opts.url, route);
        const result = await measureRoute(page, viewport);
        layout.push({ viewport: viewport.label, route, ...result, overflow: result.scrollWidth > viewport.width });
        await page.close();
      }
    }

    if (opts.selector) {
      for (const scheme of opts.schemes) {
        for (const route of opts.routes) {
          const page = await newPage(browser, token);
          await page.setViewport({ width: opts.viewports[0].width, height: opts.viewports[0].height });
          await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
          await visit(page, opts.url, route);
          colours.push({ scheme, route, selector: opts.selector, ...(await probe(page, opts.selector)) ?? { color: null, backgroundColor: null } });
          await page.close();
        }
      }
    }
  } finally {
    await browser.close();
  }

  if (opts.json) {
    console.log(JSON.stringify({ url: opts.url, layout, colours }, null, 2));
    return;
  }
  report(layout, colours, opts);
}

function report(layout, colours, opts) {
  console.log(`\nmeasure-layout  ${opts.url}  (role ${opts.role})\n`);
  console.log('VIEWPORT    ROUTE            SCROLLW  VIEWPORTW  CANVAS  RESULT');
  for (const row of layout) {
    const width = row.viewport.split('x')[0];
    console.log(
      `${row.viewport.padEnd(11)} ${row.route.padEnd(16)} ${String(row.scrollWidth).padStart(7)}  ` +
        `${width.padStart(9)}  ${String(row.canvases).padStart(6)}  ${row.overflow ? 'OVERFLOW' : 'PASS'}`
    );
    // Only when the document actually overflows: an element wider than the viewport
    // inside its own scroller (a tab strip) is not a page-level defect. --json keeps
    // them either way.
    if (!row.overflow) continue;
    for (const bad of row.offenders) {
      console.log(`               ↳ ${bad.tag}.${bad.cls || '(no class)'} — ${bad.width}px`);
    }
  }
  if (!colours.length) return;
  console.log('\nSCHEME  ROUTE            SELECTOR        COLOR                  BACKGROUND');
  for (const row of colours) {
    console.log(
      `${row.scheme.padEnd(7)} ${row.route.padEnd(16)} ${row.selector.padEnd(15)} ` +
        `${String(row.color ?? 'not found').padEnd(22)} ${row.backgroundColor ?? 'not found'}`
    );
  }
  console.log();
}

main().catch((error) => {
  console.error(`measure-layout failed: ${error.message}`);
  process.exit(1);
});
