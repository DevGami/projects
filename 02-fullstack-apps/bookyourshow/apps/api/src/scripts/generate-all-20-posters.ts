import fs from 'fs';
import path from 'path';

const outDir = 'd:/Programming/bookyourshow/apps/web/public/posters';
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const posterList = [
  { filename: 'evil-dead-burn-1212763.svg', title: 'EVIL DEAD BURN', sub: 'THE ULTIMATE BOOK OF THE DEAD', stars: 'LILY SULLIVAN • ALYSSA SUTHERLAND', c1: '#450a0a', c2: '#180303', accent: '#ef4444', cert: 'A', lang: 'ENGLISH' },
  { filename: 'batwara-1947-1169537.svg', title: 'BATWARA 1947', sub: 'AN UNTOLD SAGA OF COURAGE & SACRIFICE', stars: 'SUNNY DEOL • PANKAJ TRIPATHI • MANOJ BAJPAYEE', c1: '#78350f', c2: '#271003', accent: '#f59e0b', cert: 'U/A 16+', lang: 'HINDI' },
  { filename: 'moana-1108427.svg', title: 'MOANA', sub: 'THE OCEAN IS CALLING', stars: 'CATHERINE LAGA\'AIA • DWAYNE JOHNSON', c1: '#0e7490', c2: '#082f49', accent: '#06b6d4', cert: 'U', lang: 'ENGLISH' },
  { filename: 'spider-man-brand-new-day-969681.svg', title: 'SPIDER-MAN: BRAND NEW DAY', sub: 'NEW YORK NEEDS A HERO', stars: 'TOM HOLLAND • ZENDAYA • CHARLIE COX', c1: '#831843', c2: '#1e1b4b', accent: '#e11d48', cert: 'U/A 13+', lang: 'ENGLISH' },
  { filename: 'maaran-1739294.svg', title: 'MAARAN', sub: 'TRUTH IS HIS ONLY WEAPON', stars: 'DHANUSH • MALAVIKA MOHANAN', c1: '#1e3a8a', c2: '#0f172a', accent: '#3b82f6', cert: 'U/A 16+', lang: 'TAMIL' },
  { filename: 'ohh-my-dog-1727563.svg', title: 'OHH MY DOG', sub: 'A TALE OF UNCONDITIONAL LOVE', stars: 'ARUN VIJAY • ARNAV VIJAY', c1: '#15803d', c2: '#052e16', accent: '#22c55e', cert: 'U', lang: 'TAMIL' },
  { filename: 'the-odyssey-1368337.svg', title: 'THE ODYSSEY', sub: 'A CHRISTOPHER NOLAN MASTERPIECE', stars: 'MATT DAMON • CILLIAN MURPHY • TOM HARDY', c1: '#312e81', c2: '#0f172a', accent: '#6366f1', cert: 'U/A 13+', lang: 'ENGLISH' },
  { filename: 'dhamaal-4-1303331.svg', title: 'DHAMAAL 4', sub: 'THE CRAZIEST CHASE BEGINS', stars: 'AJAY DEVGN • RITEISH DESHMUKH • ARSHAD WARSI', c1: '#c2410c', c2: '#431407', accent: '#f97316', cert: 'U/A 13+', lang: 'HINDI' },
  { filename: 'gdn-1489543.svg', title: 'G.D.N', sub: 'THE VISIONARY EDISON OF INDIA', stars: 'R. MADHAVAN • SIMRAN • PRAKASH RAJ', c1: '#047857', c2: '#064e3b', accent: '#10b981', cert: 'U', lang: 'TAMIL' },
  { filename: 'dc-1479832.svg', title: 'DC', sub: 'GODS AND MONSTERS UNITE', stars: 'DAVID CORENSWET • RACHEL BROSNAHAN', c1: '#1d4ed8', c2: '#030712', accent: '#60a5fa', cert: 'U/A 13+', lang: 'ENGLISH' },
  { filename: 'the-end-of-oak-street-1101383.svg', title: 'THE END OF OAK STREET', sub: 'NOTHING IS AS IT SEEMS', stars: 'ANNE HATHAWAY • EWAN MCGREGOR', c1: '#3730a3', c2: '#111827', accent: '#818cf8', cert: 'PG-13', lang: 'ENGLISH' },
  { filename: 'vishwanath-and-sons-1408162.svg', title: 'VISHWANATH & SONS', sub: 'PARIVAR HAI TOH SANSAR HAI', stars: 'PARESH RAWAL • BOMAN IRANI • PRATIK GANDHI', c1: '#b45309', c2: '#451a03', accent: '#f59e0b', cert: 'U', lang: 'HINDI' },
  { filename: 'jana-nayagan-1235877.svg', title: 'JANA NAYAGAN', sub: 'VOICE OF THE PEOPLE', stars: 'THALAPATHY VIJAY • POOJA HEGDE • BOBBY DEOL', c1: '#881337', c2: '#1f040d', accent: '#f43f5e', cert: 'U/A 16+', lang: 'TAMIL' },
  { filename: 'get-set-go-1739212.svg', title: 'GET SET GO', sub: 'THE ULTIMATE BOAT RACE', stars: 'JAYARAM • URVASHI • DHYAN SREENIVASAN', c1: '#0369a1', c2: '#082f49', accent: '#38bdf8', cert: 'U', lang: 'MALAYALAM' },
  { filename: 'thudakkam-1506736.svg', title: 'THUDAKKAM', sub: 'A RACE AGAINST TIME IN THE WILD', stars: 'TOVINO THOMAS • ASIF ALI • KUNCHACKO BOBAN', c1: '#065f46', c2: '#022c22', accent: '#34d399', cert: 'U/A 13+', lang: 'MALAYALAM' },
  { filename: 'idhayam-murali-1432631.svg', title: 'IDHAYAM MURALI', sub: 'A HEARTFELT MUSICAL ODYSSEY', stars: 'ATHARVAA • ANUPAMA PARAMESWARAN', c1: '#be185d', c2: '#500724', accent: '#f472b6', cert: 'U', lang: 'TAMIL' },
  { filename: 'lenin-1408170.svg', title: 'LENIN', sub: 'POWER TO THE REVOLUTION', stars: 'CHIYAAN VIKRAM • PARVATHY • PASUPATHY', c1: '#991b1b', c2: '#180303', accent: '#ef4444', cert: 'A', lang: 'TAMIL' },
  { filename: 'unmadham-1545486.svg', title: 'UNMADHAM', sub: 'INTO THE PSYCHEDELIC MISTS', stars: 'FAHADH FAASIL • JOJU GEORGE • CHEMBAN VINOD', c1: '#4c1d95', c2: '#170631', accent: '#a78bfa', cert: 'A', lang: 'MALAYALAM' },
  { filename: 'keu-bole-biplobi-1478476.svg', title: 'KEU BOLE BIPLOBI', sub: 'CHITTAGONG 1930 REVOLUTION', stars: 'DEV • PROSENJIT CHATTERJEE • JISSHU SENGUPTA', c1: '#854d0e', c2: '#201303', accent: '#eab308', cert: 'U/A 16+', lang: 'BENGALI' },
  { filename: 'awarapan-2-1444466.svg', title: 'AWARAPAN 2', sub: 'REDEMPTION THROUGH BLOOD', stars: 'EMRAAN HASHMI • SHRIYA SARAN • JAIDEEP AHLAWAT', c1: '#7f1d1d', c2: '#1a0505', accent: '#f87171', cert: 'A', lang: 'HINDI' }
];

