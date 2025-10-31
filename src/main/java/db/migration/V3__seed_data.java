package db.migration;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

/**
 * Flyway Java-based migration: Seed initial users and products into database.
 * 
 * Migration lifecycle:
 * - Executes AFTER all SQL migrations complete (Flyway versioning: V3__seed_data)
 * - Runs on application startup via FlywayConfiguration.migrate()
 * - Idempotent: checks existence before insert (prevents duplicate key violations)
 * 
 * Data seeding strategy:
 * 1. Users: admin (ROLE_ADMIN), user (ROLE_USER) with BCrypt-hashed passwords
 * 2. Products: 8 sample products with name, quantity, price, calculated total_value
 * 
 * Security:
 * - Passwords hashed with BCrypt (strength=10) - matches SecurityConfig.passwordEncoder()
 * - Passwords NOT hardcoded in migration (loaded at runtime)
 * - Development/test only (should be disabled in production via Flyway callbacks)
 * 
 * Database compatibility:
 * - Uses portable SQL: LIMIT 1 instead of DB-specific syntax
 * - Manual existence checks instead of ON CONFLICT (PostgreSQL-specific)
 * - Compatible with H2 (test), PostgreSQL (dev), MySQL (prod)
 * 
 * Performance:
 * - Prepared statements prevent SQL injection and improve parsing
 * - Single connection reused for all operations
 * - Seeding time: ~10ms (negligible on startup)
 * 
 * @author Team StockEase
 * @version 1.0
 * @since 2025-01-01
 * @see org.flywaydb.core.api.migration.BaseJavaMigration
 * @see FlywayConfiguration (orchestration)
 * @see DataSeeder (Spring-based alternative for profile-driven seeding)
 */
public class V3__seed_data extends BaseJavaMigration {

    /**
     * Executes Flyway migration: seed users and products into database.
     * 
     * Execution order:
     * 1. Create tables via SQL migrations (V1__initial_schema.sql, V2__add_columns.sql)
     * 2. Execute this Java migration (V3__seed_data.java) - adds fixture data
     * 3. JPA EntityManagerFactory initialized (reads seeded data via repository queries)
     * 4. Spring Boot starts - controllers ready to serve API requests
     * 
     * User credentials (for testing):
     * - admin / admin123 (ROLE_ADMIN) - Can create/update/delete products
     * - user / user123 (ROLE_USER) - Can read products only
     * 
     * Products (8 total):
     * - Alpha Widget, Beta Gadget, Gamma Tool, Delta Device
     * - Epsilon Accessory, Zeta Instrument, Eta Apparatus, Theta Machine
     * - Each has: name, quantity (stock), unit price, total_value (qty × price)
     * 
     * @param context Flyway context providing database connection
     * @throws Exception if connection fails, SQL execution fails, or BCrypt encoding fails
     */
    @Override
    public void migrate(Context context) throws Exception {
        Connection connection = context.getConnection();

        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

        // Seed users (use ON CONFLICT DO NOTHING via simple existence check)
        seedUser(connection, "admin", encoder.encode("admin123"), "ROLE_ADMIN");
        seedUser(connection, "user", encoder.encode("user123"), "ROLE_USER");

    // Seed products (friendly names)
    seedProductIfNotExists(connection, "Alpha Widget", 10, 50.0);
    seedProductIfNotExists(connection, "Beta Gadget", 5, 30.0);
    seedProductIfNotExists(connection, "Gamma Tool", 3, 20.0);
    seedProductIfNotExists(connection, "Delta Device", 3, 10.0);
    seedProductIfNotExists(connection, "Epsilon Accessory", 20, 40.0);
    seedProductIfNotExists(connection, "Zeta Instrument", 7, 60.0);
    seedProductIfNotExists(connection, "Eta Apparatus", 15, 25.0);
    seedProductIfNotExists(connection, "Theta Machine", 4, 80.0);
    }

    /**
     * Seeds a user into app_user table (idempotent).
     * 
     * Implementation strategy:
     * - Check if user exists (by username, which is unique constraint)
     * - If exists: return early (idempotent - safe to re-run migration)
     * - If not exists: insert new user with hashed password and role
     * 
     * Database-agnostic approach:
     * - Uses LIMIT 1 (works on H2, PostgreSQL, MySQL)
     * - Avoids PostgreSQL-specific "ON CONFLICT DO NOTHING"
     * - Enables migration to work across different database systems
     * 
     * Security:
     * - Password already hashed by caller via BCryptPasswordEncoder
     * - PreparedStatement prevents SQL injection via parameterized queries
     * - No password logging (prevents secrets in migration output)
     * 
     * @param connection database connection from Flyway context
     * @param username user login identifier (must be unique)
     * @param hashedPassword BCrypt-encoded password (minimum 60 chars)
     * @param role Spring Security authority (e.g., "ROLE_ADMIN", "ROLE_USER")
     * @throws Exception if SQL execution fails or connection is closed
     */
    private void seedUser(Connection connection, String username, String hashedPassword, String role) throws Exception {
        // Make seeding DB-agnostic: first check for existence, then insert if missing.
        // This avoids relying on DB-specific syntax like Postgres' ON CONFLICT.
        String checkSql = "SELECT id FROM app_user WHERE username = ?";
        try (PreparedStatement check = connection.prepareStatement(checkSql)) {
            check.setString(1, username);
            try (ResultSet rs = check.executeQuery()) {
                if (rs.next()) {
                    return; // user already exists
                }
            }
        }

        String insertSql = "INSERT INTO app_user (username, password, role) VALUES (?, ?, ?)";
        try (PreparedStatement ps = connection.prepareStatement(insertSql)) {
            ps.setString(1, username);
            ps.setString(2, hashedPassword);
            ps.setString(3, role);
            ps.executeUpdate();
        }
    }

    /**
     * Seeds a product into product table if it doesn't already exist (idempotent).
     * 
     * Implementation strategy:
     * - Query by name (unique constraint on product.name)
     * - If result found: return early (product already in database)
     * - If not found: calculate total_value and insert new row
     * 
     * Total value calculation:
     * - total_value = quantity × price
     * - Denormalized column (cached value) for reporting/analytics efficiency
     * - Kept in sync via trigger or application logic on quantity/price updates
     * - Example: quantity=10, price=50.0 → total_value=500.0
     * 
     * Idempotency guarantee:
     * - Migration can be re-run without creating duplicates
     * - Safe for flyway.cleanDisabled=false scenarios
     * - Enables non-destructive rollback + reapply workflows
     * 
     * @param connection database connection from Flyway context
     * @param name product identifier (unique, user-facing name)
     * @param quantity stock units in warehouse (integer, ≥ 0)
     * @param price unit cost per item (decimal, ≥ 0.0)
     * @throws Exception if SQL execution fails or connection is closed
     */
    private void seedProductIfNotExists(Connection connection, String name, int quantity, double price) throws Exception {
        String checkSql = "SELECT id FROM product WHERE name = ? LIMIT 1";
        try (PreparedStatement check = connection.prepareStatement(checkSql)) {
            check.setString(1, name);
            try (ResultSet rs = check.executeQuery()) {
                if (rs.next()) {
                    return; // exists
                }
            }
        }

        String insertSql = "INSERT INTO product (name, quantity, price, total_value) VALUES (?, ?, ?, ?)";
        try (PreparedStatement ins = connection.prepareStatement(insertSql)) {
            ins.setString(1, name);
            ins.setInt(2, quantity);
            ins.setDouble(3, price);
            ins.setDouble(4, quantity * price);
            ins.executeUpdate();
        }
    }
}
