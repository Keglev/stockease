# Coverage & Quality

**Purpose**: JaCoCo configuration, coverage thresholds, and how to run and publish reports.

---

## Coverage Thresholds

| Layer | Line | Branch |
|-------|------|--------|
| Controllers | 80% | 70% |
| Services | 75% | 60% |
| Utilities | 80% | 75% |
| Repositories | 60% | 50% |
| Entities | 40% | 30% |

### Proposed pom.xml Configuration

```xml
<plugin>
    <groupId>org.jacoco</groupId>
    <artifactId>jacoco-maven-plugin</artifactId>
    <version>0.8.11</version>
    <configuration>
        <rules>
            <rule>
                <element>BUNDLE</element>
                <includes>
                    <include>com.stocks.stockease.controller.*</include>
                </includes>
                <limits>
                    <limit>
                        <counter>LINE</counter>
                        <value>COVEREDRATIO</value>
                        <minimum>0.70</minimum>
                    </limit>
                    <limit>
                        <counter>BRANCH</counter>
                        <value>COVEREDRATIO</value>
                        <minimum>0.60</minimum>
                    </limit>
                </limits>
            </rule>
        </rules>
        <excludes>
            <exclude>**/model/*.class</exclude>
            <exclude>**/config/AppConfig.class</exclude>
        </excludes>
    </configuration>
    <executions>
        <execution>
            <goals>
                <goal>check</goal>
            </goals>
        </execution>
    </executions>
</plugin>
```

---

## Running Reports Locally

```bash
# Generate coverage report
mvn clean test jacoco:report

# Open report
open backend/target/site/jacoco/index.html
```

Report location after generation:
```
backend/target/site/jacoco/
  index.html                          ← Overall stats
  com/stocks/stockease/controller/    ← Per-class breakdown
```

### Reading the Report

| Color | Meaning |
|-------|---------|
| Green | Line executed by tests |
| Yellow | Branch partially covered |
| Red | Line not executed |

---

## CI Integration

```yaml
# .github/workflows/ci-build.yml

- name: Run tests with coverage
  run: mvn clean test jacoco:report

- name: Upload coverage report
  uses: actions/upload-artifact@v3
  if: always()
  with:
    name: jacoco-report
    path: backend/target/site/jacoco/
    retention-days: 30

- name: Publish to GitHub Pages
  uses: actions/upload-pages-artifact@v2
  with:
    path: backend/target/site/jacoco/
```

Published report URL: `https://keglev.github.io/stockease/coverage/`

---

## Quality Practices

- Do not aim for 100% coverage — diminishing returns past 85%
- Do not test generated code (getters/setters on entities)
- Do not lower thresholds to pass a build — fix the code
- Do add tests when coverage drops after a new feature

---

## Related Documentation

- **[Coverage Matrix](./matrix.md)** — What is and is not covered
- **[CI Pipeline Tests](./ci-pipeline-tests.md)** — Coverage gates in CI
- **[Testing Strategy](./strategy.md)** — Coverage goals

---

**Last Updated**: June 2026
**Status**: Current

[Back to Testing Architecture Index](testing-architecture.md)
