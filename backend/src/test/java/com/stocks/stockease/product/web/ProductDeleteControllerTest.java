package com.stocks.stockease.product.web;

import java.util.Objects;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.jspecify.annotations.NonNull;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.stocks.stockease.config.test.TestConfig;
import com.stocks.stockease.product.ProductService;
import com.stocks.stockease.security.User;
import com.stocks.stockease.security.UserService;

/** Slice tests for DELETE /api/products/{id} endpoint. */
@ExtendWith(MockitoExtension.class)
@WebMvcTest(ProductController.class)
@Import({TestConfig.class, ProductMethodSecurityTestConfig.class})
class ProductDeleteControllerTest {

    @MockitoBean
    private ProductService productService;

    @MockitoBean
    private UserService userService;

    @Autowired
    private MockMvc mockMvc;

    @SuppressWarnings("unused")
    @BeforeEach
    void setUpMocks() {
        Mockito.when(productService.deleteById(eq(1L), any(User.class))).thenReturn(true);
        Mockito.when(userService.findByUsername(Mockito.anyString()))
                .thenReturn(Optional.of(new User("testUser", "hash", "ROLE_ADMIN")));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void deleteProduct_asAdmin_returns200() throws Exception {
        mockMvc.perform(delete("/api/products/1").with(csrfToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Product with ID 1 has been successfully deleted."));

        Mockito.verify(productService, Mockito.times(1)).deleteById(eq(1L), any(User.class));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void deleteProduct_whenProductNotFound_returns404() throws Exception {
        Mockito.when(productService.deleteById(eq(1L), any(User.class))).thenReturn(false);

        mockMvc.perform(delete("/api/products/1").with(csrfToken()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Cannot delete. Product with ID 1 does not exist."));

        Mockito.verify(productService, Mockito.times(1)).deleteById(eq(1L), any(User.class));
    }

    @Test
    @WithMockUser(username = "regularUser", roles = {"USER"})
    void deleteProduct_asUserRole_returns403() throws Exception {
        // CSRF token is supplied deliberately: the 403 must come from @PreAuthorize("hasRole('ADMIN')")
        // and nothing else, so the admin-only rule is what this test actually proves
        mockMvc.perform(delete("/api/products/1").with(csrfToken()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").doesNotExist());

        Mockito.verify(productService, Mockito.never()).deleteById(anyLong(), any(User.class));
    }

    private static @NonNull RequestPostProcessor csrfToken() {
        return Objects.requireNonNull(csrf());
    }
}