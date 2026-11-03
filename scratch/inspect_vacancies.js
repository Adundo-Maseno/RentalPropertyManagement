const fs = require('fs');
const s = fs.readFileSync('server.js', 'utf8');
const idx = s.indexOf('/api/public/vacancies');
console.log(s.substring(idx, idx + 800));
