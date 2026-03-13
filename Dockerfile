FROM ghcr.io/danny-avila/librechat:latest
USER root
RUN curl -sfL -o /app/client/dist/assets/logo.svg \
    https://stdaxassets.blob.core.windows.net/branding/Dax-Frontpage.png && \
    curl -sfL -o /app/client/dist/assets/favicon-32x32.png \
    https://stdaxassets.blob.core.windows.net/branding/lexi_avatar_384.png && \
    curl -sfL -o /app/client/dist/assets/favicon-16x16.png \
    https://stdaxassets.blob.core.windows.net/branding/lexi_avatar_384.png && \
    curl -sfL -o /app/client/dist/assets/apple-touch-icon-180x180.png \
    https://stdaxassets.blob.core.windows.net/branding/lexi_avatar_384.png && \
    ls -la /app/client/dist/assets/logo.svg /app/client/dist/assets/favicon-32x32.png
USER node
