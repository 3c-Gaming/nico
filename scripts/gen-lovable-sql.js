const fs = require('fs');
const content = fs.readFileSync('C:/Users/Davi César/.claude/projects/C--Users-Davi-C-sar/memory/lovable-projects.md', 'utf8');
const lines = content.split('\n');
const sqls = [];
for (const line of lines) {
  const parts = line.split('|').map(p => p.trim());
  if (parts.length >= 5 && parts[2] && parts[3] && parts[2].length > 10 && !parts[2].includes('---')) {
    sqls.push(`UPDATE paginas SET lovable_name = '${parts[3]}' WHERE lovable_project_id = '${parts[2]}' AND lovable_name IS NULL;`);
  }
}
console.log(sqls.join('\n'));
