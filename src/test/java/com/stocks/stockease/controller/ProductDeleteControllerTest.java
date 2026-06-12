package com.stocks.stockease.controller;

import java.util.Objects;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.lang.NonNull;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.stocks.stockease.config.test.TestConfig;
import com.stocks.stockease.repository.ProductRepository;

/** Slice tests for DELETE /api/products/{id} endpoint. */
@ExtendWith(MockitoExtension.class)
@WebMvcTest(ProductController.class)
@Import(TestConfig.class)
class ProductDeleteControllerTest {

    @MockitoBean
    private ProductRepository productRepository;

    @Autowired
    private MockMvc mockMvc;

    @SuppressWarnings("unused")
    @BeforeEach
    void setUpMocks() {
        Mockito.when(productRepository.existsById(1L)).thenReturn(true);
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void deleteProduct_asAdmin_returns200() throws Exception {
        mockMvc.perform(delete("/api/products/1").with(csrfToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Product with ID 1 has been successfully deleted."));

        Mockito.verify(productRepository, Mockito.times(1)).deleteById(1L);
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void deleteProduct_whenProductNotFound_returns404() throws Exception {
        Mockito.when(productRepository.existsById(1L)).thenReturn(false);

        mockMvc.perform(delete("/api/products/1").with(csrfToken()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Cannot delete. Product with ID 1 does not exist."));

        Mockito.verify(productRepository, Mockito.never()).deleteById(Mockito.anyLong());
    }

    @Test
    void deleteProduct_asUserRole_returns403() throws Exception {
        // @WithMockUser would inherit TestConfig's ROLE_ADMIN + ROLE_USER; manual setup isolates ROLE_USER only
        SecurityContext securityContext = SecurityContextHolder.createEmptyContext();
        securityContext.setAuthentication(new UsernamePasswordAuthenticationToken(
                "regularUser", "password", AuthorityUtils.createAuthorityList("ROLE_USER")));
        SecurityContextHolder.setContext(securityContext);

        mockMvc.perform(delete("/api/products/1"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").doesNotExist());
    }

    @NonNull
    private static RequestPostProcessor csrfToken() {
        return Objects.requireNonNull(csrf());
    }
}