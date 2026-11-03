const fs = require('fs');
const s = fs.readFileSync('server.js', 'utf8');
const target = "pathname === '/api/payments' && method === 'POST'";
const idx = s.indexOf(target);
console.log(s.substring(idx, idx + 1200));
