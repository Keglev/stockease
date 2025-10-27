package db.migration;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

/**
 * Java-based Flyway migration to seed initial users and products.
 * Uses BCrypt to hash passwords and inserts rows only when they don't exist.
 */
public class V3__seed_data extends BaseJavaMigration {

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
    }

    private void seedUser(Connection connection, String username, String hashedPassword, String role) throws Exception {
        // Use INSERT ... ON CONFLICT DO NOTHING if username unique constraint exists
        String sql = "INSERT INTO app_user (username, password, role) VALUES (?, ?, ?) ON CONFLICT (username) DO NOTHING";
        try (PreparedStatement ps = connection.prepareStatement(sql)) {
            ps.setString(1, username);
            ps.setString(2, hashedPassword);
            ps.setString(3, role);
            ps.executeUpdate();
        }
    }

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
