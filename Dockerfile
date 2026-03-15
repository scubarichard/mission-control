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
# The compiled bundle is pretty-printed (not minified), so the pattern is:
#       unique: true,
#       sparse: true,
# We delete the "unique: true," lines entirely, leaving only "sparse: true,".
# After fixing the schema, the existing users collection must be deleted so
# LibreChat recreates it without the unique indexes.
COPY patches/drop-unique-indexes.js /app/patches/drop-unique-indexes.js
COPY patches/entrypoint.sh /app/patches/entrypoint.sh
RUN chmod +x /app/patches/entrypoint.sh && \
    sed -i -e '/^        unique: true,$/{N; /\n        sparse: true,/{s/unique: true,\n/\n/;}}' \
      /app/node_modules/@librechat/data-schemas/dist/index.cjs && \
    sed -i -e '/^        unique: true,$/{N; /\n        sparse: true,/{s/unique: true,\n/\n/;}}' \
      /app/node_modules/@librechat/data-schemas/dist/index.es.js && \
    echo "=== Verifying patch ===" && \
    grep -c 'unique: true' /app/node_modules/@librechat/data-schemas/dist/index.cjs && \
    echo "googleId block:" && \
    grep -A2 'googleId' /app/node_modules/@librechat/data-schemas/dist/index.cjs && \
    echo "email block (should still have unique):" && \
    grep -A3 'email:' /app/node_modules/@librechat/data-schemas/dist/index.cjs | head -8

USER node
ENTRYPOINT ["/app/patches/entrypoint.sh"]
