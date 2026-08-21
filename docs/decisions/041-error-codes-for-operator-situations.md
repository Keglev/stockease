# ADR 041: Error Codes Name Operator Situations, and the Client Translates Them

**Scope**: [Cross-cutting]
**Status**: Accepted
**Date**: August 18, 2026

---

## Context

The interface ships in English and German and switches at runtime. Error sentences do
not: a German operator reads English whenever something fails. A survey of the whole
error path measured where that happens and what stands in the way of fixing it.

A backend-origin message can reach the operator on thirteen surfaces - seven page error
banners, four dialog inline errors, the login form, and one notification surface reached
from eleven components. The HTTP interceptor passes the backend sentence through
unchanged, and the pages render it. Several templates say so about themselves: the text
comes from the backend, which has no i18n.

The exception handler declares eighteen families. Their envelope messages divide three
ways: seven pass the exception message through verbatim, two prefix it, and nine author
a sentence in the handler and discard the exception one. Only the first nine carry text
the project wrote about its own domain; the remaining nine are handler or framework text
about protocol-level failures.

Those nine families are constructed from seventy places in project code. **Forty-three of
the seventy interpolate a runtime value** - a product name, an SKU, a quantity, an invoice
number, an identifier - and twenty-seven are fixed literals. That ratio is the most
consequential number in the survey, and it rules out the cheap answer before anything
else is considered.

Two machine codes exist today, PRODUCT_DELETED and INSUFFICIENT_STOCK, and exactly one
frontend site branches on them: the return flow on the invoice detail page. One other
site substitutes a translated sentence by sniffing HTTP status - the product recycle bin,
on 409 - because no code names the situation it needs. Its own comment gives the reason:
the backend text names the colliding attribute but is untranslated, and the operator can
act on it. That workaround is correct only because the restore endpoint has a single 409
producer. Give it two and the substituted sentence is wrong for one of them, silently. It
is this record design, implemented once, without the mechanism that would make it safe.

## Decision

**Codes are added selectively, to situations that reach a screen in normal operation and
leave the operator a distinct action.** This is not a new criterion. ApiErrorCodes already
states it - a code is warranted where a status alone leaves the client unable to tell
apart two situations needing different guidance - and this record applies it across the
surveyed families rather than case by case as each arose. The survey found five families
meeting it that carry no code today: illegal argument, invalid movement, invoice state,
entity in use, and duplicate resource. With the two already coded, seven families are in
scope.

**A code names a SITUATION, not an exception class and not a family.** The families are an
implementation detail of where a failure is raised; the operator situation is what a
translated sentence has to speak to. A family raised from sixteen places may hold several
distinct situations or only one, and the number is a measurement each phase makes before
naming anything. This record deliberately does not enumerate the roster: naming codes
here, from a survey that counted throw sites rather than situations, would publish a guess
as a contract.

**The error envelope gains an optional params object** - flat, string keys to string
values - carrying the runtime values a parameterised sentence interpolates, so the client
renders its own translated template with the same values in it. Forty-three of seventy
sites need this; without it a code identifies the situation and still cannot produce the
sentence.

**The message field stays exactly as it is, as the universal fallback.** The client
translates from the code where it knows one and falls through to the message where it does
not. Absent and unknown codes are the same case, which is what the client error type
already documents.

**Delivery is phased, family by family**, each phase measuring its own situations, adding
its codes and their translations, and converting the sites that raise them. This record
authorises the mechanism and the criterion. It does not authorise a single sweeping
change, and nothing here needs to ship at once.

## Alternatives rejected

**Code every family.** Eighteen codes, one per handler. Rejected because most families
fail the criterion they would be granted a code under. Several reach no screen in normal
operation - they need a hand-built request or a client bug to fire - and translating a
sentence no operator sees buys nothing. Others reach a screen and leave the operator
nothing to do but read: a 404 says the record is gone, and the catch-all advice is already
the whole action. Codes on those are contract surface with no client behind it, and every
one of them is a term the API can never quietly change.

**Message keys instead of codes.** Have the backend send a key and let the client look it
up. Rejected on the ratio: **43 of 70 sites are parameterised, and a key without its values
cannot render the sentence.** A key plus values is a code plus params with the naming
inverted - and inverted the wrong way, because a key hard-codes one client translation
namespace into the API contract, where a code names the situation and leaves every client
free to phrase it.

**Translate on the backend.** Rejected on two survey findings. The backend has no i18n by
design, so this is a new subsystem, a locale on every request, and a bundle to keep in step
with the frontend one. And it would not finish the job: some failures never carry a backend
sentence to begin with - the security filter chain and the authentication entry point write
their own bodies outside the handler - so the operator would still meet untranslated text
on paths the new subsystem never touched.

