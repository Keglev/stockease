package com.stocks.stockease.audit.web;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.stocks.stockease.audit.AuditService;
import com.stocks.stockease.audit.ChangeLogEntryResponse;
import com.stocks.stockease.audit.ChangedField;
import com.stocks.stockease.audit.ProductChangeLog;
import com.stocks.stockease.config.test.TestConfig;
import com.stocks.stockease.product.Product;
import com.stocks.stockease.security.User;

/** Slice tests for the change history endpoints under /api/audit. */
@ExtendWith(MockitoExtension.class)
@WebMvcTest(AuditController.class)
@Import({TestConfig.class, AuditMethodSecurityTestConfig.class})
class AuditControllerTest {

    private static final LocalDateTime CREATED_AT = LocalDateTime.of(2026, 1, 2, 3, 4);

    @MockitoBean
    private AuditService auditService;

    @Autowired
    private MockMvc mockMvc;

    @SuppressWarnings("unused") // invoked by JUnit via reflection, not by direct call
    @BeforeEach
    void setUpMocks() {
        // @MockitoBean stubs survive for the Spring context lifetime; explicit reset prevents state bleeding between tests
        Mockito.reset(auditService);
    }

    private static ProductChangeLog changeLog() {
        Product product = new Product("Widget", 10, 5.0);
        product.setId(3L);
        User user = new User("admin", "hash", "ROLE_ADMIN");
        user.setId(11L);
        return new ProductChangeLog(2L, product, user, ChangedField.NAME, "Old", "New", CREATED_AT);
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void getChangesByUser_withEntries_mapsAssociationsToIdentifiers() throws Exception {
        Mockito.when(auditService.findChangesByUser(11L)).thenReturn(List.of(changeLog()));

        mockMvc.perform(get("/api/audit/users/11/changes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(2))
                .andExpect(jsonPath("$[0].productId").value(3))
                .andExpect(jsonPath("$[0].userId").value(11))
                .andExpect(jsonPath("$[0].field").value("NAME"))
                .andExpect(jsonPath("$[0].oldValue").value("Old"))
                .andExpect(jsonPath("$[0].newValue").value("New"))
                .andExpect(jsonPath("$[0].createdAt").exists());

        Mockito.verify(auditService).findChangesByUser(11L);
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void getChangesByUser_summaryShape_omitsNestedEntities() throws Exception {
        Mockito.when(auditService.findChangesByUser(11L)).thenReturn(List.of(changeLog()));

        // the response must carry identifiers only; a nested object would mean the entity leaked out
        mockMvc.perform(get("/api/audit/users/11/changes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].product").doesNotExist())
                .andExpect(jsonPath("$[0].user").doesNotExist());
    }

    @Test
    @WithMockUser(username = "user", roles = {"USER"})
    void getChangesByUser_asUserRole_returns200() throws Exception {
        Mockito.when(auditService.findChangesByUser(11L)).thenReturn(List.of(changeLog()));

        mockMvc.perform(get("/api/audit/users/11/changes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(2));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void getChangesByUser_withNoEntries_returnsEmptyList() throws Exception {
        Mockito.when(auditService.findChangesByUser(11L)).thenReturn(List.of());

        mockMvc.perform(get("/api/audit/users/11/changes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$").isEmpty());
    }

    @Test
    void getChangesByUser_asAnonymous_returns401() throws Exception {
        mockMvc.perform(get("/api/audit/users/11/changes"))
                .andExpect(status().isUnauthorized());

        Mockito.verify(auditService, Mockito.never()).findChangesByUser(11L);
    }

    @Test
    @WithMockUser(username = "user", roles = {"USER"})
    void getChangesByProduct_withEntries_mapsAssociationsToIdentifiers() throws Exception {
        Mockito.when(auditService.findChangesByProduct(3L)).thenReturn(List.of(changeLog()));

        mockMvc.perform(get("/api/audit/products/3/changes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].productId").value(3))
                .andExpect(jsonPath("$[0].userId").value(11))
                .andExpect(jsonPath("$[0].field").value("NAME"));

        Mockito.verify(auditService).findChangesByProduct(3L);
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void getChangesByProduct_withNoEntries_returnsEmptyList() throws Exception {
        Mockito.when(auditService.findChangesByProduct(3L)).thenReturn(List.of());

        mockMvc.perform(get("/api/audit/products/3/changes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
    }

    @Test
    void getChangesByProduct_asAnonymous_returns401() throws Exception {
        mockMvc.perform(get("/api/audit/products/3/changes"))
                .andExpect(status().isUnauthorized());

        Mockito.verify(auditService, Mockito.never()).findChangesByProduct(3L);
    }

    private static ChangeLogEntryResponse entry() {
        return new ChangeLogEntryResponse(2L, 3L, "Widget", "SKU-3", false, "julia.brandt",
                ChangedField.NAME, "Old name", "New name", CREATED_AT);
    }

    @Test
    @WithMockUser(username = "user", roles = {"USER"})
    void getChanges_withEntries_returnsEnrichedRecordsDirectly() throws Exception {
        Mockito.when(auditService.findChanges(null, null)).thenReturn(List.of(entry()));

        mockMvc.perform(get("/api/audit/changes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].username").value("julia.brandt"))
                .andExpect(jsonPath("$[0].productName").value("Widget"))
                .andExpect(jsonPath("$[0].sku").value("SKU-3"))
                .andExpect(jsonPath("$[0].productDeleted").value(false))
                .andExpect(jsonPath("$[0].field").value("NAME"));

        Mockito.verify(auditService).findChanges(null, null);
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void getChanges_withPeriod_passesBothBoundsThrough() throws Exception {
        LocalDate from = LocalDate.of(2026, 1, 1);
        LocalDate to = LocalDate.of(2026, 3, 31);
        Mockito.when(auditService.findChanges(from, to)).thenReturn(List.of(entry()));

        mockMvc.perform(get("/api/audit/changes").param("from", "2026-01-01").param("to", "2026-03-31"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(2));

        Mockito.verify(auditService).findChanges(from, to);
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void getChanges_withOnlyTheStartBound_passesAnOpenEndedPeriodThrough() throws Exception {
        // one bound alone is always a valid period: the ordering check only applies once both exist
        LocalDate from = LocalDate.of(2026, 1, 1);
        Mockito.when(auditService.findChanges(from, null)).thenReturn(List.of(entry()));

        mockMvc.perform(get("/api/audit/changes").param("from", "2026-01-01"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(2));

        Mockito.verify(auditService).findChanges(from, null);
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void getChanges_withStartAfterEnd_returns400() throws Exception {
        mockMvc.perform(get("/api/audit/changes").param("from", "2026-03-31").param("to", "2026-01-01"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("The start of the period must not be after its end."));

        Mockito.verify(auditService, Mockito.never()).findChanges(Mockito.any(), Mockito.any());
    }

    @Test
    void getChanges_asAnonymous_returns401() throws Exception {
        mockMvc.perform(get("/api/audit/changes"))
                .andExpect(status().isUnauthorized());

        Mockito.verify(auditService, Mockito.never()).findChanges(Mockito.any(), Mockito.any());
    }
}
