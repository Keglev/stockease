package com.stocks.stockease.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

/** Enables {@code @CreatedDate}/{@code @LastModifiedDate} auditing support for JPA entities. */
@Configuration
@EnableJpaAuditing
public class JpaAuditingConfig {
}
