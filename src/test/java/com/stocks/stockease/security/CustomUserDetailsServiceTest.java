package com.stocks.stockease.security;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

import com.stocks.stockease.model.User;
import com.stocks.stockease.repository.UserRepository;

/**
 * Tests for {@link CustomUserDetailsService} covering user lookup, authority mapping, and not-found behavior.
 */
@ExtendWith(MockitoExtension.class)
class CustomUserDetailsServiceTest {

    @Mock
    private UserRepository userRepository;

    private CustomUserDetailsService userDetailsService;

    @SuppressWarnings("unused") // invoked by JUnit via reflection, not by direct call
    @BeforeEach
    void setUp() {
        userDetailsService = new CustomUserDetailsService(userRepository);
    }

    @Test
    void loadUserByUsername_withExistingUser_returnsUserDetailsWithCorrectFields() {
        User user = new User(1L, "alice", "$2a$10$hashedPassword", "ROLE_USER");
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));

        UserDetails result = userDetailsService.loadUserByUsername("alice");

        assertThat(result.getUsername()).isEqualTo("alice");
        assertThat(result.getPassword()).isEqualTo("$2a$10$hashedPassword");
        assertThat(result.getAuthorities())
                .extracting("authority")
                .containsExactly("ROLE_USER");
    }

    @Test
    void loadUserByUsername_withAdminUser_returnsAdminAuthority() {
        User admin = new User(2L, "bob", "$2a$10$adminHashedPassword", "ROLE_ADMIN");
        when(userRepository.findByUsername("bob")).thenReturn(Optional.of(admin));

        UserDetails result = userDetailsService.loadUserByUsername("bob");

        assertThat(result.getAuthorities())
                .extracting("authority")
                .containsExactly("ROLE_ADMIN");
    }

    @Test
    void loadUserByUsername_withUnknownUsername_throwsUsernameNotFoundException() {
        when(userRepository.findByUsername("ghost")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userDetailsService.loadUserByUsername("ghost"))
                .isInstanceOf(UsernameNotFoundException.class)
                .hasMessageContaining("ghost");
    }
}
