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

/** Test Spring configuration providing mock beans and a pre-authenticated SecurityContext. */
@Configuration
@SuppressWarnings("unused") // @Bean methods are invoked by Spring's CGLIB proxy at runtime
public class TestConfig {

    @Bean
    public JwtUtil jwtUtil() {
        return Mockito.mock(JwtUtil.class);
    }

    @Bean
    public UserDetailsService userDetailsService() {
        return Mockito.mock(UserDetailsService.class);
    }

    @Bean
    public JwtFilter jwtFilter(JwtUtil jwtUtil, UserDetailsService userDetailsService) {
        return new JwtFilter(jwtUtil, userDetailsService);
    }

    @Bean
    public SecurityContext securityContext() {
        // Both roles so tests cover ADMIN-only and USER-only @PreAuthorize paths without separate configs.
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(
                "testUser",
                "password",
                AuthorityUtils.createAuthorityList("ROLE_ADMIN", "ROLE_USER")
        ));
        return context;
    }
}
