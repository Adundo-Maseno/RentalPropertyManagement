const fs = require('fs');

const serverJs = fs.readFileSync('server.js', 'utf8');
const catchallJs = fs.readFileSync('functions/api/[[catchall]].js', 'utf8');

// Find all `if (pathname...` in server.js
const regex = /if\s*\(([^)]*pathname[^)]*)\)/g;
let match;
const serverRoutes = [];

while ((match = regex.exec(serverJs)) !== null) {
  serverRoutes.push(match[1].trim());
}

console.log(`Found ${serverRoutes.length} route conditionals in server.js:\n`);

const missingInCatchall = [];
for (const cond of serverRoutes) {
  // Extract path and method
  const pathMatch = cond.match(/['"`](\/api\/[^'"`]+)['"`]/);
  const methodMatch = cond.match(/method\s*===?\s*['"`]([A-Z]+)['"`]/);
  
  if (pathMatch) {
    const path = pathMatch[1];
    const method = methodMatch ? methodMatch[1] : 'ANY';
    
    // Check if catchall handles this path
    const hasPath = catchallJs.includes(path) || (path.endsWith('/') && catchallJs.includes(path.slice(0, -1)));
    const hasMethod = method === 'ANY' || catchallJs.includes(method);
    
    if (!hasPath) {
      missingInCatchall.push({ cond, path, method });
      console.log(`❌ Missing in catchall: [${method}] ${path} (from: ${cond})`);
    }
  }
}

console.log(`\nTotal missing in catchall: ${missingInCatchall.length}`);
