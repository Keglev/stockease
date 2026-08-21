package com.stocks.stockease.security.web;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.stocks.stockease.config.test.TestConfig;
import com.stocks.stockease.security.internal.UserRepository;
import com.stocks.stockease.shared.ApiErrorCodes;

/**
 * Pins the blank-credentials refusal at the layer that owns it.
 *
 * <p>The controller used to answer this case itself, with a hand-built 400. That branch could not
 * be reached over HTTP - {@code @NotBlank} on both {@link LoginRequest} fields and {@code @Valid}
 * on the parameter answer first - so it was deleted, and this is the case that shows what answers
 * in its place: the validation envelope, carrying {@link ApiErrorCodes#VALIDATION_FAILED}.
 *
 * <p>One request with both fields blank, because one request violates both constraints. Driven over
 * HTTP rather than against the method, because bean validation is the claim and bean validation
 * only runs on the wire - which is exactly what the deleted branch's tests could not show.
 *
 * <p>Its own class rather than a case in {@link AuthControllerTest}: that one drives the controller
 * as a plain object under Mockito, and a slice cannot be mixed into it.
 */
@WebMvcTest(AuthController.class)
@Import(TestConfig.class)
class AuthLoginValidationControllerTest {

    /** Both fields blank: one request, both constraints, one refusal. */
    private static final String BLANK_BODY = "{\"username\": \"\", \"password\": \"\"}";

    @MockitoBean
    private AuthenticationManager authenticationManager;

    @MockitoBean
    private UserRepository userRepository;

    @Autowired
    private MockMvc mockMvc;

    @Test
    @WithMockUser
    void login_withBlankCredentials_returns400WithValidationFailed() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON).content(BLANK_BODY).with(csrf()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Validation failed for request parameters."))
                .andExpect(jsonPath("$.code").value(ApiErrorCodes.VALIDATION_FAILED))
                // Named rather than quoted: both constraints are bare @NotBlank, so the sentence
                // behind each key is the library's default and not ours to pin.
                .andExpect(jsonPath("$.data.username").exists())
                .andExpect(jsonPath("$.data.password").exists());
    }
}
