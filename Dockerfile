FROM ghcr.io/danny-avila/librechat:latest
USER root

# Stage original PNGs for ImageMagick processing
COPY docs/Dax-Frontpage.png /tmp/Dax-Frontpage.png
COPY docs/Dakona_Logo_-_Wordmark.png /tmp/Dakona_Logo_-_Wordmark.png

# Remove black backgrounds and place final assets
RUN apk add --no-cache imagemagick && \
    convert /tmp/Dax-Frontpage.png -fuzz 25% -transparent black \
      /app/client/dist/assets/dax-hero.png && \
    convert /tmp/Dakona_Logo_-_Wordmark.png -fuzz 25% -transparent black \
      /tmp/wordmark-transparent.png && \
    BASE64=$(cat /tmp/wordmark-transparent.png | base64 | tr -d '\n') && \
    printf '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100"><image href="data:image/png;base64,%s" width="300" height="100"/></svg>' "$BASE64" \
      > /app/client/dist/assets/logo.svg && \
    rm -f /tmp/Dax-Frontpage.png /tmp/Dakona_Logo_-_Wordmark.png /tmp/wordmark-transparent.png

# Copy remaining assets
COPY docs/lexi_avatar_384.png /app/client/dist/assets/favicon-32x32.png
COPY docs/lexi_avatar_384.png /app/client/dist/assets/favicon-16x16.png
COPY docs/lexi_avatar_384.png /app/client/dist/assets/apple-touch-icon-180x180.png
COPY docs/microsoft-signin.png /app/client/dist/assets/microsoft-signin.png
COPY docs/custom.css /app/client/dist/assets/custom.css
RUN sed -i 's|</head>|<link rel="stylesheet" href="assets/custom.css" /></head>|' /app/client/dist/index.html

USER node
