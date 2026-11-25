// Lululingo – lille lokal webserver til afspilleren (ingen ekstra pakker nødvendige).
// Brug:  node tools/serve.js            -> http://localhost:5173
//        node tools/serve.js --lan      -> også tilgængelig for din iPhone på samme Wi-Fi
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..', 'docs');
const PORT = Number(process.env.PORT) || 5173;
const HOST = process.argv.includes('--lan') ? '0.0.0.0' : '127.0.0.1';
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.mp4': 'video/mp4',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp'
};

http.createServer((req, res) => {
  let rel;
  try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); return res.end(); }
  // Undertekst-tjenesten (samme kode som Cloudflare-workeren) – så »Tilføj video« også virker derhjemme
  if (rel === '/api/captions') {
    const url = 'file:///' + path.resolve(__dirname, '..', 'worker', 'captions.mjs').replace(/\\/g, '/');
    import(url).then((m) => m.default.fetch(new Request('http://localhost' + req.url, { headers: { Origin: req.headers.origin || '' } })))
      .then(async (r) => { res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(await r.text()); })
      .catch((e) => { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'error', message: String(e && e.message) })); });
    return;
  }
  // Kun til udvikling: gem en video, som appen har lavet, som fast video (videos/<id>/video.json).
  // Bagefter køres »node tools/build-videos.js«. Virker kun fra selve computeren, ikke fra telefonen.
  if (rel === '/api/save-video' && req.method === 'POST') {
    const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
    if (!local) { res.writeHead(403); return res.end(); }
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 5e6) req.destroy(); });
    req.on('end', () => {
      try {
        const v = JSON.parse(body);
        if (!/^[A-Za-z0-9_-]{11}$/.test(v.id) || !Array.isArray(v.lines) || !v.lines.length) throw new Error('ugyldig video');
        delete v.mine;
        const dir = path.resolve(__dirname, '..', 'videos', v.id);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'video.json'), JSON.stringify(v));
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, lines: v.lines.length }));
      } catch (e) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: String(e.message) })); }
    });
    return;
  }
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.resolve(ROOT, '.' + rel);
  if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('Ikke fundet'); }
    const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
    if (range) {
      const start = range[1] ? Number(range[1]) : 0;
      const end = range[2] ? Math.min(Number(range[2]), st.size - 1) : st.size - 1;
      if (start > end || start >= st.size) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end(); }
      res.writeHead(206, { 'Content-Type': type, 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
}).listen(PORT, HOST, () => {
  console.log(`Lululingo: http://localhost:${PORT}/`);
  if (HOST === '0.0.0.0') {
    for (const list of Object.values(os.networkInterfaces())) for (const a of list || []) {
      if (a.family === 'IPv4' && !a.internal) console.log(`På iPhone (samme Wi-Fi): http://${a.address}:${PORT}/`);
    }
  }
});
