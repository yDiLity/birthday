const fs = require('fs');
const t = fs.readFileSync('src/lib/congratulations.ts', 'utf8');
const m = t.match(/"[^"]+"/g);
console.log('Total:', m ? m.length : 0);
