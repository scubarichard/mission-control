FROM node:20-slim

# Install Azure CLI + PowerShell Core + git
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      curl ca-certificates apt-transport-https lsb-release gnupg git && \
    # Azure CLI
    curl -sL https://aka.ms/InstallAzureCLIDeb | bash && \
    # PowerShell Core
    curl -sL https://packages.microsoft.com/keys/microsoft.asc | \
      gpg --dearmor -o /usr/share/keyrings/microsoft.gpg && \
    CODENAME=$(lsb_release -cs) && \
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/microsoft.gpg] https://packages.microsoft.com/repos/microsoft-debian-${CODENAME}-prod ${CODENAME} main" \
      > /etc/apt/sources.list.d/microsoft.list && \
    apt-get update && apt-get install -y --no-install-recommends powershell && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY server.js .

ENV MCP_TRANSPORT=sse
ENV PORT=3001
ENV DAX_REPO_PATH=/repo

EXPOSE 3001

COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "const http=require('http');http.get('http://localhost:3001/health',r=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

ENTRYPOINT ["/app/entrypoint.sh"]
