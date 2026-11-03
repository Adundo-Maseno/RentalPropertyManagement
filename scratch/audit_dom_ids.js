const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');
const appJs = fs.readFileSync('public/app.js', 'utf8');

// Find all document.getElementById in app.js
const regex = /document\.getElementById\(['"]([^'"]+)['"]\)/g;
let match;
const ids = new Set();
while ((match = regex.exec(appJs)) !== null) {
  ids.add(match[1]);
}

console.log(`Total getElementById queries in app.js: ${ids.size}`);

const missing = [];
for (const id of ids) {
  // Check if id exists in html
  // Note: Some elements might be dynamically created in JS, but let's check!
  if (!html.includes(`id="${id}"`) && !html.includes(`id='${id}'`)) {
    // Check if created dynamically in appJs
    if (!appJs.includes(`id="${id}"`) && !appJs.includes(`id='${id}'`)) {
      missing.push(id);
    }
  }
}

console.log(`Missing element IDs from HTML & JS template literals (${missing.length}):`);
console.log(missing);

