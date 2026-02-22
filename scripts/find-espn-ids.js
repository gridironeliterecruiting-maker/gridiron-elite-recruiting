#!/usr/bin/env node
/**
 * Search ESPN for specific school names to find their IDs.
 * Tries multiple name variations for each.
 */

async function fetchTeam(id) {
  try {
    const r = await fetch(`http://site.api.espn.com/apis/site/v2/sports/football/college-football/teams/${id}`);
    if (!r.ok) return null;
    const d = await r.json();
    if (!d.team) return null;
    return { id: parseInt(d.team.id), name: d.team.displayName, loc: d.team.location };
  } catch { return null; }
}

// Scan ALL ESPN IDs and build complete lookup
async function buildFullLookup() {
  const teams = [];
  const ranges = [];
  for (let id = 1; id <= 3145; id++) ranges.push(id);
  for (let id = 3146; id <= 3260; id++) ranges.push(id);
  for (let id = 100000; id <= 102000; id++) ranges.push(id);
  for (let id = 125000; id <= 130000; id++) ranges.push(id);

  console.log(`Scanning ${ranges.length} IDs...`);
  const batchSize = 50;
  for (let i = 0; i < ranges.length; i += batchSize) {
    const batch = ranges.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(fetchTeam));
    for (const t of results) if (t) teams.push(t);
    if ((i + batchSize) % 1000 === 0) process.stdout.write(`  ${i + batchSize}/${ranges.length}\r`);
  }
  console.log(`\nFound ${teams.length} total ESPN teams\n`);
  return teams;
}

async function main() {
  const teams = await buildFullLookup();

  // Schools we need to find
  const wanted = [
    // DII 404s + skips
    'Anderson University', 'Indiana University of Pennsylvania', 'Kentucky State',
    'Davenport', 'Minnesota State Moorhead', 'Missouri Southern',
    'Northwestern Oklahoma', 'Northwood', 'Saint Anselm',
    'Southeastern Oklahoma', 'Southwest Minnesota', 'Virginia College at Wise',
    'UVA Wise', 'Charleston', 'UNC Pembroke', 'Permian Basin', 'UTPB',
    'West Florida', 'Wayne State', 'Western Colorado', 'Western State',
    'Virginia State', 'West Chester', 'Texas A&M Kingsville',
    // DIII skips
    'Alvernia', 'Azusa Pacific', 'Benedictine', 'Bethany',
    'Bethel', 'Bridgewater', 'Carroll', 'Centenary',
    'Concordia Chicago', 'Concordia Wisconsin', 'Elmhurst',
    'FDU Florham', 'Fairleigh Dickinson', 'Illinois College',
    'Keystone', 'King\'s', 'Maine Maritime', 'MIT',
    'Massachusetts Maritime', 'Morrisville', 'New England College',
    'Pomona-Pitzer', 'Pomona Pitzer', 'Roanoke',
    'Saint John\'s', 'St. John\'s Minnesota', 'Saint Vincent',
    'Schreiner', 'Simpson', 'Buffalo State',
    'Trinity Connecticut', 'Trinity Texas', 'Union',
    'UMass Dartmouth', 'Minnesota Morris',
    'Northwestern St. Paul', 'Wisconsin Eau Claire', 'Wisconsin La Crosse',
    'Wisconsin Oshkosh', 'Wisconsin Platteville', 'Wisconsin River Falls',
    'Wisconsin Stevens Point', 'Wisconsin Stout', 'Wisconsin Whitewater',
    'Wis.-Eau Claire', 'Wis.-Whitewater', 'UW-Whitewater',
    'Washington Lee', 'Wash. & Lee', 'WashU', 'Washington St. Louis',
    'Wesleyan', 'Westminster', 'William Paterson',
  ];

  for (const query of wanted) {
    const q = query.toLowerCase();
    const matches = teams.filter(t => {
      const name = t.name.toLowerCase();
      const loc = (t.loc || '').toLowerCase();
      return name.includes(q) || loc.includes(q) || q.includes(loc);
    });
    if (matches.length > 0) {
      for (const m of matches.slice(0, 3)) {
        console.log(`  "${query}" → ${m.id}: ${m.name} (loc: ${m.loc})`);
      }
    }
  }
}

main().catch(console.error);
