package com.stocks.stockease.demo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.stocks.stockease.security.CustomUserDetailsService;
import com.stocks.stockease.security.JwtUtil;
import com.stocks.stockease.security.internal.UserRepository;
import com.stocks.stockease.support.AbstractIntegrationTest;

/**
 * Pins the passwordless demo login: the tokens it hands out are ordinary tokens for ordinary accounts,
 * so the demo ADMIN passes an admin-only endpoint and the demo USER is refused by it. That refusal is
 * the point - a demo USER that could close invoices would be a hidden admin.
 */
@SpringBootTest(properties = {"app.demo.enabled=true", "spring.main.allow-bean-definition-overriding=true"})
@AutoConfigureMockMvc
@ActiveProfiles("test")
class DemoLoginIntegrationTest extends AbstractIntegrationTest {

    /**
     * Restores the real JWT machinery for this class.
     *
     * <p>{@code config.test.TestConfig} sits inside the scanned package and hands every
     * {@code @SpringBootTest} a mocked {@link JwtUtil} and {@code UserDetailsService}. That is fine for
     * tests that only need a principal, but this class exists to prove a demo token survives the actual
     * filter chain, and a mock signs nothing.
     */
    @TestConfiguration
    static class RealJwtConfiguration {

        @Bean
        JwtUtil jwtUtil(@Value("${jwt.secret}") String secret) {
            return new JwtUtil(secret);
        }

        @Bean
        UserDetailsService userDetailsService(UserRepository userRepository) {
            return new CustomUserDetailsService(userRepository);
        }
    }

    private static final ObjectMapper JSON = new ObjectMapper();

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private DemoDataService demoDataService;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void seedBaseline() {
        demoDataService.resetToBaseline();
    }

    /** Performs the demo login and returns the raw JWT the envelope carries as its data. */
    private String demoToken(String role) throws Exception {
        String body = mockMvc.perform(post("/api/demo/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\":\"" + role + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andReturn().getResponse().getContentAsString();
        JsonNode data = JSON.readTree(body).get("data");
        return data.asText();
    }

    /** The one sale invoice the baseline deliberately leaves open, so closing it is a real operation. */
    private long openSaleInvoiceId() {
        return jdbcTemplate.queryForObject(
                "SELECT id FROM invoice WHERE status = 'OPEN' AND invoice_type = 'SALE' ORDER BY id LIMIT 1",
                Long.class);
    }

    @Test
    void login_adminRole_issuesTokenForTheAdminDemoAccount() throws Exception {
        String token = demoToken("ADMIN");

        assertThat(jwtUtil.validateToken(token)).isTrue();
        assertThat(jwtUtil.extractUsername(token)).isEqualTo("julia.brandt");
        // the row stores the prefixed authority; the claim carries the bare role the frontend contract expects
        assertThat(jwtUtil.extractRole(token)).isEqualTo("ADMIN");
        // guards the assertion above against a silent return of the "ROLE_" prefix
        assertThat(jwtUtil.extractRole(token)).doesNotStartWith("ROLE_");
    }

    @Test
    void login_userRole_issuesTokenForTheUserDemoAccount() throws Exception {
        String token = demoToken("USER");

        assertThat(jwtUtil.validateToken(token)).isTrue();
        assertThat(jwtUtil.extractUsername(token)).isEqualTo("markus.weber");
        assertThat(jwtUtil.extractRole(token)).isEqualTo("USER");
    }

    @Test
    void adminToken_onAdminOnlyEndpoint_passesTheRealFilterChain() throws Exception {
        String token = demoToken("ADMIN");

        mockMvc.perform(patch("/api/invoices/" + openSaleInvoiceId() + "/close")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    void userToken_onAdminOnlyEndpoint_isRejected() throws Exception {
        String token = demoToken("USER");

        mockMvc.perform(patch("/api/invoices/" + openSaleInvoiceId() + "/close")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    void userToken_onSharedEndpoint_isAccepted() throws Exception {
        String token = demoToken("USER");

        mockMvc.perform(get("/api/products").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    @Test
    void login_unknownRole_returns400() throws Exception {
        mockMvc.perform(post("/api/demo/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\":\"SUPERUSER\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Demo role must be ADMIN or USER."));
    }
}
