package com.stocks.stockease.controller;

import java.util.Arrays;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.stocks.stockease.model.Product;
import com.stocks.stockease.repository.ProductRepository;

@ExtendWith(MockitoExtension.class)
@WebMvcTest(ProductController.class)
public class ProductControllerTest {

    @Mock
    private ProductRepository productRepository;

    @Autowired
    private MockMvc mockMvc;

    @Test
    void testLowStockProducts() throws Exception {
        Product product1 = new Product("Low Stock Product 1", 3, 50.0);
        product1.setId(1L);

        Product product2 = new Product("Low Stock Product 2", 2, 30.0);
        product2.setId(2L);

        when(productRepository.findByQuantityLessThan(5)).thenReturn(Arrays.asList(product1, product2));

        mockMvc.perform(get("/api/products/low-stock"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].name").value("Low Stock Product 1"))
            .andExpect(jsonPath("$[1].name").value("Low Stock Product 2"));
    }

    @Test
    void testLowStockProductsEmpty() throws Exception {
        when(productRepository.findByQuantityLessThan(5)).thenReturn(List.of());

        mockMvc.perform(get("/api/products/low-stock"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.message").value("All products are sufficiently stocked."));
    }

    @Test
    void testSearchProducts() throws Exception {
        Product product = new Product("Searchable Product", 10, 100.0);
        product.setId(1L);

        when(productRepository.findByNameContainingIgnoreCase("searchable"))
            .thenReturn(List.of(product));

        mockMvc.perform(get("/api/products/search")
                .param("name", "searchable"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].name").value("Searchable Product"));
    }

    @Test
    void testSearchProductsEmpty() throws Exception {
        when(productRepository.findByNameContainingIgnoreCase("nonexistent"))
            .thenReturn(List.of());

        mockMvc.perform(get("/api/products/search")
                .param("name", "nonexistent"))
            .andExpect(status().isNoContent())
            .andExpect(jsonPath("$.message").doesNotExist());
    }
}
