package com.stocks.stockease.security;

import org.springframework.http.HttpMethod;

/**
 * An endpoint another module publishes as reachable without a JWT.
 *
 * <p>The filter chain's permit list is closed to editing from outside the security module: a module
 * that legitimately needs an unauthenticated entry point contributes a bean of this type instead, and
 * {@link SecurityConfig} folds it into the chain ahead of the authenticated catch-all. A module whose
 * beans do not load - the demo module below its property flag - contributes nothing, so the path it
 * would have opened stays shut without any conditional logic living here.
 *
 * @param method HTTP method the exemption applies to
 * @param pattern path pattern the exemption applies to
 */
public record PublicEndpoint(HttpMethod method, String pattern) {
}
