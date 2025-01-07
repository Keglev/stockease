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

@Configuration
public class TestConfig {

    @Bean
    public JwtUtil jwtUtil() {
        // Create a mock of JwtUtil
        return Mockito.mock(JwtUtil.class);
    }

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

    @Bean
    public UserDetailsService userDetailsService() {
        // Create a mock of UserDetailsService
        return Mockito.mock(UserDetailsService.class);
    }

    @Bean
    public JwtFilter jwtFilter(JwtUtil jwtUtil, UserDetailsService userDetailsService) {
        // Inject mocked dependencies into JwtFilter
        return new JwtFilter(jwtUtil, userDetailsService);
    }
}
