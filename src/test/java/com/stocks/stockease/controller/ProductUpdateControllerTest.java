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

/** Slice tests for PUT /api/products/{id}/quantity|price|name (happy-path updates). */
@ExtendWith(MockitoExtension.class)
@WebMvcTest(ProductController.class)
@Import(TestConfig.class)
class ProductUpdateControllerTest {

    @MockitoBean
    private ProductRepository productRepository;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtUtil jwtUtil;

    @SuppressWarnings("unused")
    @BeforeEach
    void setUpJwtMock() {
        Mockito.when(jwtUtil.validateToken(Mockito.anyString())).thenReturn(true);
        Mockito.when(jwtUtil.extractUsername(Mockito.anyString())).thenReturn("testUser");
        // @MockitoBean stubs survive for the Spring context lifetime; explicit reset prevents state bleeding between tests
        Mockito.reset(productRepository);
    }

    @ParameterizedTest
    @CsvSource({"adminUser, ADMIN", "regularUser, USER"})
    void updateQuantity_withValidData_returns200(String username, String role) throws Exception {
        Product product = new Product("Product 1", 10, 100.0);
        product.setId(1L);
        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(productRepository.save(anyNonNull(Product.class))).thenReturn(product);

        mockMvc.perform(put("/api/products/1/quantity")
                        .contentType(applicationJson())
                        .with(userWithRole(username, role))
                        .with(csrfToken())
                        .content("{\"quantity\": 50}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Quantity updated successfully"))
                .andExpect(jsonPath("$.data.quantity").value(50));
    }

    @ParameterizedTest
    @CsvSource({"adminUser, ADMIN", "regularUser, USER"})
    void updatePrice_withValidData_returns200(String username, String role) throws Exception {
        Product product = new Product("Product 1", 10, 100.0);
        product.setId(1L);
        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(productRepository.save(anyNonNull(Product.class))).thenReturn(product);

        mockMvc.perform(put("/api/products/1/price")
                        .contentType(applicationJson())
                        .with(userWithRole(username, role))
                        .with(csrfToken())
                        .content("{\"price\": 150.0}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Price updated successfully"));
    }

    @ParameterizedTest
    @CsvSource({"adminUser, ADMIN", "regularUser, USER"})
    void updateName_withSpecialCharacters_returns200(String username, String role) throws Exception {
        Product product = new Product("Product 1", 10, 100.0);
        product.setId(1L);
        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(productRepository.save(anyNonNull(Product.class))).thenReturn(product);

        mockMvc.perform(put("/api/products/1/name")
                        .contentType(applicationJson())
                        .with(userWithRole(username, role))
                        .with(csrfToken())
                        .content("{\"name\": \"Updated!@#$%\"}")) // special characters verify the API stores names without sanitizing or encoding them
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Name updated successfully"))
                .andExpect(jsonPath("$.data.name").value("Updated!@#$%"));
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