package com.stocks.stockease.controller;

import java.util.Arrays;
import java.util.List;
import java.util.Objects;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.Mockito;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.lang.NonNull;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.stocks.stockease.config.test.TestConfig;
import com.stocks.stockease.model.Product;
import com.stocks.stockease.repository.ProductRepository;
import com.stocks.stockease.security.JwtUtil;

/** Slice tests for ProductController read endpoints: low-stock, search, total-stock-value. */
@ExtendWith(MockitoExtension.class)
@WebMvcTest(ProductController.class)
@Import(TestConfig.class)
class ProductControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ProductRepository productRepository;

    @MockitoBean
    private JwtUtil jwtUtil;

    @SuppressWarnings("unused")
    @BeforeEach
    void resetMocks() {
        // @MockitoBean stubs survive for the Spring context lifetime; explicit reset prevents state bleeding between tests
        Mockito.reset(productRepository, jwtUtil);
        Mockito.when(jwtUtil.validateToken(Mockito.anyString())).thenReturn(true);
        Mockito.when(jwtUtil.extractUsername(Mockito.anyString())).thenReturn("testUser");
    }

    @ParameterizedTest
    @CsvSource({"adminUser, ADMIN", "regularUser, USER"})
    void getLowStockProducts_withLowStockItems_returnsProducts(String username, String role) throws Exception {
        Product product1 = new Product("Low Stock Product 1", 3, 50.0);
        Product product2 = new Product("Low Stock Product 2", 2, 30.0);
        when(productRepository.findByQuantityLessThan(5)).thenReturn(Arrays.asList(product1, product2));

        mockMvc.perform(get("/api/products/low-stock").with(userWithRole(username, role)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Low Stock Product 1"))
                .andExpect(jsonPath("$[1].name").value("Low Stock Product 2"));
    }

    @ParameterizedTest
    @CsvSource({"adminUser, ADMIN", "regularUser, USER"})
    void getLowStockProducts_withNoLowStockItems_returnsAllStockedMessage(String username, String role) throws Exception {
        when(productRepository.findByQuantityLessThan(5)).thenReturn(List.of());

        mockMvc.perform(get("/api/products/low-stock").with(userWithRole(username, role)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("All products are sufficiently stocked."));
    }

    @ParameterizedTest
    @CsvSource({"adminUser, ADMIN", "regularUser, USER"})
    void searchProducts_withMatchingName_returnsProducts(String username, String role) throws Exception {
        Product product = new Product("Searchable Product", 10, 100.0);
        product.setId(1L);
        when(productRepository.findByNameContainingIgnoreCase("searchable")).thenReturn(List.of(product));

        mockMvc.perform(get("/api/products/search").with(userWithRole(username, role)).param("name", "searchable"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Searchable Product"));
    }

    @ParameterizedTest
    @CsvSource({"adminUser, ADMIN", "regularUser, USER"})
    void searchProducts_withNoMatches_returns204(String username, String role) throws Exception {
        when(productRepository.findByNameContainingIgnoreCase("nonexistent")).thenReturn(List.of());

        mockMvc.perform(get("/api/products/search").with(userWithRole(username, role)).param("name", "nonexistent"))
                .andExpect(status().isNoContent())
                .andExpect(jsonPath("$.message").value("No products found matching the name: nonexistent"));
    }

    @ParameterizedTest
    @CsvSource({"adminUser, ADMIN", "regularUser, USER"})
    void getTotalStockValue_withProducts_returnsCalculatedValue(String username, String role) throws Exception {
        when(productRepository.calculateTotalStockValue()).thenReturn(500.0);

        mockMvc.perform(get("/api/products/total-stock-value").with(userWithRole(username, role)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value(500.0))
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Total stock value fetched successfully"));
    }

    @ParameterizedTest
    @CsvSource({"adminUser, ADMIN", "regularUser, USER"})
    void getTotalStockValue_withNoProducts_returnsZero(String username, String role) throws Exception {
        when(productRepository.calculateTotalStockValue()).thenReturn(0.0);

        mockMvc.perform(get("/api/products/total-stock-value").with(userWithRole(username, role)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value(0.0))
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Total stock value fetched successfully"));
    }

    @NonNull
    private static RequestPostProcessor userWithRole(String username, String role) {
        return Objects.requireNonNull(SecurityMockMvcRequestPostProcessors.user(username).roles(role));
    }
}