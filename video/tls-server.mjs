/**
 * Máy chủ giả chạy HTTPS, dùng riêng cho việc quay video.
 * Cần HTTPS vì Chrome có sẵn danh sách HSTS: gõ http://facebook.com sẽ tự nâng lên https://.
 * Chứng chỉ tự ký; Chromium được khởi chạy kèm --ignore-certificate-errors.
 */
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:https';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

const PAGE = (host, url) => `<!doctype html><html lang="vi"><head><meta charset="utf-8">
<title>${host}</title><style>
  :root{color-scheme:light}
  *{box-sizing:border-box;margin:0}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"DejaVu Sans",sans-serif;
       background:#F0F2F5;color:#1C1E21;padding:18px}
  .top{display:flex;align-items:center;gap:12px;margin-bottom:18px}
  .avatar{width:40px;height:40px;border-radius:50%;background:#D8DADF;flex:none}
  #site{font-size:15px;font-weight:600;color:#65676B;letter-spacing:-.01em}
  #path{font-size:12px;color:#8A8D91}
  .card{background:#fff;border-radius:10px;padding:16px;margin-bottom:12px;box-shadow:0 1px 2px rgba(0,0,0,.1)}
  .row{display:flex;gap:11px;align-items:center;margin-bottom:12px}
  .l{height:11px;border-radius:99px;background:#E4E6EB}
  .block{height:150px;border-radius:8px;background:#E4E6EB;margin-top:4px}
  .note{margin-top:20px;font-size:12px;color:#8A8D91;text-align:center}
</style></head>
<body>
  <div class="top">
    <span class="avatar"></span>
    <span><span id="site">${host}</span><br><span id="path">${url}</span></span>
  </div>
  <div class="card">
    <div class="row"><span class="avatar"></span><span style="flex:1">
      <span class="l" style="width:42%;display:block"></span>
      <span class="l" style="width:26%;display:block;margin-top:7px;height:9px"></span></span></div>
    <div class="block"></div>
  </div>
  <div class="card">
    <div class="row"><span class="avatar"></span><span style="flex:1">
      <span class="l" style="width:54%;display:block"></span>
      <span class="l" style="width:31%;display:block;margin-top:7px;height:9px"></span></span></div>
    <span class="l" style="width:88%;display:block"></span>
    <span class="l" style="width:66%;display:block;margin-top:9px"></span>
  </div>
  <div class="card">
    <div class="row"><span class="avatar"></span><span style="flex:1">
      <span class="l" style="width:38%;display:block"></span>
      <span class="l" style="width:22%;display:block;margin-top:7px;height:9px"></span></span></div>
    <div class="block" style="height:110px"></div>
  </div>
  <p class="note">Trang giữ chỗ dùng cho demo</p>
</body></html>`;

function ensureCert() {
  const dir = join(HERE, 'cert');
  if (existsSync(join(dir, 'key.pem')) && existsSync(join(dir, 'cert.pem'))) return;
  mkdirSync(dir, { recursive: true });
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '3650', '-subj', '/CN=localhost',
    '-keyout', join(dir, 'key.pem'), '-out', join(dir, 'cert.pem')], { stdio: 'ignore' });
}

export function startFakeWebTls(port = 8443) {
  ensureCert();
  const server = createServer(
    {
      key: readFileSync(join(HERE, 'cert/key.pem')),
      cert: readFileSync(join(HERE, 'cert/cert.pem'))
    },
    (req, res) => {
      const host = (req.headers.host || 'unknown').split(':')[0];
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(PAGE(host, req.url));
    }
  );
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}
