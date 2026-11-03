const fs = require('fs');

const appJs = fs.readFileSync('public/app.js', 'utf8');

const regex = /on(?:click|submit|change|input)=["']app\.([a-zA-Z0-9_$]+)\s*\(/g;
let match;
const handlerNames = new Set();
while ((match = regex.exec(appJs)) !== null) {
  handlerNames.add(match[1]);
}

console.log(`Total app.* inline handlers inside app.js templates: ${handlerNames.size}`);

const missing = [];
for (const fn of handlerNames) {
  const fnRegex = new RegExp(`(?:async\\s+)?${fn}\\s*\\(|this\\.${fn}\\s*=|${fn}\\s*=\\s*function`, 'g');
  if (!fnRegex.test(appJs)) {
    missing.push(fn);
  }
}

console.log(`Missing template methods in app.js (${missing.length}):`, missing);

