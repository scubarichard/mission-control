FROM ghcr.io/danny-avila/librechat:latest
USER root
COPY docs/logo.svg /app/client/dist/assets/logo.svg
COPY docs/lexi_avatar_384.png /app/client/dist/assets/favicon-32x32.png
COPY docs/lexi_avatar_384.png /app/client/dist/assets/favicon-16x16.png
COPY docs/lexi_avatar_384.png /app/client/dist/assets/apple-touch-icon-180x180.png
USER node
