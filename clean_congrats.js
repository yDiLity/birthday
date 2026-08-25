const fs = require('fs');
const t = fs.readFileSync('src/lib/congratulations.ts', 'utf8');
const re = /"([^"]+)"/g;
let m;
const items = [];
while ((m = re.exec(t)) !== null) {
  if (m[1].length > 5) items.push(m[1]);
}
console.log('Before:', items.length);

const clean = items.filter(x => {
  if (/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/.test(x)) return false;
  if (/\b(second|nature|compass|canvas|palette|masterpiece|diamond|pearl|jewel|treasure|innovation|galaxy|universe|cosmos|frontier|safari|globe|tour|continent|destination|expedition|petting|purr|butterfly|aquarium|wagging|purring|meadow|panorama|exhibition|symphony|ballet|opera|harmony|rhythm|beat|concert|playlist|melody|anthology|fairy|portrait|landscape|gallery|cinema|movie|frame|Instagram|update|smart|digital|app|inventory|race|marathon|recipe|restaurant|flavor|aroma|season|forest|park|garden|river|mountain|island|cruise|novel|poetry|literature|reading|photography|camera|lens|telescope|laboratory|algorithm|software|hardware|robot|drone|virtual|blockchain|crypto|satellite|comet|nebula|asteroid|supernova|memorial|monument|sculpture|drawing|sketch|diagram|chart|graph|paragraph|section|volume|edition|glossary|prologue|epilogue|compendium|treasury|chrestomathy|handbook|notebook|register|ledger|roster|directory|inventory|schedule|timetable|budget|forecast|projection|evaluation|assessment|questionnaire|dialogue|conversation|declaration|announcement|proclamation|symposium|colloquium|premiere|publication|broadcast|newsletter|gazette|journal|magazine|periodical|newspaper|editorial|commentary|critique|dispatch|bulletin|livestream|podcast|vlog|post|essay|column)\b/i.test(x)) return false;
  if (/\b(crédito|emoji|menu|café|résumé|naïve|résumé)\b/i.test(x)) return false;
  if (/\b(enough|beautiful|love|happy|special|young|old)\b/i.test(x)) return false;
  return true;
});
console.log('After:', clean.length);

// Build the file
const lines = clean.map(x => `  "${x}",`);
const file = `const congratulations: string[] = [\n${lines.join('\n')}\n];

export function buildSeedRows(userId: string) {
  return congratulations.map((text) => ({ user_id: userId, text }));
}
`;
fs.writeFileSync('src/lib/congratulations.ts', file, 'utf8');
console.log('Written');
