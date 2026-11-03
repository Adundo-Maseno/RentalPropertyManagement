const fs = require('fs');
const s = fs.readFileSync('server.js', 'utf8');

const idxUser = s.indexOf("if (pathname === '/api/users' && method === 'POST')");
console.log('=== Users POST ===');
console.log(s.substring(idxUser, idxUser + 800));
