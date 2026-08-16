import fs from 'fs';
import path from 'path';

const outDir = 'd:/Programming/bookyourshow/apps/web/public/posters';
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

interface MoviePosterSpec {
  slug: string;
  title: string;
  subtitle?: string;
  stars: string;
  director: string;
  genre: string;
  palette: {
    c1: string;
    c2: string;
    c3: string;
    accent: string;
    textAccent: string;
  };
  symbol: string;
}

const posters: MoviePosterSpec[] = [
  {
    slug: 'awarapan-2-1399617',
    title: 'AWARAPAN 2',
    subtitle: 'REDEMPTION HAS A PRICE',
    stars: 'EMRAAN HASHMI • DISHA PATANI • SHABANA AZMI',
    director: 'A NITIN KAKKAR FILM',
    genre: 'ACTION • CRIME • THRILLER',
    palette: { c1: '#3d0c11', c2: '#1a0507', c3: '#080102', accent: '#e63946', textAccent: '#ff758f' },
    symbol: 'M'
  },
  {
    slug: 'thudakkam-1380921',
    title: 'THUDAKKAM',
    subtitle: 'THE BEGINNING OF THE END',
    stars: 'VISMAYA MOHANLAL • MOHANLAL',
    director: 'A JUDE ANTHANY JOSEPH FILM',
    genre: 'ACTION • THRILLER',
    palette: { c1: '#064e3b', c2: '#022c22', c3: '#011611', accent: '#10b981', textAccent: '#6ee7b7' },
    symbol: 'T'
  },
  {
    slug: 'ishqnama-1362845',
    title: 'ISHQNAMA',
    subtitle: 'A BORDERLESS LOVE STORY',
    stars: 'JAYY RANDHAWA • SHEHNAAZ GILL',
    director: 'DIRECTED BY ARVVINDER KHAIRA',
    genre: 'ROMANCE • PERIOD • DRAMA',
    palette: { c1: '#701a75', c2: '#4a044e', c3: '#1f0122', accent: '#ec4899', textAccent: '#f472b6' },
    symbol: 'I'
  },
  {
    slug: 'batwara-1947-1391087',
    title: 'BATWARA 1947',
    subtitle: 'AN EPIC TALE OF PARTITION & SURVIVAL',
    stars: 'SUNNY DEOL • PREITY ZINTA • SHABANA AZMI',
    director: 'A RAJKUMAR SANTOSHI FILM • PRODUCED BY AAMIR KHAN',
    genre: 'HISTORICAL • WAR • DRAMA',
    palette: { c1: '#78350f', c2: '#451a03', c3: '#1c0a00', accent: '#f59e0b', textAccent: '#fbbf24' },
    symbol: 'B'
  },
  {
    slug: 'idhayam-murali-1479835',
    title: 'IDHAYAM MURALI',
    subtitle: 'A COMING OF AGE MELODY',
    stars: 'ATHARVAA MURALI • ADITI SHANKAR • PRAKASH RAJ',
    director: 'DIRECTED BY AAKASH BASKARAN',
    genre: 'ROMANCE • DRAMA • MUSICAL',
    palette: { c1: '#1e3a8a', c2: '#0f172a', c3: '#020617', accent: '#38bdf8', textAccent: '#7dd3fc' },
    symbol: 'IM'
  },
  {
    slug: 'the-end-of-oak-street-1391203',
    title: 'THE END OF OAK STREET',
    subtitle: 'TIME HAS NO WAY BACK',
    stars: 'ANNE HATHAWAY • EWAN MCGREGOR',
    director: 'A DAVID ROBERT MITCHELL FILM',
    genre: 'SCI-FI • SURVIVAL • THRILLER',
    palette: { c1: '#134e4a', c2: '#042f2e', c3: '#011716', accent: '#14b8a6', textAccent: '#5eead4' },
    symbol: 'OAK'
  },
  {
    slug: 'dhamaal-4-1368904',
    title: 'DHAMAAL 4',
    subtitle: 'THE CRAZIEST CHASE IS BACK',
    stars: 'AJAY DEVGN • RITEISH DESHMUKH • ARSHAD WARSI • SANJAY DUTT',
    director: 'AN INDRA KUMAR COMEDY',
    genre: 'COMEDY • ADVENTURE • FAMILY',
    palette: { c1: '#854d0e', c2: '#422006', c3: '#1a0c02', accent: '#eab308', textAccent: '#fde047' },
    symbol: 'D4'
  },
  {
    slug: 'lenin-1479821',
    title: 'LENIN',
    subtitle: 'REVOLUTION IN THE BLOOD',
    stars: 'AKHIL AKKINENI • SREELEELA • JAGAPATHI BABU',
    director: 'A MURALI KISHOR ABBURU FILM',
    genre: 'RURAL ACTION • POLITICAL DRAMA',
    palette: { c1: '#881337', c2: '#4c0519', c3: '#1f010a', accent: '#f43f5e', textAccent: '#fda4af' },
    symbol: 'L'
  },
  {
    slug: 'moana-1241982',
    title: 'MOANA 2',
    subtitle: 'THE OCEAN IS CALLING AGAIN',
    stars: 'AULIʻI CRAVALHO • DWAYNE JOHNSON',
    director: 'DISNEY ANIMATION STUDIOS',
    genre: 'ANIMATION • ADVENTURE • FANTASY',
    palette: { c1: '#0284c7', c2: '#0369a1', c3: '#082f49', accent: '#38bdf8', textAccent: '#bae6fd' },
    symbol: 'M2'
  },
  {
    slug: 'the-odyssey-950387',
    title: 'THE ODYSSEY',
    subtitle: 'THE GREATEST JOURNEY IN HUMAN HISTORY',
    stars: 'MATT DAMON • ANNE HATHAWAY • ROBERT PATTINSON',
    director: 'A CHRISTOPHER NOLAN FILM',
    genre: 'EPIC • ACTION • FANTASY',
    palette: { c1: '#312e81', c2: '#1e1b4b', c3: '#0f0d2e', accent: '#818cf8', textAccent: '#c7d2fe' },
    symbol: 'ODY'
  },
  {
    slug: 'maaran-1380914',
    title: 'MAARAN',
    subtitle: 'THE TRUTH CANNOT BE SILENCED',
    stars: 'DHANUSH • MALAVIKA MOHANAN • SAMUTHIRAKANI',
    director: 'A KARTHICK NAREN FILM',
    genre: 'ACTION • INVESTIGATIVE THRILLER',
    palette: { c1: '#581c87', c2: '#3b0764', c3: '#1a0130', accent: '#a855f7', textAccent: '#d8b4fe' },
    symbol: 'MRN'
  },
  {
    slug: 'get-set-go-1380998',
    title: 'GET SET GO',
    subtitle: 'THE RACE FOR JUSTICE',
    stars: 'DEEPAK TIJORI • MALHAR THAKAR • AAROHI PATEL',
    director: 'AN ARNAV KUMAR FILM',
    genre: 'ACTION • COMEDY • ADVENTURE',
    palette: { c1: '#c2410c', c2: '#7c2d12', c3: '#320e05', accent: '#f97316', textAccent: '#fed7aa' },
    symbol: 'GSG'
  },
  {
    slug: 'evil-dead-burn-1379203',
    title: 'EVIL DEAD BURN',
    subtitle: 'DIE BY FIRE OR BY POSSESSION',
    stars: 'SOUHEILA YACOUB • HUNTER DOOHAN',
    director: 'PRODUCED BY SAM RAIMI • DIRECTED BY SÉBASTIEN VANIČEK',
    genre: 'HORROR • SUPERNATURAL THRILLER',
    palette: { c1: '#450a0a', c2: '#260404', c3: '#0d0101', accent: '#dc2626', textAccent: '#fca5a5' },
    symbol: 'EDB'
  },
  {
    slug: 'jana-nayagan-1380876',
    title: 'JANA NAYAGAN',
    subtitle: 'THE LEADER OF THE PEOPLE',
    stars: 'THALAPATHY VIJAY • POOJA HEGDE • BOBBY DEOL',
    director: 'A H. VINOTH FILM • ANIRUDH MUSICAL',
    genre: 'POLITICAL ACTION • MASS DRAMA',
    palette: { c1: '#7c2d12', c2: '#431407', c3: '#1a0501', accent: '#ea580c', textAccent: '#fdba74' },
    symbol: 'JN'
  },
  {
    slug: 'vishwanath-and-sons-1391142',
    title: 'VISHWANATH & SONS',
    subtitle: 'A FAMILY WORTH FIGHTING FOR',
    stars: 'SURIYA • MAMITHA BAIJU • RAVEENA TANDON',
    director: 'WRITTEN & DIRECTED BY VENKY ATLURI',
    genre: 'FAMILY • ROMANCE • DRAMA',
    palette: { c1: '#14532d', c2: '#052e16', c3: '#011509', accent: '#22c55e', textAccent: '#86efac' },
    symbol: 'VS'
  },
  {
    slug: 'spider-man-brand-new-day-1156593',
    title: 'SPIDER-MAN',
    subtitle: 'BRAND NEW DAY',
    stars: 'TOM HOLLAND • ZENDAYA • SADIE SINK',
    director: 'DIRECTED BY DESTIN DANIEL CRETTON • MARVEL STUDIOS',
    genre: 'ACTION • ADVENTURE • SCI-FI',
    palette: { c1: '#991b1b', c2: '#1e3a8a', c3: '#090f2b', accent: '#ef4444', textAccent: '#93c5fd' },
    symbol: 'SPIDER'
  },
  {
    slug: 'unmadham-1380922',
    title: 'UNMADHAM',
    subtitle: 'WHEN PASSION BECOMES OBSESSION',
    stars: 'KUNCHACKO BOBAN • APARNA BALAMURALI',
    director: 'A KIRAN DAS PSYCHOLOGICAL THRILLER',
    genre: 'PSYCHOLOGICAL THRILLER • NOIR',
    palette: { c1: '#3730a3', c2: '#1e1b4b', c3: '#0b0a24', accent: '#6366f1', textAccent: '#a5b4fc' },
    symbol: 'UNM'
  },
  {
    slug: 'chao-1391188',
    title: 'ChaO',
    subtitle: 'A REVOLUTIONARY FANTASY ROMANCE',
    stars: 'RYUNOSUKE KAMIKI • MINAMI HAMABE',
    director: 'STUDIO 4°C • DIRECTED BY YASUHIRO AOKI',
    genre: 'ANIMATION • FANTASY • SCI-FI',
    palette: { c1: '#0e7490', c2: '#155e75', c3: '#082f49', accent: '#06b6d4', textAccent: '#67e8f9' },
    symbol: 'CHAO'
  },
  {
    slug: 'gdn-1479840',
    title: 'G.D.N.',
    subtitle: 'THE EDISON OF INDIA',
    stars: 'R. MADHAVAN • SHRADDHA SRINATH • NASSAR',
    director: 'A KRISHNAKUMAR RAMAKUMAR BIOPIC',
    genre: 'BIOGRAPHY • INSPIRATIONAL • DRAMA',
    palette: { c1: '#713f12', c2: '#3f2206', c3: '#180d01', accent: '#ca8a04', textAccent: '#fef08a' },
    symbol: 'GDN'
  },
  {
    slug: 'dc-1479832',
    title: 'DC',
    subtitle: 'PASSION • BLOODSHED • LOYALTY',
    stars: 'LOKESH KANAGARAJ • WAMIQA GABBI',
    director: 'AN ARUN MATHESWARAN FILM',
    genre: 'ACTION • CRIME • ROMANCE',
    palette: { c1: '#831843', c2: '#500724', c3: '#20010c', accent: '#f43f5e', textAccent: '#fda4af' },
    symbol: 'DC'
  }
];

