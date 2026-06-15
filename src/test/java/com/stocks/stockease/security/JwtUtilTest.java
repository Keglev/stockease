package com.stocks.stockease.security;

import java.security.Key;
import java.util.Date;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;

/**
 * Tests for {@link JwtUtil} covering token generation, validation, and claim extraction.
 */
class JwtUtilTest {

    private JwtUtil jwtUtil;

    @SuppressWarnings("unused") // invoked by JUnit via reflection, not by direct call
    @BeforeEach
    void setUp() {
        jwtUtil = new JwtUtil();
    }

    // --- generate ---

    @Test
    void generateToken_returnsCompactJwtString() {
        String token = jwtUtil.generateToken("alice", "ROLE_USER");

        assertThat(token).isNotNull().isNotEmpty();
        // A compact JWT has exactly two dots: header.payload.signature
        assertThat(token.chars().filter(c -> c == '.').count()).isEqualTo(2);
    }

    @Test
    void generateToken_embeddedClaimsMatchInputs() {
        String token = jwtUtil.generateToken("carol", "ROLE_USER");

        assertThat(jwtUtil.extractUsername(token)).isEqualTo("carol");
        assertThat(jwtUtil.extractRole(token)).isEqualTo("ROLE_USER");
    }

    // --- validate ---

    @Test
    void validateToken_withValidToken_returnsTrue() {
        String token = jwtUtil.generateToken("alice", "ROLE_USER");

        assertThat(jwtUtil.validateToken(token)).isTrue();
    }

    @Test
    void validateToken_withMalformedToken_returnsFalse() {
        assertThat(jwtUtil.validateToken("not.a.valid.jwt")).isFalse();
    }

    @Test
    void validateToken_withExpiredToken_returnsFalse() {
        String expiredToken = buildExpiredToken("expiredUser");

        assertThat(jwtUtil.validateToken(expiredToken)).isFalse();
    }

    // --- extract ---

    @Test
    void extractUsername_returnsCorrectSubjectClaim() {
        String token = jwtUtil.generateToken("alice", "ROLE_USER");

        assertThat(jwtUtil.extractUsername(token)).isEqualTo("alice");
    }

    @Test
    void extractRole_returnsCorrectRoleClaim() {
        String token = jwtUtil.generateToken("alice", "ROLE_ADMIN");

        assertThat(jwtUtil.extractRole(token)).isEqualTo("ROLE_ADMIN");
    }

    @Test
    void extractClaim_withCustomResolver_returnsExpectedValue() {
        String token = jwtUtil.generateToken("bob", "ROLE_USER");

        String subject = jwtUtil.extractClaim(token, claims -> claims.getSubject());

        assertThat(subject).isEqualTo("bob");
    }

    /** Signed with the same key as {@link JwtUtil} so the signature is valid; only the expiry triggers rejection. */
    private String buildExpiredToken(String username) {
        Key key = Keys.hmacShaKeyFor("your-secret-key-which-must-be-very-secure-and-long".getBytes());
        return Jwts.builder()
                .setSubject(username)
                .setExpiration(new Date(System.currentTimeMillis() - 1000))
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }
}
