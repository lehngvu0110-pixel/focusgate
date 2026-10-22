/**
 * FocusGate Desktop — máy chủ đồng bộ nội bộ.
 * Chỉ lắng nghe 127.0.0.1 và chỉ nhận yêu cầu từ extension (hoặc không có Origin),
 * nên trang web bình thường không chọc vào được.
 */
import { createServer } from 'node:http';

const MAX_BODY = 2 * 1024 * 1024;

export function createSyncServer(store, { port = 47823, host = '127.0.0.1' } = {}) {
  const server = createServer(async (req, res) => {
    const origin = req.headers.origin;
    const allowed = !origin || /^chrome-extension:\/\//.test(origin) || /^moz-extension:\/\//.test(origin)
      || /^safari-web-extension:\/\//.test(origin);

    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    if (!allowed) return json(res, 403, { error: 'Chỉ extension mới được kết nối.' });

    const url = new URL(req.url, 'http://localhost');
    try {
      if (req.method === 'GET' && url.pathname === '/state') {
        return json(res, 200, { state: store.get(), gate: store.gate(), summary: store.summary() });
      }
      if (req.method === 'GET' && url.pathname === '/ping') {
        return json(res, 200, { ok: true, app: 'focusgate-desktop', updatedAt: store.get().updatedAt || 0 });
      }
      if (req.method === 'POST' && url.pathname === '/state') {
        const body = await readBody(req);
        if (!body || typeof body !== 'object' || !body.state) return json(res, 400, { error: 'Thiếu state' });
        store.replace(body.state);
        return json(res, 200, { ok: true, state: store.get() });
      }
      return json(res, 404, { error: 'Không có đường dẫn này' });
    } catch (e) {
      return json(res, 500, { error: String(e.message || e) });
    }
  });

  return {
    server,
    listen: () => new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, host, () => resolve(server.address().port));
    }),
    close: () => new Promise((r) => server.close(r))
  };
}

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('Dữ liệu quá lớn')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve(null);
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new Error('JSON không hợp lệ')); }
    });
    req.on('error', reject);
  });
}
