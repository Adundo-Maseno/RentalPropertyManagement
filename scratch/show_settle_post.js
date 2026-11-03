const fs = require('fs');
const s = fs.readFileSync('server.js', 'utf8');

const idxSettle = s.indexOf("if (pathname.startsWith('/api/inspections/') && pathname.endsWith('/settle-deposit') && method === 'POST')");
console.log('=== Settle Deposit ===');
console.log(s.substring(idxSettle, idxSettle + 1100));
