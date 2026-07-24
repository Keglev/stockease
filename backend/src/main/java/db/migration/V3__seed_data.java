package db.migration;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

/**
 * Flyway V3 migration that seeds initial users and sample products into the database.
 * Java is used instead of SQL so that BCryptPasswordEncoder can hash passwords at migration time.
 */
public class V3__seed_data extends BaseJavaMigration {

    @Override
    public void migrate(Context context) throws Exception {
        Connection connection = context.getConnection();

        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

        seedUser(connection, "admin", encoder.encode("admin123"), "ROLE_ADMIN");
        seedUser(connection, "user", encoder.encode("user123"), "ROLE_USER");

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
     * Inserts a user row into app_user if one with the given username does not already exist (idempotent).
     *
     * @param connection database connection from Flyway context
     * @param username login identifier for the user
     * @param hashedPassword BCrypt-encoded password
     * @param role Spring Security authority string
     * @throws Exception if SQL execution fails
     */
    private void seedUser(Connection connection, String username, String hashedPassword, String role) throws Exception {
        // Make seeding DB-agnostic: first check for existence, then insert if missing.
        // This avoids relying on DB-specific syntax like Postgres' ON CONFLICT.
        String checkSql = "SELECT id FROM app_user WHERE username = ?";
        try (PreparedStatement check = connection.prepareStatement(checkSql)) {
            check.setString(1, username);
            try (ResultSet rs = check.executeQuery()) {
                if (rs.next()) {
                    return;
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
     * Inserts a product row into the product table if one with the given name does not already exist (idempotent).
     *
     * @param connection database connection from Flyway context
     * @param name unique product name
     * @param quantity stock unit count
     * @param price unit price
     * @throws Exception if SQL execution fails
     */
    private void seedProductIfNotExists(Connection connection, String name, int quantity, double price) throws Exception {
        String checkSql = "SELECT id FROM product WHERE name = ? LIMIT 1";
        try (PreparedStatement check = connection.prepareStatement(checkSql)) {
            check.setString(1, name);
            try (ResultSet rs = check.executeQuery()) {
                if (rs.next()) {
                    return;
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
