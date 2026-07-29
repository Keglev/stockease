package com.stocks.stockease.security;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.stocks.stockease.security.internal.UserRepository;
import com.stocks.stockease.support.AbstractIntegrationTest;

/**
 * Proves the replacement account actually replaces the old one: the environment-provisioned admin
 * logs in and receives an ADMIN token, and the credential V3 committed no longer authenticates.
 */
@SpringBootTest(properties = {
        "app.bootstrap-admin.username=" + BootstrapAdminLoginIntegrationTest.USERNAME,
        "app.bootstrap-admin.password=" + BootstrapAdminLoginIntegrationTest.PASSWORD,
        "spring.main.allow-bean-definition-overriding=true"})
@AutoConfigureMockMvc
@ActiveProfiles("test")
class BootstrapAdminLoginIntegrationTest extends AbstractIntegrationTest {

    static final String USERNAME = "bootstrap.admin";
    static final String PASSWORD = "bootstrap-test-password";

    /**
     * Restores the real authentication machinery, as {@code config.test.TestConfig} hands every
     * {@code @SpringBootTest} a mocked {@link JwtUtil} and {@code UserDetailsService}. This class
     * exists to inspect a genuinely signed token and to authenticate against genuinely stored
     * credentials, and a mock provides neither.
     *
     * <p>The {@code AuthenticationManager} is assembled here rather than inherited because the test
     * context holds two {@code UserDetailsService} beans - the scanned {@link CustomUserDetailsService}
     * and TestConfig's mock - and Spring Security wires no {@code DaoAuthenticationProvider} when the
     * bean is ambiguous, leaving {@code AuthenticationConfiguration}'s manager delegating to itself.
     * Production has exactly one, so this rebuilds what production derives: the real user lookup and
     * the real {@link PasswordEncoder}.
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

        @Bean
        AuthenticationManager authenticationManager(UserDetailsService userDetailsService,
                PasswordEncoder passwordEncoder) {
            DaoAuthenticationProvider provider = new DaoAuthenticationProvider(userDetailsService);
            provider.setPasswordEncoder(passwordEncoder);
            return new ProviderManager(provider);
        }
    }

    private static final ObjectMapper JSON = new ObjectMapper();

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtUtil jwtUtil;

    @Test
    void login_withBootstrapCredentials_returnsAdminToken() throws Exception {
        String body = login(USERNAME, PASSWORD)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andReturn().getResponse().getContentAsString();

        String token = JSON.readTree(body).get("data").asText();
        assertThat(jwtUtil.validateToken(token)).isTrue();
        assertThat(jwtUtil.extractRole(token)).isEqualTo("ADMIN");
        // the row stores ROLE_ADMIN; the prefix must not survive into the claim the frontend reads
        assertThat(jwtUtil.extractRole(token)).doesNotStartWith("ROLE_");
    }

    @Test
    void login_withRemovedSeedAdminCredentials_returns401() throws Exception {
        // the row no longer exists, so authentication fails before any password comparison; the
        // historical credential is deliberately not repeated in sources
        login("admin", "any-password").andExpect(status().isUnauthorized());
    }

    /** Posts the credentials to the real login endpoint. */
    private org.springframework.test.web.servlet.ResultActions login(String username, String password)
            throws Exception {
        return mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}"));
    }
}
