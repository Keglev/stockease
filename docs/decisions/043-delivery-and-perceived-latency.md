# ADR 043: Delivery and Perceived Latency Are Designed, Not Left to the Network

**Scope**: [Cross-cutting]
**Status**: Accepted
**Date**: August 26, 2026

---

## Context

The application was fast in every measurement the project had been taking, and slow in the
one it had not. The test suites are green, the bundles are within budget, the backend
answers its queries quickly. What nobody had measured was the interval a visitor actually
experiences: from pressing a button to seeing something true on screen.

Network logs taken on 26 August 2026 measured it. Four figures:

**First login: 1.16 s.** Not the request - the request is a fraction of that. The rest is
the initial bundle arriving before any route can render.

**A landing screenshot: 2.88 s, cold edge.** The landing page's argument is that the
application is genuinely translated and genuinely themed: press a toggle and watch it
change. A toggle swaps four full-page screenshots at once. Against a cold edge that
demonstration played out as four empty frames - the page failing to prove the one thing
it exists to prove.

**A hashed stylesheet: 3.21 s to revalidate.** The file's name contains its content hash,
so its content cannot change without its name changing. It was nevertheless served with
`max-age=0, must-revalidate`, and so was re-checked on every load. Three seconds spent
asking whether a file that cannot have changed had changed.

**Fourteen round trips where seven would do.** Every authenticated request carries an
`Authorization` header, so none of them is a simple request, so each was preceded by a
CORS preflight. The server sent no `Access-Control-Max-Age`, and Chrome's default
preflight cache is five seconds - shorter than a dashboard load. Every request paid for
its own preflight, twice over the wire for one answer.

None of these is a bug. Each is a default that was never chosen: a preloading strategy not
set, a cache header not written, a max-age not sent, a loading state not drawn. Taken
individually each looks too small to be worth a decision record. Taken together they were
the difference between an application that feels quick and one that feels broken, and the
reason they went unmeasured for so long is precisely that no single one of them was
anybody's job.

There is a second half to the finding, and it is not about speed at all. During those same
intervals the interface actively lied. The dashboard's signals hold `0` until their
responses land, so the first thing a user saw after login was a complete dashboard
reporting zero products, zero overdue invoices and zero profit. A zero is
indistinguishable from a real zero. The page did not look like it was loading; it looked
like a business with nothing in it. The demo buttons had the same shape of problem: greyed
out with their original label, which reads as a control that is not going to work rather
than one that is busy.

## Decision

**Delivery and perceived latency are treated as one design surface, and the whole surface
is addressed together.** The individual changes are small and would not each carry a record;
what is being recorded is that they are one decision, taken once, with a shared rationale.

