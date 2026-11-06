# ⚡ Live Counter Web App (React + Express)

A high-vibe, real-time counter application engineered with a **React (Vite + Tailwind CSS)** frontend, an **Express.js** backend, and automated deployment scripts for **AWS EC2**.

---

## ✨ Features

- **Real-Time Synchronization**: Connects to the Express backend via Server-Sent Events (SSE) so counters update seamlessly across all connected devices and browser tabs.
- **Dedicated Buttons**:
  - **Increase (`+ Increase`)**: Atomically increments the count on the server, persists state, and broadcasts the update.
  - **Refresh (`↻ Refresh`)**: Manually queries `/api/count` to pull and display the absolute latest server state.
- **State Persistence**: Persists counter state in `backend/data/counter.json` so counts survive server restarts and instance reboots.
- **Haptic & Audio Vibe**: Built-in sound effects synthesizer (via native Web Audio API) with mute toggle, scale-pop animations, and keyboard shortcuts (`Space` to Increase, `R` to Refresh).
- **Production-Ready Single Port**: In production, the Express backend serves the optimized React build directly on a single port (5000), eliminating CORS issues and simplifying hosting.

---

## 📁 Project Architecture

```text
live-counter-app/
├── backend/
│   ├── server.js              # Express REST API + SSE stream + static file server
│   ├── package.json           # Express, CORS, dotenv dependencies
│   └── data/
│       └── counter.json       # Persisted state store
├── frontend/
│   ├── src/
│   │   ├── App.jsx            # Main Live Counter UI with buttons & animations
│   │   ├── main.jsx           # React DOM entry point
│   │   └── index.css          # Tailwind CSS + custom glassmorphic glow styles
│   ├── index.html             # HTML template with Google Fonts
│   ├── vite.config.js         # Vite configuration with API reverse proxy
│   ├── tailwind.config.js     # Tailwind design tokens
│   └── package.json           # Frontend dependencies
├── deploy/
│   ├── ec2-setup.sh           # One-click automated setup script for Ubuntu EC2
│   ├── nginx.conf             # Production reverse proxy configuration (Port 80 -> 5000)
│   └── live-counter.service   # Systemd service unit file
├── Dockerfile                 # Multi-stage production container build
├── docker-compose.yml         # Container orchestrator
├── package.json               # Root monorepo workspace scripts
└── README.md                  # Complete documentation
```

---

## 💻 Local Development

### Prerequisites
- Node.js 18+ and npm installed ([nodejs.org](https://nodejs.org/))

### Quick Start

1. **Install backend dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Install frontend dependencies:**
   ```bash
   cd ../frontend
   npm install
   ```

3. **Run both servers concurrently:**
   - Terminal 1 (Backend):
     ```bash
     cd backend
     npm run dev
     # Backend runs on http://localhost:5000
     ```
   - Terminal 2 (Frontend):
     ```bash
     cd frontend
     npm run dev
     # Frontend runs on http://localhost:3000
     ```

4. Open your browser at **`http://localhost:3000`**.

---

## ☁️ Step-by-Step AWS EC2 Hosting Guide

Follow this guide to launch and host your Live Counter on an AWS EC2 instance.

### Step 1: Launch an EC2 Instance on AWS

1. Log into your **AWS Management Console** and open the **EC2 Dashboard**.
2. Click **"Launch Instance"**.
3. **Name**: `live-counter-server`
4. **Application and OS Images (AMI)**: Choose **Ubuntu** (Ubuntu Server 24.04 LTS or 22.04 LTS - *Free tier eligible*).
5. **Instance Type**: Select **`t2.micro`** (or `t3.micro` if in newer regions) - *Free tier eligible*.
6. **Key pair (login)**:
   - Click **Create new key pair**.
   - Key pair name: `live-counter-key`
   - Key pair type: `RSA`
   - Private key file format: `.pem` (for OpenSSH / macOS / Linux / Windows PowerShell).
   - Click **Create key pair** and save the downloaded `.pem` file safely.

### Step 2: Configure Network Security Group (Critical!)

Under **Network settings**, check the following boxes:
- ✅ **Allow SSH traffic from Anywhere (`0.0.0.0/0`)** or your IP (Port 22)
- ✅ **Allow HTTP traffic from the internet (`0.0.0.0/0`)** (Port 80)
- ✅ *(Optional)* Add Custom TCP Rule for **Port 5000** if you want direct access without Nginx:
  - Type: `Custom TCP`
  - Port range: `5000`
  - Source: `Anywhere (0.0.0.0/0)`
7. Click **"Launch Instance"**.

---

### Step 3: Connect to Your EC2 Instance via SSH

Open your terminal or Windows PowerShell in the folder where your `.pem` file was downloaded:

```bash
# On Linux/macOS, set secure permissions:
chmod 400 live-counter-key.pem

# SSH into Ubuntu instance (replace with your EC2 Public IP):
ssh -i live-counter-key.pem ubuntu@<YOUR_EC2_PUBLIC_IP>
```

---

### Step 4: Transfer Your Code to the EC2 Instance

You have two convenient options:

#### Option A: Clone via Git (Recommended)
Push this `live-counter-app` folder to a GitHub repository, then on your EC2 terminal:
```bash
git clone https://github.com/<your-username>/live-counter-app.git
cd live-counter-app
```

#### Option B: Direct Copy via SCP from your local machine
From your local computer terminal:
```bash
scp -i live-counter-key.pem -r ./live-counter-app ubuntu@<YOUR_EC2_PUBLIC_IP>:~/live-counter-app
```
Then on your EC2 terminal:
```bash
cd ~/live-counter-app
```

---

### Step 5: Automated 1-Click Deployment on EC2

We included an automated deployment script `deploy/ec2-setup.sh`. Run:

```bash
chmod +x deploy/ec2-setup.sh
./deploy/ec2-setup.sh
```

**What this script does automatically:**
1. Updates package repositories.
2. Installs Node.js 20 LTS and build essentials.
3. Installs PM2 process manager to keep your app running 24/7 across crashes/reboots.
4. Builds the React frontend (`npm run build`).
5. Configures Nginx reverse proxy so your app is accessible directly via standard HTTP port 80.
6. Configures the firewall and starts the service.

---

### Step 6: Test Your Live App

Once the script completes, open your web browser and navigate to:
```text
http://<YOUR_EC2_PUBLIC_IP>
```

You will see the **Live Counter** in action!
- Click **Increase** to see the counter increment live.
- Click **Refresh** to sync and confirm the latest server state.
- Open the same URL on your phone or in an incognito tab — see real-time updates synchronize across screens!

---

### Helpful Server Management Commands on EC2

```bash
# View running process status
pm2 status

# View live application logs
pm2 logs live-counter

# Restart application
pm2 restart live-counter

# Restart Nginx
sudo systemctl restart nginx
```

