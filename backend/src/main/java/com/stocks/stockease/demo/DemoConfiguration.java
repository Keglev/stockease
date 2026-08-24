package com.stocks.stockease.demo;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;

import com.stocks.stockease.security.PublicEndpoint;

/**
 * Configuration of the demo module; the whole module hangs off this class's condition.
 *
 * <p>It binds {@link DemoProperties} and publishes the two entry points the demo needs to be reachable
 * without a JWT. Both are contributions to the security module rather than edits inside it, so the
 * filter chain carries no demo-specific branch: when this configuration is absent the beans are absent,
 * the paths are not exempted, and no controller is mapped behind them either.
 */
@Configuration(proxyBeanMethods = false)
@ConditionalOnDemoMode
@EnableConfigurationProperties(DemoProperties.class)
public class DemoConfiguration {

    /**
     * Opens the passwordless demo login to unauthenticated callers.
     *
     * @return the exemption for {@code POST /api/demo/login}
     */
    @Bean
    PublicEndpoint demoLoginEndpoint() {
        return new PublicEndpoint(HttpMethod.POST, "/api/demo/login");
    }

    /**
     * Opens the demo reset to unauthenticated callers; the endpoint authenticates the caller itself,
     * by shared token rather than by JWT, because the weekly scheduler holds no user account.
     *
     * @return the exemption for {@code POST /api/demo/reset}
     */
    @Bean
    PublicEndpoint demoResetEndpoint() {
        return new PublicEndpoint(HttpMethod.POST, "/api/demo/reset");
    }
}
