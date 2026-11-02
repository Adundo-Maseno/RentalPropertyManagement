const fs = require('fs');

const appJs = fs.readFileSync('public/app.js', 'utf8');
const rentalsHtml = fs.readFileSync('public/rentals.html', 'utf8');
const indexHtml = fs.readFileSync('public/index.html', 'utf8');
const serverJs = fs.readFileSync('server.js', 'utf8');
const catchallJs = fs.readFileSync('functions/api/[[catchall]].js', 'utf8');

const regex = /\/api\/[a-zA-Z0-9_\-\/]+/g;
const allCalls = [
  ...(appJs.match(regex) || []),
  ...(rentalsHtml.match(regex) || []),
  ...(indexHtml.match(regex) || [])
];
const endpoints = [...new Set(allCalls)].sort();

console.log('=== AUDITING ' + endpoints.length + ' UNIQUE FRONTEND API ENDPOINTS ===');

const issues = [];
for (const ep of endpoints) {
  // Normalize
  const inServer = serverJs.includes(ep) || serverJs.includes(ep.split('/').slice(0, 3).join('/'));
  const inCatchall = catchallJs.includes(ep) || catchallJs.includes(ep.split('/').slice(0, 3).join('/'));

  console.log(`${ep} -> server: ${inServer ? 'OK' : 'MISSING'} | catchall: ${inCatchall ? 'OK' : 'MISSING'}`);
  if (!inServer || !inCatchall) {
    issues.push({ ep, inServer, inCatchall });
  }
}

console.log('\n=== SUMMARY OF MISSING / INCOMPLETE ROUTES ===');
console.log(JSON.stringify(issues, null, 2));
