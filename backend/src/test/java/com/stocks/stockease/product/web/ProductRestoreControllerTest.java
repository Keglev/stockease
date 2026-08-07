package com.stocks.stockease.product.web;

import java.math.BigDecimal;
import java.util.List;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.stocks.stockease.config.test.TestConfig;
import com.stocks.stockease.product.Product;
import com.stocks.stockease.product.ProductService;
import com.stocks.stockease.security.User;
import com.stocks.stockease.security.UserService;
import com.stocks.stockease.shared.DuplicateResourceException;

import jakarta.persistence.EntityNotFoundException;

/** Slice tests for the ADMIN-only deleted listing and restore endpoints. */
@ExtendWith(MockitoExtension.class)
@WebMvcTest(ProductController.class)
@Import({TestConfig.class, ProductMethodSecurityTestConfig.class})
class ProductRestoreControllerTest {

    @MockitoBean
    private ProductService productService;

    @MockitoBean
    private UserService userService;

    @Autowired
    private MockMvc mockMvc;

    @SuppressWarnings("unused") // invoked by JUnit via reflection, not by direct call
    @BeforeEach
    void setUpMocks() {
        Mockito.when(userService.findByUsername(Mockito.anyString()))
                .thenReturn(Optional.of(new User("testUser", "hash", "ROLE_ADMIN")));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void getDeletedProducts_asAdmin_returns200WithTheDeletedProducts() throws Exception {
        Mockito.when(productService.getDeletedProducts()).thenReturn(List.of(product(7L, "Anodized Bracket")));

        mockMvc.perform(get("/api/products/deleted"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Deleted products fetched successfully"))
                .andExpect(jsonPath("$.data[0].id").value(7))
                .andExpect(jsonPath("$.data[0].name").value("Anodized Bracket"));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void getDeletedProducts_withEmptyBin_returns200WithEmptyArray() throws Exception {
        // an empty recycle bin is a successful empty list, never a 404
        Mockito.when(productService.getDeletedProducts()).thenReturn(List.of());

        mockMvc.perform(get("/api/products/deleted"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data").isEmpty());
    }

    @Test
    @WithMockUser(username = "regularUser", roles = {"USER"})
    void getDeletedProducts_asUserRole_returns403() throws Exception {
        mockMvc.perform(get("/api/products/deleted"))
                .andExpect(status().isForbidden());

        Mockito.verify(productService, Mockito.never()).getDeletedProducts();
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void restoreProduct_asAdmin_returns200WithTheRestoredProduct() throws Exception {
        Mockito.when(productService.restore(eq(1L), any(User.class))).thenReturn(product(1L, "Laptop"));

        mockMvc.perform(post("/api/products/1/restore").with(csrfToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Product restored successfully"))
                .andExpect(jsonPath("$.data.id").value(1))
                .andExpect(jsonPath("$.data.name").value("Laptop"));

        Mockito.verify(productService, Mockito.times(1)).restore(eq(1L), any(User.class));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void restoreProduct_whenNoSoftDeletedProduct_returns404() throws Exception {
        // covers both the unknown ID and the already-live product: neither can be restored
        Mockito.when(productService.restore(eq(999L), any(User.class)))
                .thenThrow(new EntityNotFoundException("No soft-deleted product with ID 999 found."));

        mockMvc.perform(post("/api/products/999/restore").with(csrfToken()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message")
                        .value("Entity not found: No soft-deleted product with ID 999 found."));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void restoreProduct_whenLiveProductHoldsTheName_returns409() throws Exception {
        Mockito.when(productService.restore(eq(1L), any(User.class))).thenThrow(
                new DuplicateResourceException("Cannot restore: a live product named 'Laptop' already exists."));

        mockMvc.perform(post("/api/products/1/restore").with(csrfToken()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message")
                        .value("Cannot restore: a live product named 'Laptop' already exists."));
    }

    @Test
    @WithMockUser(username = "regularUser", roles = {"USER"})
    void restoreProduct_asUserRole_returns403() throws Exception {
        // CSRF token is supplied deliberately: the 403 must come from @PreAuthorize("hasRole('ADMIN')")
        mockMvc.perform(post("/api/products/1/restore").with(csrfToken()))
                .andExpect(status().isForbidden());

        Mockito.verify(productService, Mockito.never()).restore(anyLong(), any(User.class));
    }

    private static Product product(long id, String name) {
        Product product = new Product(name, 4, 39.00);
        product.setId(id);
        product.setSku("SKU-A1B2C3D4");
        product.setPurchasePrice(BigDecimal.valueOf(39.00));
        return product;
    }

    private static @NonNull RequestPostProcessor csrfToken() {
        return Objects.requireNonNull(csrf());
    }
}
