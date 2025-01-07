// All tests passed successfully. 
package com.stocks.stockease.controller;

import java.util.Arrays;
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
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.stocks.stockease.config.test.TestConfig;
import com.stocks.stockease.model.Product;
import com.stocks.stockease.repository.ProductRepository;
import com.stocks.stockease.security.JwtUtil;

@ExtendWith(MockitoExtension.class)
@WebMvcTest(ProductController.class)
@Import(TestConfig.class) // Import the reusable TestConfig
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)

public class ProductFetchControllerTest {

    @MockitoBean // Mock the repository
    private ProductRepository productRepository;

    @Autowired // Inject MockMvc for request simulation
    private MockMvc mockMvc;

     @Autowired
    private JwtUtil jwtUtil;

    @BeforeEach
    void setUp() {
        // Correct constructor or setters to set up mock products
        Product product1 = new Product("Product 1", 10, 100.0);
        product1.setId(1L);
        product1.setTotalValue(1000.0); // Mock total value
       
        Product product2 = new Product("Product 2", 5, 50.0);
        product2.setId(2L);
        product2.setTotalValue(250.0); // Mock total value

        when(productRepository.findAllOrderById()).thenReturn(Arrays.asList(product1, product2));

    }

    @Test
    void contextLoads() {
        assertNotNull(productRepository);
        assertNotNull(mockMvc);
    }


    @ParameterizedTest
    @CsvSource({
        "adminUser, ADMIN",
        "regularUser, USER"
    })
    void testGetAllProductsWithRoles(String username, String role) throws Exception {

        // Mock JwtUtil behavior
        Mockito.when(jwtUtil.validateToken(Mockito.anyString())).thenReturn(true);
        Mockito.when(jwtUtil.extractUsername(Mockito.anyString())).thenReturn("testUser");

        // Perform GET request and validate response
        ResultActions result = mockMvc.perform(get("/api/products")
                .with(SecurityMockMvcRequestPostProcessors.user(username).roles(role)));

        // Validate JSON response
        result.andExpect(status().isOk())
            .andExpect(jsonPath("$[0].name").value("Product 1"))
            .andExpect(jsonPath("$[0].totalValue").value(1000.0))
            .andExpect(jsonPath("$[1].name").value("Product 2"))
            .andExpect(jsonPath("$[1].totalValue").value(250.0));
    }

    @ParameterizedTest
    @CsvSource({
        "adminUser, ADMIN",
        "regularUser, USER"
    })
    void testGetProductByIdWithRoles(String username, String role) throws Exception {

        // Mock JwtUtil behavior
        Mockito.when(jwtUtil.validateToken(Mockito.anyString())).thenReturn(true);
        Mockito.when(jwtUtil.extractUsername(Mockito.anyString())).thenReturn("testUser");

          // Prepare mock data
        Product product = new Product("Product 1", 10, 100.0);
        product.setId(1L);
        product.setTotalValue(10 * 100.0);

        // Mock repository behavior
        when(productRepository.findById(1L)).thenReturn(Optional.of(product));

         // Perform GET request and validate response
        mockMvc.perform(get("/api/products/1")
                .with(SecurityMockMvcRequestPostProcessors.user(username).roles(role)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.name").value("Product 1"))
            .andExpect(jsonPath("$.data.totalValue").value(1000.0));
    }

    @ParameterizedTest
    @CsvSource({
        "adminUser, ADMIN",
        "regularUser, USER"
    })
    void testGetProductByIdNotFoundWithRoles(String username, String role) throws Exception {

        // Mock JwtUtil behavior
        Mockito.when(jwtUtil.validateToken(Mockito.anyString())).thenReturn(true);
        Mockito.when(jwtUtil.extractUsername(Mockito.anyString())).thenReturn("testUser");

        // Mock repository behavior: return empty for the given ID
        when(productRepository.findById(999L)).thenReturn(Optional.empty());

        // Perform GET request for a non-existing product and validate response
        mockMvc.perform(get("/api/products/999")
                .with(SecurityMockMvcRequestPostProcessors.user(username).roles(role)))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.message").value("The product with ID 999 does not exist."))
            .andExpect(jsonPath("$.data").isEmpty());
    }
}