**Leave the status-sniffing pattern to spread.** It works today in the one place it is
used. Rejected because it is correct by accident: it holds only while its endpoint has a
single producer for that status, a condition nothing checks and no test asserts. The second
producer breaks it silently, showing a confident sentence about the wrong situation. One
instance is a workaround; a pattern is a defect waiting for arithmetic to turn against it.

## Consequences

The ApiErrorCodes documentation argues for exactly two codes and explains why a third would
need to earn its place. This record supersedes that stance - the criterion stands, the count
does not - and that documentation will be revised by the first implementation phase. Until
that phase lands it still reads as written, and a reader meeting it before then should treat
this record as the later word.

The published OpenAPI error schema gains params when the first phase ships it, and the
frontend envelope type gains the matching optional field. Neither changes anything for
existing clients: an absent params is the normal case, exactly as an absent code is now.

The recycle bin status sniffing becomes replaceable as soon as duplicate resource carries
codes. It is the first thing each phase should look for - an existing workaround is evidence
the situation was already worth naming.

Uncoded failures keep their English sentences, and the documentation keeps saying so. Phased
delivery means a period where some errors are translated and others are not, and that is a
visible half-state rather than a hidden one. It is preferable to a single change touching
seven families, seventy throw sites and every translation bundle at once, where a failure
anywhere would be attributable to nothing in particular.

## Amendment - 20 August 2026

Ruling R44: the entity-in-use family is coded in full - all four situations, not the
subset the distinct-action criterion would have selected.

Three of the four are deletion vetoes - a supplier, a customer or a product pinned by an
open invoice - and they share one operator remedy: settle or delete the invoice first. On
the criterion this record applies elsewhere, situations that ask the operator for the same
thing do not each need naming, and those three would have been left uncoded or given one
shared code. The owner ruled the other way for this family. The criterion answers which
situations a *client* must tell apart in order to act; it does not answer which sentences a
client must be able to *render*, and all four of these are sentences an operator reads in
their own language. Complete German coverage of a family was taken as worth more here than
the economy of coding only what differs in remedy.

The criterion is not withdrawn. It governs where it governed before; this family is an
exception made deliberately and recorded as one, so that a later reader meeting four codes
with three remedies finds the reason rather than an inconsistency.

The handler Javadoc for `EntityInUseException` recorded the opposite as design - "No code",
on the reasoning that a client has nothing to do with a veto beyond showing its message.
That claim is superseded and was rewritten in the same pull request, so no reader meets the
old rationale beside the new behaviour.

## Amendment - 20 August 2026, phase 3.5

The last of the five surveyed families is coded, and it is the one this record named first:
illegal argument. It is coded by moving off the JDK type rather than by decorating it. A new
`InvalidRequestException` carries the code, and all thirteen project throw sites - nine in
invoice creation and returns, two in the reporting controller, one in the audit controller
and one in the supplier service - now raise it.

**The JDK's `IllegalArgumentException` handler stays, uncoded.** What reaches it after this
change is the argument failure raised inside a library the application calls: a situation the
project never named and has no advice to offer about, so there is nothing for a code to
identify. It still answers 400, because such a request is still the caller's fault and the
alternative is a 500 that blames the server. The split is the point - it is what lets a client
tell a rule this project can explain from one it cannot.

**Ruling R48: twelve codes for thirteen sites.** The reporting controller and the audit
controller each reject a period whose start falls after its end, restating the check
independently because the two modules share no code by design. They share one code all the
same. The situation is identical, the sentence is byte-identical, and a client would have
nothing different to say about them, so minting two codes would name a duplication in the
implementation rather than a distinction the operator can act on. Should the two sentences
ever diverge, that divergence is the moment a second code is minted - and not before.

Reachability was measured rather than assumed, on the protocol ruling R47 established for the
movement matrix. Four of the twelve reach a client; the other eight declare the same rule as a
bean-validation constraint on the request record, so the validation envelope answers first and
the service check behind it is unreachable over HTTP. Those eight are coded anyway, on R45's
reasoning, and each names its shadowing constraint in `ApiErrorCodes` so a later reader meets
the decision rather than an apparently dead code.

**20 August 2026, on building the client half.** The two controllers that share
`PERIOD_START_AFTER_END` under R48 turn out to share a surface as well. The reports page's
changes tab is the only caller of the audit module's period-bounded endpoint, so both throw
sites reach the reader through the same error banner: one code, one key, one sentence, and one
place it is rendered. This strengthens the ruling rather than complicating it - a client that
cannot reach the two situations by different routes could not have said anything different
about them even if they had been coded apart. It is recorded because the ruling above reads as
though two surfaces were in play, and a later reader weighing whether to split the code should
know that splitting it would still produce one rendering.

[Back to Decisions Index](index.md)
