package com.stocks.stockease.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import com.stocks.stockease.security.internal.UserRepository;

import lombok.RequiredArgsConstructor;

/**
 * Provisions the administrator account described by {@link BootstrapAdminProperties} at startup.
 *
 * <p>This replaces the 'admin' account V3 seeded with a password committed to the repository, which
 * V16 deletes. The credential now lives only in the deployment environment, so the account can be
 * rotated without a migration and nothing recoverable from the source tree opens it.
 *
 * <p>Deliberately not conditional on demo mode: this is a real administrator for a real deployment
 * and must be provisioned with {@code app.demo.enabled=false}. Equally deliberately, it never
 * touches an account that already exists - a restart must not silently reset a password an operator
 * has since changed. A half-configured deployment warns and carries on rather than failing to start,
 * because refusing to boot over a missing optional credential turns a misconfiguration into an outage.
 */
@Component
@RequiredArgsConstructor
@EnableConfigurationProperties(BootstrapAdminProperties.class)
public class BootstrapAdminInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(BootstrapAdminInitializer.class);

    /** Authority as the column stores it; the JWT layer strips the prefix when it writes the claim. */
    static final String ADMIN_ROLE = "ROLE_ADMIN";

    private final BootstrapAdminProperties properties;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    /**
     * Creates the configured administrator if it is absent, and does nothing in every other case.
     *
     * @param args startup arguments, unused; the configuration is the only input
     */
    @Override
    public void run(ApplicationArguments args) {
        String username = properties.username();
        boolean hasUsername = StringUtils.hasText(username);
        boolean hasPassword = StringUtils.hasText(properties.password());

        if (!hasUsername && !hasPassword) {
            // the normal development and test state; silence keeps it from reading as a problem
            return;
        }
        if (!hasUsername || !hasPassword) {
            log.warn("Bootstrap admin provisioning skipped: {} is set but {} is not.",
                    hasUsername ? "APP_BOOTSTRAPADMIN_USERNAME" : "APP_BOOTSTRAPADMIN_PASSWORD",
                    hasUsername ? "APP_BOOTSTRAPADMIN_PASSWORD" : "APP_BOOTSTRAPADMIN_USERNAME");
            return;
        }
        if (userRepository.findByUsername(username).isPresent()) {
            log.debug("Bootstrap admin '{}' already exists; its password is left as it is.", username);
            return;
        }

        // only the username is ever logged: the password must not be recoverable from any log level
        userRepository.save(new User(username, passwordEncoder.encode(properties.password()), ADMIN_ROLE));
        log.info("Provisioned bootstrap admin account '{}'.", username);
    }
}
