const fs = require('fs');
const s = fs.readFileSync('server.js', 'utf8');

const idxProp = s.indexOf("if (pathname === '/api/properties' && method === 'POST')");
console.log('=== Properties POST ===');
console.log(s.substring(idxProp, idxProp + 550));

const idxUnit = s.indexOf("if (pathname === '/api/units' && method === 'POST')");
console.log('=== Units POST ===');
console.log(s.substring(idxUnit, idxUnit + 650));
