const fs = require('fs');
const s = fs.readFileSync('server.js', 'utf8');
const target = "pathname === '/api/invoices' && method === 'POST'";
const idx = s.indexOf(target);
console.log(s.substring(idx + 1000, idx + 2400));
