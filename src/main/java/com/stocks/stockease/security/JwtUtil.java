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
 * Handles JWT token generation, validation, and claims extraction.
 * Uses HMAC-SHA256 signing with a 10-hour expiration window.
 */
@Component
public class JwtUtil {

    /**
     * SECURITY: In production, move to environment variables or a secure vault;
     * must be at least 256 bits for HS256.
     */
    private static final String SECRET_KEY = "your-secret-key-which-must-be-very-secure-and-long";

    private static final long EXPIRATION_TIME = 1000 * 60 * 60 * 10;

    private final Key key = Keys.hmacShaKeyFor(SECRET_KEY.getBytes());

    /**
     * Generates a signed JWT with username as the subject and role as a custom claim.
     *
     * @param username authenticated user's username (becomes JWT "sub" claim)
     * @param role user's authorization role (custom "role" claim)
     * @return compact signed JWT string
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
     * Validates a JWT token's signature and expiration, returning false on any failure.
     *
     * @param token JWT string to validate
     * @return true if valid and unexpired, false otherwise
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
     * Extracts a single claim from the token using the provided resolver function.
     *
     * @param token JWT string
     * @param claimsResolver function to extract the desired claim
     * @return extracted claim value
     */
    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }

    /**
     * Parses and returns all claims from the token, validating the signature in the process.
     *
     * @param token JWT string
     * @return Claims object containing all embedded claims
     */
    private Claims extractAllClaims(String token) {
        return Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(token).getBody();
    }

    /**
     * Extracts the username from the token's subject claim.
     *
     * @param token JWT string
     * @return username string
     */
    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    /**
     * Extracts the role from the token's custom "role" claim.
     *
     * @param token JWT string
     * @return role string
     */
    public String extractRole(String token) {
        return extractClaim(token, claims -> claims.get("role", String.class));
    }
}
