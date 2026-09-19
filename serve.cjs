const http = require('http'), fs = require('fs'), path = require('path');
const TIPOS = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript' };
http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  const f = path.join(__dirname, u === '/' ? 'index.html' : u);
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); return res.end('nao achei ' + u); }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'text/plain' });
    res.end(d);
  });
}).listen(8099, () => console.log('servindo em http://localhost:8099'));
