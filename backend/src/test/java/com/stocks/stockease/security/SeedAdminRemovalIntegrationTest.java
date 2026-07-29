package com.stocks.stockease.security;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import com.stocks.stockease.support.AbstractIntegrationTest;

/**
 * Pins what V16 did to a real, fully migrated database: the seeded 'admin' account whose password is
 * public in this repository is gone, and nothing else is.
 *
 * <p>The survivor assertions are the load-bearing half. "No row named admin" also passes against an
 * empty table, so an over-broad DELETE would look like a success; requiring the demo accounts to
 * still be present, with their roles intact, is what makes the first assertion mean something.
 */
@SpringBootTest
@ActiveProfiles("test")
class SeedAdminRemovalIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void migratedSchema_afterV16_holdsNoSeededAdminAccount() {
        List<String> admins = jdbcTemplate.queryForList(
                "SELECT username FROM app_user WHERE username = 'admin'", String.class);

        assertThat(admins).isEmpty();
    }

    @Test
    void migratedSchema_afterV16_keepsTheDemoAccountsWithTheirRoles() {
        assertThat(roleOf("julia.brandt")).isEqualTo("ROLE_ADMIN");
        assertThat(roleOf("markus.weber")).isEqualTo("ROLE_USER");
    }

    /** The stored authority string for a username, or null when the account does not exist. */
    private String roleOf(String username) {
        return jdbcTemplate.queryForList(
                        "SELECT role FROM app_user WHERE username = ?", String.class, username)
                .stream().findFirst().orElse(null);
    }
}
