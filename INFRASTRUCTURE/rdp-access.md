# RDP Remote Access — RICHARD-WS (Forge)

**Configured:** 2026-05-08 by Forge

## What's Set Up

- RDP enabled on RICHARD-WS (`fDenyTSConnections = 0`)
- Firewall rule: `RDP-In-3389-Forge` (inbound TCP 3389)
- Cloudflare tunnel: `dax-desktop` (d11dfcb8) — `rdp.dakona.net → tcp://localhost:3389`
- DNS CNAME: `rdp.dakona.net → d11dfcb8-d6da-4d61-a7e4-947c8716a685.cfargotunnel.com` (proxied)
- cloudflared config: `C:\Users\18473\.cloudflared\config.yml`
- **No Cloudflare Access gate** — currently open to anyone with cloudflared + hostname

## Client Connection Instructions

1. Install cloudflared on remote machine
2. Run:
   ```bash
   cloudflared access rdp --hostname rdp.dakona.net --url localhost:33389
   ```
3. Open Remote Desktop → connect to `localhost:33389`
4. Login: `RICHARD-WS\18473`

## Notes

- AT&T modem firewall is not involved — tunnel is outbound HTTPS only
- No reboot required for setup
- DNS token: `cloudflare-tunnel-edit-token` (kvdaxdakonapilot)
- Credentials used: `cloudflare-tunnel-edit-token` from KV had DNS write permission; `cloudflare-dns-token` did not
- First shared with: Justin (Dew Wealth) via ShareFile 2026-05-08
- To add email gate: create Cloudflare Access Application for `rdp.dakona.net` (self-hosted, TCP), add email policy
