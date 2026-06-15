package com.stocks.stockease.config;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.stocks.stockease.repository.ProductRepository;
import com.stocks.stockease.repository.UserRepository;

/**
 * Tests for {@link DataSeeder} covering the idempotency guards that skip re-seeding when data already exists.
 */
@ExtendWith(MockitoExtension.class)
class DataSeederTest {

    @Mock
    private ProductRepository productRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    private DataSeeder dataSeeder;

    @SuppressWarnings("unused") // invoked by JUnit via reflection, not by direct call
    @BeforeEach
    void setUp() {
        dataSeeder = new DataSeeder(productRepository, userRepository, passwordEncoder);
    }

    @Test
    void seedData_whenUsersAndProductsAlreadyExist_skipsAllInsertions() {
        // Both repositories already have rows — the count() == 0 guards must be false
        when(userRepository.count()).thenReturn(2L);
        when(productRepository.count()).thenReturn(5L);

        dataSeeder.seedData();

        verify(userRepository, never()).save(any());
        verify(productRepository, never()).save(any());
    }
}
