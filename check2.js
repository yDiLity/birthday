const fs = require('fs');
const t = fs.readFileSync('src/lib/congratulations.ts', 'utf8');
const re = /"([^"]+)"/g;
let m;
const items = [];
while ((m = re.exec(t)) !== null) {
  if (m[1].length > 5) items.push(m[1]);
}
const eng = items.filter(x => /[a-zA-Z]/.test(x));
console.log('With Latin chars:', eng.length);
eng.forEach(x => console.log(x.slice(0, 120)));
