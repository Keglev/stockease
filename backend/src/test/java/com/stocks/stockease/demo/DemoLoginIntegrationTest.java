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
    void login_missingRole_returns400() throws Exception {
        // an absent role must be refused by the same path an unknown one is, not uppercased into an NPE
        mockMvc.perform(post("/api/demo/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\":null}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Demo role must be ADMIN or USER."));
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

    /*
     * The two envelope-serialization guards (R42), riding this refusal.
     *
     * The claim is about how the envelope serializes an optional field, not about this endpoint: an
     * absent code must be an absent key rather than a key present with null, and the same for
     * params, while data must still serialize as null beside them. Any uncoded failure can carry
     * the claim; what it needs is a target that stays uncoded.
     *
     * This is their second seat. They rode the invoice unknown-id 404 until ADR 041 coded the
     * not-found family, on the reasoning that no planned family covered it - which held until this
     * one did. The demo role refusal is the new target: the demo module is not part of the
     * application an operator uses, and its sentences are prose for a caller hitting the API
     * directly rather than text a screen renders.
     *
     * The standing cost, stated rather than assumed: should the demo module ever be coded too,
     * these two move a third time. That is the price of pinning a serialization claim to a live
     * refusal instead of to a fabricated one, and it is paid knowingly.
     *
     * They live here rather than beside their ErrorEnvelope siblings because the demo controllers
     * are only registered when app.demo.enabled is true, which the shared test profile leaves
     * false. Enabling it on the sibling class would fork it away from the context its three
     * siblings share; this class already pays for a demo-enabled context, so the guards ride it.
     */
    @Test
    void login_unknownRole_answers400WithNoCodeFieldAtAll() throws Exception {
        String body = mockMvc.perform(post("/api/demo/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\":\"NOPE\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").exists())
                .andReturn().getResponse().getContentAsString();

        // Asserted on the raw JSON, not through jsonPath: a path assertion cannot tell an absent key
        // from one present with a null value, and that distinction is exactly what is being claimed.
        // data is null and still serialized, so this also shows the omission is the field's own
        // @JsonInclude and not a global null-stripping rule that would have changed every response.
        assertThat(body).doesNotContain("code").contains("\"data\":null");
    }

    @Test
    void login_unknownRole_answers400WithNoParamsFieldAtAll() throws Exception {
        // The same serialization claim for the second optional field: params rides with a code and
        // this failure has none.
        String body = mockMvc.perform(post("/api/demo/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\":\"NOPE\"}"))
                .andExpect(status().isBadRequest())
                .andReturn().getResponse().getContentAsString();

        assertThat(body).doesNotContain("params");
    }
}
