const fs = require('fs');

const serverJs = fs.readFileSync('server.js', 'utf8');
const catchallJs = fs.readFileSync('functions/api/[[catchall]].js', 'utf8');

// server.js route pattern: if (pathname === '/api/...' || pathname.startsWith('/api/...'))
// or method check: if (req.method === 'GET' && pathname === '...')
const serverRoutes = [];
const sRegex = /(?:pathname|path)\s*===?\s*['"](\/api\/[^'"]+)['"]/g;
let m;
while ((m = sRegex.exec(serverJs)) !== null) {
  serverRoutes.push(m[1]);
}
const sStartRegex = /(?:pathname|path)\.startsWith\(['"](\/api\/[^'"]+)['"]\)/g;
while ((m = sStartRegex.exec(serverJs)) !== null) {
  serverRoutes.push(m[1] + '*');
}

const catchallRoutes = [];
const cRegex = /(?:pathname|path)\s*===?\s*['"](\/api\/[^'"]+)['"]/g;
while ((m = cRegex.exec(catchallJs)) !== null) {
  catchallRoutes.push(m[1]);
}
const cStartRegex = /(?:pathname|path)\.startsWith\(['"](\/api\/[^'"]+)['"]\)/g;
while ((m = cStartRegex.exec(catchallJs)) !== null) {
  catchallRoutes.push(m[1] + '*');
}

console.log('Unique server.js routes:', new Set(serverRoutes).size);
console.log('Unique catchall.js routes:', new Set(catchallRoutes).size);

const serverSet = new Set(serverRoutes);
const catchallSet = new Set(catchallRoutes);

console.log('In server.js but not in catchall.js:');
for (const r of serverSet) {
  if (!catchallSet.has(r)) {
    console.log('  ', r);
  }
}

console.log('In catchall.js but not in server.js:');
for (const r of catchallSet) {
  if (!serverSet.has(r)) {
    console.log('  ', r);
  }
}

