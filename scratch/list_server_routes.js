const fs = require('fs');

const serverJs = fs.readFileSync('server.js', 'utf8');
const lines = serverJs.split('\n');

const routes = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes("pathname === '") || line.includes("pathname.startsWith('")) {
    // Check previous or next lines for method
    let method = 'GET';
    const surrounding = lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 3)).join(' ');
    const m = surrounding.match(/method\s*===?\s*['"]([A-Z]+)['"]/);
    if (m) method = m[1];
    
    const p = surrounding.match(/['"](\/api\/[^'"]+)['"]/);
    if (p) {
      routes.push({ line: i + 1, method, path: p[1] });
    }
  }
}

console.log('Total routes found in server.js:', routes.length);
for (const r of routes) {
  console.log(`${r.method.padEnd(6)} ${r.path} (line ${r.line})`);
}
