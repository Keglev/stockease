// all tests pass
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

    @BeforeEach
    @SuppressWarnings("unused")
    void setUpMocks() {
        // Mock JwtUtil behavior (if needed)
        Mockito.when(jwtUtil.validateToken(Mockito.anyString())).thenReturn(true);
        Mockito.when(jwtUtil.extractUsername(Mockito.anyString())).thenReturn("testUser");
        Mockito.when(jwtUtil.extractRole(Mockito.anyString())).thenReturn("ROLE_ADMIN");
    
        // Initialize a valid product
        product1 = new Product("Product 1", 10, 100.0);
        product1.setId(1L);
        product1.setTotalValue(1000.0);
    
        // Reset repository mock (only needed if test modifies mock behavior)
        Mockito.reset(productRepository);
    }

    @Test
    void testValidProductCreation() throws Exception {
        when(productRepository.save(any(Product.class))).thenReturn(product1);

        mockMvc.perform(post("/api/products")
                .contentType(APPLICATION_JSON)
                .content("{\"name\": \"Product 1\", \"quantity\": 10, \"price\": 100.0, \"totalValue\": 1000.0}")
                .with(csrf())  // Add CSRF token
                .with(SecurityMockMvcRequestPostProcessors.user("adminUser").roles("ADMIN")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Product 1"))
            .andExpect(jsonPath("$.quantity").value(10))
            .andExpect(jsonPath("$.price").value(100.0))
            .andExpect(jsonPath("$.totalValue").value(1000.0));
    }

    @ParameterizedTest
    @CsvSource({
        "regularUser, USER"
    })
    void testProductCreationDeniedForUser(String username, String role) throws Exception {

        mockMvc.perform(post("/api/products")
                .contentType(APPLICATION_JSON)
                .content("{\"name\": \"Valid Product\", \"quantity\": 10, \"price\": 100.0, \"totalValue\": 1000.0}")
                .with(SecurityMockMvcRequestPostProcessors.user(username).roles(role)))
            .andExpect(status().isForbidden()); // 403 Forbidden
    }

    @Test
    void testProductCreationWithMissingFields() throws Exception {
        mockMvc.perform(post("/api/products")
                .contentType(APPLICATION_JSON)
                .content("{\"name\": \"\"}")
                .with(SecurityMockMvcRequestPostProcessors.user("adminUser").roles("ADMIN"))
                .with(csrf()))  // Add CSRF token
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("Incomplete update. Please fill in all required fields."));
    }
    
    @Test
    void testProductCreationWithNegativeQuantity() throws Exception {
        mockMvc.perform(post("/api/products")
                .contentType(APPLICATION_JSON)
                .content("{\"name\": \"Product 1\", \"quantity\": -5, \"price\": 100.0, \"totalValue\": 1000.0}")
                .with(SecurityMockMvcRequestPostProcessors.user("adminUser").roles("ADMIN"))
                .with(csrf()))  // Add CSRF token
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("Quantity cannot be negative."));
    }
    
    @Test
    void testProductCreationWithZeroPrice() throws Exception {
        mockMvc.perform(post("/api/products")
                .contentType(APPLICATION_JSON)
                .content("{\"name\": \"Product 1\", \"quantity\": 10, \"price\": 0, \"totalValue\": 0}")
                .with(SecurityMockMvcRequestPostProcessors.user("adminUser").roles("ADMIN"))
                .with(csrf()))  // Add CSRF token
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("Price must be greater than 0."));
    }
    
    @Test
    void testProductCreationWithInvalidTypeForPrice() throws Exception {
        when(productRepository.save(any(Product.class))).thenReturn(product1);
        mockMvc.perform(post("/api/products")
                .contentType(APPLICATION_JSON)
                .content("{\"name\": \"Product 1\", \"quantity\": 10, \"price\": \"notANumber\", \"totalValue\": 1000.0}")
                .with(SecurityMockMvcRequestPostProcessors.user("adminUser").roles("ADMIN"))
                .with(csrf()))  // Add CSRF token
            .andExpect(status().isBadRequest());
    }
    
}
