FROM ghcr.io/danny-avila/librechat:latest
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
RUN sed -i 's|<meta name="theme-color"|<meta name="color-scheme" content="dark only" /><meta name="theme-color"|' /app/client/dist/index.html && \
    sed -i 's|</head>|<link rel="stylesheet" href="assets/custom.css" /></head>|' /app/client/dist/index.html && \
    sed -i 's|<title>.*</title>|<title>DAX - Governed AI for RIAs</title>|' /app/client/dist/index.html && \
    sed -i 's|content="LibreChat[^"]*"|content="DAX - Governed AI for RIAs"|g' /app/client/dist/index.html && \
    sed -i 's|</head>|<meta property="og:title" content="DAX - Governed AI for RIAs" /><meta property="og:description" content="A private, governed AI workspace for SEC-registered RIAs. Built inside your Azure environment. Powered by Microsoft. Managed by Dakona." /><meta property="og:site_name" content="DAX by Dakona" /><meta property="og:type" content="website" /><meta property="og:url" content="https://dax.dakona.com" /></head>|' /app/client/dist/index.html

# ---------- Fix Cosmos DB unique index bug ----------
# Cosmos DB MongoDB API treats null as a unique value, so unique+sparse indexes
# on social provider ID fields (googleId, facebookId, etc.) block multi-user login.
# Two-part fix:
#   1. Patch compiled schema to remove unique:true so mongoose won't recreate indexes
#   2. Startup script drops existing problematic indexes from the database
COPY patches/drop-unique-indexes.js /app/patches/drop-unique-indexes.js
COPY patches/entrypoint.sh /app/patches/entrypoint.sh
RUN chmod +x /app/patches/entrypoint.sh && \
    find /app/node_modules/@librechat/data-schemas/dist -name '*.cjs' -exec \
      sed -i 's/unique:!0,sparse:!0/sparse:!0/g' {} \; && \
    find /app/node_modules/@librechat/data-schemas/dist -name '*.js' -exec \
      sed -i 's/unique:!0,sparse:!0/sparse:!0/g' {} \; && \
    find /app/node_modules/@librechat/data-schemas/dist -name '*.cjs' -exec \
      sed -i 's/unique: true, sparse: true/sparse: true/g' {} \; && \
    find /app/node_modules/@librechat/data-schemas/dist -name '*.js' -exec \
      sed -i 's/unique: true, sparse: true/sparse: true/g' {} \;

USER node
ENTRYPOINT ["/app/patches/entrypoint.sh"]
