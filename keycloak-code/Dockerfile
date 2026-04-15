# ─── Stage 1: Build ────────────────────────────────────────────────────────────
# Pre-bake the feature set and custom provider so the runtime image is optimised.
FROM quay.io/keycloak/keycloak:26.5.6 AS builder

# Target database (Render Postgres)
ENV KC_DB=postgres

# Enable required features at build time
ENV KC_FEATURES=preview,token-exchange:v1,admin-fine-grained-authz:v1

# Build-time options (must be baked in before kc.sh build)
ENV KC_HEALTH_ENABLED=true

# Copy the custom Skyfire IDP provider
COPY providers/skyfire-keycloak-idp-1.0.0.jar /opt/keycloak/providers/

# Build an optimised Keycloak binary
RUN /opt/keycloak/bin/kc.sh build

# ─── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM quay.io/keycloak/keycloak:26.5.6

COPY --from=builder /opt/keycloak /opt/keycloak

# Render terminates TLS at the edge — Keycloak only needs to speak plain HTTP
# internally and trust X-Forwarded-* headers.
ENV KC_HTTP_ENABLED=true
ENV KC_PROXY_HEADERS=xforwarded
ENV KC_HOSTNAME_STRICT=false

# Port Keycloak listens on (must match the "Port" field in your Render service)
EXPOSE 8080

ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
# --optimized skips the build phase at startup (uses the pre-built image above)
CMD ["start", "--optimized"]
