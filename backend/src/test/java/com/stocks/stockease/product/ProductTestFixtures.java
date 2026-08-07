package com.stocks.stockease.product;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import java.time.LocalDateTime;

import org.mockito.ArgumentCaptor;
import org.springframework.context.ApplicationEventPublisher;

import com.stocks.stockease.product.internal.ProductRepository;
import com.stocks.stockease.security.User;

/*
 * Wiring shared by the four ProductService spec files: the repository and publisher the service
 * collaborates with, the service under test, and the acting user.
 *
 * It is one class rather than four copies because the four specs must disagree only about
 * behaviour. A collaborator wired differently in one file would read as a difference in the
 * service, which is the one thing these tests exist to measure.
 *
 * Out of scope: stubbing that only one group needs. Each spec arranges its own returns, so a
 * reader learns why a test passes without leaving the file it lives in.
 */
class ProductTestFixtures {

    final ProductRepository productRepository = mock(ProductRepository.class);
    final ApplicationEventPublisher eventPublisher = mock(ApplicationEventPublisher.class);

    final ProductService productService = new ProductService(productRepository, eventPublisher);

    final User user = new User("editor", "hash", "ROLE_ADMIN");

    /* A soft-deleted product as findDeletedById would return it. */
    static Product deletedProduct() {
        Product product = new Product("Widget", 10, 5.0);
        product.setId(1L);
        product.setSku("SKU-1");
        product.setDeletedAt(LocalDateTime.now());
        return product;
    }

    /* Captures the single event handed to the publisher. */
    ProductChangedEvent publishedEvent() {
        ArgumentCaptor<ProductChangedEvent> captor = ArgumentCaptor.forClass(ProductChangedEvent.class);
        verify(eventPublisher).publishEvent(captor.capture());
        return captor.getValue();
    }
}
