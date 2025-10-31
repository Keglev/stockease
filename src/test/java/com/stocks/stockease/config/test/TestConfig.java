package com.stocks.stockease.config.test;

import org.mockito.Mockito;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetailsService;

import com.stocks.stockease.security.JwtFilter;
import com.stocks.stockease.security.JwtUtil;

/**
 * Spring configuration for test environment with mock beans and test security context.
 * 
 * Purpose: Provide isolated test dependencies to prevent test pollution
 * - Mock beans: JwtUtil, UserDetailsService (no database/HTTP calls)
 * - Pre-configured SecurityContext: Test user with ROLE_ADMIN + ROLE_USER
 * - JwtFilter integration: Wired with mocked dependencies
 * 
 * Usage pattern (in @WebMvcTest):
 * ```
 * @Import(TestConfig.class)  // Loads all @Bean methods below
 * public class ProductControllerTest { ... }
 * ```
 * 
 * Dependency graph:
 * - jwtUtil() → mocked, returns null/default for all method calls
 * - userDetailsService() → mocked, enables JwtFilter instantiation
 * - securityContext() → pre-configured with test authentication
 * - jwtFilter(JwtUtil, UserDetailsService) → uses both mocks
 * 
 * Test isolation benefits:
 * - No Spring Security initialization required (mocked)
 * - No JWT token validation (mocked JwtUtil)
 * - No user lookups (mocked UserDetailsService)
 * - Tests run fast without external dependencies
 * 
 * Security context for tests:
 * - Username: "testUser"
 * - Roles: ["ROLE_ADMIN", "ROLE_USER"] (covers both admin + user scenarios)
 * - Password: "password" (irrelevant in mock)
 * 
 * @author Team StockEase
 * @version 1.0
 * @since 2025-01-01
 * @see JwtFilter (JWT validation filter)
 * @see JwtUtil (token generation/validation)
 * @see org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest (test framework)
 */
@Configuration
public class TestConfig {

    /**
     * Provides a mock {@link JwtUtil} bean for testing JWT operations.
     * 
     * Mock behavior:
     * - All methods return null/default (no-op mocking)
     * - Tests override specific methods via Mockito.when() in @BeforeEach
     * - Prevents real JWT token generation/validation during tests
     * 
     * Example usage in test:
     * ```
     * @Autowired JwtUtil jwtUtil;
     * @BeforeEach
     * void setup() {
     *   Mockito.when(jwtUtil.validateToken("token")).thenReturn(true);
     *   Mockito.when(jwtUtil.extractUsername("token")).thenReturn("testUser");
     * }
     * ```
     * 
     * @return mocked JwtUtil instance (no real JWT operations)
     */
    @Bean
    public JwtUtil jwtUtil() {
        return Mockito.mock(JwtUtil.class);
    }

    /**
     * Provides a pre-configured {@link SecurityContext} bean for test authentication.
     * 
     * Test user configuration:
     * - Username: "testUser" (default authentication name)
     * - Password: "password" (unused in mock, required by UsernamePasswordAuthenticationToken)
     * - Roles: ["ROLE_ADMIN", "ROLE_USER"] (covers both admin and user authorization paths)
     * 
     * Context usage:
     * - Stored in SecurityContextHolder (ThreadLocal, scoped to test thread)
     * - Retrieved by @PreAuthorize annotations during test execution
     * - Enables testing of role-based authorization (@PreAuthorize("hasRole('ADMIN')"))
     * 
     * Authorization scenarios covered:
     * - ADMIN-only operations: hasRole('ADMIN') → PASS (testUser has ROLE_ADMIN)
     * - USER-only operations: hasRole('USER') → PASS (testUser has ROLE_USER)
     * - Multiple roles: hasAnyRole('ADMIN','USER') → PASS
     * 
     * @return SecurityContext with testUser authenticated as ADMIN and USER
     */
    @Bean
    public SecurityContext securityContext() {
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(
                "testUser",
                "password",
                AuthorityUtils.createAuthorityList("ROLE_ADMIN", "ROLE_USER")
        ));
        System.out.println("Test SecurityContext initialized with roles: ROLE_ADMIN, ROLE_USER");
        return context;
    }

    /**
     * Provides a mock {@link UserDetailsService} bean for testing user lookups.
     * 
     * Mock behavior:
     * - All methods return null/default (no-op mocking)
     * - Tests override specific methods via Mockito.when() if needed
     * - Prevents database calls during test execution
     * 
     * Integration point:
     * - Required by JwtFilter constructor (dependency injection)
     * - Enables filter instantiation without real user repository
     * 
     * Test override example:
     * ```
     * @MockitoBean UserDetailsService userDetailsService;
     * @BeforeEach
     * void setup() {
     *   Mockito.when(userDetailsService.loadUserByUsername("admin"))
     *     .thenReturn(new User("admin", "password", ROLE_ADMIN));
     * }
     * ```
     * 
     * @return mocked UserDetailsService instance (no real user lookups)
     */
    @Bean
    public UserDetailsService userDetailsService() {
        return Mockito.mock(UserDetailsService.class);
    }

    /**
     * Provides a {@link JwtFilter} bean wired with mocked dependencies.
     * 
     * Dependency injection:
     * - JwtUtil (mocked): Prevents real JWT validation
     * - UserDetailsService (mocked): Prevents real user lookups
     * 
     * Filter behavior during tests:
     * - Constructor receives mocked dependencies (safe, no external calls)
     * - During test execution:
     *   * Extracts JWT from Authorization header
     *   * Calls mocked JwtUtil.validateToken() → returns what test stubs
     *   * Calls mocked UserDetailsService.loadUserByUsername() → returns null or test stub
     * 
     * Integration in SecurityFilterChain:
     * - Added via @Import(TestConfig.class) in @WebMvcTest
     * - Runs before each MockMvc.perform() request
     * - Tests control behavior via @BeforeEach setup
     * 
     * @param jwtUtil mocked JWT utility bean
     * @param userDetailsService mocked user service bean
     * @return JwtFilter instance ready for test execution
     */
    @Bean
    public JwtFilter jwtFilter(JwtUtil jwtUtil, UserDetailsService userDetailsService) {
        return new JwtFilter(jwtUtil, userDetailsService);
    }
}