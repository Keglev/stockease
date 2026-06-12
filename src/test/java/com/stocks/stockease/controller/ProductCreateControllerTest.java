package com.stocks.stockease.controller;

import java.util.Objects;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.mockito.ArgumentMatchers.any;
import org.mockito.Mockito;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.lang.NonNull;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.stocks.stockease.config.test.TestConfig;
import com.stocks.stockease.model.Product;
import com.stocks.stockease.repository.ProductRepository;
import com.stocks.stockease.security.JwtUtil;

/** Slice tests for POST /api/products (product creation). */
@ExtendWith(MockitoExtension.class)
@WebMvcTest(ProductController.class)
@Import(TestConfig.class)
class ProductCreateControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtUtil jwtUtil;

    @MockitoBean
    private ProductRepository productRepository;

    private Product product1;

    @SuppressWarnings("unused")
    @BeforeEach
    void setUpMocks() {
        Mockito.when(jwtUtil.validateToken(Mockito.anyString())).thenReturn(true);
        Mockito.when(jwtUtil.extractUsername(Mockito.anyString())).thenReturn("testUser");
        Mockito.when(jwtUtil.extractRole(Mockito.anyString())).thenReturn("ROLE_ADMIN");
        product1 = new Product("Product 1", 10, 100.0);
        product1.setId(1L);
        product1.setTotalValue(1000.0);
        // @MockitoBean stubs survive for the Spring context lifetime; explicit reset prevents state bleeding between tests
        Mockito.reset(productRepository);
    }

    @Test
    void createProduct_withValidData_returns200() throws Exception {
        when(productRepository.save(anyNonNull(Product.class))).thenReturn(Objects.requireNonNull(product1));

        mockMvc.perform(post("/api/products")
                        .contentType(applicationJson())
                        .content("{\"name\": \"Product 1\", \"quantity\": 10, \"price\": 100.0, \"totalValue\": 1000.0}")
                        .with(csrfToken())
                        .with(userWithRole("adminUser", "ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Product 1"))
                .andExpect(jsonPath("$.quantity").value(10))
                .andExpect(jsonPath("$.price").value(100.0))
                .andExpect(jsonPath("$.totalValue").value(1000.0));
    }

    @Test
    void createProduct_asUserRole_returns403() throws Exception {
        mockMvc.perform(post("/api/products")
                        .contentType(applicationJson())
                        .content("{\"name\": \"Valid Product\", \"quantity\": 10, \"price\": 100.0, \"totalValue\": 1000.0}")
                        .with(userWithRole("regularUser", "USER")))
                .andExpect(status().isForbidden());
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
    void createProduct_withNegativeQuantity_returns400() throws Exception {
        mockMvc.perform(post("/api/products")
                        .contentType(applicationJson())
                        .content("{\"name\": \"Product 1\", \"quantity\": -5, \"price\": 100.0, \"totalValue\": 1000.0}")
                        .with(userWithRole("adminUser", "ADMIN"))
                        .with(csrfToken()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Validation failed for request parameters."));
    }

    @Test
    void createProduct_withZeroPrice_returns400() throws Exception {
        mockMvc.perform(post("/api/products")
                        .contentType(applicationJson())
                        .content("{\"name\": \"Product 1\", \"quantity\": 10, \"price\": 0, \"totalValue\": 0}")
                        .with(userWithRole("adminUser", "ADMIN"))
                        .with(csrfToken()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Validation failed for request parameters."));
    }

    @Test
    void createProduct_withInvalidPriceType_returns400() throws Exception {
        // save is never reached — JSON deserialization fails before the controller is invoked; stub is defensive only
        when(productRepository.save(anyNonNull(Product.class))).thenReturn(Objects.requireNonNull(product1));

        mockMvc.perform(post("/api/products")
                        .contentType(applicationJson())
                        .content("{\"name\": \"Product 1\", \"quantity\": 10, \"price\": \"notANumber\", \"totalValue\": 1000.0}")
                        .with(userWithRole("adminUser", "ADMIN"))
                        .with(csrfToken()))
                .andExpect(status().isBadRequest());
    }

    @NonNull
    private static MediaType applicationJson() {
        return Objects.requireNonNull(MediaType.APPLICATION_JSON);
    }

    @NonNull
    private static RequestPostProcessor csrfToken() {
        return Objects.requireNonNull(csrf());
    }

    @SuppressWarnings("null")
    @NonNull
    private static <T> T anyNonNull(Class<T> clazz) {
        return any(clazz);
    }

    @NonNull
    private static RequestPostProcessor userWithRole(String username, String role) {
        return Objects.requireNonNull(SecurityMockMvcRequestPostProcessors.user(username).roles(role));
    }
}