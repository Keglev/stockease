package com.stocks.stockease.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * Request body for authenticating a user.
 *
 * <p>Contract defined in {@code docs/api/paths/auth-login.yaml}, operation {@code loginUser}.
 */
@Data
public class LoginRequest {

    /** Username of the account to authenticate. Must not be blank. */
    @NotBlank
    private String username;

    /** Account password. Must not be blank. */
    @NotBlank
    private String password;
}
