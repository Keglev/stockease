package com.stocks.stockease.controller;

import java.util.Arrays;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.Mockito;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.stocks.stockease.model.Product;
import com.stocks.stockease.repository.ProductRepository;
import com.stocks.stockease.security.JwtUtil;

/**
 * Test class for {@link ProductController}.
 * This class contains parameterized tests for verifying the behavior of the product-related endpoints.
 */
@ExtendWith(MockitoExtension.class)
@WebMvcTest(ProductController.class)
public class ProductControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ProductRepository productRepository;

    @MockitoBean
    private JwtUtil jwtUtil;

    /**
     * Resets the mocked dependencies and sets up common behaviors before each test.
     */
    @BeforeEach
    void resetMocks() {
        Mockito.reset(productRepository, jwtUtil);
        Mockito.when(jwtUtil.validateToken(Mockito.anyString())).thenReturn(true);
        Mockito.when(jwtUtil.extractUsername(Mockito.anyString())).thenReturn("testUser");
    }

    /**
     * Tests the "low-stock products" endpoint with various roles.
     */
    @ParameterizedTest
    @CsvSource({
        "adminUser, ADMIN",
        "regularUser, USER"
    })
    void testLowStockProductsWithRoles(String username, String role) throws Exception {
        Product product1 = new Product("Low Stock Product 1", 3, 50.0);
        product1.setId(1L);

        Product product2 = new Product("Low Stock Product 2", 2, 30.0);
        product2.setId(2L);

        when(productRepository.findByQuantityLessThan(5)).thenReturn(Arrays.asList(product1, product2));

        mockMvc.perform(get("/api/products/low-stock")
                .with(SecurityMockMvcRequestPostProcessors.user(username).roles(role)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Low Stock Product 1"))
                .andExpect(jsonPath("$[1].name").value("Low Stock Product 2"));
    }

    /**
     * Tests the "low-stock products" endpoint with no low-stock products.
     */
    @ParameterizedTest
    @CsvSource({
        "adminUser, ADMIN",
        "regularUser, USER"
    })
    void testLowStockProductsEmptyWithRoles(String username, String role) throws Exception {
        when(productRepository.findByQuantityLessThan(5)).thenReturn(List.of());

        mockMvc.perform(get("/api/products/low-stock")
                .with(SecurityMockMvcRequestPostProcessors.user(username).roles(role)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("All products are sufficiently stocked."));
    }

    /**
     * Tests the "search products" endpoint with matching products.
     */
    @ParameterizedTest
    @CsvSource({
        "adminUser, ADMIN",
        "regularUser, USER"
    })
    void testSearchProductsWithRoles(String username, String role) throws Exception {
        Product product = new Product("Searchable Product", 10, 100.0);
        product.setId(1L);

        when(productRepository.findByNameContainingIgnoreCase("searchable"))
            .thenReturn(List.of(product));

        mockMvc.perform(get("/api/products/search")
                .with(SecurityMockMvcRequestPostProcessors.user(username).roles(role))
                .param("name", "searchable"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Searchable Product"));
    }

    /**
     * Tests the "search products" endpoint with no matching products.
     */
    @ParameterizedTest
    @CsvSource({
        "adminUser, ADMIN",
        "regularUser, USER"
    })
    void testSearchProductsEmptyWithRoles(String username, String role) throws Exception {
        when(productRepository.findByNameContainingIgnoreCase("nonexistent"))
            .thenReturn(List.of());

        mockMvc.perform(get("/api/products/search")
                .with(SecurityMockMvcRequestPostProcessors.user(username).roles(role))
                .param("name", "nonexistent"))
                .andExpect(status().isNoContent())
                .andExpect(jsonPath("$.message").value("No products found matching the name: nonexistent"));
    }

    /**
     * Tests the "total stock value" endpoint with products present.
     */
    @ParameterizedTest
    @CsvSource({
        "adminUser, ADMIN",
        "regularUser, USER"
    })
    void testTotalStockValueWithProducts(String username, String role) throws Exception {
        when(productRepository.calculateTotalStockValue()).thenReturn(500.0);

        mockMvc.perform(get("/api/products/total-stock-value")
                .with(SecurityMockMvcRequestPostProcessors.user(username).roles(role)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value(500.0))
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Total stock value fetched successfully"));
    }

    /**
     * Tests the "total stock value" endpoint with no products.
     */
    @ParameterizedTest
    @CsvSource({
        "adminUser, ADMIN",
        "regularUser, USER"
    })
    void testTotalStockValueWithNoProducts(String username, String role) throws Exception {
        when(productRepository.calculateTotalStockValue()).thenReturn(0.0);

        mockMvc.perform(get("/api/products/total-stock-value")
                .with(SecurityMockMvcRequestPostProcessors.user(username).roles(role)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value(0.0))
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Total stock value fetched successfully"));
    }
}
