package com.stocks.stockease.security;

import java.util.Collections;

import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import com.stocks.stockease.model.User;
import com.stocks.stockease.repository.UserRepository;

/**
 * UserDetailsService implementation that loads Spring Security user details from the database.
 * Converts the User domain model's role string into a GrantedAuthority for authorization.
 */
@Service
@org.springframework.context.annotation.Profile("!docs")
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    /**
     * Constructs the service with a user repository for data access.
     *
     * @param userRepository repository for user data access
     */
    public CustomUserDetailsService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /**
     * Loads a UserDetails instance by username, throwing UsernameNotFoundException if not found.
     *
     * @param username the username to look up
     * @return Spring Security UserDetails with username, password, and authorities
     * @throws UsernameNotFoundException if no user exists with the given username
     */
    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found with username: " + username));

        // Password is BCrypt-encoded in the database; AuthenticationManager hashes the submitted password before comparing
        return new org.springframework.security.core.userdetails.User(
                    user.getUsername(),
                    user.getPassword(),
                    Collections.singletonList(new SimpleGrantedAuthority(user.getRole()))
        );
    }
}
