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
    sed -i 's|<title>.*</title>|<title>DAX — Governed AI for RIAs</title>|' /app/client/dist/index.html && \
    sed -i 's|content="LibreChat[^"]*"|content="DAX — Governed AI for RIAs"|g' /app/client/dist/index.html && \
    sed -i 's|og:description" content="[^"]*"|og:description" content="A private, governed AI workspace for SEC-registered RIAs. Built inside your Azure environment. Powered by Microsoft. Managed by Dakona."|' /app/client/dist/index.html && \
    sed -i 's|og:site_name" content="[^"]*"|og:site_name" content="DAX by Dakona"|' /app/client/dist/index.html

USER node
