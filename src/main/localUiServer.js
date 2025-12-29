import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import fs from 'node:fs/promises';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function safeJoin(rootDir, requestPath) {
  const p = decodeURIComponent(requestPath.split('?')[0] || '/');
  const cleaned = p.replace(/\\/g, '/');
  const rel = cleaned.replace(/^\/+/, '');
  const joined = path.join(rootDir, rel);
  const normalizedRoot = path.resolve(rootDir);
  const normalizedJoined = path.resolve(joined);
  if (!normalizedJoined.startsWith(normalizedRoot)) return null;
  return normalizedJoined;
}

async function fileExists(filePath) {
  try {
    const st = await fs.stat(filePath);
    return st.isFile();
  } catch {
    return false;
  }
}

export async function startLocalUiServer({ rootDir, host = '127.0.0.1', port = 0 } = {}) {
  // In dev, we can proxy UI from Vite and only serve /api/* from here.
  // In prod, we serve files from rootDir (the built renderer directory).
  const hasRootDir = !!rootDir;

  /** @type {Set<import('node:http').ServerResponse>} */
  const sseClients = new Set();
  let lastStatus = { state: 'disconnected', channel: '' };
  let lastConfig = { blocked: [], renames: {} };
  let proxyTarget = null;

  function sseWrite(res, event, data) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  function broadcast(event, data) {
    for (const res of sseClients) {
      try {
        sseWrite(res, event, data);
      } catch {
        // ignore
      }
    }
  }

  const server = http.createServer(async (req, res) => {
    try {
      const urlPath = req.url || '/';

      if (urlPath.startsWith('/api/health')) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ ok: true, sseClients: sseClients.size, lastStatus, lastConfig }, null, 2));
        return;
      }

      if (urlPath.startsWith('/api/config')) {
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(JSON.stringify({ ok: true, status: lastStatus, config: lastConfig }, null, 2));
        return;
      }

      // SSE stream for OBS/browser overlays
      if (urlPath.startsWith('/api/stream')) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-store',
          Connection: 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        });
        res.write('\n');
        sseClients.add(res);
        // Helpful logs for debugging OBS/browser
        console.log(`[ui] SSE client connected (${sseClients.size})`);

        // Send initial status
        sseWrite(res, 'status', lastStatus);
        // Send initial config
        sseWrite(res, 'config', lastConfig);

        // Keep-alive ping
        const ping = setInterval(() => {
          try {
            res.write(': ping\n\n');
          } catch {
            // ignore
          }
        }, 25000);

        req.on('close', () => {
          clearInterval(ping);
          sseClients.delete(res);
          console.log(`[ui] SSE client disconnected (${sseClients.size})`);
        });
        return;
      }

      // Dev proxy mode: forward non-api requests to Vite server
      if (proxyTarget) {
        const targetUrl = new URL(urlPath, proxyTarget).toString();
        const upstream = await fetch(targetUrl, { headers: { 'User-Agent': 'DucChat/1.0' } });
        const buf = Buffer.from(await upstream.arrayBuffer());
        const headers = {
          'Cache-Control': 'no-store',
          'Access-Control-Allow-Origin': '*',
        };
        const contentType = upstream.headers.get('content-type');
        if (contentType) headers['Content-Type'] = contentType;
        res.writeHead(upstream.status, headers);
        res.end(buf);
        return;
      }

      if (!hasRootDir) {
        res.writeHead(500);
        res.end('UI rootDir not configured');
        return;
      }

      let filePath = safeJoin(rootDir, urlPath);
      if (!filePath) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      // Single-page entry fallback
      if (urlPath === '/' || urlPath.startsWith('/#') || urlPath.startsWith('/?')) {
        filePath = path.join(rootDir, 'index.html');
      } else if (urlPath.endsWith('/')) {
        filePath = path.join(filePath, 'index.html');
      }

      // If not found, fallback to index.html (for future routing or direct load)
      if (!(await fileExists(filePath))) {
        const fallback = path.join(rootDir, 'index.html');
        if (await fileExists(fallback)) filePath = fallback;
      }

      const ext = path.extname(filePath).toLowerCase();
      const type = MIME[ext] || 'application/octet-stream';

      const body = await fs.readFile(filePath);
      res.writeHead(200, {
        'Content-Type': type,
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(body);
    } catch (e) {
      res.writeHead(500);
      res.end('Internal Server Error');
    }
  });

  // WebSocket proxy for Vite HMR in dev mode.
  // When the UI is served from this local server (8760) and proxied to Vite (517x),
  // the browser will connect to ws://127.0.0.1:8760/ for HMR. We must forward the
  // Upgrade request to the Vite dev server.
  server.on('upgrade', (req, socket, head) => {
    try {
      if (!proxyTarget) {
        socket.destroy();
        return;
      }

      const target = new URL(proxyTarget);
      const targetPort = Number(target.port) || (target.protocol === 'https:' ? 443 : 80);
      const targetHost = target.hostname;

      const upstream = net.connect(targetPort, targetHost, () => {
        // Reconstruct the raw HTTP upgrade request
        let raw = `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`;
        for (const [k, v] of Object.entries(req.headers)) {
          if (typeof v === 'undefined') continue;
          if (Array.isArray(v)) raw += `${k}: ${v.join(', ')}\r\n`;
          else raw += `${k}: ${v}\r\n`;
        }
        raw += `\r\n`;
        upstream.write(raw);
        if (head && head.length) upstream.write(head);

        // Bi-directional pipe
        upstream.pipe(socket);
        socket.pipe(upstream);
      });

      upstream.on('error', () => socket.destroy());
      socket.on('error', () => upstream.destroy());
    } catch {
      socket.destroy();
    }
  });

  // Prefer a stable port for OBS, fallback if already in use
  const preferred = port && port > 0 ? port : 8760;
  const candidates = [preferred, preferred + 1, preferred + 2, preferred + 3, preferred + 4, 0];
  let lastErr = null;
  for (const p of candidates) {
    try {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(p, host, resolve);
      });
      lastErr = null;
      break;
    } catch (e) {
      lastErr = e;
      try {
        server.removeAllListeners('error');
      } catch {
        // ignore
      }
    }
  }
  if (lastErr) throw lastErr;

  const addr = server.address();
  const actualPort = typeof addr === 'object' && addr ? addr.port : port;
  const baseUrl = `http://${host}:${actualPort}`;

  return {
    url: `${baseUrl}/`,
    // Same URL, just a friendlier naming for UI. Keep obsUrl for backwards compatibility.
    interfaceUrl: `${baseUrl}/?overlay=1#/`,
    obsUrl: `${baseUrl}/?overlay=1#/`,
    port: actualPort,
    setProxyTarget: (url) => {
      proxyTarget = url ? String(url) : null;
    },
    broadcastMessage: (msg) => broadcast('message', msg),
    broadcastStatus: (status) => {
      lastStatus = status || lastStatus;
      broadcast('status', lastStatus);
    },
    broadcastConfig: (config) => {
      lastConfig = config || lastConfig;
      broadcast('config', lastConfig);
    },
    setConfig: (config) => {
      lastConfig = config || lastConfig;
    },
    close: () =>
      new Promise((resolve) => {
        for (const res of sseClients) {
          try {
            res.end();
          } catch {
            // ignore
          }
        }
        sseClients.clear();
        server.close(() => resolve());
      }),
  };
}


