const fs = require('fs');

const html = fs.readFileSync('public/index.html', 'utf8');
const appJs = fs.readFileSync('public/app.js', 'utf8');

// Match onclick="app.foo(...)" or onsubmit="app.bar(...)"
const regex = /on(?:click|submit|change|input)="app\.([a-zA-Z0-9_$]+)\s*\(/g;
let match;
const handlerNames = new Set();
while ((match = regex.exec(html)) !== null) {
  handlerNames.add(match[1]);
}

console.log(`Total app.* inline handlers in index.html: ${handlerNames.size}`);

const missing = [];
for (const fn of handlerNames) {
  // Check if defined in BomaSphereApp class or prototype or constructor
  // Pattern: fn( or fn = or this.fn =
  const fnRegex = new RegExp(`(?:async\\s+)?${fn}\\s*\\(|this\\.${fn}\\s*=|${fn}\\s*=\\s*function`, 'g');
  if (!fnRegex.test(appJs)) {
    missing.push(fn);
  }
}

console.log(`Missing methods in app.js (${missing.length}):`, missing);

