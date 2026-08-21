# ADR 042: The Deploy Gate Watches the Deployment It Triggered

**Scope**: [Backend]
**Status**: Accepted
**Date**: August 20, 2026

---

## Context

The backend release path is one workflow step asking one question: did the thing this
commit triggered actually ship? For most of the project's life the answer it produced was
worthless, and the reason was not a bug in the loop but the object the loop was reading.

`koyeb-wait-healthy.sh` used to poll the service - `GET /v1/services/{id}`, reading the
service's own status field - and wait for it to report `HEALTHY`. Koyeb does not replace a
service in place. It builds the new deployment beside the running one, and its own
reference states the consequence directly: any currently running deployments for the
service continue to run until the new deployment is marked healthy. The service object
therefore answers `HEALTHY` for the entire duration of the build, on behalf of the
instance that was already serving before the commit existed.

The gate passed on its first request. The script header records the observation that
settled it, captured live on 19-20 August 2026:

```
[1/60 0s/600s] Service status: HEALTHY
```

printed while the build was still running. Zero seconds elapsed, first attempt, green.
Every historic fast deploy - the eighteen-to-nineteen-second runs that made up the entire
sibling history of the hour-long run that first drew attention to this workflow - was that
same false green: a job reporting success for a condition that was already true before it
started. It never measured a build at all.

This matters beyond a misleading badge. The gate is what stands between a merge to `main`
and the belief that production has the merged code. A gate that answers about the old
instance says nothing about the new one, so a deployment that failed to build would leave
`main` green and production stale, with no signal anywhere that the two had diverged.

An earlier round of work had already bounded this poll so it could not hang, after a run
sat in progress for an hour. That fixed the hang and left the defect: as the script header
puts it, bounding a measurement of the wrong object only makes it fail faster.

## Decision

**The redeploy reply's deployment id is captured, and that deployment is polled.**

`koyeb-redeploy.sh` posts the redeploy, then parses the identifier out of the reply body
instead of printing it and discarding it. That id names the deployment *this run* created,
so its status is this run's answer and nobody else's. It is published as a step output and
consumed by `koyeb-wait-healthy.sh`, which reads `GET /v1/deployments/{id}` and takes the
deployment's status.

The reply's shape was verified rather than assumed. Koyeb's generated Go client declares
the redeploy reply with a single `deployment` field, and the deployment type carries `id` -
`koyeb/koyeb-api-client-go`, `model_redeploy_reply.go` and `model_deployment.go`, the same
source that settled the status enum.

**A missing id fails the step loudly.** An empty id would turn the next request's URL from
a single deployment into a deployment listing, which would quietly resume measuring the
wrong object - the precise failure this record exists to end. Both scripts refuse it:
the redeploy step errors when the reply carries no id, and the poll step errors when it is
handed an empty one rather than falling back to the service.

## The status doctrine

A deployment status is the gate's entire verdict, so every value the platform can return
is classified deliberately and none is left to a default.

**Sixteen values, not the twelve that are documented.** The set was taken from Koyeb's
deployments reference page and then cross-checked against the enum in their own generated
client, `model_deployment_status.go`. The two disagree: the reference documents twelve,
the client declares sixteen, adding `CANCELING`, `CANCELED`, `ERRORING` and `STASHED`. The
published documentation lags the client, and the enum has already grown once.

**Shipped** is `HEALTHY`, and also `SLEEPING`. The sleeping case is reasoned rather than
assumed: Koyeb stops the old deployment only once the new one has been marked healthy, so
a deployment can only become the sleeping one by having become the active one first, and a
failure ends in `ERROR` or `STOPPED` and never in `SLEEPING`. The service is
scale-to-zero, so this is a state a real successful deploy can land in. It gets its own
distinct log line rather than sharing the healthy one, deliberately: that reasoning is a
claim about the platform, the first live deploy is its empirical check, and a separate
line is what would make a contradiction visible instead of silently indistinguishable from
an ordinary success. The message is a tripwire, not decoration.

**Superseded** is `CANCELING`, `CANCELED` and `STASHED` - another deployment overtook this
one. This exits non-zero on purpose. The gate answers for *this* commit; the deployment
that displaced it has its own gate, which answers for itself. Reporting success here would
attribute someone else's release to this run.

