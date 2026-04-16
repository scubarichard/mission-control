# DAX PWA — Icon & Manifest Deployment Guide

## What this does
Makes dax.dakona.com installable as a home screen app on iPhone, Android, and desktop.
Users see a proper DAX icon, no browser chrome, full-screen experience — identical to a native app.

## Files needed
- `manifest.json` — PWA manifest (this folder)
- `dax-icon-192.png` — 192x192 icon (dark navy background, white DAX text)
- `dax-icon-512.png` — 512x512 icon (same design, high-res)
- `dax-icon-180.png` — 180x180 Apple touch icon

## Icon design spec
- Background: #1F3864 (dark navy)
- Text: "DAX" in white, Calibri Bold or similar sans-serif
- No border radius needed — iOS applies it automatically
- Keep 20% safe zone padding around the text

## How to deploy into LibreChat

### Step 1 — Generate icons
Use any icon generator (e.g. https://realfavicongenerator.net) with the DAX logo.
Place the output PNG files in the LibreChat container at:
  /app/client/public/assets/dax-icon-192.png
  /app/client/public/assets/dax-icon-512.png
  /app/client/public/assets/dax-icon-180.png

### Step 2 — Add manifest to LibreChat
Copy manifest.json to:
  /app/client/public/manifest.json

### Step 3 — Link manifest in LibreChat index.html
In /app/client/public/index.html, add inside <head>:
  <link rel="manifest" href="/manifest.json" />
  <link rel="apple-touch-icon" href="/assets/dax-icon-180.png" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="DAX" />
  <meta name="theme-color" content="#1F3864" />

### Step 4 — Rebuild and redeploy LibreChat container
  cd /repo
  docker build -t acrdaxdakona.azurecr.io/librechat-dax:v0.5.4-pwa .
  az acr login --name acrdaxdakona
  docker push acrdaxdakona.azurecr.io/librechat-dax:v0.5.4-pwa
  az containerapp update --name ca-dax-dakona-pilot --resource-group rg-dax-dakona-pilot \
    --image acrdaxdakona.azurecr.io/librechat-dax:v0.5.4-pwa

## How to install on iPhone (after deployment)
1. Open Safari → go to dax.dakona.com
2. Tap the Share button (box with arrow)
3. Scroll down → tap "Add to Home Screen"
4. Name it "DAX" → tap Add
5. DAX icon appears on home screen — tap to open full screen

## Notes for Forge / Triton
- This is a v0.5.4 patch — no workflow changes, container only
- Must be deployed to both Dakona pilot AND ICP instance once provisioned
- Icon files need to be created — use the spec above or ask Richard for the DAX logo assets
- Test on iPhone Safari and Android Chrome before marking complete