function generateSvg(p: MoviePosterSpec): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="750" viewBox="0 0 500 750">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${p.palette.c1}" />
      <stop offset="45%" stop-color="${p.palette.c2}" />
      <stop offset="100%" stop-color="${p.palette.c3}" />
    </linearGradient>
    <linearGradient id="overlayGrad" x1="50%" y1="0%" x2="50%" y2="100%">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.65" />
      <stop offset="35%" stop-color="#000000" stop-opacity="0.1" />
      <stop offset="65%" stop-color="#000000" stop-opacity="0.5" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0.95" />
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="45%" r="45%">
      <stop offset="0%" stop-color="${p.palette.accent}" stop-opacity="0.35" />
      <stop offset="60%" stop-color="${p.palette.accent}" stop-opacity="0.05" />
      <stop offset="100%" stop-color="${p.palette.accent}" stop-opacity="0" />
    </radialGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.85" />
    </filter>
  </defs>

  <!-- Background Base -->
  <rect width="500" height="750" fill="url(#bgGrad)" />
  <rect width="500" height="750" fill="url(#glow)" />
  
  <!-- Geometric Cinema Framing -->
  <rect x="20" y="20" width="460" height="710" fill="none" stroke="${p.palette.accent}" stroke-width="1.5" stroke-opacity="0.35" rx="12" />
  <rect x="28" y="28" width="444" height="694" fill="none" stroke="#ffffff" stroke-width="0.75" stroke-opacity="0.1" rx="8" />

  <!-- Corner Accents -->
  <path d="M 20 50 L 20 20 L 50 20" fill="none" stroke="${p.palette.accent}" stroke-width="3" />
  <path d="M 480 50 L 480 20 L 450 20" fill="none" stroke="${p.palette.accent}" stroke-width="3" />
  <path d="M 20 700 L 20 730 L 50 730" fill="none" stroke="${p.palette.accent}" stroke-width="3" />
  <path d="M 480 700 L 480 730 L 450 730" fill="none" stroke="${p.palette.accent}" stroke-width="3" />

  <!-- Stylized Center Icon Artwork -->
  <circle cx="250" cy="330" r="110" fill="none" stroke="${p.palette.accent}" stroke-width="2" stroke-opacity="0.25" />
  <circle cx="250" cy="330" r="95" fill="${p.palette.c1}" fill-opacity="0.4" stroke="#ffffff" stroke-width="1" stroke-opacity="0.15" />
  <circle cx="250" cy="330" r="70" fill="none" stroke="${p.palette.accent}" stroke-width="1.5" stroke-dasharray="6,4" stroke-opacity="0.5" />
  
  <!-- Central Emblem / Monogram -->
  <text x="250" y="348" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="44" font-weight="900" fill="${p.palette.textAccent}" letter-spacing="4" filter="url(#shadow)">${p.symbol}</text>

  <!-- Film Strip Dots Top & Bottom -->
  <g fill="${p.palette.accent}" opacity="0.4">
    <circle cx="210" cy="46" r="3" />
    <circle cx="230" cy="46" r="3" />
    <circle cx="250" cy="46" r="3" />
    <circle cx="270" cy="46" r="3" />
    <circle cx="290" cy="46" r="3" />
  </g>

  <!-- Dark Atmospheric Gradient Overlay -->
  <rect width="500" height="750" fill="url(#overlayGrad)" />

  <!-- Top Billing: Genre & Release Year -->
  <text x="250" y="72" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" fill="${p.palette.textAccent}" letter-spacing="3">${p.genre}</text>
  <text x="250" y="90" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="500" fill="#94a3b8" letter-spacing="2">IN THEATRES 2026</text>

  <!-- Star Cast Header -->
  <text x="250" y="140" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="10.5" font-weight="700" fill="#e2e8f0" letter-spacing="1.5" filter="url(#shadow)">${p.stars}</text>

  <!-- Subtitle / Tagline Above Title -->
  <text x="250" y="490" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="600" fill="${p.palette.textAccent}" letter-spacing="2.5" filter="url(#shadow)">${p.subtitle || ''}</text>

  <!-- Main Movie Title -->
  <text x="250" y="540" text-anchor="middle" font-family="system-ui, -apple-system, Impact, sans-serif" font-size="${p.title.length > 15 ? '32' : '38'}" font-weight="900" fill="#ffffff" letter-spacing="2" filter="url(#shadow)">${p.title}</text>

  <!-- Divider Line -->
  <line x1="170" y1="565" x2="330" y2="565" stroke="${p.palette.accent}" stroke-width="2" stroke-linecap="round" />

  <!-- Director & Production Credit -->
  <text x="250" y="605" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" fill="#cbd5e1" letter-spacing="2">${p.director}</text>
  <text x="250" y="628" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="9.5" font-weight="500" fill="#64748b" letter-spacing="1.5">EXPERIENCE IT IN CINEMAS &amp; IMAX</text>

  <!-- Bottom Brand Badge -->
  <rect x="200" y="670" width="100" height="24" rx="12" fill="${p.palette.accent}" fill-opacity="0.2" stroke="${p.palette.accent}" stroke-width="1" />
  <text x="250" y="686" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="800" fill="#ffffff" letter-spacing="2">BOOK NOW</text>
</svg>`;
}

for (const p of posters) {
  const filePath = path.join(outDir, `${p.slug}.svg`);
  fs.writeFileSync(filePath, generateSvg(p), 'utf-8');
  console.log('Generated:', p.slug);
}
console.log('✅ Generated all 20 custom studio-grade movie posters!');
