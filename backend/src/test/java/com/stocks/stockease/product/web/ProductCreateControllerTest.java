package com.stocks.stockease.product.web;

import java.util.Objects;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyString;
import org.mockito.Mockito;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.jspecify.annotations.NonNull;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.stocks.stockease.config.test.TestConfig;
import com.stocks.stockease.product.Product;
import com.stocks.stockease.product.ProductService;
import com.stocks.stockease.security.UserService;
import com.stocks.stockease.security.JwtUtil;

/** Slice tests for POST /api/products (product creation). */
@ExtendWith(MockitoExtension.class)
@WebMvcTest(ProductController.class)
@Import({TestConfig.class, ProductMethodSecurityTestConfig.class})
class ProductCreateControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtUtil jwtUtil;

    @MockitoBean
    private ProductService productService;

    @MockitoBean
    private UserService userService;

    private Product product1;

    @SuppressWarnings("unused") // invoked by JUnit via reflection, not by direct call
    @BeforeEach
    void setUpMocks() {
        Mockito.when(jwtUtil.validateToken(Mockito.anyString())).thenReturn(true);
        Mockito.when(jwtUtil.extractUsername(Mockito.anyString())).thenReturn("testUser");
        Mockito.when(jwtUtil.extractRole(Mockito.anyString())).thenReturn("ROLE_ADMIN");
        // created products always hold zero stock, so the fixture the service returns does too
        product1 = new Product("Product 1", 0, 100.0);
        product1.setId(1L);
        product1.setSku("BUE-0004");
        // @MockitoBean stubs survive for the Spring context lifetime; explicit reset prevents state bleeding between tests
        Mockito.reset(productService);
    }

    @Test
    void createProduct_withValidData_returns200() throws Exception {
        when(productService.create(anyString(), anyString(), anyDouble()))
                .thenReturn(Objects.requireNonNull(product1));

        mockMvc.perform(post("/api/products")
                        .contentType(applicationJson())
                        .content("{\"name\": \"Product 1\", \"sku\": \"BUE-0004\", \"purchasePrice\": 100.0}")
                        .with(csrfToken())
                        .with(userWithRole("adminUser", "ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Product 1"))
                .andExpect(jsonPath("$.sku").value("BUE-0004"))
                .andExpect(jsonPath("$.purchasePrice").value(100.0));
    }

    @Test
    void createProduct_withNoQuantityInRequest_returnsProductAtZeroStock() throws Exception {
        when(productService.create(anyString(), anyString(), anyDouble()))
                .thenReturn(Objects.requireNonNull(product1));

        // the vacuity guard: the request carries no quantity, and the response must still say 0
        // rather than omit the field - a created product holds no stock until a movement books it
        mockMvc.perform(post("/api/products")
                        .contentType(applicationJson())
                        .content("{\"name\": \"Product 1\", \"sku\": \"BUE-0004\", \"purchasePrice\": 100.0}")
                        .with(csrfToken())
                        .with(userWithRole("adminUser", "ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.quantity").value(0))
                .andExpect(jsonPath("$.totalValue").value(0.0));
    }

    @Test
    void createProduct_asUserRole_returns403() throws Exception {
        // CSRF token is supplied deliberately: the 403 must come from @PreAuthorize("hasRole('ADMIN')")
        // and nothing else, so the admin-only rule is what this test actually proves
        mockMvc.perform(post("/api/products")
                        .contentType(applicationJson())
                        .content("{\"name\": \"Valid Product\", \"sku\": \"BUE-0004\", \"purchasePrice\": 100.0}")
                        .with(userWithRole("regularUser", "USER"))
                        .with(csrfToken()))
                .andExpect(status().isForbidden());

        Mockito.verify(productService, Mockito.never()).create(anyString(), anyString(), anyDouble());
    }

    @Test
    void createProduct_withMissingName_returns400() throws Exception {
        mockMvc.perform(post("/api/products")
                        .contentType(applicationJson())
                        .content("{\"name\": \"\"}")
                        .with(userWithRole("adminUser", "ADMIN"))
                        .with(csrfToken()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Validation failed for request parameters."));
    }

    @Test
    void createProduct_withBlankSku_returns400() throws Exception {
        mockMvc.perform(post("/api/products")
                        .contentType(applicationJson())
                        .content("{\"name\": \"Product 1\", \"sku\": \"  \", \"purchasePrice\": 100.0}")
                        .with(userWithRole("adminUser", "ADMIN"))
                        .with(csrfToken()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Validation failed for request parameters."))
                .andExpect(jsonPath("$.data.sku").exists());
    }

    @Test
    void createProduct_withMissingSku_returns400() throws Exception {
        mockMvc.perform(post("/api/products")
                        .contentType(applicationJson())
                        .content("{\"name\": \"Product 1\", \"purchasePrice\": 100.0}")
                        .with(userWithRole("adminUser", "ADMIN"))
                        .with(csrfToken()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Validation failed for request parameters."));
    }

    @Test
    void createProduct_withZeroPrice_returns400() throws Exception {
        mockMvc.perform(post("/api/products")
                        .contentType(applicationJson())
                        .content("{\"name\": \"Product 1\", \"sku\": \"BUE-0004\", \"purchasePrice\": 0}")
                        .with(userWithRole("adminUser", "ADMIN"))
                        .with(csrfToken()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Validation failed for request parameters."));
    }

    @Test
    void createProduct_withInvalidPriceType_returns400() throws Exception {
        // save is never reached — JSON deserialization fails before the controller is invoked; stub is defensive only
        when(productService.create(anyString(), anyString(), anyDouble()))
                .thenReturn(Objects.requireNonNull(product1));

        mockMvc.perform(post("/api/products")
                        .contentType(applicationJson())
                        .content("{\"name\": \"Product 1\", \"sku\": \"BUE-0004\", \"purchasePrice\": \"notANumber\"}")
                        .with(userWithRole("adminUser", "ADMIN"))
                        .with(csrfToken()))
                .andExpect(status().isBadRequest());
    }

    private static @NonNull MediaType applicationJson() {
        return Objects.requireNonNull(MediaType.APPLICATION_JSON);
    }

    private static @NonNull RequestPostProcessor csrfToken() {
        return Objects.requireNonNull(csrf());
    }

    private static @NonNull RequestPostProcessor userWithRole(String username, String role) {
        return Objects.requireNonNull(SecurityMockMvcRequestPostProcessors.user(username).roles(role));
    }
}