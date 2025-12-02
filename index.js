// index.js
// Bridge RealSense → Node → Unity using WebSockets.
// - Python/RealSense connects to ws://HOST/ws/realsense and SENDS frames.
// - Unity connects to ws://HOST/ws/unity and RECEIVES frames.
// Node does not interpret the payload: it just relays it.

const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);

// Basic CORS so Unity / other hosts can talk to this server
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

// Simple health check
app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

// --- WebSocket servers ---
// RealSense producer (Python)
const rsWss = new WebSocket.Server({ noServer: true });
// Unity consumers
const unityWss = new WebSocket.Server({ noServer: true });

const unityClients = new Set();

// When Python/RealSense connects
rsWss.on('connection', (ws) => {
  console.log('RealSense producer connected');

  ws.on('message', (data, isBinary) => {
    // Relay this message as-is to all Unity clients
    for (const client of unityClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data, { binary: isBinary });
      }
    }
  });

  ws.on('close', () => {
    console.log('RealSense producer disconnected');
  });
});

// When Unity connects
unityWss.on('connection', (ws) => {
  console.log('Unity client connected');
  unityClients.add(ws);

  ws.on('close', () => {
    unityClients.delete(ws);
    console.log('Unity client disconnected');
  });
});

// Route upgrades based on URL
server.on('upgrade', (req, socket, head) => {
  if (req.url === '/ws/realsense') {
    rsWss.handleUpgrade(req, socket, head, (ws) => {
      rsWss.emit('connection', ws, req);
    });
  } else if (req.url === '/ws/unity') {
    unityWss.handleUpgrade(req, socket, head, (ws) => {
      unityWss.emit('connection', ws, req);
    });
  } else {
    socket.destroy();
  }
});

// Use Render's PORT or 3001 locally
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`RealSense bridge server listening on port ${PORT}`);
});
