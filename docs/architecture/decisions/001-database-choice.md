# ADR 001: Database Choice - PostgreSQL for Production, H2 for Tests

**Status**: Accepted  
**Date**: October 31, 2025  
**Authors**: Architecture Team  
**Stakeholders**: Backend Team, DevOps, QA

## Problem Statement

StockEase requires a persistent data store for product inventory, user management, and audit trails. We need to decide on:
1. Production database technology
2. Testing database technology
3. Data consistency model
4. Scalability approach

### Requirements
- ✅ ACID compliance (data consistency)
- ✅ Support for complex queries
- ✅ Horizontal scaling capability
- ✅ Easy backups and recovery
- ✅ Fast test execution
- ✅ No external dependencies during development

## Decision

**Production**: PostgreSQL 17.5 (managed on Neon)  
**Testing**: H2 (in-memory)  
**Migration Tool**: Flyway 11.7.2

## Rationale

### Why PostgreSQL for Production?

1. **ACID Compliance**
   - Guarantees data integrity
   - Supports complex transactions
   - Prevents data corruption

2. **Query Capabilities**
   - Full-text search support
   - JSON/JSONB data types
   - Window functions for analytics
   - CTEs (Common Table Expressions)

3. **Scalability**
   - Connection pooling support
   - Read replicas
   - Horizontal scaling with Citus extension
   - Partitioning for large tables

4. **Operational Excellence**
   - Extensive monitoring tools
   - Point-in-time recovery
   - Proven in enterprise environments
   - Large community and support

5. **Cloud Integration**
   - Neon provides serverless PostgreSQL
   - Automatic backups
   - Easy scaling without manual intervention
   - Pay-as-you-go pricing

### Why H2 for Testing?

1. **Test Speed**
   - In-memory database
   - No network latency
   - Fast startup and teardown
   - Tests complete in seconds

2. **Test Isolation**
   - Each test gets fresh database
   - No test pollution
   - Parallel test execution possible
   - Deterministic results

3. **No Dependencies**
   - No external services needed
   - Developers don't need PostgreSQL installed
   - CI/CD doesn't need database service
   - Faster feedback loop

4. **Debugging**
   - Easy to inspect test data
   - No network issues to debug
   - Deterministic behavior
   - Simple to understand failures

### Why Flyway?

1. **Version Control**
   - Schema changes tracked in Git
   - Reproducible deployments
   - Easy to review changes

2. **Safety**
   - Validates migrations before execution
   - Prevents duplicate execution
   - Rollback on failure

3. **Database Agnostic**
   - Same migrations work on H2 (tests) and Postgres (production)
   - Catch DB-specific issues early

4. **Simplicity**
   - SQL-based migrations
   - No ORM magic
   - Full control over schema changes

## Alternative Approaches Considered

### 1. MySQL for Production, H2 for Tests
**Rejected because**:
- PostgreSQL has better JSON support
- PostgreSQL has more advanced features (window functions, CTEs)
- PostgreSQL scales better horizontally

### 2. MongoDB (NoSQL)
**Rejected because**:
- ACID compliance not guaranteed
- Join operations complex
- Inventory management needs structured data
- Team experience with SQL databases

### 3. Same database for tests and production (PostgreSQL everywhere)
**Rejected because**:
- Slower test execution
- Requires running database service during development
- More expensive (Neon cost for test runs)
- Test data management becomes complex

### 4. Liquibase instead of Flyway
**Rejected because**:
- Flyway is simpler and faster
- YAML/JSON format adds complexity
- SQL-based migrations are more direct
- Flyway has smaller learning curve

## Consequences

### Positive
- ✅ Fast test execution (< 1 minute for 65 tests)
- ✅ Production-grade data consistency
- ✅ Scalable architecture
- ✅ Easy to scale database horizontally
- ✅ Developers can work without external DB
- ✅ Catch DB issues early in tests

### Negative
- ❌ H2 doesn't support all Postgres features
- ❌ Need database-agnostic SQL in migrations
- ❌ Developers must understand SQL
- ❌ Complex queries must be tested carefully

## Mitigation Strategies

### For H2/Postgres Incompatibility
- Use database-agnostic SQL patterns
- Avoid Postgres-specific features in application SQL
- Test migrations on both databases
- Document any DB-specific code

### For SQL Complexity
- Use Spring Data JPA for simple queries
- Write and test complex SQL carefully
- Document complex queries
- Code review for database changes

## Related Decisions
- ADR 003: ORM Choice (Spring Data JPA)
- ADR 004: Caching Strategy (Future)

## Implementation Status
- ✅ PostgreSQL 17.5 on Neon (production)
- ✅ H2 2.3.232 (testing)
- ✅ Flyway 11.7.2 (migrations)
- ✅ HikariCP connection pooling
- ✅ 65+ passing tests

## Verification
To verify this decision in code:
```sql
-- Check database type
SELECT version();

-- Check Flyway migrations
SELECT * FROM flyway_schema_history;

-- Check connection pooling
SHOW max_connections;
```

## Questions & Answers

**Q: Can we switch databases later?**  
A: Yes, but it would require significant effort. Flyway helps with migrations, but application code might need changes if using DB-specific features.

**Q: Is PostgreSQL expensive?**  
A: Neon uses pay-as-you-go pricing. For a small project, it's very affordable (~$5-10/month).

**Q: Why not use MongoDB for flexibility?**  
A: Product inventory data is highly structured. Relational model is more natural and provides better consistency.

---

**Document Version**: 1.0  
**Last Updated**: October 31, 2025  
**Approval**: ✅ Accepted
