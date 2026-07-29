package com.stocks.stockease.demo;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

/**
 * Marks a bean as part of the demo surface: it exists only while {@code app.demo.enabled} is true.
 *
 * <p>The property defaults to false, so a normal deployment loads none of these beans at all. That is
 * the whole guarantee the demo module rests on - with no controller bean there is no request mapping,
 * so a disabled deployment answers 404 on the demo paths rather than exposing a protected surface that
 * answers 403. One annotation rather than a repeated string keeps the property name in a single place.
 */
@Documented
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@ConditionalOnProperty(prefix = "app.demo", name = "enabled", havingValue = "true")
public @interface ConditionalOnDemoMode {
}
