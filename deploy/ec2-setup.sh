#!/usr/bin/env bash
# ==============================================================================
# AWS EC2 Quick-Start Bootstrap Script for Live Counter Web App
# Target OS: Ubuntu 22.04 LTS / 24.04 LTS on AWS EC2 (t2.micro / t3.micro Free Tier)
# ==============================================================================

set -e

echo "🚀 [1/6] Updating system packages..."
sudo apt-get update -y
sudo apt-get upgrade -y
sudo apt-get install -y curl git ufw nginx

echo "📦 [2/6] Installing Node.js 20 LTS (NodeSource)..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"

echo "⚡ [3/6] Installing PM2 process manager globally..."
sudo npm install -g pm2

APP_DIR="/var/www/live-counter-app"

echo "📂 [4/6] Setting up project at $APP_DIR..."
# If current directory contains package.json, copy it to APP_DIR
CURRENT_DIR=$(pwd)
if [ -f "$CURRENT_DIR/backend/server.js" ]; then
    echo "Copying files from current directory..."
    sudo mkdir -p $APP_DIR
    sudo cp -r "$CURRENT_DIR"/* $APP_DIR/
    sudo chown -R $USER:$USER $APP_DIR
else
    echo "Creating directory $APP_DIR..."
    sudo mkdir -p $APP_DIR
    sudo chown -R $USER:$USER $APP_DIR
fi

cd $APP_DIR

echo "🔨 [5/6] Installing dependencies and building production frontend..."
cd backend && npm install --omit=dev && cd ..
cd frontend && npm install && npm run build && cd ..

echo "🛡️ [6/6] Starting application with PM2..."
cd backend
pm2 delete live-counter 2>/dev/null || true
pm2 start server.js --name "live-counter" --env PORT=5000
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp /home/$USER || true

echo "🌐 Configuring Nginx reverse proxy (Port 80 -> Port 5000)..."
NGINX_CONF="/etc/nginx/sites-available/live-counter"
sudo bash -c "cat > $NGINX_CONF" << 'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;

        # WebSockets / SSE Support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;

        # Disable buffering for live Server-Sent Events (SSE)
        proxy_buffering off;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;

        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sf /etc/nginx/sites-available/live-counter /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Firewall configuration
sudo ufw allow 'Nginx Full'
sudo ufw allow 22/tcp
echo "y" | sudo ufw enable 2>/dev/null || true

PUBLIC_IP=$(curl -s http://checkip.amazonaws.com || curl -s https://ifconfig.me || echo "<YOUR_EC2_PUBLIC_IP>")

echo ""
echo "=========================================================="
echo "🎉 SUCCESS! Your Live Counter Web App is now running!"
echo "🌐 Open in browser:  http://${PUBLIC_IP}"
echo "📊 PM2 Status:       pm2 status"
echo "📜 View Logs:        pm2 logs live-counter"
echo "=========================================================="

