# Risks and Technical Debt

Tracked debt, with its planned resolution. Small enough to be honest about.

- **Pre-service-layer web code.** The oldest controllers and exception
  handling predate the service-layer rework and are scheduled for rewrite
  with the API-layer phase - including replacing generic exceptions with
  domain exceptions and moving the last derived getter off an entity into a
  DTO.
- **A retired deployment still reachable.** The legacy frontend entry that
  stood here is closed: the Angular frontend replaced it and is in
  production, so the debt it described - a frozen app awaiting a
  replacement - no longer exists. What remains is smaller and real. The
  retired deployment is still served at its old address, and the backend's
  CORS configuration still names that origin as allowed. Nothing depends on
  either, and neither is reached by any supported path; the entry stays open
  because a permitted origin for an application nobody maintains is surface
  worth removing rather than surface worth explaining.
- **Single environment.** No staging tier (section 02): pull requests get
  the full test gate, but production is the first runtime environment every
  merge meets. Accepted for a system whose data is disposable.
- **Credential lifecycle.** A password-expiry feature for user accounts is
  designed but unscheduled; demo accounts must be exempt so the public demo
  cannot lock itself out.
- **Scaling triggers, not scaling debt.** The monolith is a decision with
  named exit conditions (ADR 007, ADR 010) - reaching them is growth, not
  debt.

[Back to Architecture Index](index.md)
