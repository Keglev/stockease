package com.stocks.stockease.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Credentials of the administrator account provisioned at startup.
 *
 * <p>Both values come from the environment ({@code APP_BOOTSTRAPADMIN_USERNAME} and
 * {@code APP_BOOTSTRAPADMIN_PASSWORD} via relaxed binding) and are blank unless deliberately set,
 * which is the normal state in development and in the test suite. A committed default would
 * reintroduce exactly the leak that removing the V3 'admin' account closes.
 *
 * @param username login name of the administrator to provision; blank disables provisioning
 * @param password plaintext password, encoded before it is stored and never logged
 */
@ConfigurationProperties(prefix = "app.bootstrap-admin")
public record BootstrapAdminProperties(String username, String password) {
}