**The initial bundle is cut, then the rest is fetched before it is needed.** Angular
Material's paginator labels were being pulled into the initial bundle by a root-level
provider; moving that provision to the shell route halved it - 661.75 kB to 333.30 kB
(#322). With the initial payload small, `PreloadAllModules` then fetches the remaining
route chunks in the background after the first render (#324), so the first navigation
inside the application costs no download.

**Preflights are cached.** The backend sends `Access-Control-Max-Age: 3600` (#325), which
collapses the fourteen round trips back to seven. One hour rather than longer because
Chrome caps preflight caching at two hours regardless of what is sent, so a larger number
would be a claim the browser ignores.

**Waiting is drawn honestly.** The login and demo buttons carry a spinner in a reserved
slot and a label that says the request is in flight, and the demo buttons hold that state
until the router has actually replaced the page rather than clearing it when the token
arrives (#324, #326, #327). The dashboard holds one loading flag per request - not one for
the page - and renders a placeholder wherever a figure will land, so a figure that is not
yet known is never written down as a figure (#326). Placeholders are `aria-hidden` and the
cards carry `aria-busy`, so the state is announced in words rather than in a shimmer; under
`prefers-reduced-motion: reduce` the animation is dropped and the plain block remains.

**Static files are cached according to whether their names identify their contents.**
Assets under `/assets/` are edge-cached for a year and browser-cached for one day (#327):
the long edge lifetime is safe because Vercel purges its cache on every deployment, and the
short browser lifetime is necessary because those filenames are *not* fingerprinted -
`dashboard-en-dark.png` is the same URL forever. Hashed build output - `main-*`, `chunk-*`,
`styles-*` - is served `immutable` for a year (this record), which is safe for the opposite
reason: the hash *is* in the filename, so a changed file is a different URL and a stale
response is impossible by construction.

**The immutable rule is enforced by a build check rather than by reading it.** Its first
draft matched an eight-character hash, which silently missed the 26 of 67 files Angular
emits with a nine-character one and left roughly a third of the JavaScript revalidating on
every load; `frontend/scripts/check-vercel-cache-rules.mjs` now runs after the production
build in CI and fails it unless every emitted file matches the rule.

**The off-screen screenshots are warmed at idle.** The twelve landing screenshots that are
not on screen are fetched in a `requestIdleCallback` after first render, the current
language's other theme first (#327). The bytes are the same bytes; this only decides
whether they are paid for while the visitor is reading or while they are waiting. Skipped
entirely under `prefers-reduced-data`, because speculative fetching is exactly what that
setting asks not to happen.

## Alternatives rejected

**A custom preloading strategy instead of `PreloadAllModules`.** The obvious refinement is
to preload only the routes a given role can reach, or only those reached from the current
page. It was rejected on the arithmetic: after the paginator fix the entire remaining route
payload is around 300 kB, fetched at idle after the first render, on a connection that is
otherwise doing nothing. A selective strategy is a policy object, a decision about what
counts as likely, and a thing to keep correct as routes are added - all to avoid
downloading a few hundred kilobytes that nobody is waiting for. The cheaper answer is
better here, and it stops being better only if the route payload grows by an order of
magnitude.

**A single page-level loading flag on the dashboard.** One flag is less code than five and
would have been a smaller diff. It was rejected because it holds every figure behind the
slowest request: the product count, which answers immediately, would sit behind the profit
report, which does not. That is a slower page presented as a simpler implementation. Five
flags cost four extra lines and let each figure render when its own answer arrives.

**A dashboard summary endpoint - deferred, and the next lever.** The dashboard makes five
requests because it reads five sources. One endpoint returning one composed payload would
make it one request, and would do more for first-paint than everything in this record
combined - the preflight cache halves the round trips, but a summary endpoint removes four
of them outright. It is deferred rather than rejected because it is a backend design
change and not a delivery setting: a new module boundary, a composed DTO, a decision about
whether the composition belongs in a reporting module or a dashboard one, and a second
place where the meaning of "low stock" is defined. That is a design conversation, and it
does not belong inside a change whose other parts are cache headers. **It is named here as
the next lever precisely so that the cheap wins in this record are not mistaken for having
finished the job.**

## Consequences

**What got faster.** The initial bundle halved, so first render happens sooner on every
visit. Authenticated pages make half the round trips they did. Hashed build files are
fetched once and then never revalidated, which removes the 3.21 s stylesheet check from
every repeat visit entirely. Landing screenshots are served from the edge and the
off-screen ones are already in cache when a toggle is pressed, so the page's own
demonstration now happens at the speed of a repaint.

**What did not get faster, and will not.** The backend is one region. A request from
outside Frankfurt pays roughly 300 ms of round trip before the server has done anything,
and nothing in this record touches that; it is a hosting decision, not a delivery one.
Halving the *number* of round trips is the whole of what was available, and it has been
taken. The remaining lever on that axis is the summary endpoint above, which reduces the
count further - a multi-region backend, which would reduce the cost of each, is not on the
table at this project's scale.

**What is honest rather than fast.** The pending buttons and the dashboard placeholders
make no request quicker. A visitor waits exactly as long as before; they are simply told
the truth about it, instead of reading a greyed-out button as broken or a screen of zeros
as a business with no stock. This distinction is worth keeping visible: it would be easy,
later, to point at these placeholders as though they were a performance change and stop
looking for real ones.

**The prefetch has a limit worth knowing.** `requestIdleCallback` measures main-thread
idleness, not network idleness, so on a slow connection the twelve warmed screenshots
compete with the four on screen rather than politely following them. It is still far
better than fetching them at toggle time. If it proves to matter, the fix is to gate the
idle callback on the hero image's `load` event rather than on first render.

**A standing maintenance cost, accepted.** The cache rule is now coupled to Angular's
output naming. That coupling was already there and simply unenforced; the build check makes
it visible, which means a future change to how Angular names its chunks will fail CI rather
than quietly un-cache part of the application. That is the intended direction of failure,
and the failure names the files it could not match.

[Back to Decisions Index](index.md)
