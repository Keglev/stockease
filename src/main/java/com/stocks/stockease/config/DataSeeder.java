package com.stocks.stockease.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import com.stocks.stockease.model.Product;
import com.stocks.stockease.model.User;
import com.stocks.stockease.repository.ProductRepository;
import com.stocks.stockease.repository.UserRepository;

import jakarta.annotation.PostConstruct;

/**
 * Component responsible for seeding initial data into the database.
 * This includes default users and products to ensure the application
 * has baseline data for functionality during development or testing.
 */
@Component
public class DataSeeder {

    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    /**
     * Constructor for injecting dependencies into the DataSeeder component.
     * 
     * @param productRepository the repository for managing product data
     * @param userRepository the repository for managing user data
     * @param passwordEncoder the password encoder for securing user passwords
     */
    @Autowired
    public DataSeeder(ProductRepository productRepository, UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.productRepository = productRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * Seeds the database with initial data for users and products.
     * This method is executed automatically after the bean initialization.
     */
    @PostConstruct
    public void seedData() {
        System.out.println("Seeding data...");

        // Seed Users if no users exist in the database
        if (userRepository.count() == 0) {
            userRepository.save(new User("admin", passwordEncoder.encode("admin123"), "ROLE_ADMIN"));
            userRepository.save(new User("user", passwordEncoder.encode("user123"), "ROLE_USER"));
        }

        // Seed Products if no products exist in the database
        if (productRepository.count() == 0) {
            productRepository.save(new Product("Product 1", 10, 50.0));
            productRepository.save(new Product("Product 2", 5, 30.0));
            productRepository.save(new Product("Product 3", 3, 20.0));
            productRepository.save(new Product("Product 4", 3, 10.0));
            productRepository.save(new Product("Product 5", 20, 40.0));
        }
    }
}
