package com.stocks.stockease.security;

import java.security.Key;
import java.util.Date;
import java.util.function.Function;

import org.springframework.stereotype.Component;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;

/**
 * Utility class for handling JWT operations, including token generation,
 * validation, and extraction of claims.
 */
@Component
public class JwtUtil {

    // Secret key for signing the JWT tokens (must be kept secure)
    private static final String SECRET_KEY = "your-secret-key-which-must-be-very-secure-and-long";

    // Expiration time for the token in milliseconds (10 hours)
    private static final long EXPIRATION_TIME = 1000 * 60 * 60 * 10;

    // Signing key derived from the secret key
    private final Key key = Keys.hmacShaKeyFor(SECRET_KEY.getBytes());

    /**
     * Generates a JWT token for the given username and role.
     * 
     * @param username the username to include in the token
     * @param role the role to include as a claim in the token
     * @return a signed JWT token as a String
     */
    public String generateToken(String username, String role) {
        return Jwts.builder()
                .setSubject(username)
                .claim("role", role)
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + EXPIRATION_TIME))
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    /**
     * Validates the given JWT token.
     * 
     * @param token the JWT token to validate
     * @return true if the token is valid, false otherwise
     */
    public boolean validateToken(String token) {
        try {
            Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(token);
            return true;
        } catch (JwtException e) {
            return false;
        }
    }

    /**
     * Extracts a specific claim from the token using the provided resolver function.
     * 
     * @param <T> the type of the claim to extract
     * @param token the JWT token
     * @param claimsResolver a function to resolve the desired claim from the Claims object
     * @return the extracted claim
     */
    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }

    /**
     * Extracts all claims from the token.
     * 
     * @param token the JWT token
     * @return a Claims object containing all claims from the token
     */
    private Claims extractAllClaims(String token) {
        return Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(token).getBody();
    }

    /**
     * Extracts the username (subject) from the token.
     * 
     * @param token the JWT token
     * @return the username as a String
     */
    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    /**
     * Extracts the role from the token.
     * 
     * @param token the JWT token
     * @return the role as a String
     */
    public String extractRole(String token) {
        return extractClaim(token, claims -> claims.get("role", String.class));
    }
}
