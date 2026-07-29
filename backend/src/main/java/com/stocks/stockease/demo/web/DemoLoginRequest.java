package com.stocks.stockease.demo.web;

/**
 * Body of a passwordless demo login.
 *
 * @param role which demo persona to sign in as, {@code ADMIN} or {@code USER}
 */
public record DemoLoginRequest(String role) {
}
