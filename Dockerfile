FROM ghcr.io/danny-avila/librechat:latest
USER root
RUN wget -q -O /app/client/dist/assets/logo.svg \
    https://stdaxassets.blob.core.windows.net/branding/Dax-Frontpage.png && \
    wget -q -O /app/client/dist/assets/favicon-32x32.png \
    https://stdaxassets.blob.core.windows.net/branding/lexi_avatar_384.png && \
    wget -q -O /app/client/dist/assets/favicon-16x16.png \
    https://stdaxassets.blob.core.windows.net/branding/lexi_avatar_384.png && \
    wget -q -O /app/client/dist/assets/apple-touch-icon-180x180.png \
    https://stdaxassets.blob.core.windows.net/branding/lexi_avatar_384.png
USER node
