# ghost.chat — Deploy Guide

Ephemeral P2P encrypted chat. No subdomain needed — runs on the same domain via nginx location blocks.

## Architecture

```
Cloudflare (SSL) → nginx :80
  ├─ /ghost/ws   → signaling server :3002 (WebSocket)
  ├─ /ghost/api/ → signaling server :3002 (HTTP)
  └─ /*          → portfolio Docker :3001 (static, includes /chat page)
```

## 1. Signaling server

```bash
cd server
cp .env.example .env
# Set INVITE_SECRET to a random string:
#   openssl rand -hex 32
nano .env

npm install
npm run build
```

## 2. systemd service

```bash
sudo cp ghost-chat.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable ghost-chat
sudo systemctl start ghost-chat
sudo systemctl status ghost-chat
```

## 3. nginx

Add the location blocks from `nginx/ghost-chat.conf` to `/etc/nginx/sites-available/default`, **above** the existing `location /` catch-all:

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    # Ghost Chat — WebSocket
    location /ghost/ws {
        proxy_pass http://127.0.0.1:3002/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # Ghost Chat — API
    location /ghost/api/ {
        proxy_pass http://127.0.0.1:3002/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Existing portfolio proxy (keep this last)
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Then:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 4. CSP update

Update the CSP in the portfolio's `nginx.conf` (inside the Docker container) to allow WebSocket connections:

```
connect-src 'self' wss: ws:;
```

And update `Permissions-Policy` to allow camera/microphone for calls:

```
camera=(self), microphone=(self), geolocation=()
```

## 5. Rebuild & deploy the portfolio

```bash
cd /home/ubuntu/lightweightPortfolio
npm run build
docker build -t swap-portfolio .
docker stop swap-portfolio && docker rm swap-portfolio
docker run -d --name swap-portfolio -p 3001:80 swap-portfolio
```

## Verify

```bash
curl http://localhost:3002/api/health
# {"status":"ok","rooms":0,"peers":0,...}
```
