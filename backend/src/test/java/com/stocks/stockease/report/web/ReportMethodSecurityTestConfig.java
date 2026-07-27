package com.stocks.stockease.report.web;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;

/**
 * Turns on {@code @PreAuthorize} enforcement inside the report controller slice tests.
 * Production enables it on {@code SecurityConfig}, which {@code @WebMvcTest} does not load, so without
 * this the role rules would silently pass every request; {@code @TestConfiguration} keeps it out of
 * component scanning so full-context tests are unaffected.
 */
@TestConfiguration
@EnableMethodSecurity
public class ReportMethodSecurityTestConfig {
}
