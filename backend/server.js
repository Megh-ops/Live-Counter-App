const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'counter.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-memory state with persistence fallback
let state = {
  count: 0,
  peakCount: 0,
  totalIncrements: 0,
  lastUpdated: new Date().toISOString(),
};

// Load initial state if file exists
try {
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    state = { ...state, ...parsed };
    console.log(`[Backend] Loaded saved state: count = ${state.count}`);
  }
} catch (err) {
  console.warn('[Backend] Could not load persisted data, starting fresh:', err.message);
}

// Helper to save state to disk
function persistState() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Backend] Error writing to data file:', err.message);
  }
}

// Active Server-Sent Event (SSE) clients for real-time live sync
const sseClients = new Set();

function broadcastState() {
  const payload = `data: ${JSON.stringify(getStatePayload())}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch (err) {
      sseClients.delete(client);
    }
  }
}

function getStatePayload() {
  return {
    count: state.count,
    peakCount: state.peakCount,
    totalIncrements: state.totalIncrements,
    lastUpdated: state.lastUpdated,
    connectedUsers: sseClients.size,
  };
}

// Middleware
app.use(cors());
app.use(express.json());

// Request logger for easy debugging on EC2
app.use((req, res, next) => {
  if (req.path !== '/api/count/stream') {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  }
  next();
});

// API Routes

// 1. Get current count
app.get('/api/count', (req, res) => {
  res.json(getStatePayload());
});

// 2. Increment count
app.post('/api/count/increment', (req, res) => {
  const step = Number(req.body?.step) || 1;
  state.count += step;
  if (state.count > state.peakCount) {
    state.peakCount = state.count;
  }
  state.totalIncrements += 1;
  state.lastUpdated = new Date().toISOString();

  persistState();
  broadcastState();

  res.json({
    success: true,
    message: 'Count incremented successfully',
    ...getStatePayload(),
  });
});

// 3. Server-Sent Events (SSE) for automatic real-time push
app.get('/api/count/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  // Send current state immediately on connect
  res.write(`data: ${JSON.stringify(getStatePayload())}\n\n`);

  sseClients.add(res);
  broadcastState(); // notify all about new user count

  req.on('close', () => {
    sseClients.delete(res);
    broadcastState();
  });
});

// 4. Health check endpoint (vital for AWS EC2 Target Groups or status monitoring)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: `${Math.floor(process.uptime())} seconds`,
    timestamp: new Date().toISOString(),
    activeClients: sseClients.size,
  });
});

// Serve frontend build in production
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(frontendDist)) {
  console.log(`[Backend] Serving static frontend from: ${frontendDist}`);
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`===============================================`);
  console.log(`🚀 Live Counter Backend running on port ${PORT}`);
  console.log(`📡 Local API:     http://localhost:${PORT}/api/count`);
  console.log(`🩺 Health check: http://localhost:${PORT}/api/health`);
  console.log(`===============================================`);
});

