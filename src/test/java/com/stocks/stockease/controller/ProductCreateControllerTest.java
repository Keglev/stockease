package com.stocks.stockease.controller;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import static org.mockito.ArgumentMatchers.any;
import org.mockito.Mockito;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.stocks.stockease.config.test.TestConfig;
import com.stocks.stockease.model.Product;
import com.stocks.stockease.repository.ProductRepository;
import com.stocks.stockease.security.JwtUtil;

/**
 * Test class for product creation functionality in {@link ProductController}.
 * This class verifies various scenarios, including valid, invalid, and unauthorized requests.
 */
@ExtendWith(MockitoExtension.class)
@WebMvcTest(ProductController.class)
@Import(TestConfig.class) // Use TestConfig to handle authorization
public class ProductCreateControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtUtil jwtUtil;

    @MockitoBean
    private ProductRepository productRepository;

    private Product product1;

    /**
     * Sets up mocks and initializes test data before each test.
     */
    @BeforeEach
    void setUpMocks() {
        // Mock JwtUtil behavior
        Mockito.when(jwtUtil.validateToken(Mockito.anyString())).thenReturn(true);
        Mockito.when(jwtUtil.extractUsername(Mockito.anyString())).thenReturn("testUser");
        Mockito.when(jwtUtil.extractRole(Mockito.anyString())).thenReturn("ROLE_ADMIN");

        // Initialize a valid product
        product1 = new Product("Product 1", 10, 100.0);
        product1.setId(1L);
        product1.setTotalValue(1000.0);

        // Reset repository mock
        Mockito.reset(productRepository);
    }

    /**
     * Tests successful product creation by an admin user.
     */
    @Test
    void testValidProductCreation() throws Exception {
        when(productRepository.save(any(Product.class))).thenReturn(product1);

        mockMvc.perform(post("/api/products")
                .contentType(APPLICATION_JSON)
                .content("{\"name\": \"Product 1\", \"quantity\": 10, \"price\": 100.0, \"totalValue\": 1000.0}")
                .with(csrf())
                .with(SecurityMockMvcRequestPostProcessors.user("adminUser").roles("ADMIN")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Product 1"))
            .andExpect(jsonPath("$.quantity").value(10))
            .andExpect(jsonPath("$.price").value(100.0))
            .andExpect(jsonPath("$.totalValue").value(1000.0));
    }

    /**
     * Tests unauthorized product creation by a regular user.
     */
    @ParameterizedTest
    @CsvSource({
        "regularUser, USER"
    })
    void testProductCreationDeniedForUser(String username, String role) throws Exception {
        mockMvc.perform(post("/api/products")
                .contentType(APPLICATION_JSON)
                .content("{\"name\": \"Valid Product\", \"quantity\": 10, \"price\": 100.0, \"totalValue\": 1000.0}")
                .with(SecurityMockMvcRequestPostProcessors.user(username).roles(role)))
            .andExpect(status().isForbidden());
    }

    /**
     * Tests product creation with missing required fields.
     */
    @Test
    void testProductCreationWithMissingFields() throws Exception {
        mockMvc.perform(post("/api/products")
                .contentType(APPLICATION_JSON)
                .content("{\"name\": \"\"}")
                .with(SecurityMockMvcRequestPostProcessors.user("adminUser").roles("ADMIN"))
                .with(csrf()))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("Incomplete update. Please fill in all required fields."));
    }

    /**
     * Tests product creation with a negative quantity value.
     */
    @Test
    void testProductCreationWithNegativeQuantity() throws Exception {
        mockMvc.perform(post("/api/products")
                .contentType(APPLICATION_JSON)
                .content("{\"name\": \"Product 1\", \"quantity\": -5, \"price\": 100.0, \"totalValue\": 1000.0}")
                .with(SecurityMockMvcRequestPostProcessors.user("adminUser").roles("ADMIN"))
                .with(csrf()))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("Quantity cannot be negative."));
    }

    /**
     * Tests product creation with a price of zero.
     */
    @Test
    void testProductCreationWithZeroPrice() throws Exception {
        mockMvc.perform(post("/api/products")
                .contentType(APPLICATION_JSON)
                .content("{\"name\": \"Product 1\", \"quantity\": 10, \"price\": 0, \"totalValue\": 0}")
                .with(SecurityMockMvcRequestPostProcessors.user("adminUser").roles("ADMIN"))
                .with(csrf()))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("Price must be greater than 0."));
    }

    /**
     * Tests product creation with an invalid data type for price.
     */
    @Test
    void testProductCreationWithInvalidTypeForPrice() throws Exception {
        when(productRepository.save(any(Product.class))).thenReturn(product1);
        mockMvc.perform(post("/api/products")
                .contentType(APPLICATION_JSON)
                .content("{\"name\": \"Product 1\", \"quantity\": 10, \"price\": \"notANumber\", \"totalValue\": 1000.0}")
                .with(SecurityMockMvcRequestPostProcessors.user("adminUser").roles("ADMIN"))
                .with(csrf()))
            .andExpect(status().isBadRequest());
    }
}