**Failed** is `ERROR`, `ERRORING`, `STOPPING`, `STOPPED`, `DEGRADED` and `UNHEALTHY`. These
cannot reach healthy, so the step fails immediately and names the status rather than
polling out the remaining budget and reporting a timeout that hides the real reason.

**In flight** is `PENDING`, `PROVISIONING`, `SCHEDULED`, `ALLOCATING` and `STARTING` -
keep polling.

**An unrecognised value exits non-zero, naming itself.** There is no wildcard that keeps
polling. Since the documented set and the implemented set already disagree and the enum
has grown before, a future addition will arrive as a value this script has never seen; the
choice is between refusing to guess whether it means progress, and burning the whole
budget before reporting a timeout for what was actually a decided outcome. The second is
the defect the previous round removed, and a permissive default would reintroduce it
through the back door.

A failed *request* is not a status. A dropped connection or a 5xx is recorded as a lost
attempt and the loop continues, because under a strict shell an unguarded failure would
otherwise end a release over one dropped packet.

## The budget

**2100 seconds.** The previous 600 was sized against the eighteen-second figure, which was
the false green - it was never a measurement of a build, so the budget derived from it was
derived from nothing. The replacement is sized against the platform: Koyeb caps builds at
thirty minutes, plus five minutes for the phases that follow the build. A build that
exceeds the platform cap turns into `ERROR`, and the gate should report that real reason
rather than give up first and call it a timeout. A gate must not lose its nerve before the
platform it is watching does.

The ceiling is wall-clock rather than attempts multiplied by interval, so the elapsed
figure printed on failure is the time that actually passed rather than an arithmetic
estimate.

**Every request carries its own bound.** The poll's reads use a ten-second connect timeout
and a fifteen-second cap: a status read answers in well under a second, so the cap can
never cut a real response, while a black-holed socket costs one attempt instead of the
job. The redeploy POST is capped at thirty, twice the poll's, because it asks Koyeb to
accept and enqueue work rather than read a field. That POST is deliberately not retried -
retrying a request that may already have been accepted would risk queuing a second
deployment, which the poll would then correctly report as having superseded this one.

**The job timeout sits just above the poll's worst case** rather than at the platform
default of six hours. The budget plus at most one in-flight request leaves roughly two and
a half minutes for checkout, the Dockerfile check and the redeploy POST. This bounds the
job even if some step finds a way to hang that the scripts do not cover, so no run can
outlive its own budget the way the hour-long run did.

## Alternatives rejected

**Harden the service poll.** This was genuinely attempted, and it is what the earlier round
of work delivered: bounded requests, a wall-clock ceiling, classified statuses, no
unbounded calls. Every one of those improvements was kept. None of them addressed the
defect, because the object being measured was still the service, and the service was
answering on behalf of the old instance. A correct measurement of the wrong thing is still
the wrong answer, delivered more reliably.

**Use the Koyeb CLI's `services redeploy --wait`.** Rejected on dependency grounds rather
than on correctness - and worth recording precisely because it is *not* wrong: the CLI
takes the same route this script now takes, resolving the redeploy to a deployment and
waiting on that. That agreement is corroboration for the mechanism chosen here. What it
would add is a versioned binary to install and pin in the runner for behaviour the two
existing scripts already express in terms of the same HTTP API the CLI calls, with the
failure taxonomy visible in the repository rather than inside a tool's release notes.

**Poll the application's own health endpoint.** The container health probe answers about
whichever instance is serving, which is the original defect restated at a different layer:
during a parallel build the old instance answers, and answers correctly. It is the right
mechanism for keeping a running service healthy and the wrong one for deciding whether a
new deployment shipped.

## Consequences

The gate now takes as long as a deploy actually takes, and the fast greens are gone. A run
that finishes in seconds is now a signal that something is wrong rather than the norm.

A merge to `main` that fails to build fails visibly, at the step that exists to catch it,
naming the status that ended it.

The doctrine has a maintenance cost that is accepted deliberately: because unknown statuses
fail rather than pass, a future addition to Koyeb's enum will break the gate rather than be
absorbed by it. That is the intended direction of failure. A release gate that guesses at
an unfamiliar status is worth less than one that stops and asks, and the failure names the
value it did not recognise, so the fix is a one-line classification rather than an
investigation.

The published architecture record and this script's own header are now the same story.
Section 07 of the backend architecture describes the mechanism and points here for the
reasoning.

[Back to Decisions Index](index.md)
