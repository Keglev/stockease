package com.stocks.stockease.controller;

import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.stocks.stockease.model.User;
import com.stocks.stockease.repository.UserRepository;
import com.stocks.stockease.security.JwtUtil;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    private AuthenticationManager authenticationManager;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private UserRepository userRepository;

   @PostMapping("/login")
public ResponseEntity<Map<String, String>> login(@RequestBody Map<String, String> authRequest) {
    try {
        String username = authRequest.get("username");
        String password = authRequest.get("password");

        System.out.println("Attempting login for username: " + username);

        authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(username, password));

        // Dynamically fetch the role
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found with username: " + username));

                System.out.println("Login successful for username: " + username + " with role: " + user.getRole());

        String token = jwtUtil.generateToken(username, user.getRole());
        return ResponseEntity.ok(Map.of("token", token));
    } catch (AuthenticationException e) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Invalid credentials"));
    }
}

}
