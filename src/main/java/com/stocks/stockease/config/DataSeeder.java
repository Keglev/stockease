package com.stocks.stockease.config;

import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import com.stocks.stockease.model.Product;
import com.stocks.stockease.model.User;
import com.stocks.stockease.repository.ProductRepository;
import com.stocks.stockease.repository.UserRepository;

import jakarta.annotation.PostConstruct;

/**
 * Database seeder for development and test environments.
 * 
 * Purpose:
 * - Populates database with fixture data (users, products) on startup
 * - Enables API testing without manual setup
 * - Supports demo/PoC deployments with pre-loaded inventory
 * 
 * Lifecycle:
 * - Bean created during Spring startup
 * - @PostConstruct seedData() called after bean fully constructed
 * - Data inserted only if tables empty (idempotent via count checks)
 * 
 * Profile activation:
 * - @Profile("!prod"): Active in dev, test profiles; DISABLED in production
 * - Prevents accidental data seeding in prod environments
 * - Explicitly exclude with @Profile("prod") or spring.profiles.active=prod
 * 
 * Fixture data:
 * - Users: admin (ROLE_ADMIN), user (ROLE_USER) for testing role-based access
 * - Products: 5 sample products with name, quantity, price for CRUD testing
 * - Passwords: BCrypt-encoded (admin123, user123 for demo)
 * 
 * @author Team StockEase
 * @version 1.0
 * @since 2025-01-01
 */
@Component
@Profile("!prod")
public class DataSeeder {

    /**
     * Repository for Product entity persistence operations.
     */
    private final ProductRepository productRepository;

    /**
     * Repository for User entity persistence operations.
     */
    private final UserRepository userRepository;

    /**
     * Password encoder (BCrypt) for hashing user credentials before storage.
     */
    private final PasswordEncoder passwordEncoder;

    /**
     * Constructor for dependency injection via Spring constructor autowiring.
     * 
     * Spring automatically injects dependencies:
     * - No @Autowired needed on constructor (Spring 4.3+)
     * - Constructor injection preferred over field injection (immutability, testability)
     * 
     * @param productRepository repository for product data access
     * @param userRepository repository for user data access
     * @param passwordEncoder BCrypt encoder for credential hashing
     */
    public DataSeeder(ProductRepository productRepository, UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.productRepository = productRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * Initializes database with fixture data on bean creation.
     * 
     * Execution timing:
     * - Called by Spring after constructor completes (@PostConstruct)
     * - Before @RestController beans receive requests
     * - Runs once per application startup
     * 
     * Idempotency:
     * - Checks count() before inserting (prevents duplicates on restart)
     * - Safe to call multiple times (conditional inserts)
     * 
     * User fixtures:
     * - admin / admin123 → ROLE_ADMIN (can create, update, delete products)
     * - user / user123 → ROLE_USER (can read, update quantities only)
     * 
     * Product fixtures (name, quantity, price):
     * - Product 1: qty=10, price=50.0
     * - Product 2: qty=5, price=30.0
     * - Product 3: qty=3, price=20.0
     * - Product 4: qty=3, price=10.0
     * - Product 5: qty=20, price=40.0
     * 
     * Database state after seeding:
     * - 2 users in USER table (admin, user)
     * - 5 products in PRODUCT table (with timestamps)
     * - Ready for API testing: login → list products → CRUD operations
     */
    @PostConstruct
    public void seedData() {
        System.out.println("Seeding data...");

        // Seed users if database is empty (idempotent via count check)
        if (userRepository.count() == 0) {
            // Create ADMIN user: can perform all CRUD operations
            userRepository.save(new User("admin", passwordEncoder.encode("admin123"), "ROLE_ADMIN"));
            // Create regular USER: can read and update quantities only
            userRepository.save(new User("user", passwordEncoder.encode("user123"), "ROLE_USER"));
        }

        // Seed products if database is empty (idempotent via count check)
        if (productRepository.count() == 0) {
            // Sample inventory data for testing and demo purposes
            productRepository.save(new Product("Product 1", 10, 50.0));
            productRepository.save(new Product("Product 2", 5, 30.0));
            productRepository.save(new Product("Product 3", 3, 20.0));
            productRepository.save(new Product("Product 4", 3, 10.0));
            productRepository.save(new Product("Product 5", 20, 40.0));
        }
    }
}
