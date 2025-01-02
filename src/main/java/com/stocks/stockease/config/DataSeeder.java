package com.stocks.stockease.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import com.stocks.stockease.model.Product;
import com.stocks.stockease.model.User;
import com.stocks.stockease.repository.ProductRepository;
import com.stocks.stockease.repository.UserRepository;

import jakarta.annotation.PostConstruct;

@Component
public class DataSeeder {

    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder; // Add PasswordEncoder

    @Autowired
    public DataSeeder(ProductRepository productRepository, UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.productRepository = productRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @PostConstruct
    public void seedData() {
         System.out.println("Seeding data...");
        // Seed Users
        if (userRepository.count() == 0) {
            userRepository.save(new User("admin", passwordEncoder.encode("admin123"), "ROLE_ADMIN"));
            userRepository.save(new User("user", passwordEncoder.encode("user123"), "ROLE_USER"));
        }

        // Seed Products
        if (productRepository.count() == 0) {
            productRepository.save(new Product("Product 1", 10, 50.0));
            productRepository.save(new Product("Product 2", 5, 30.0));
            productRepository.save(new Product("Product 3", 3, 20.0));
        }
    }
}

