const fs = require('fs');
const t = fs.readFileSync('src/lib/congratulations.ts', 'utf8');
const re = /"([^"]+)"/g;
let m;
const items = [];
while ((m = re.exec(t)) !== null) {
  if (m[1].length > 5) items.push(m[1]);
}
console.log('Total congratulations:', items.length);

// Check for Chinese chars
const chinese = items.filter(x => /[\u4e00-\u9fff]/.test(x));
console.log('Chinese chars found:', chinese.length);
if (chinese.length) chinese.slice(0,5).forEach(x => console.log('  -', x.slice(0,80)));

// Check for obvious English words
const english = items.filter(x => /\b(second|nature|compass|canvas|palette|masterpiece|diamond|pearl|jewel|treasure|innovation|galaxy|universe|cosmos|frontier|safari|globe|tour|continent|destination|expedition|petting|purr|butterfly|aquarium|wagging|purring|meadow|panorama|exhibition|symphony|ballet|opera|harmony|rhythm|beat|concert|playlist|melody|anthology|fairy|portrait|landscape|gallery|cinema|movie|frame|Instagram|update|smart|digital|app|inventory|race|marathon|recipe|restaurant|flavor|aroma|season|forest|park|garden|river|mountain|island|cruise|novel|poetry|literature|reading|photography|camera|lens|telescope|laboratory|algorithm|software|hardware|robot|drone|virtual|blockchain|crypto|satellite|comet|nebula|asteroid|supernova|memorial|monument|sculpture|drawing|sketch|diagram|chart|graph|paragraph|section|volume|edition|glossary|prologue|epilogue|compendium|treasury|chrestomathy|handbook|notebook|register|ledger|roster|directory|inventory|schedule|timetable|budget|forecast|projection|evaluation|assessment|questionnaire|dialogue|conversation|declaration|announcement|proclamation|symposium|colloquium|premiere|publication|broadcast|newsletter|gazette|journal|magazine|periodical|newspaper|editorial|commentary|critique|dispatch|bulletin|livestream|podcast|vlog|post|essay|column)\b/i.test(x));
console.log('English words found:', english.length);
if (english.length) english.slice(0,5).forEach(x => console.log('  -', x.slice(0,100)));