for (const p of posterList) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 900" width="600" height="900">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${p.c1}"/>
      <stop offset="60%" stop-color="${p.c2}"/>
      <stop offset="100%" stop-color="#020617"/>
    </linearGradient>
    <linearGradient id="accentG" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${p.accent}"/>
      <stop offset="100%" stop-color="#ffffff"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="35%" r="45%">
      <stop offset="0%" stop-color="${p.accent}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${p.accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="600" height="900" fill="url(#bg)"/>
  <circle cx="300" cy="360" r="260" fill="url(#glow)"/>

  <!-- Top Badges -->
  <rect x="40" y="40" width="70" height="28" rx="6" fill="#0f172a" stroke="${p.accent}" stroke-width="1.5"/>
  <text x="75" y="59" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="800" fill="#ffffff" text-anchor="middle">${p.cert}</text>

  <rect x="440" y="40" width="120" height="28" rx="6" fill="#0f172a" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
  <text x="500" y="59" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#94a3b8" text-anchor="middle">${p.lang}</text>

  <!-- Center Decorative Visual -->
  <g transform="translate(300, 360)">
    <circle r="120" fill="none" stroke="${p.accent}" stroke-width="2" stroke-opacity="0.3" stroke-dasharray="10 15"/>
    <circle r="90" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-opacity="0.2"/>
    <text y="30" font-family="'Impact', 'Segoe UI', sans-serif" font-size="90" font-weight="900" fill="url(#accentG)" text-anchor="middle" letter-spacing="4">${p.title.charAt(0)}</text>
  </g>

  <!-- Bottom Title Block -->
  <g transform="translate(300, 680)">
    <text y="0" font-family="'Impact', 'Arial Black', sans-serif" font-size="34" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="2">${p.title}</text>
    <text y="36" font-family="'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="700" fill="${p.accent}" text-anchor="middle" letter-spacing="3">${p.sub}</text>
    
    <line x1="-180" y1="65" x2="180" y2="65" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
    
    <text y="95" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="600" fill="#cbd5e1" text-anchor="middle" letter-spacing="1.5">${p.stars}</text>
    <text y="130" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="800" fill="#64748b" text-anchor="middle" letter-spacing="4">IN THEATRES NOW • BOOK YOUR SHOW</text>
  </g>
</svg>`;

  fs.writeFileSync(path.join(outDir, p.filename), svg, 'utf-8');
}

console.log(`✅ Generated ${posterList.length} SVG posters in ${outDir}`);
