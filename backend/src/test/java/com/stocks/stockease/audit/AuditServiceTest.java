package com.stocks.stockease.audit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import com.stocks.stockease.audit.internal.ProductChangeLogRepository;

/** Tests that {@link AuditService} delegates each history lookup to the change log repository. */
@ExtendWith(MockitoExtension.class)
class AuditServiceTest {

    private ProductChangeLogRepository productChangeLogRepository;
    private AuditService auditService;

    @BeforeEach
    void setUp() {
        productChangeLogRepository = mock(ProductChangeLogRepository.class);
        auditService = new AuditService(productChangeLogRepository);
    }

    @Test
    void findChangesByUser_withEntries_returnsRepositoryResult() {
        ProductChangeLog entry = new ProductChangeLog();
        when(productChangeLogRepository.findByUserIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(entry));

        assertThat(auditService.findChangesByUser(1L)).containsExactly(entry);
    }

    @Test
    void findChangesByProduct_withEntries_returnsRepositoryResult() {
        ProductChangeLog entry = new ProductChangeLog();
        when(productChangeLogRepository.findByProductIdOrderByCreatedAtDesc(2L)).thenReturn(List.of(entry));

        assertThat(auditService.findChangesByProduct(2L)).containsExactly(entry);
    }
}
