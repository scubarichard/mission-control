FROM ghcr.io/danny-avila/librechat:v0.8.4
USER root

# Remove black background from hero image with ImageMagick
COPY docs/Dax-Frontpage.png /tmp/Dax-Frontpage.png
RUN apk add --no-cache imagemagick && \
    magick /tmp/Dax-Frontpage.png -fuzz 25% -transparent black \
      /app/client/dist/assets/dax-hero.png && \
    rm -f /tmp/Dax-Frontpage.png

# Copy pre-built logo SVG and remaining assets
COPY docs/logo.svg /app/client/dist/assets/logo.svg
COPY docs/lexi_avatar_384.png /app/client/dist/assets/favicon-32x32.png
COPY docs/lexi_avatar_384.png /app/client/dist/assets/favicon-16x16.png
COPY docs/lexi_avatar_384.png /app/client/dist/assets/apple-touch-icon-180x180.png
COPY docs/microsoft-signin.png /app/client/dist/assets/microsoft-signin.png
COPY docs/custom.css /app/client/dist/assets/custom.css
COPY docs/compliance.html /app/client/dist/compliance.html
RUN sed -i 's|<meta name="theme-color"|<meta name="color-scheme" content="dark only" /><meta name="theme-color"|' /app/client/dist/index.html && \
    sed -i 's|</head>|<link rel="stylesheet" href="assets/custom.css" /></head>|' /app/client/dist/index.html && \
    sed -i 's|<title>.*</title>|<title>DAX - Governed AI for RIAs</title>|' /app/client/dist/index.html && \
    sed -i 's|content="LibreChat[^"]*"|content="DAX - Governed AI for RIAs"|g' /app/client/dist/index.html && \
    sed -i 's|</head>|<meta property="og:title" content="DAX - Governed AI for RIAs" /><meta property="og:description" content="A private, governed AI workspace for SEC-registered RIAs. Built inside your Azure environment. Powered by Microsoft. Managed by Dakona." /><meta property="og:site_name" content="DAX by Dakona" /><meta property="og:type" content="website" /><meta property="og:url" content="https://dax.dakona.com" /></head>|' /app/client/dist/index.html

# ---------- Fix Cosmos DB unique index bug ----------
COPY patches/drop-unique-indexes.js /app/patches/drop-unique-indexes.js
COPY patches/cosmos-compat.js /app/patches/cosmos-compat.js
COPY patches/seed-docgen-agent.js /app/patches/seed-docgen-agent.js
COPY librechat/tools/openapi-docgen.yaml /app/patches/openapi-docgen.yaml
COPY patches/entrypoint.sh /app/patches/entrypoint.sh
COPY patches/patch-tool-choice.js /app/patches/patch-tool-choice.js
RUN chmod +x /app/patches/entrypoint.sh && \
    sed -i -e '/^        unique: true,$/{N; /\n        sparse: true,/{s/unique: true,\n/\n/;}}' \
      /app/node_modules/@librechat/data-schemas/dist/index.cjs && \
    sed -i -e '/^        unique: true,$/{N; /\n        sparse: true,/{s/unique: true,\n/\n/;}}' \
      /app/node_modules/@librechat/data-schemas/dist/index.es.js && \
    echo "=== Verifying Cosmos patch ===" && \
    grep -c 'unique: true' /app/node_modules/@librechat/data-schemas/dist/index.cjs

# ---------- Patch: force tool_choice=required for action tools ----------
# Patches @librechat/agents Graph.cjs to pass { tool_choice: 'required' } to model.bindTools()
# when at least one action tool (name contains '_action_') is present in the tool list.
# This forces GPT-4o to make function calls instead of writing text.
RUN node /app/patches/patch-tool-choice.js

# ---------- Patch: null guards for MCP tool responses ----------
# Prevents crash when MCP tool returns null/partial response
COPY patches/patch-agent-null-guards.js /app/patches/patch-agent-null-guards.js
RUN node /app/patches/patch-agent-null-guards.js

# ---------- Patch: normalize OpenID email to lowercase ----------
# Entra returns mixed-case emails (e.g. Brett@impact-cp.com). Lowercasing at
# extraction prevents "user not found" warnings on every SSO login.
COPY patches/patch-openid-lowercase.js /app/patches/patch-openid-lowercase.js
RUN node /app/patches/patch-openid-lowercase.js

# ---------- Compliance Portal route ----------
COPY patches/compliance-route.js /app/patches/compliance-route.js
# Insert compliance routes BEFORE the catch-all route (module.exports = app)
RUN sed -i 's|module.exports = app;|// DAX Compliance Portal\nrequire("/app/patches/compliance-route.js")(app);\n\nmodule.exports = app;|' /app/api/server/index.js

USER node
ENTRYPOINT ["/app/patches/entrypoint.sh"]
