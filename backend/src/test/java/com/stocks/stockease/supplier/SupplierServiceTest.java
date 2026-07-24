package com.stocks.stockease.supplier;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import com.stocks.stockease.supplier.internal.SupplierRepository;

import jakarta.persistence.EntityNotFoundException;

/** Tests for {@link SupplierService} covering CRUD validation and the deletion event. */
@ExtendWith(MockitoExtension.class)
class SupplierServiceTest {

    private SupplierRepository supplierRepository;
    private ApplicationEventPublisher eventPublisher;
    private SupplierService supplierService;

    @BeforeEach
    void setUp() {
        supplierRepository = mock(SupplierRepository.class);
        eventPublisher = mock(ApplicationEventPublisher.class);
        supplierService = new SupplierService(supplierRepository, eventPublisher);
    }

    private static Supplier supplier(long id, String name) {
        Supplier supplier = new Supplier();
        supplier.setId(id);
        supplier.setName(name);
        supplier.setAddress("1 Main St");
        return supplier;
    }

    @Test
    void findAll_withSuppliers_returnsRepositoryResult() {
        Supplier supplier = supplier(1L, "Acme");
        when(supplierRepository.findAll()).thenReturn(List.of(supplier));

        assertThat(supplierService.findAll()).containsExactly(supplier);
    }

    @Test
    void findById_withExistingId_returnsSupplier() {
        Supplier supplier = supplier(1L, "Acme");
        when(supplierRepository.findById(1L)).thenReturn(Optional.of(supplier));

        assertThat(supplierService.findById(1L)).contains(supplier);
    }

    @Test
    void create_withValidFields_savesAndReturnsSupplier() {
        when(supplierRepository.save(any(Supplier.class))).thenAnswer(call -> call.getArgument(0));

        Supplier result = supplierService.create("Acme", "1 Main St");

        assertThat(result.getName()).isEqualTo("Acme");
        assertThat(result.getAddress()).isEqualTo("1 Main St");
    }

    @Test
    void create_withBlankName_throwsIllegalArgumentException() {
        assertThatThrownBy(() -> supplierService.create("  ", "1 Main St"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Supplier name and address are required.");
        verify(supplierRepository, never()).save(any(Supplier.class));
    }

    @Test
    void create_withBlankAddress_throwsIllegalArgumentException() {
        assertThatThrownBy(() -> supplierService.create("Acme", null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Supplier name and address are required.");
    }

    @Test
    void update_withExistingId_updatesBothFields() {
        Supplier supplier = supplier(1L, "Acme");
        when(supplierRepository.findById(1L)).thenReturn(Optional.of(supplier));
        when(supplierRepository.save(supplier)).thenReturn(supplier);

        Supplier result = supplierService.update(1L, "Acme Two", "2 Side St");

        assertThat(result.getName()).isEqualTo("Acme Two");
        assertThat(result.getAddress()).isEqualTo("2 Side St");
    }

    @Test
    void update_withMissingId_throwsEntityNotFoundException() {
        when(supplierRepository.findById(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> supplierService.update(1L, "Acme", "1 Main St"))
                .isInstanceOf(EntityNotFoundException.class)
                .hasMessage("Supplier with ID 1 not found.");
    }

    @Test
    void update_withBlankName_throwsIllegalArgumentException() {
        Supplier supplier = supplier(1L, "Acme");
        when(supplierRepository.findById(1L)).thenReturn(Optional.of(supplier));

        assertThatThrownBy(() -> supplierService.update(1L, "", "1 Main St"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Supplier name and address are required.");
    }

    @Test
    void deleteById_withExistingId_publishesEventThenDeletes() {
        Supplier supplier = supplier(1L, "Acme");
        when(supplierRepository.findById(1L)).thenReturn(Optional.of(supplier));

        supplierService.deleteById(1L);

        ArgumentCaptor<SupplierDeletedEvent> captor = ArgumentCaptor.forClass(SupplierDeletedEvent.class);
        verify(eventPublisher).publishEvent(captor.capture());
        assertThat(captor.getValue().supplierId()).isEqualTo(1L);
        assertThat(captor.getValue().supplierName()).isEqualTo("Acme");
        verify(supplierRepository).delete(supplier);
    }

    @Test
    void deleteById_withMissingId_throwsEntityNotFoundException() {
        when(supplierRepository.findById(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> supplierService.deleteById(1L))
                .isInstanceOf(EntityNotFoundException.class)
                .hasMessage("Supplier with ID 1 not found.");
        verify(eventPublisher, never()).publishEvent(any(SupplierDeletedEvent.class));
    }
}
