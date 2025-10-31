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
 * JWT token generation, validation, and claims extraction utility.
 * 
 * Handles all JWT operations including token generation with user claims,
 * cryptographic validation, and claim extraction. Uses HMAC-SHA256 for
 * token signing and 10-hour expiration for security balance.
 * 
 * @author Team StockEase
 * @version 1.0
 * @since 2025-01-01
 */
@Component
public class JwtUtil {

    /**
     * Secret key for HMAC-SHA256 token signing.
     * SECURITY NOTE: In production, move to environment variables or secure vault
     * (do NOT hardcode in source). Must be at least 256 bits for HS256.
     */
    private static final String SECRET_KEY = "your-secret-key-which-must-be-very-secure-and-long";

    /**
     * JWT expiration time in milliseconds (10 hours = 36,000,000 ms).
     * After this duration, token is invalid. Clients must re-authenticate to obtain new token.
     * Balance: Long enough for user sessions, short enough for security (limited damage if compromised).
     */
    private static final long EXPIRATION_TIME = 1000 * 60 * 60 * 10;

    /**
     * Derived HMAC signing key. Initialized from SECRET_KEY.
     * Used for both token generation and validation (signature verification).
     * Must be at least 256 bits for HS256 algorithm.
     */
    private final Key key = Keys.hmacShaKeyFor(SECRET_KEY.getBytes());

    /**
     * Generates signed JWT token for authenticated user.
     * 
     * Creates a new token with embedded username (subject) and role (custom claim).
     * Token is signed with HMAC-SHA256 algorithm and includes expiration timestamp.
     * Token becomes invalid after 10 hours or if signature is tampered with.
     * 
     * @param username authenticated user's username (becomes JWT "sub" claim)
     * @param role user's authorization role (custom "role" claim: ADMIN or USER)
     * @return compact signed JWT token string (base64url encoded)
     */
    public String generateToken(String username, String role) {
        return Jwts.builder()
                // Subject: username used for authentication on subsequent requests
                .setSubject(username)
                // Custom claim: role used for authorization (@PreAuthorize checks)
                .claim("role", role)
                // Standard claims: issued and expiration timestamps
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + EXPIRATION_TIME))
                // Sign with HMAC-SHA256 using derived key
                .signWith(key, SignatureAlgorithm.HS256)
                // Compact serialization: header.payload.signature
                .compact();
    }

    /**
     * Validates JWT token signature and expiration.
     * 
     * Cryptographically verifies token signature to ensure tampering hasn't occurred.
     * Also validates expiration timestamp. Token is INVALID if signature tampered
     * or expiration time exceeded.
     * 
     * @param token JWT token string to validate
     * @return true if signature valid and not expired; false if tampered or expired
     */
    public boolean validateToken(String token) {
        try {
            // parseClaimsJws() verifies signature and expiration
            // Throws JwtException if any validation fails
            Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(token);
            return true;
        } catch (JwtException e) {
            // Catch all JWT errors: signature mismatch, expiration, malformed, etc.
            return false;
        }
    }

    /**
     * Extracts specific claim from token using resolver function.
     * 
     * Generic method to extract any claim from token by applying resolver function.
     * First validates and parses token, then applies resolver to extracted Claims object.
     * 
     * @param token JWT token string
     * @param claimsResolver function to extract desired claim (e.g., Claims::getSubject)
     * @return extracted claim of specified type
     */
    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        // Parse token and extract all claims (validates signature)
        final Claims claims = extractAllClaims(token);
        // Apply resolver function to extract desired claim
        return claimsResolver.apply(claims);
    }

    /**
     * Extracts all claims from token.
     * 
     * Internal method that parses and validates token, returning all embedded claims.
     * Token must have valid signature; thrown JwtException if signature invalid.
     * 
     * @param token JWT token string
     * @return Claims object with all embedded claims (subject, role, timestamps, etc.)
     */
    private Claims extractAllClaims(String token) {
        // parseClaimsJws() validates signature and returns signed claims
        return Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(token).getBody();
    }

    /**
     * Extracts username (subject claim) from token.
     * 
     * Convenience method to extract JWT "sub" claim (username from login).
     * 
     * @param token JWT token string
     * @return username string
     */
    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    /**
     * Extracts role (custom claim) from token.
     * 
     * Convenience method to extract custom "role" claim embedded during token generation.
     * Returns ADMIN or USER role for authorization decisions.
     * 
     * @param token JWT token string
     * @return role string (ADMIN or USER)
     */
    public String extractRole(String token) {
        // Get custom "role" claim as String
        return extractClaim(token, claims -> claims.get("role", String.class));
    }
}
