package com.stocks.stockease.controller;

import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.stocks.stockease.model.Product;
import com.stocks.stockease.repository.ProductRepository;

@ExtendWith(MockitoExtension.class)
@WebMvcTest(ProductController.class)
public class ProductUpdateControllerTest {

    @Mock
    private ProductRepository productRepository;

    @Autowired
    private MockMvc mockMvc;

    @Test
    void testUpdateQuantity() throws Exception {
        Product product = new Product("Product 1", 10, 100.0);
        product.setId(1L);

        when(productRepository.findById(1L)).thenReturn(Optional.of(product));

        mockMvc.perform(put("/api/products/1/quantity")
                .contentType(APPLICATION_JSON)
                .content("{\"quantity\": 20}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.message").value("Quantity updated successfully"));
    }

    @Test
    void testUpdatePrice() throws Exception {
        Product product = new Product("Product 1", 10, 100.0);
        product.setId(1L);

        when(productRepository.findById(1L)).thenReturn(Optional.of(product));

        mockMvc.perform(put("/api/products/1/price")
                .contentType(APPLICATION_JSON)
                .content("{\"price\": 150.0}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.message").value("Price updated successfully"));
    }

    @Test
    void testUpdateName() throws Exception {
        Product product = new Product("Product 1", 10, 100.0);
        product.setId(1L);

        when(productRepository.findById(1L)).thenReturn(Optional.of(product));

        mockMvc.perform(put("/api/products/1/name")
                .contentType(APPLICATION_JSON)
                .content("{\"name\": \"Updated Product\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.message").value("Name updated successfully"));
    }
}
