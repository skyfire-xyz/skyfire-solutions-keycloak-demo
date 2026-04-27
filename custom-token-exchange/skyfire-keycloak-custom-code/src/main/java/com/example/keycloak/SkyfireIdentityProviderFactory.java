package com.example.keycloak;

import java.util.List;

import org.keycloak.broker.provider.AbstractIdentityProviderFactory;
import org.keycloak.models.IdentityProviderModel;
import org.keycloak.models.KeycloakSession;
import org.keycloak.provider.ProviderConfigProperty;

public class SkyfireIdentityProviderFactory
    extends AbstractIdentityProviderFactory<SkyfireIdentityProvider> {

    public static final String PROVIDER_ID = "skyfire-idp-token-exchange";

        private static final ProviderConfigProperty JWKS_URL = new ProviderConfigProperty(
            SkyfireIdentityProviderConfig.JWKS_URL,
            "Skyfire JWKS URL",
            "Required JWKS endpoint used to resolve the ES256 signing key by `kid`.",
            ProviderConfigProperty.STRING_TYPE,
            null);

    private static final ProviderConfigProperty ISSUER = new ProviderConfigProperty(
        IdentityProviderModel.ISSUER,
        "Expected issuer",
        "Expected `iss` value in the Skyfire JWT. Leave empty to accept the configured alias only.",
        ProviderConfigProperty.STRING_TYPE,
        null);

        private static final ProviderConfigProperty EXPECTED_ENV = new ProviderConfigProperty(
            SkyfireIdentityProviderConfig.EXPECTED_ENV,
            "Expected environment",
            "Expected Skyfire `env` claim, for example `qa` or `production`.",
            ProviderConfigProperty.STRING_TYPE,
            null);

    @Override
    public String getName() {
        return "Skyfire IdP (Token Exchange)";
    }

    @Override
    public SkyfireIdentityProvider create(KeycloakSession session, IdentityProviderModel model) {
        return new SkyfireIdentityProvider(session, new SkyfireIdentityProviderConfig(model));
    }

    @Override
    public IdentityProviderModel createConfig() {
        return new SkyfireIdentityProviderConfig();
    }

    @Override
    public List<ProviderConfigProperty> getConfigProperties() {
        return List.of(JWKS_URL, ISSUER, EXPECTED_ENV);
    }

    @Override
    public String getId() {
        return PROVIDER_ID;
    }
}