package com.stocks.stockease.security;

import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.stocks.stockease.security.internal.UserRepository;

import lombok.RequiredArgsConstructor;

/**
 * Security module's public API for looking up users.
 * Other modules depend on this service rather than reaching into the module's repository.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserService {

    private final UserRepository userRepository;

    /**
     * Finds a user by their unique username.
     *
     * @param username login name to look up
     * @return the user, or empty if no account carries that username
     */
    public Optional<User> findByUsername(String username) {
        return userRepository.findByUsername(username);
    }
}
