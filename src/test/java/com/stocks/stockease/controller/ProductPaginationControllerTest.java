package com.stocks.stockease.controller;

import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static org.hamcrest.Matchers.hasSize;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.stocks.stockease.config.test.TestConfig;
import com.stocks.stockease.model.Product;
import com.stocks.stockease.repository.ProductRepository;
import com.stocks.stockease.security.JwtUtil;

@ExtendWith(MockitoExtension.class)
@WebMvcTest(ProductController.class)
@Import(TestConfig.class)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
public class ProductPaginationControllerTest {

    @MockitoBean
    private ProductRepository productRepository;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtUtil jwtUtil;

    @BeforeEach
    void setUp() {
        Mockito.when(jwtUtil.validateToken(Mockito.anyString())).thenReturn(true);
        Mockito.when(jwtUtil.extractUsername(Mockito.anyString())).thenReturn("testUser");

        List<Product> products = IntStream.range(1, 21) // Generate 20 products
                .mapToObj(i -> new Product("Product " + i, i, i * 10.0))
                .collect(Collectors.toList());
            Page<Product> productPage = new PageImpl<>(products.subList(0, 10), PageRequest.of(0, 10), products.size());
            Mockito.when(productRepository.findAll(Mockito.any(Pageable.class))).thenReturn(productPage);
    }

    @ParameterizedTest
    @CsvSource({
        "adminUser, ADMIN",
        "regularUser, USER"
    })
    void testGetPagedProductsWithRoles(String username, String role) throws Exception {
        mockMvc.perform(get("/api/products/paged")
                .with(SecurityMockMvcRequestPostProcessors.user(username).roles(role))
                .param("page", "0")
                .param("size", "10"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content", hasSize(10)))
            .andExpect(jsonPath("$.data.content[0].name").value("Product 1"))
            .andExpect(jsonPath("$.data.content[9].name").value("Product 10"))
            .andExpect(jsonPath("$.data.totalElements").value(20))
            .andExpect(jsonPath("$.data.totalPages").value(2));
    }
    
    @ParameterizedTest
    @CsvSource({
        "adminUser, ADMIN",
        "regularUser, USER"
    })
    void testGetPagedProductsEmptyPage(String username, String role) throws Exception {
        Page<Product> emptyPage = new PageImpl<>(Collections.emptyList());
        Mockito.when(productRepository.findAll(Mockito.any(Pageable.class))).thenReturn(emptyPage);

        mockMvc.perform(get("/api/products/paged")
                .with(SecurityMockMvcRequestPostProcessors.user(username).roles(role))
                .param("page", "1")
                .param("size", "10"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content").isEmpty());
    }

    @ParameterizedTest
    @CsvSource({
        "adminUser, ADMIN",
        "regularUser, USER"
    })
    void testGetPagedProductsInvalidParams(String username, String role) throws Exception {
        mockMvc.perform(get("/api/products/paged")
                .with(SecurityMockMvcRequestPostProcessors.user(username).roles(role))
                .param("page", "-1")
                .param("size", "-10"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.message").value("Validation failed for request parameters."))
            .andExpect(jsonPath("$.data.Unknown").value("Unable to extract detailed validation error.")); // Adjust expectation based on actual error message
    }
}

