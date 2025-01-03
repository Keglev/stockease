package com.stocks.stockease.controller;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.stocks.stockease.repository.ProductRepository;

@ExtendWith(MockitoExtension.class)
@WebMvcTest(ProductController.class)
public class ProductDeleteControllerTest {

    @Mock
    private ProductRepository productRepository;

    @Autowired
    private MockMvc mockMvc;

    @Test
    void testDeleteProduct() throws Exception {
        when(productRepository.existsById(1L)).thenReturn(true);

        mockMvc.perform(delete("/api/products/1"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.message").value("Product with ID 1 has been successfully deleted."));
    }

    @Test
    void testDeleteNonexistentProduct() throws Exception {
        when(productRepository.existsById(99L)).thenReturn(false);

        mockMvc.perform(delete("/api/products/99"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.message").value("Cannot delete. Product with ID 99 does not exist."));
    }
}
