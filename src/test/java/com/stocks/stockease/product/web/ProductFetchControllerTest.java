package com.stocks.stockease.product.web;

import java.util.Arrays;
import java.util.Objects;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.Mockito;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.jspecify.annotations.NonNull;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.stocks.stockease.config.test.TestConfig;
import com.stocks.stockease.product.Product;
import com.stocks.stockease.product.ProductService;
import com.stocks.stockease.security.JwtUtil;

/** Slice tests for GET /api/products and GET /api/products/{id} endpoints. */
@ExtendWith(MockitoExtension.class)
@WebMvcTest(ProductController.class)
@Import(TestConfig.class)
// JwtUtil stubs configured in setUp() are scoped to the Spring context; DirtiesContext forces a reload between tests to prevent stub bleed-over.
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class ProductFetchControllerTest {

    @MockitoBean
    private ProductService productService;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtUtil jwtUtil;

    @SuppressWarnings("unused")
    @BeforeEach
    void setUp() {
        Mockito.when(jwtUtil.validateToken(Mockito.anyString())).thenReturn(true);
        Mockito.when(jwtUtil.extractUsername(Mockito.anyString())).thenReturn("testUser");

        Product product1 = new Product("Product 1", 10, 100.0);
        product1.setId(1L);

        Product product2 = new Product("Product 2", 5, 50.0);
        product2.setId(2L);

        when(productService.getAllProducts()).thenReturn(Arrays.asList(product1, product2));
    }

    @Test
    void contextLoads_onApplicationStart_beansAreInjected() {
        assertNotNull(productService);
        assertNotNull(mockMvc);
    }

    @ParameterizedTest
    @CsvSource({"adminUser, ADMIN", "regularUser, USER"})
    void getAllProducts_withAdminOrUserRole_returns200(String username, String role) throws Exception {
        mockMvc.perform(get("/api/products").with(userWithRole(username, role)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Product 1"))
                .andExpect(jsonPath("$[0].totalValue").value(1000.0))
                .andExpect(jsonPath("$[1].name").value("Product 2"))
                .andExpect(jsonPath("$[1].totalValue").value(250.0));
    }

    @ParameterizedTest
    @CsvSource({"adminUser, ADMIN", "regularUser, USER"})
    void getProductById_withExistingId_returns200(String username, String role) throws Exception {
        Product product = new Product("Product 1", 10, 100.0);
        product.setId(1L);
        when(productService.findById(1L)).thenReturn(Optional.of(product));

        mockMvc.perform(get("/api/products/1").with(userWithRole(username, role)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("Product 1"))
                .andExpect(jsonPath("$.data.totalValue").value(1000.0));
    }

    @ParameterizedTest
    @CsvSource({"adminUser, ADMIN", "regularUser, USER"})
    void getProductById_withNonExistentId_returns404(String username, String role) throws Exception {
        when(productService.findById(999L)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/products/999").with(userWithRole(username, role)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("The product with ID 999 does not exist."))
                .andExpect(jsonPath("$.data").isEmpty());
    }

    private static @NonNull RequestPostProcessor userWithRole(String username, String role) {
        return Objects.requireNonNull(SecurityMockMvcRequestPostProcessors.user(username).roles(role));
    }
}