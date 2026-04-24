package com.example.keycloak;

import com.fasterxml.jackson.databind.JsonNode;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSVerifier;
import com.nimbusds.jose.crypto.ECDSAVerifier;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.ws.rs.core.MultivaluedMap;
import jakarta.ws.rs.core.Response;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.ECParameterSpec;
import java.security.spec.ECPoint;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.jboss.logging.Logger;
import org.keycloak.broker.provider.*;
import org.keycloak.events.EventBuilder;
import org.keycloak.models.FederatedIdentityModel;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.RealmModel;
import org.keycloak.models.UserModel;
import org.keycloak.models.UserSessionModel;
import org.keycloak.protocol.oidc.TokenExchangeContext;
import org.keycloak.protocol.oidc.TokenExchangeProvider;

public class SkyfireIdentityProvider
        extends AbstractIdentityProvider<SkyfireIdentityProviderConfig>
        implements ExchangeExternalToken {

    private static final Logger LOG = Logger.getLogger(SkyfireIdentityProvider.class);
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final HttpClient HTTP_CLIENT = HttpClient.newHttpClient();
    private static final long JWKS_CACHE_TTL_MILLIS = 10 * 60 * 1000L;
    private static final ConcurrentHashMap<String, CachedKey> KEY_CACHE = new ConcurrentHashMap<>();
    private static final String ATTR_SKYFIRE_SUB = "skyfire_sub";
    private static final String ATTR_SKYFIRE_EMAIL = "skyfire_email";

    public SkyfireIdentityProvider(KeycloakSession session,
                                   SkyfireIdentityProviderConfig config) {
        super(session, config);
    }

    @Override
    public boolean isIssuer(String issuer, MultivaluedMap<String, String> params) {
        if (issuer == null) {
            return false;
        }

        String alias = getConfig().getAlias();
        String configuredIssuer = getConfig().getIssuer();

        return issuer.equals(alias) || (configuredIssuer != null && issuer.equals(configuredIssuer));
    }

    @Override
    public BrokeredIdentityContext exchangeExternal(TokenExchangeProvider provider, TokenExchangeContext context) {
        String token = context.getFormParams().getFirst("subject_token");
        return exchangeExternalToken(context.getRealm(), context.getEvent(), token);
    }

    @Override
    public void exchangeExternalComplete(UserSessionModel userSession,
                                         BrokeredIdentityContext context,
                                         MultivaluedMap<String, String> params) {
        context.addSessionNotesToUserSession(userSession);
    }

    @Override
    public Response retrieveToken(KeycloakSession session, FederatedIdentityModel identity) {
        return Response.status(Response.Status.NOT_IMPLEMENTED)
                .entity("Skyfire external token retrieval is not implemented for this provider.")
                .build();
    }

    @Override
    public void preprocessFederatedIdentity(KeycloakSession session,
                                            RealmModel realm,
                                            BrokeredIdentityContext context) {
        super.preprocessFederatedIdentity(session, realm, context);
        context.setModelUsername(buildModelUsername(context.getEmail(), context.getBrokerUserId()));
        applySkyfireContextAttributes(context);
    }

    @Override
    public void importNewUser(KeycloakSession session,
                              RealmModel realm,
                              UserModel user,
                              BrokeredIdentityContext context) {
        super.importNewUser(session, realm, user, context);
        syncSkyfireUserAttributes(user, context);
    }

    @Override
    public void updateBrokeredUser(KeycloakSession session,
                                   RealmModel realm,
                                   UserModel user,
                                   BrokeredIdentityContext context) {
        super.updateBrokeredUser(session, realm, user, context);
        syncSkyfireUserAttributes(user, context);
    }

    protected BrokeredIdentityContext exchangeExternalToken(RealmModel realm,
                                                            EventBuilder event,
                                                            String token) {
        if (token == null || token.isBlank()) {
            throw new IdentityBrokerException("Missing Skyfire subject token");
        }

        LOG.info("Received Skyfire token" + token);

        try {
            SignedJWT jwt = verifyToken(token);
            validateSkyfireToken(jwt);

            JWTClaimsSet claims = jwt.getJWTClaimsSet();
            String userId = claims.getSubject();
            String email = extractEmail(jwt);
            @SuppressWarnings("unchecked")
            Map<String, Object> hid = (Map<String, Object>) claims.getClaim("hid");
            @SuppressWarnings("unchecked")
            Map<String, Object> aid = (Map<String, Object>) claims.getClaim("aid");

            LOG.info("Parsed JWT userId=" + userId);

            BrokeredIdentityContext user = new BrokeredIdentityContext(userId, getConfig());

            user.setId(userId);
            user.setBrokerUserId(userId);
            user.setUsername(userId);
            user.setModelUsername(buildModelUsername(email, userId));
            user.setEmail(email);
            user.setIdp(this);
            user.setToken(token);
            applySkyfireContextAttributes(user);

            if (hid != null) {
                user.setFirstName(asString(hid.get("given_name")));
                user.setLastName(asString(hid.get("family_name")));
                user.setUserAttribute("email", asString(hid.get("email")));
                user.setUserAttribute("phone_number", asString(hid.get("phone_number")));
                user.setUserAttribute("organization_name", asString(hid.get("organization_name")));
                user.setUserAttribute("skyfire_verified", asString(hid.get("verified")));
                user.setUserAttribute("skyfire_verifier", asString(hid.get("verifier")));
                user.setUserAttribute("skyfire_verification_id", asString(hid.get("verification_id")));
            }

            if (aid != null) {
                user.setUserAttribute("skyfire_agent_name", asString(aid.get("name")));
                user.setUserAttribute("skyfire_creation_ip", asString(aid.get("creation_ip")));
                Object sourceIps = aid.get("source_ips");
                if (sourceIps instanceof List<?> values && !values.isEmpty()) {
                    user.setUserAttribute("skyfire_source_ips", values.stream().map(String::valueOf).toList());
                }
            }

            user.setUserAttribute("skyfire_env", (String) claims.getClaim("env"));
            user.setUserAttribute("skyfire_jti", claims.getJWTID());

            return user;

        } catch (Exception e) {
            LOG.error("JWT validation failed", e);
            throw new IdentityBrokerException("Invalid Skyfire token", e);
        }
    }

    private SignedJWT verifyToken(String token) throws Exception {
        String issuer = getConfig().getIssuer();
        SignedJWT signedJWT = SignedJWT.parse(token);
        validateSignatureAlgorithm(signedJWT);

        PublicKey publicKey = resolveVerificationKey(signedJWT);
        JWSVerifier verifier = createVerifier(publicKey);
        if (!signedJWT.verify(verifier)) {
            throw new IdentityBrokerException("JWT signature verification failed");
        }

        JWTClaimsSet claims = signedJWT.getJWTClaimsSet();
        if (issuer != null && !issuer.isBlank() && !issuer.equals(claims.getIssuer())) {
            throw new IdentityBrokerException("Unexpected issuer in Skyfire token");
        }

        java.util.Date expiry = claims.getExpirationTime();
        if (expiry != null && expiry.before(new java.util.Date())) {
            throw new IdentityBrokerException("Skyfire token has expired");
        }

        return signedJWT;
    }

    private PublicKey resolveVerificationKey(SignedJWT jwt) throws Exception {
        String kid = jwt.getHeader().getKeyID();
        String jwksUrl = getConfig().getJwksUrl();
        if (jwksUrl == null || jwksUrl.isBlank()) {
            throw new IdentityBrokerException("Missing Skyfire JWKS URL configuration");
        }

        if (kid == null || kid.isBlank()) {
            throw new IdentityBrokerException("Missing Skyfire kid header");
        }

        return readPublicKeyFromJwks(kid, jwksUrl);
    }

    private JWSVerifier createVerifier(PublicKey publicKey) throws Exception {
        if (publicKey instanceof ECPublicKey ecPublicKey) {
            return new ECDSAVerifier(ecPublicKey);
        }

        throw new IdentityBrokerException("Unsupported Skyfire EC verification key type");
    }

    private void validateSignatureAlgorithm(SignedJWT jwt) {
        JWSAlgorithm algorithm = jwt.getHeader().getAlgorithm();
        if (!JWSAlgorithm.ES256.equals(algorithm)) {
            throw new IdentityBrokerException("Unsupported Skyfire JWT algorithm");
        }
    }

    private void validateSkyfireToken(SignedJWT jwt) throws Exception {
        JWTClaimsSet claims = jwt.getJWTClaimsSet();
        validateHeaderType(jwt);
        validateRequiredEmail(jwt);
        validateExpectedEnvironment(jwt);
        validateUuid(claims.getJWTID(), "jti");
        validateUuid(claims.getSubject(), "sub");
        validateAudience(jwt);
    }

    private void validateHeaderType(SignedJWT jwt) {
        String type = jwt.getHeader().getType() != null ? jwt.getHeader().getType().getType() : null;
        if (!"kya+jwt".equals(type) && !"kya-pay+jwt".equals(type)) {
            throw new IdentityBrokerException("Invalid Skyfire token type");
        }
    }

    private void validateRequiredEmail(SignedJWT jwt) throws Exception {
        String email = extractEmail(jwt);
        if (email == null || email.isBlank() || !email.contains("@")) {
            throw new IdentityBrokerException("Invalid Skyfire email claim");
        }
    }

    private void validateExpectedEnvironment(SignedJWT jwt) throws Exception {
        String expectedEnv = getConfig().getExpectedEnv();
        if (expectedEnv == null || expectedEnv.isBlank()) {
            return;
        }

        String actualEnv = (String) jwt.getJWTClaimsSet().getClaim("env");
        if (!expectedEnv.equals(actualEnv)) {
            throw new IdentityBrokerException("Unexpected Skyfire environment - Token is not from qa environment");
        }
    }

    private void validateUuid(String value, String claimName) {
        if (value == null || value.isBlank()) {
            throw new IdentityBrokerException("Missing Skyfire " + claimName + " claim");
        }

        try {
            UUID.fromString(value);
        } catch (IllegalArgumentException ex) {
            throw new IdentityBrokerException("Invalid Skyfire " + claimName + " claim", ex);
        }
    }

    private void validateAudience(SignedJWT jwt) throws Exception {
        List<String> audiences = jwt.getJWTClaimsSet().getAudience();
        if (audiences == null || audiences.isEmpty()) {
            throw new IdentityBrokerException("Missing Skyfire aud claim");
        }

        boolean validAudience = audiences.stream().allMatch(this::isUuid);
        if (!validAudience) {
            throw new IdentityBrokerException("Invalid audience (aud): not a valid UUID");
        }
    }

    private boolean isUuid(String value) {
        try {
            UUID.fromString(value);
            return true;
        } catch (IllegalArgumentException ex) {
            return false;
        }
    }

    private void validateIssuerIfConfigured(SignedJWT jwt, String expectedIssuer) throws Exception {
        if (expectedIssuer != null && !expectedIssuer.isBlank() && !expectedIssuer.equals(jwt.getJWTClaimsSet().getIssuer())) {
            throw new IdentityBrokerException("Unexpected issuer in Skyfire token");
        }
    }

    private void applySkyfireContextAttributes(BrokeredIdentityContext context) {
        if (context.getBrokerUserId() != null && !context.getBrokerUserId().isBlank()) {
            context.setUserAttribute(ATTR_SKYFIRE_SUB, context.getBrokerUserId());
        }

        if (context.getEmail() != null && !context.getEmail().isBlank()) {
            context.setUserAttribute(ATTR_SKYFIRE_EMAIL, context.getEmail());
        }
    }

    private void syncSkyfireUserAttributes(UserModel user, BrokeredIdentityContext context) {
        if (context.getBrokerUserId() != null && !context.getBrokerUserId().isBlank()) {
            user.setSingleAttribute(ATTR_SKYFIRE_SUB, context.getBrokerUserId());
        }

        if (context.getEmail() != null && !context.getEmail().isBlank()) {
            user.setSingleAttribute(ATTR_SKYFIRE_EMAIL, context.getEmail());
        }
    }

    private String buildModelUsername(String email, String userId) {
        if (email != null && !email.isBlank()) {
            return email;
        }

        return userId;
    }

    private PublicKey readPublicKeyFromJwks(String kid, String jwksUrl) throws Exception {
        String cacheKey = jwksUrl + "::" + kid;
        CachedKey cached = KEY_CACHE.get(cacheKey);
        if (cached != null && !cached.isExpired()) {
            return cached.publicKey;
        }

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(jwksUrl))
                .timeout(java.time.Duration.ofSeconds(5))
                .GET()
                .build();

        HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IdentityBrokerException("Unable to fetch Skyfire JWKS");
        }

        JsonNode jwks = OBJECT_MAPPER.readTree(response.body());
        JsonNode keys = jwks.get("keys");
        if (keys == null || !keys.isArray()) {
            throw new IdentityBrokerException("Invalid Skyfire JWKS response");
        }

        for (JsonNode key : keys) {
            if (kid.equals(key.path("kid").asText())) {
                PublicKey publicKey = buildPublicKeyFromJwk(key);
                KEY_CACHE.put(cacheKey, new CachedKey(publicKey, System.currentTimeMillis() + JWKS_CACHE_TTL_MILLIS));
                return publicKey;
            }
        }

        throw new IdentityBrokerException("No matching Skyfire signing key found for kid");
    }

    private String extractEmail(SignedJWT jwt) throws Exception {
        JWTClaimsSet claims = jwt.getJWTClaimsSet();
        String email = (String) claims.getClaim("email");
        if (email != null && !email.isBlank()) {
            return email;
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> hid = (Map<String, Object>) claims.getClaim("hid");
        if (hid == null) {
            return null;
        }

        return asString(hid.get("email"));
    }

    private String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private PublicKey buildPublicKeyFromJwk(JsonNode key) throws Exception {
        String keyType = key.path("kty").asText(null);
        String algorithm = key.path("alg").asText(null);
        if (!"EC".equals(keyType)) {
            throw new IdentityBrokerException("Unsupported Skyfire JWK key type");
        }

        if (algorithm != null && !"ES256".equals(algorithm)) {
            throw new IdentityBrokerException("Unsupported Skyfire JWK algorithm");
        }

        String curve = key.path("crv").asText(null);
        String x = key.path("x").asText(null);
        String y = key.path("y").asText(null);
        if (curve == null || x == null || y == null) {
            throw new IdentityBrokerException("Invalid Skyfire EC JWK");
        }

        return JwkEcPublicKeyBuilder.build(curve, x, y);
    }

    private record CachedKey(PublicKey publicKey, long expiresAt) {
        private boolean isExpired() {
            return System.currentTimeMillis() >= expiresAt;
        }
    }

    private static final class JwkEcPublicKeyBuilder {
        private JwkEcPublicKeyBuilder() {
        }

        private static ECPublicKey build(String curve, String x, String y) throws Exception {
            String stdName = switch (curve) {
                case "P-256" -> "secp256r1";
                case "P-384" -> "secp384r1";
                case "P-521" -> "secp521r1";
                default -> throw new IdentityBrokerException("Unsupported Skyfire EC curve");
            };

            java.security.AlgorithmParameters parameters = java.security.AlgorithmParameters.getInstance("EC");
            parameters.init(new ECGenParameterSpec(stdName));
            ECParameterSpec parameterSpec = parameters.getParameterSpec(ECParameterSpec.class);

            java.math.BigInteger xCoordinate = new java.math.BigInteger(1, Base64.getUrlDecoder().decode(x));
            java.math.BigInteger yCoordinate = new java.math.BigInteger(1, Base64.getUrlDecoder().decode(y));
            java.security.spec.ECPublicKeySpec keySpec = new java.security.spec.ECPublicKeySpec(
                    new ECPoint(xCoordinate, yCoordinate),
                    parameterSpec);
            return (ECPublicKey) KeyFactory.getInstance("EC").generatePublic(keySpec);
        }
    }
}