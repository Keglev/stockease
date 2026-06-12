package com.stocks.stockease.config;

import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import com.stocks.stockease.model.Product;
import com.stocks.stockease.model.User;
import com.stocks.stockease.repository.ProductRepository;
import com.stocks.stockease.repository.UserRepository;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;

/**
 * Populates the database with fixture users and products on startup.
 *
 * <p>Active in every profile except {@code prod}. All inserts are guarded by
 * {@code count()} checks so restarting the application never creates duplicates.
 *
 * <p>Fixture credentials: {@code admin / admin123} (ROLE_ADMIN),
 * {@code user / user123} (ROLE_USER).
 */
@Component
@Profile("!prod")
@RequiredArgsConstructor
public class DataSeeder {

    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    /**
     * Seeds fixture users and products once, immediately after the bean is constructed.
     *
     * <p>Fixture users match the roles described in this class's Javadoc.
     * Fixture products cover the full range of CRUD scenarios exercised in
     * {@code docs/api/paths/products.yaml}.
     */
    @PostConstruct
    public void seedData() {
        System.out.println("Seeding data...");

        if (userRepository.count() == 0) {
            userRepository.save(new User("admin", passwordEncoder.encode("admin123"), "ROLE_ADMIN"));
            userRepository.save(new User("user", passwordEncoder.encode("user123"), "ROLE_USER"));
        }

        if (productRepository.count() == 0) {
            productRepository.save(new Product("Product 1", 10, 50.0));
            productRepository.save(new Product("Product 2", 5, 30.0));
            productRepository.save(new Product("Product 3", 3, 20.0));
            productRepository.save(new Product("Product 4", 3, 10.0));
            productRepository.save(new Product("Product 5", 20, 40.0));
        }
    }
}
