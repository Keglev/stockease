package com.stocks.stockease.controller;

import java.util.Arrays;
import java.util.Optional;

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
public class ProductFetchControllerTest {

    @Mock
    private ProductRepository productRepository;

    @Autowired
    private MockMvc mockMvc;

    @Test
    void testGetAllProducts() throws Exception {
        Product product1 = new Product("Product 1", 10, 100.0);
        product1.setId(1L);

        Product product2 = new Product("Product 2", 5, 50.0);
        product2.setId(2L);

        when(productRepository.findAllOrderById()).thenReturn(Arrays.asList(product1, product2));

        mockMvc.perform(get("/api/products"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].name").value("Product 1"))
            .andExpect(jsonPath("$[1].name").value("Product 2"));
    }

    @Test
    void testGetProductById() throws Exception {
        Product product = new Product("Product 1", 10, 100.0);
        product.setId(1L);

        when(productRepository.findById(1L)).thenReturn(Optional.of(product));

        mockMvc.perform(get("/api/products/1"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.name").value("Product 1"));
    }
}
