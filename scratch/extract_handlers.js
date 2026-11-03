const fs = require('fs');
const appJs = fs.readFileSync('public/app.js', 'utf8');

function extractMethod(name) {
  const start = appJs.indexOf(`${name}(`);
  if (start === -1) return `Method ${name} not found`;
  // find opening brace
  const braceIdx = appJs.indexOf('{', start);
  let depth = 1;
  let i = braceIdx + 1;
  while (depth > 0 && i < appJs.length) {
    if (appJs[i] === '{') depth++;
    else if (appJs[i] === '}') depth--;
    i++;
  }
  return appJs.slice(start, i);
}

console.log('=== handleAddTenantSubmit ===\n', extractMethod('handleAddTenantSubmit'), '\n');
console.log('=== handleCreateLeaseSubmit ===\n', extractMethod('handleCreateLeaseSubmit'), '\n');

