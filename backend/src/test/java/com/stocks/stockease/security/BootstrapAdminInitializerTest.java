package com.stocks.stockease.security;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import static org.mockito.ArgumentMatchers.any;
import org.mockito.Mockito;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.stocks.stockease.security.internal.UserRepository;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;

/**
 * Tests for {@link BootstrapAdminInitializer}: it provisions the configured administrator exactly
 * once, never overwrites an existing account, and treats a half-configured deployment as a warning
 * rather than a failure.
 */
class BootstrapAdminInitializerTest {

    private static final String RAW_PASSWORD = "fake-test-password-1";

    private UserRepository userRepository;
    private PasswordEncoder passwordEncoder;
    private ListAppender<ILoggingEvent> logAppender;

    @SuppressWarnings("unused") // invoked by JUnit via reflection, not by direct call
    @BeforeEach
    void setUp() {
        userRepository = Mockito.mock(UserRepository.class);
        // the real encoder, so "was it encoded" is answered by production behaviour, not by a stub
        passwordEncoder = new BCryptPasswordEncoder();
        logAppender = new ListAppender<>();
        logAppender.start();
        logger().addAppender(logAppender);
    }

    @SuppressWarnings("unused") // invoked by JUnit via reflection, not by direct call
    @AfterEach
    void tearDown() {
        logger().detachAppender(logAppender);
    }

    @Test
    void run_whenConfiguredAndUserAbsent_savesEncodedAdmin() {
        Mockito.when(userRepository.findByUsername("ops.admin")).thenReturn(Optional.empty());

        initializer("ops.admin", RAW_PASSWORD).run(null);

        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        Mockito.verify(userRepository).save(saved.capture());
        assertThat(saved.getValue().getUsername()).isEqualTo("ops.admin");
        assertThat(saved.getValue().getRole()).isEqualTo("ROLE_ADMIN");
        assertThat(saved.getValue().getPassword()).isNotEqualTo(RAW_PASSWORD);
        assertThat(passwordEncoder.matches(RAW_PASSWORD, saved.getValue().getPassword())).isTrue();
    }

    @Test
    void run_whenUserAlreadyExists_savesNothingAndKeepsThePassword() {
        User existing = new User("ops.admin", "pre-existing-hash", "ROLE_ADMIN");
        Mockito.when(userRepository.findByUsername("ops.admin")).thenReturn(Optional.of(existing));

        initializer("ops.admin", RAW_PASSWORD).run(null);

        Mockito.verify(userRepository, Mockito.never()).save(any());
        assertThat(existing.getPassword()).isEqualTo("pre-existing-hash");
    }

    @Test
    void run_whenBothPropertiesBlank_doesNothingSilently() {
        initializer("", "").run(null);

        Mockito.verifyNoInteractions(userRepository);
        assertThat(logAppender.list).isEmpty();
    }

    @Test
    void run_whenOnlyUsernameIsSet_warnsAndSavesNothing() {
        initializer("ops.admin", "").run(null);

        Mockito.verifyNoInteractions(userRepository);
        assertThat(logAppender.list).singleElement()
                .satisfies(event -> assertThat(event.getLevel()).isEqualTo(Level.WARN));
        assertThat(logAppender.list.get(0).getFormattedMessage()).contains("APP_BOOTSTRAPADMIN_PASSWORD");
    }

    @Test
    void run_whenOnlyPasswordIsSet_warnsAndSavesNothing() {
        initializer(null, RAW_PASSWORD).run(null);

        Mockito.verifyNoInteractions(userRepository);
        assertThat(logAppender.list.get(0).getLevel()).isEqualTo(Level.WARN);
        assertThat(logAppender.list.get(0).getFormattedMessage()).contains("APP_BOOTSTRAPADMIN_USERNAME");
        // the password itself must never reach a log line, at any level
        assertThat(logAppender.list.get(0).getFormattedMessage()).doesNotContain(RAW_PASSWORD);
    }

    private BootstrapAdminInitializer initializer(String username, String password) {
        return new BootstrapAdminInitializer(
                new BootstrapAdminProperties(username, password), userRepository, passwordEncoder);
    }

    private Logger logger() {
        return (Logger) LoggerFactory.getLogger(BootstrapAdminInitializer.class);
    }
}
