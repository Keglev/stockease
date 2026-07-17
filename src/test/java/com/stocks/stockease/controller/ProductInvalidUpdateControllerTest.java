package com.stocks.stockease.controller;

import java.util.Objects;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import static org.mockito.ArgumentMatchers.any;
import org.mockito.Mockito;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.lang.NonNull;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.stocks.stockease.config.test.TestConfig;
import com.stocks.stockease.model.Product;
import com.stocks.stockease.repository.ProductRepository;
import com.stocks.stockease.security.JwtUtil;

/** Slice tests for validation and error scenarios in PUT /api/products/{id}/quantity|price|name. */
@ExtendWith(MockitoExtension.class)
@WebMvcTest(ProductController.class)
@Import(TestConfig.class)
class ProductInvalidUpdateControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtUtil jwtUtil;

    @MockitoBean
    private ProductRepository productRepository;

    private Product product1;

    @SuppressWarnings("unused")
    @BeforeEach
    void setUpJwtMock() {
        Mockito.when(jwtUtil.validateToken(Mockito.anyString())).thenReturn(true);
        Mockito.when(jwtUtil.extractUsername(Mockito.anyString())).thenReturn("testUser");
        product1 = new Product("Product 1", 10, 100.0);
        product1.setId(1L);
        product1.setTotalValue(1000.0);
        // @MockitoBean stubs survive for the Spring context lifetime; explicit reset prevents state bleeding between tests
        Mockito.reset(productRepository);
    }

    @ParameterizedTest
    @CsvSource({"adminUser, ADMIN", "regularUser, USER"})
    void updateQuantity_withMissingField_returns400(String username, String role) throws Exception {
        when(productRepository.findById(1L)).thenReturn(Optional.of(Objects.requireNonNull(product1)));
        when(productRepository.save(anyNonNull(Product.class))).thenReturn(Objects.requireNonNull(product1));

        mockMvc.perform(put("/api/products/1/quantity")
                        .contentType(applicationJson())
                        .with(userWithRole(username, role))
                        .with(csrfToken())
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Validation failed for request parameters."));
    }

    @ParameterizedTest
    @CsvSource({"adminUser, ADMIN", "regularUser, USER"})
    void updateQuantity_withInvalidType_returns400(String username, String role) throws Exception {
        when(productRepository.findById(1L)).thenReturn(Optional.of(Objects.requireNonNull(product1)));

        mockMvc.perform(put("/api/products/1/quantity")
                        .contentType(applicationJson())
                        .with(userWithRole(username, role))
                        .with(csrfToken())
                        .content("{\"quantity\": \"notAnInteger\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Invalid request format or data type."));
    }

    @ParameterizedTest
    @CsvSource({"adminUser, ADMIN", "regularUser, USER"})
    void updatePrice_withNegativeValue_returns400(String username, String role) throws Exception {
        when(productRepository.findById(1L)).thenReturn(Optional.of(Objects.requireNonNull(product1)));
        when(productRepository.save(anyNonNull(Product.class))).thenReturn(Objects.requireNonNull(product1));

        mockMvc.perform(put("/api/products/1/price")
                        .contentType(applicationJson())
                        .with(userWithRole(username, role))
                        .with(csrfToken())
                        .content("{\"price\": -10.0}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Validation failed for request parameters."));
    }

    @ParameterizedTest
    @CsvSource({"adminUser, ADMIN", "regularUser, USER"})
    void updatePrice_withInvalidType_returns400(String username, String role) throws Exception {
        when(productRepository.findById(1L)).thenReturn(Optional.of(Objects.requireNonNull(product1)));

        mockMvc.perform(put("/api/products/1/price")
                        .contentType(applicationJson())
                        .with(userWithRole(username, role))
                        .with(csrfToken())
                        .content("{\"price\": \"notANumber\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Invalid request format or data type."));
    }

    @ParameterizedTest
    @CsvSource({"adminUser, ADMIN", "regularUser, USER"})
    void updatePrice_withZeroValue_returns400(String username, String role) throws Exception {
        when(productRepository.findById(1L)).thenReturn(Optional.of(Objects.requireNonNull(product1)));

        mockMvc.perform(put("/api/products/1/price")
                        .contentType(applicationJson())
                        .with(userWithRole(username, role))
                        .with(csrfToken())
                        .content("{\"price\": 0}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Validation failed for request parameters."));
    }

    @ParameterizedTest
    @CsvSource({"adminUser, ADMIN", "regularUser, USER"})
    void updateName_withWhitespaceOnly_returns400(String username, String role) throws Exception {
        when(productRepository.findById(1L)).thenReturn(Optional.of(Objects.requireNonNull(product1)));

        mockMvc.perform(put("/api/products/1/name")
                        .contentType(applicationJson())
                        .with(userWithRole(username, role))
                        .with(csrfToken())
                        .content("{\"name\": \"   \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Validation failed for request parameters."));
    }

    @ParameterizedTest
    @CsvSource({"adminUser, ADMIN", "regularUser, USER"})
    void updateProduct_whenNotFound_returns404(String username, String role) throws Exception {
        when(productRepository.findById(999L)).thenReturn(Optional.empty());

        mockMvc.perform(put("/api/products/999/quantity")
                        .contentType(applicationJson())
                        .with(userWithRole(username, role))
                        .with(csrfToken())
                        .content("{\"quantity\": 10}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Entity not found: Product with ID 999 not found."));
    }

    @ParameterizedTest
    @CsvSource({"adminUser, ADMIN", "regularUser, USER"})
    void updateProduct_withoutCsrfToken_returns403(String username, String role) throws Exception {
        when(productRepository.findById(1L)).thenReturn(Optional.of(Objects.requireNonNull(product1)));

        // 403 is issued by the CSRF filter, not the authorization layer; both roles are rejected equally
        mockMvc.perform(put("/api/products/1/quantity")
                        .contentType(applicationJson())
                        .with(userWithRole(username, role))
                        .content("{\"quantity\": 10}"))
                .andExpect(status().isForbidden());
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