package com.example.keycloak;

import org.keycloak.models.IdentityProviderModel;

public class SkyfireIdentityProviderConfig extends IdentityProviderModel {

    public static final String JWKS_URL = "jwksUrl";
    public static final String EXPECTED_ENV = "expectedEnv";

    public SkyfireIdentityProviderConfig() {
    }

    public SkyfireIdentityProviderConfig(IdentityProviderModel model) {
        super(model);
    }

    public String getJwksUrl() {
        return getConfig().get(JWKS_URL);
    }

    public String getIssuer() {
        return getConfig().get(ISSUER);
    }

    public String getExpectedEnv() {
        return getConfig().get(EXPECTED_ENV);
    }
}