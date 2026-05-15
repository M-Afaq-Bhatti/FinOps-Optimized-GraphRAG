# AWS EC2 Deployment Guide — LightRAG

## Architecture
```
Internet → EC2 (t3.micro) → Nginx (port 80) → Docker → FastAPI (port 8000)
                         ↓
                    EBS Volume (rag_storage/ + data/)
```

---

## Step 1 — Launch EC2 Instance

1. Go to **EC2 → Launch Instance** in AWS Console
2. Choose **Amazon Linux 2023** or **Ubuntu 24.04 LTS**
3. Instance type: **t3.micro** (free tier eligible)
4. Storage: **20 GB gp3** (enough for the graph + Docker)
5. Security Group — add these inbound rules:
   | Type  | Port | Source    |
   |-------|------|-----------|
   | SSH   | 22   | Your IP   |
   | HTTP  | 80   | 0.0.0.0/0 |
   | Custom TCP | 8000 | 0.0.0.0/0 (for direct API access) |
6. Create/select a key pair and download it
7. Launch the instance

---

## Step 2 — Transfer Your Project

From your local machine:

```bash
# Replace KEY.pem and EC2_IP with your values
scp -i KEY.pem -r lightrag-project/ ec2-user@EC2_IP:/opt/lightrag
# For Ubuntu, use ubuntu@ instead of ec2-user@
```

---

## Step 3 — SSH into EC2 and Run Setup

```bash
ssh -i KEY.pem ec2-user@EC2_IP
cd /opt/lightrag

# Make bootstrap script executable
chmod +x infra/ec2-bootstrap.sh

# Edit your Gemini API key first!
nano .env   # or: echo "GEMINI_API_KEY=your_key" > .env

# Run setup (installs Docker, builds image, starts container, configures Nginx)
sudo bash infra/ec2-bootstrap.sh
```

---

## Step 4 — Verify

```bash
# Check container is running
docker ps

# Check logs
docker logs lightrag-app

# Test health endpoint
curl http://localhost:8000/api/health

# From your browser:
# http://YOUR_EC2_PUBLIC_IP
```

---

## Step 5 — Ingest Sample Document (Optional)

```bash
# Shell into the container
docker exec -it lightrag-app bash

# Run ingestion
PYTHONPATH=. python -m src.ingest data/sample.txt
```

Or use the web UI — go to **Ingest** tab and paste/upload text.

---

## (Optional) Use S3 for Persistent Storage

Instead of local EBS, mount S3 as the rag_storage directory using **s3fs**:

```bash
# Install s3fs on EC2
sudo yum install -y s3fs-fuse   # Amazon Linux
# or
sudo apt-get install -y s3fs    # Ubuntu

# Create S3 bucket: lightrag-storage-YOUR-NAME
# Mount it
echo "YOUR_ACCESS_KEY:YOUR_SECRET_KEY" > ~/.passwd-s3fs
chmod 600 ~/.passwd-s3fs

mkdir -p /opt/lightrag/rag_storage
s3fs lightrag-storage-YOUR-NAME /opt/lightrag/rag_storage \
  -o passwd_file=~/.passwd-s3fs \
  -o allow_other,use_cache=/tmp/s3cache
```

Then update `docker-compose.yml` to mount `/opt/lightrag/rag_storage:/app/rag_storage`.

---

## Useful Commands

```bash
# Restart the app
docker-compose restart

# Rebuild after code changes
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop
docker-compose down

# SSH port forwarding (access from local machine without opening port 80)
ssh -i KEY.pem -L 8000:localhost:8000 ec2-user@EC2_IP
# Then open http://localhost:8000 on your machine
```

---

## Cost Estimate

| Resource | Spec | Monthly Cost |
|----------|------|-------------|
| EC2 t3.micro | 2 vCPU, 1 GB RAM | ~$8.35 (or FREE with free tier) |
| EBS 20 GB gp3 | Storage | ~$1.60 |
| Gemini API | Free tier: generous limits | $0 |
| **Total** | | **~$10/month** |

> LightRAG + Gemini = GraphRAG at **1/6000th the cost** of Microsoft's GraphRAG.
