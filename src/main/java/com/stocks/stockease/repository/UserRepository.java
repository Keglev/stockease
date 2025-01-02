package com.stocks.stockease.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.stocks.stockease.model.User;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User>findByUsername(String username);
}
