package com.stocks.stockease.demo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.ApplicationContext;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import com.stocks.stockease.demo.web.DemoLoginController;
import com.stocks.stockease.demo.web.DemoResetController;
import com.stocks.stockease.security.PublicEndpoint;
import com.stocks.stockease.support.AbstractIntegrationTest;

/**
 * Pins the default state: with {@code app.demo.enabled} left at false the demo module does not exist.
 *
 * <p>The requests carry an authenticated principal on purpose. 404 rather than 403 is the assertion
 * that matters - a caller who is allowed through the filter chain still finds nothing there, because
 * no controller was ever mapped. A protected-but-present demo surface would answer 403.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@WithMockUser(username = "julia.brandt", roles = {"ADMIN"})
class DemoDisabledIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ApplicationContext applicationContext;

    @Test
    void demoReset_whenDemoDisabled_returns404() throws Exception {
        mockMvc.perform(post("/api/demo/reset").header(DemoResetController.RESET_TOKEN_HEADER, "any"))
                .andExpect(status().isNotFound());
    }

    @Test
    void demoLogin_whenDemoDisabled_returns404() throws Exception {
        mockMvc.perform(post("/api/demo/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\":\"ADMIN\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void demoBeans_whenDemoDisabled_areAbsentFromTheContext() {
        assertThat(applicationContext.getBeanNamesForType(DemoDataService.class)).isEmpty();
        assertThat(applicationContext.getBeanNamesForType(DemoStartupSeeder.class)).isEmpty();
        assertThat(applicationContext.getBeanNamesForType(DemoResetController.class)).isEmpty();
        assertThat(applicationContext.getBeanNamesForType(DemoLoginController.class)).isEmpty();
    }

    @Test
    void publicEndpoints_whenDemoDisabled_containNoDemoPath() {
        // the demo paths are exempted from authentication by beans the demo module contributes; with the
        // module gone the filter chain never learns about them
        assertThat(applicationContext.getBeanNamesForType(PublicEndpoint.class)).isEmpty();
    }
}
