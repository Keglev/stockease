# CI Pipeline Tests

**Purpose**: Document how tests run in GitHub Actions and what gates block a merge.

---

## Pipeline Overview

```
Push to main or PR
    ↓
Checkout + Setup JDK 17
    ↓
[Gate 1] Build — mvn clean compile
    ↓ fail → block merge
[Gate 2] Tests — mvn test
    ↓ fail → block merge
[Gate 3] Coverage — mvn jacoco:report
    ↓ < 70% → block merge
[Gate 4] Code Quality — mvn spotbugs:check
    ↓ high priority issues → block merge
    ↓
SUCCESS
```

**Estimated total time**: ~60 seconds

---

## Quality Gates

| Gate | Condition | On Failure |
|------|-----------|------------|
| Build | No compilation errors | Block merge |
| Tests | All test classes pass, 0 failures | Block merge |
| Coverage | Line coverage ≥ 70% | Block merge |
| Code quality | No high-priority SpotBugs issues | Warn or block (configurable) |

---

## Workflow File Reference

```yaml
# .github/workflows/ci-build.yml

- name: Build
  run: mvn clean compile

- name: Test
  run: mvn test

- name: Coverage report
  run: mvn jacoco:report

- name: Coverage gate
  run: mvn jacoco:check -Djacoco.minimum=0.70

- name: Upload test reports
  uses: actions/upload-artifact@v3
  if: always()
  with:
    name: test-reports
    path: backend/target/surefire-reports/
    retention-days: 30

- name: Upload coverage report
  uses: actions/upload-artifact@v3
  if: always()
  with:
    name: jacoco-report
    path: backend/target/site/jacoco/
    retention-days: 30

- name: Publish coverage to GitHub Pages
  uses: actions/upload-pages-artifact@v2
  with:
    path: backend/target/site/jacoco/
```

---

## Test Classes Run in CI

| Class | Type | Methods |
|-------|------|---------|
| `AuthControllerTest` | Unit | 4 |
| `ProductControllerTest` | Slice | 3+ |
| `ProductCreateControllerTest` | Slice | 3 |
| `ProductFetchControllerTest` | Slice | 4 |
| `ProductUpdateControllerTest` | Slice | 3 |
| `ProductInvalidUpdateControllerTest` | Slice | 2 |
| `ProductDeleteControllerTest` | Slice | 2 |
| `ProductPaginationControllerTest` | Slice | 2 |
| `StockEaseApplicationTests` | Integration | 1 |

Parameterized tests expand the total method count to 65+.

---

## Artifacts

After each run, two artifacts are available in GitHub Actions:

- `test-reports` — Surefire XML and text summaries
- `jacoco-report` — HTML coverage report

Coverage is also published to GitHub Pages: `https://keglev.github.io/stockease/coverage/`

---

## Related Documentation

- **[Coverage & Quality](./coverage-and-quality.md)** — JaCoCo thresholds and pom.xml config
- **[Testing Strategy](./strategy.md)** — What CI is gating against
- **[Troubleshooting](./troubleshooting.md)** — CI failure diagnosis

---

**Last Updated**: June 2026
**Status**: Current

[Back to Testing Architecture Index](testing-architecture.md)
