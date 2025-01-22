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
 * Configuration class for test dependencies.
 * This class provides mock beans and pre-configured settings for testing purposes.
 */
@Configuration
public class TestConfig {

    /**
     * Provides a mock {@link JwtUtil} bean for testing.
     * 
     * @return a mocked instance of {@link JwtUtil}
     */
    @Bean
    public JwtUtil jwtUtil() {
        return Mockito.mock(JwtUtil.class);
    }

    /**
     * Provides a pre-configured {@link SecurityContext} bean for testing.
     * The context is initialized with a test user having roles "ROLE_ADMIN" and "ROLE_USER".
     * 
     * @return a pre-configured {@link SecurityContext}
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
     * Provides a mock {@link UserDetailsService} bean for testing.
     * 
     * @return a mocked instance of {@link UserDetailsService}
     */
    @Bean
    public UserDetailsService userDetailsService() {
        return Mockito.mock(UserDetailsService.class);
    }

    /**
     * Provides a {@link JwtFilter} bean configured with mocked dependencies for testing.
     * 
     * @param jwtUtil the mocked {@link JwtUtil}
     * @param userDetailsService the mocked {@link UserDetailsService}
     * @return a {@link JwtFilter} instance
     */
    @Bean
    public JwtFilter jwtFilter(JwtUtil jwtUtil, UserDetailsService userDetailsService) {
        return new JwtFilter(jwtUtil, userDetailsService);
    }
}