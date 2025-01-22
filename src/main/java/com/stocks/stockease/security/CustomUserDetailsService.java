package com.stocks.stockease.security;

import java.util.Collections;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import com.stocks.stockease.model.User;
import com.stocks.stockease.repository.UserRepository;

/**
 * Custom implementation of {@link UserDetailsService} for Spring Security.
 * This class is used to load user-specific data during authentication.
 */
@Service
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    /**
     * Constructor for dependency injection.
     * 
     * @param userRepository the repository used to fetch user data from the database
     */
    @Autowired
    public CustomUserDetailsService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /**
     * Loads a user's details based on their username.
     * 
     * @param username the username of the user
     * @return a {@link UserDetails} object containing the user's information
     * @throws UsernameNotFoundException if the user with the specified username is not found
     */
    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        // Fetch the custom User entity from the database
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found with username: " + username));

        // Convert the User entity to Spring Security's UserDetails
        return new org.springframework.security.core.userdetails.User(
                    user.getUsername(),
                    user.getPassword(), // Password should be encoded
                    Collections.singletonList(new SimpleGrantedAuthority(user.getRole()))
        );
    }
}