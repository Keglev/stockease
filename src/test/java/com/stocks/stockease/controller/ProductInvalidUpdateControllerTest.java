// All tests passed

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
public class ProductInvalidUpdateControllerTest {

    @Autowired
    private MockMvc mockMvc;
    
    @Autowired
    private JwtUtil jwtUtil;

    @MockitoBean
    private ProductRepository productRepository;

    private Product product1;

    @BeforeEach
    @SuppressWarnings("unused")
    void setUpJwtMock() {
        // Mock JwtUtil behavior for consistent authorization
        Mockito.when(jwtUtil.validateToken(Mockito.anyString())).thenReturn(true);
        Mockito.when(jwtUtil.extractUsername(Mockito.anyString())).thenReturn("testUser");
        product1 = new Product("Product 1", 10, 100.0);
        product1.setId(1L);
        product1.setTotalValue(1000.0); // Mock total value
        Mockito.reset(productRepository); // Reset repository mock to avoid interference between tests
    }

    @ParameterizedTest
    @CsvSource({
        "adminUser, ADMIN",
        "regularUser, USER"
    })
    void testUpdateQuantityMissingField(String username, String role) throws Exception {

        // Mock repository behavior
        when(productRepository.findById(1L)).thenReturn(Optional.of(product1));
        when(productRepository.save(any(Product.class))).thenReturn(product1);

        // Perform the PUT request
        mockMvc.perform(put("/api/products/1/quantity")
                .contentType(APPLICATION_JSON)
                .with(SecurityMockMvcRequestPostProcessors.user(username).roles(role))
                .with(csrf())  // Add CSRF token
                .content("{}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("Quantity field is missing or null."));
    }

    @ParameterizedTest
    @CsvSource({
        "adminUser, ADMIN",
        "regularUser, USER"
    })
    void testUpdateQuantityInvalidType(String username, String role) throws Exception {

        // Mock repository behavior
        when(productRepository.findById(1L)).thenReturn(Optional.of(product1));

        // Perform the PUT request
        mockMvc.perform(put("/api/products/1/quantity")
                .contentType(APPLICATION_JSON)
                .with(SecurityMockMvcRequestPostProcessors.user(username).roles(role))
                .with(csrf())  // Add CSRF token
                .content("{\"quantity\": \"notAnInteger\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("Quantity must be a valid integer."));
    }


    @ParameterizedTest
    @CsvSource({
        "adminUser, ADMIN",
        "regularUser, USER"
    })
    void testUpdatePriceNegativeValue(String username, String role) throws Exception {

          // Mock repository behavior
          when(productRepository.findById(1L)).thenReturn(Optional.of(product1));
          when(productRepository.save(any(Product.class))).thenReturn(product1);

        // Perform the PUT request
        mockMvc.perform(put("/api/products/1/price")
                .contentType(APPLICATION_JSON)
                .with(SecurityMockMvcRequestPostProcessors.user(username).roles(role))
                .with(csrf())  // Add CSRF token
                .content("{\"price\": -10.0}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("Price must be greater than 0."));
    }

    @ParameterizedTest
    @CsvSource({
        "adminUser, ADMIN",
        "regularUser, USER"
    })
    void testUpdatePriceInvalidType(String username, String role) throws Exception {

        // Mock repository behavior
        when(productRepository.findById(1L)).thenReturn(Optional.of(product1));

        // Perform the PUT request
        mockMvc.perform(put("/api/products/1/price")
                .contentType(APPLICATION_JSON)
                .with(SecurityMockMvcRequestPostProcessors.user(username).roles(role))
                .with(csrf())  // Add CSRF token
                .content("{\"price\": \"notANumber\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("Price must be a valid number."));
    }

    @ParameterizedTest
    @CsvSource({
        "adminUser, ADMIN",
        "regularUser, USER"
    })
    void testUpdatePriceZeroValue(String username, String role) throws Exception {

        // Mock repository behavior
        when(productRepository.findById(1L)).thenReturn(Optional.of(product1));

        // Perform the PUT request
        mockMvc.perform(put("/api/products/1/price")
                .contentType(APPLICATION_JSON)
                .with(SecurityMockMvcRequestPostProcessors.user(username).roles(role))
                .with(csrf())  // Add CSRF token
                .content("{\"price\": 0}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("Price must be greater than 0."));
    }


    @ParameterizedTest
    @CsvSource({
    "adminUser, ADMIN",
    "regularUser, USER"
    })
    void testUpdateNameWhitespaceOnly(String username, String role) throws Exception {

        // Mock repository behavior
        when(productRepository.findById(1L)).thenReturn(Optional.of(product1));

        // Perform the PUT request
        mockMvc.perform(put("/api/products/1/name")
                .contentType(APPLICATION_JSON)
                .with(SecurityMockMvcRequestPostProcessors.user(username).roles(role))
                .with(csrf())  // Add CSRF token
                .content("{\"name\": \"   \"}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("Name is required and cannot be empty."));
    }

    @ParameterizedTest
    @CsvSource({
        "adminUser, ADMIN",
        "regularUser, USER"
    })
    void testUpdateNonexistentProduct(String username, String role) throws Exception {

        // Mock repository behavior for nonexistent product
        when(productRepository.findById(999L)).thenReturn(Optional.empty());

        // Perform the PUT request
        mockMvc.perform(put("/api/products/999/quantity")
                .contentType(APPLICATION_JSON)
                .with(SecurityMockMvcRequestPostProcessors.user(username).roles(role))
                .with(csrf())  // Add CSRF token
                .content("{\"quantity\": 10}"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.message").value("Product not found."));
    }

    @ParameterizedTest
    @CsvSource({
        "adminUser, ADMIN",
        "regularUser, USER"
    })
    void testUpdateWithoutCsrfToken(String username, String role) throws Exception {

        // Mock repository behavior
        when(productRepository.findById(1L)).thenReturn(Optional.of(product1));

        // Perform the PUT request without CSRF token
        mockMvc.perform(put("/api/products/1/quantity")
                .contentType(APPLICATION_JSON)
                .with(SecurityMockMvcRequestPostProcessors.user(username).roles(role))
                .content("{\"quantity\": 10}"))
            .andExpect(status().isForbidden());
    }
}
