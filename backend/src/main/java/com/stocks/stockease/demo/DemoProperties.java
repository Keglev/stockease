package com.stocks.stockease.demo;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configuration of the demo surface.
 *
 * @param enabled whether the demo module exists at all; false in every normal deployment
 * @param resetToken shared secret the reset endpoint demands; supplied by the environment in
 *        production and never committed, so it is blank unless deliberately set
 */
@ConfigurationProperties(prefix = "app.demo")
public record DemoProperties(boolean enabled, String resetToken) {
}
