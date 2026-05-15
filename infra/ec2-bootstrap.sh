#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# LightRAG EC2 Bootstrap Script
# Run as EC2 User Data on Amazon Linux 2023 or Ubuntu 24.04
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail
LOG=/var/log/lightrag-setup.log
exec > >(tee -a $LOG) 2>&1

echo "=== LightRAG Setup Starting: $(date) ==="

# ── 1. Update system ──────────────────────────────────────────────────────────
if command -v yum &>/dev/null; then
  yum update -y
  yum install -y docker git curl
  systemctl enable docker && systemctl start docker
  usermod -aG docker ec2-user
else
  apt-get update -y
  apt-get install -y docker.io docker-compose-plugin git curl
  systemctl enable docker && systemctl start docker
  usermod -aG docker ubuntu
fi

# ── 2. Install Docker Compose (standalone) ───────────────────────────────────
COMPOSE_VERSION="v2.27.0"
curl -SL "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-x86_64" \
  -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# ── 3. Clone / place the project ─────────────────────────────────────────────
# Option A: clone from your GitHub repo (replace URL)
# git clone https://github.com/YOUR_USERNAME/lightrag-project.git /opt/lightrag

# Option B: the project is already here (when using S3 or SCP to transfer)
# Assuming project is at /opt/lightrag — adjust as needed
mkdir -p /opt/lightrag
cd /opt/lightrag

# ── 4. Write .env ─────────────────────────────────────────────────────────────
# IMPORTANT: Replace YOUR_KEY with your actual Gemini API key
# In production, use AWS Secrets Manager or SSM Parameter Store instead
cat > /opt/lightrag/.env << 'ENVEOF'
GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE
RAG_STORAGE_DIR=/app/rag_storage
DATA_DIR=/app/data
ENVEOF

# ── 5. Build and start ────────────────────────────────────────────────────────
cd /opt/lightrag
docker-compose up -d --build

# ── 6. Configure Nginx reverse proxy (optional, for port 80) ─────────────────
if command -v yum &>/dev/null; then
  amazon-linux-extras enable nginx1 2>/dev/null || true
  yum install -y nginx
else
  apt-get install -y nginx
fi

cat > /etc/nginx/conf.d/lightrag.conf << 'NGINXEOF'
server {
    listen 80;
    server_name _;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 120s;
    }
}
NGINXEOF

systemctl enable nginx && systemctl start nginx

echo "=== LightRAG Setup Complete: $(date) ==="
echo "Access the app at: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)"
