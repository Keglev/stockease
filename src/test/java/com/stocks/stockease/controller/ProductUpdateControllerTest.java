// all Tests sucessfull passed
package com.stocks.stockease.controller;

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
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.stocks.stockease.config.test.TestConfig;
import com.stocks.stockease.model.Product;
import com.stocks.stockease.repository.ProductRepository;
import com.stocks.stockease.security.JwtUtil;

@ExtendWith(MockitoExtension.class)
@WebMvcTest(ProductController.class)
@Import(TestConfig.class) // Use TestConfig to handle authorization
public class ProductUpdateControllerTest {

    @MockitoBean
    private ProductRepository productRepository;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtUtil jwtUtil;

    @BeforeEach
    @SuppressWarnings("unused")
    void setUpJwtMock() {
        // Mock JwtUtil behavior for consistent authorization
        Mockito.when(jwtUtil.validateToken(Mockito.anyString())).thenReturn(true);
        Mockito.when(jwtUtil.extractUsername(Mockito.anyString())).thenReturn("testUser");
        Mockito.reset(productRepository); // Reset repository mock to avoid interference between tests
    }

    @ParameterizedTest
    @CsvSource({
        "adminUser, ADMIN",
        "regularUser, USER"
    })
    void testUpdateQuantityWithRoles(String username, String role) throws Exception {
        Product product = new Product("Product 1", 10, 100.0);
        product.setId(1L);

        // Mock repository behavior
        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(productRepository.save(any(Product.class))).thenReturn(product);

        // Perform the PUT request to update quantity
        mockMvc.perform(put("/api/products/1/quantity")
                .contentType(APPLICATION_JSON)
                .with(SecurityMockMvcRequestPostProcessors.user(username).roles(role))
                .with(csrf())  // Add CSRF token
                .content("{\"quantity\": 50}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.message").value("Quantity updated successfully"))
            .andExpect(jsonPath("$.data.quantity").value(50));
    }

    @ParameterizedTest
    @CsvSource({
        "adminUser, ADMIN",
        "regularUser, USER"
    })
    void testUpdatePriceWithRoles(String username, String role) throws Exception {
        Product product = new Product("Product 1", 10, 100.0);
        product.setId(1L);

        // Mock repository behavior
        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(productRepository.save(any(Product.class))).thenReturn(product);

        // Perform the PUT request to update price
        mockMvc.perform(put("/api/products/1/price")
                .contentType(APPLICATION_JSON)
                .with(SecurityMockMvcRequestPostProcessors.user(username).roles(role))
                .with(csrf())  // Add CSRF token
                .content("{\"price\": 150.0}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.message").value("Price updated successfully"));
    }

    @ParameterizedTest
    @CsvSource({
        "adminUser, ADMIN",
        "regularUser, USER"
    })
    void testUpdateNameWithSpecialCharacters(String username, String role) throws Exception {
        Product product = new Product("Product 1", 10, 100.0);
        product.setId(1L);

        // Mock repository behavior
        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(productRepository.save(any(Product.class))).thenReturn(product);

        // Perform the PUT request to update name with special characters
        mockMvc.perform(put("/api/products/1/name")
                .contentType(APPLICATION_JSON)
                .with(SecurityMockMvcRequestPostProcessors.user(username).roles(role))
                .with(csrf())  // Add CSRF token
                .content("{\"name\": \"Updated!@#$%\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.message").value("Name updated successfully"))
            .andExpect(jsonPath("$.data.name").value("Updated!@#$%"));
    }
}
