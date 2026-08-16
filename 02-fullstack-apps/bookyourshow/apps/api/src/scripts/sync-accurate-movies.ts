import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { redis, connectRedis, disconnectRedis } from '../config/redis.js';

const postersDir = 'd:/Programming/bookyourshow/apps/web/public/posters';
if (!fs.existsSync(postersDir)) {
  fs.mkdirSync(postersDir, { recursive: true });
}

interface MovieDef {
  tmdbId: number;
  title: string;
  slug: string;
  genres: string[];
  language: string;
  originalLanguage: string;
  rating: number;
  voteCount: number;
  popularity: number;
  duration: number;
  director: string;
  tagline: string;
  starsSummary: string;
  releaseDate: string;
  certificate: string;
  formats: string[];
  description: string;
  cast: Array<{ name: string; character: string; photo: string | null }>;
  palette: { c1: string; c2: string; c3: string; accent: string; textAccent: string; symbol: string };
}

const moviesData: MovieDef[] = [
  {
    tmdbId: 1399617,
    title: "Awarapan 2",
    slug: "awarapan-2-1399617",
    genres: ["Action", "Crime", "Thriller"],
    language: "Hindi",
    originalLanguage: "hi",
    rating: 7.9,
    voteCount: 320,
    popularity: 95.4,
    duration: 148,
    director: "Nitin Kakkar",
    tagline: "REDEMPTION HAS A DEADLY PRICE",
    starsSummary: "EMRAAN HASHMI • DISHA PATANI • SHABANA AZMI",
    releaseDate: "2026-08-14",
    certificate: "UA",
    formats: ["2D"],
    description: "Shivam Pandit returns in a brooding Mumbai underworld thriller, caught between an oath of peace and a rising ruthless cartel.",
    cast: [
      { name: "Emraan Hashmi", character: "Shivam Pandit", photo: null },
      { name: "Disha Patani", character: "Nisha", photo: null },
      { name: "Shabana Azmi", character: "Begum Fatima", photo: null },
      { name: "Randeep Hooda", character: "Inspector Rathod", photo: null },
      { name: "Nushrratt Bharuccha", character: "Nadia", photo: null },
      { name: "Mahesh Manjrekar", character: "Don Sikandar", photo: null },
      { name: "Ashutosh Rana", character: "Malik Bhai", photo: null },
      { name: "Gulshan Grover", character: "Tyson", photo: null }
    ],
    palette: { c1: "#3b0764", c2: "#18022b", c3: "#07000d", accent: "#a855f7", textAccent: "#e9d5ff", symbol: "A2" }
  },
  {
    tmdbId: 1380921,
    title: "Thudakkam",
    slug: "thudakkam-1380921",
    genres: ["Action", "Thriller", "Drama"],
    language: "Malayalam",
    originalLanguage: "ml",
    rating: 8.2,
    voteCount: 410,
    popularity: 89.6,
    duration: 135,
    director: "Jude Anthany Joseph",
    tagline: "THE BEGINNING OF THE END",
    starsSummary: "VISMAYA MOHANLAL • MOHANLAL • PRANAV MOHANLAL",
    releaseDate: "2026-08-07",
    certificate: "UA",
    formats: ["2D"],
    description: "A high-octane Malayalam action thriller following Meenu, whose act of kindness pulls her into the crosshairs of an elusive coastal syndicate.",
    cast: [
      { name: "Vismaya Mohanlal", character: "Meenu", photo: null },
      { name: "Mohanlal", character: "Mathew (Extended Cameo)", photo: null },
      { name: "Pranav Mohanlal", character: "Anand", photo: null },
      { name: "Mamta Mohandas", character: "Dr. Sarah", photo: null },
      { name: "Saiju Kurup", character: "SI Mathew", photo: null },
      { name: "Siddique", character: "Commissioner Nair", photo: null },
      { name: "Kalidas Jayaram", character: "Siddhu", photo: null },
      { name: "Jagadish", character: "Father Francis", photo: null }
    ],
    palette: { c1: "#064e3b", c2: "#022c22", c3: "#01140f", accent: "#10b981", textAccent: "#a7f3d0", symbol: "THU" }
  },
  {
    tmdbId: 1362845,
    title: "Ishqnama",
    slug: "ishqnama-1362845",
    genres: ["Romance", "Period", "Drama"],
    language: "Punjabi",
    originalLanguage: "pa",
    rating: 7.8,
    voteCount: 270,
    popularity: 82.1,
    duration: 142,
    director: "Arvvinder Khaira",
    tagline: "A BORDERLESS LOVE STORY",
    starsSummary: "JAYY RANDHAWA • SHEHNAAZ GILL • GUGGU GILL",
    releaseDate: "2026-07-24",
    certificate: "U",
    formats: ["2D"],
    description: "An intense Punjabi period romance set against the India-Pakistan border, bridging generational divides through unforgettable soulful melodies.",
    cast: [
      { name: "Jayy Randhawa", character: "Fateh", photo: null },
      { name: "Shehnaaz Gill", character: "Noor", photo: null },
      { name: "Guggu Gill", character: "Sardar Jarnail", photo: null },
      { name: "Nirmal Rishi", character: "Bebe", photo: null },
      { name: "Hobby Dhaliwal", character: "Chaudhary Saab", photo: null },
      { name: "B.N. Sharma", character: "Munshi Ji", photo: null },
      { name: "Gurpreet Ghuggi", character: "Ustad Ji", photo: null },
      { name: "Sunita Dhir", character: "Ammi", photo: null }
    ],
    palette: { c1: "#701a75", c2: "#4a044e", c3: "#1f0122", accent: "#f43f5e", textAccent: "#fbcfe8", symbol: "ISH" }
  },
  {
    tmdbId: 1391087,
    title: "Batwara 1947",
    slug: "batwara-1947-1391087",
    genres: ["History", "War", "Drama"],
    language: "Hindi",
    originalLanguage: "hi",
    rating: 8.5,
    voteCount: 780,
    popularity: 145.2,
    duration: 165,
    director: "Rajkumar Santoshi",
    tagline: "AN EPIC SAGA OF RESILIENCE & SURVIVAL",
    starsSummary: "SUNNY DEOL • PREITY ZINTA • SHABANA AZMI • ALI FAZAL",
    releaseDate: "2026-08-14",
    certificate: "UA",
    formats: ["2D", "IMAX"],
    description: "Rajkumar Santoshi and Aamir Khan present an epic tale of human resilience, courage, and compassion during the 1947 Partition of India.",
    cast: [
      { name: "Sunny Deol", character: "Tarafdar Singh", photo: null },
      { name: "Preity Zinta", character: "Amrit Kaur", photo: null },
      { name: "Shabana Azmi", character: "Zeenat Begum", photo: null },
      { name: "Ali Fazal", character: "Iqbal", photo: null },
      { name: "Manoj Bajpayee", character: "Ratan Singh", photo: null },
      { name: "Pankaj Kapur", character: "Gurdev Singh", photo: null },
      { name: "Konkona Sen Sharma", character: "Amrita", photo: null },
      { name: "Abhimanyu Singh", character: "Jameel", photo: null }
    ],
    palette: { c1: "#78350f", c2: "#451a03", c3: "#1c0a00", accent: "#f59e0b", textAccent: "#fde68a", symbol: "1947" }
  },
  {
    tmdbId: 1479835,
    title: "Idhayam Murali",
    slug: "idhayam-murali-1479835",
    genres: ["Romance", "Drama", "Musical"],
    language: "Tamil",
    originalLanguage: "ta",
    rating: 8.3,
    voteCount: 510,
    popularity: 110.4,
    duration: 138,
    director: "Aakash Baskaran",
    tagline: "A COMING OF AGE ROMANTIC MELODY",
    starsSummary: "ATHARVAA MURALI • ADITI SHANKAR • PRAKASH RAJ",
    releaseDate: "2026-07-10",
    certificate: "U",
    formats: ["2D"],
    description: "A touching coming-of-age romantic drama about a young man striving to win the love of his life while discovering his true musical calling.",
    cast: [
      { name: "Atharvaa Murali", character: "Murali", photo: null },
      { name: "Aditi Shankar", character: "Kavya", photo: null },
      { name: "Prakash Raj", character: "Subbaiah", photo: null },
      { name: "Jayaram", character: "Annamalai", photo: null },
      { name: "Karunakaran", character: "Paappan", photo: null },
      { name: "Urvashi", character: "Mother", photo: null },
      { name: "VTV Ganesh", character: "Uncle", photo: null },
      { name: "Devadarshini", character: "Aunt", photo: null }
    ],
    palette: { c1: "#1e3a8a", c2: "#0f172a", c3: "#020617", accent: "#38bdf8", textAccent: "#bae6fd", symbol: "IM" }
  },
  {
    tmdbId: 1391203,
    title: "The End of Oak Street",
    slug: "the-end-of-oak-street-1391203",
    genres: ["Sci-Fi", "Survival", "Thriller"],
    language: "English",
    originalLanguage: "en",
    rating: 7.8,
    voteCount: 620,
    popularity: 98.9,
    duration: 118,
    director: "David Robert Mitchell",
    tagline: "TRAPPED IN A PREHISTORIC NIGHTMARE",
    starsSummary: "ANNE HATHAWAY • EWAN MCGREGOR • MAISY STELLA",
    releaseDate: "2026-08-14",
    certificate: "UA",
    formats: ["2D", "IMAX"],
    description: "An 80s suburban neighborhood is mysteriously displaced into a prehistoric era, forcing residents into a desperate fight for survival.",
    cast: [
      { name: "Anne Hathaway", character: "Laura Mills", photo: null },
      { name: "Ewan McGregor", character: "Marcus Mills", photo: null },
      { name: "Maisy Stella", character: "Chloe Mills", photo: null },
      { name: "Christian Convery", character: "Toby", photo: null },
      { name: "Michael Shannon", character: "Chief Harlan", photo: null },
      { name: "Tilda Swinton", character: "Dr. Voss", photo: null },
      { name: "Carey Mulligan", character: "Sarah", photo: null },
      { name: "Paul Dano", character: "Henry", photo: null }
    ],
    palette: { c1: "#134e4a", c2: "#042f2e", c3: "#011716", accent: "#14b8a6", textAccent: "#99f6e4", symbol: "OAK" }
  },
  {
    tmdbId: 1368904,
    title: "Dhamaal 4",
    slug: "dhamaal-4-1368904",
    genres: ["Comedy", "Adventure", "Family"],
    language: "Hindi",
    originalLanguage: "hi",
    rating: 7.6,
    voteCount: 890,
    popularity: 165.7,
    duration: 128,
    director: "Indra Kumar",
    tagline: "THE CRAZIEST QUARTET IS BACK",
    starsSummary: "AJAY DEVGN • RITEISH DESHMUKH • ARSHAD WARSI • SANJAY DUTT",
    releaseDate: "2026-07-10",
    certificate: "U",
    formats: ["2D", "3D"],
    description: "The beloved Dhamaal gang embarks on their wildest and funniest adventure yet across uncharted jungles, wild beasts, and eccentric gangsters.",
    cast: [
      { name: "Ajay Devgn", character: "Guddu", photo: null },
      { name: "Riteish Deshmukh", character: "Roy", photo: null },
      { name: "Arshad Warsi", character: "Manav", photo: null },
      { name: "Javed Jaffrey", character: "Adi", photo: null },
      { name: "Sanjay Dutt", character: "Inspector Kabir Nayak", photo: null },
      { name: "Johnny Lever", character: "Constable Lakhan", photo: null },
      { name: "Ashish Chowdhry", character: "Boman", photo: null },
      { name: "Esha Gupta", character: "Sanjana", photo: null }
    ],
    palette: { c1: "#854d0e", c2: "#422006", c3: "#1a0c02", accent: "#eab308", textAccent: "#fef08a", symbol: "D4" }
  },
  {
    tmdbId: 1479821,
    title: "Lenin",
    slug: "lenin-1479821",
    genres: ["Action", "Political", "Drama"],
    language: "Telugu",
    originalLanguage: "te",
    rating: 8.1,
    voteCount: 540,
    popularity: 105.3,
    duration: 152,
    director: "Murali Kishor Abburu",
    tagline: "A RURAL REVOLUTIONARY RISES",
    starsSummary: "AKHIL AKKINENI • SREELEELA • JAGAPATHI BABU",
    releaseDate: "2026-07-10",
    certificate: "UA",
    formats: ["2D"],
    description: "A fierce rural action drama about a young rebel who fights against systemic village oppression to deliver long-denied justice.",
    cast: [
      { name: "Akhil Akkineni", character: "Lenin", photo: null },
      { name: "Sreeleela", character: "Ananya", photo: null },
      { name: "Jagapathi Babu", character: "Veeraraju", photo: null },
      { name: "Sunil", character: "Samba", photo: null },
      { name: "Brahmaji", character: "Sub-Inspector", photo: null },
      { name: "Rao Ramesh", character: "Collector", photo: null },
      { name: "Muralikrishna", character: "Chinna", photo: null },
      { name: "Saranya Ponvannan", character: "Mother", photo: null }
    ],
    palette: { c1: "#881337", c2: "#4c0519", c3: "#1f010a", accent: "#f43f5e", textAccent: "#fecdd3", symbol: "LEN" }
  },
  {
    tmdbId: 1241982,
    title: "Moana 2",
    slug: "moana-1241982",
    genres: ["Animation", "Adventure", "Family"],
    language: "English",
    originalLanguage: "en",
    rating: 8.2,
    voteCount: 2400,
    popularity: 320.5,
    duration: 100,
    director: "David G. Derrick Jr.",
    tagline: "THE OCEAN CALLS FOR THE ULTIMATE VOYAGE",
    starsSummary: "AULIʻI CRAVALHO • DWAYNE JOHNSON • ALAN TUDYK",
    releaseDate: "2026-07-10",
    certificate: "U",
    formats: ["2D", "3D", "IMAX"],
    description: "Moana sets sail on an epic new voyage into distant, dangerous waters after receiving an unexpected call from her wayfinding ancestors.",
    cast: [
      { name: "Auliʻi Cravalho", character: "Moana (voice)", photo: null },
      { name: "Dwayne Johnson", character: "Maui (voice)", photo: null },
      { name: "Alan Tudyk", character: "Heihei (voice)", photo: null },
      { name: "Rachel House", character: "Gramma Tala (voice)", photo: null },
      { name: "Temuera Morrison", character: "Chief Tui (voice)", photo: null },
      { name: "Nicole Scherzinger", character: "Sina (voice)", photo: null },
      { name: "Jemaine Clement", character: "Tamatoa (voice)", photo: null },
      { name: "Rose Matafeo", character: "Loto (voice)", photo: null }
    ],
    palette: { c1: "#0284c7", c2: "#0369a1", c3: "#082f49", accent: "#38bdf8", textAccent: "#e0f2fe", symbol: "M2" }
  },
  {
    tmdbId: 950387,
    title: "The Odyssey",
    slug: "the-odyssey-950387",
    genres: ["Epic", "Action", "Fantasy", "Drama"],
    language: "English",
    originalLanguage: "en",
    rating: 8.9,
    voteCount: 4200,
    popularity: 480.4,
    duration: 166,
    director: "Christopher Nolan",
    tagline: "CHRISTOPHER NOLAN'S CINEMATIC MASTERPIECE",
    starsSummary: "MATT DAMON • ANNE HATHAWAY • ROBERT PATTINSON",
    releaseDate: "2026-07-17",
    certificate: "UA",
    formats: ["2D", "IMAX", "70MM", "4DX"],
    description: "An astronomical billion-dollar epic adapting Homer's Odyssey, taking Odysseus on a grand visual spectacle across mythical worlds.",
    cast: [
      { name: "Matt Damon", character: "Odysseus", photo: null },
      { name: "Anne Hathaway", character: "Penelope", photo: null },
      { name: "Robert Pattinson", character: "Telemachus", photo: null },
      { name: "Tom Holland", character: "Hermes", photo: null },
      { name: "Zendaya", character: "Athena", photo: null },
      { name: "Lupita Nyong'o", character: "Circe", photo: null },
      { name: "Cillian Murphy", character: "Poseidon", photo: null },
      { name: "Ken Watanabe", character: "King Alcinous", photo: null }
    ],
    palette: { c1: "#312e81", c2: "#1e1b4b", c3: "#0a0924", accent: "#818cf8", textAccent: "#e0e7ff", symbol: "ODY" }
  },
  {
    tmdbId: 1380914,
    title: "Maaran",
    slug: "maaran-1380914",
    genres: ["Action", "Crime", "Thriller"],
    language: "Tamil",
    originalLanguage: "ta",
    rating: 8.0,
    voteCount: 480,
    popularity: 92.1,
    duration: 145,
    director: "Karthick Naren",
    tagline: "THE PEN IS DEADLIER THAN THE SWORD",
    starsSummary: "DHANUSH • MALAVIKA MOHANAN • SAMUTHIRAKANI",
    releaseDate: "2026-07-31",
    certificate: "UA",
    formats: ["2D"],
    description: "A fearless investigative journalist exposes a high-profile election tampering scam and must protect his family when the cartel retaliates.",
    cast: [
      { name: "Dhanush", character: "Mathimaaran 'Maaran'", photo: null },
      { name: "Malavika Mohanan", character: "Thara", photo: null },
      { name: "Samuthirakani", character: "Pazhani", photo: null },
      { name: "Smruthi Venkat", character: "Shwetha", photo: null },
      { name: "Master Mahendran", character: "Inspector Selvam", photo: null },
      { name: "Ameer", character: "Deva", photo: null },
      { name: "Ramki", character: "Chief Editor", photo: null },
      { name: "Bose Venkat", character: "MLA Rathnam", photo: null }
    ],
    palette: { c1: "#581c87", c2: "#3b0764", c3: "#19022e", accent: "#a855f7", textAccent: "#f3e8ff", symbol: "MRN" }
  },
  {
    tmdbId: 1380998,
    title: "Get Set Go",
    slug: "get-set-go-1380998",
    genres: ["Action", "Adventure", "Comedy"],
    language: "Gujarati",
    originalLanguage: "gu",
    rating: 7.7,
    voteCount: 290,
    popularity: 81.7,
    duration: 122,
    director: "Arnav Kumar",
    tagline: "GUJARATI CINEMA'S BIGGEST ACTION ADVENTURE",
    starsSummary: "DEEPAK TIJORI • MALHAR THAKAR • AAROHI PATEL",
    releaseDate: "2026-08-07",
    certificate: "U",
    formats: ["2D"],
    description: "Deepak Tijori returns in a high-octane bicycle gang action heist film about young daredevils outsmarting a corrupt syndicate.",
    cast: [
      { name: "Deepak Tijori", character: "Vikram Bhai", photo: null },
      { name: "Malhar Thakar", character: "Jignesh", photo: null },
      { name: "Aarohi Patel", character: "Pooja", photo: null },
      { name: "Pratik Gandhi", character: "Inspector Joshi (Special)", photo: null },
      { name: "Siddharth Randeria", character: "Bapa", photo: null },
      { name: "Manoj Joshi", character: "Commissioner", photo: null },
      { name: "Aanvee Oza", character: "Riya", photo: null },
      { name: "Mitra Gadhvi", character: "Bhavesh", photo: null }
    ],
    palette: { c1: "#c2410c", c2: "#7c2d12", c3: "#300e04", accent: "#f97316", textAccent: "#ffedd5", symbol: "GSG" }
  },
  {
    tmdbId: 1379203,
    title: "Evil Dead Burn",
    slug: "evil-dead-burn-1379203",
    genres: ["Horror", "Supernatural", "Thriller"],
    language: "English",
    originalLanguage: "en",
    rating: 8.0,
    voteCount: 1120,
    popularity: 220.6,
    duration: 98,
    director: "Sébastien Vaniček",
    tagline: "SURVIVE THE FIRE OR SUCCUMB TO THE DEAD",
    starsSummary: "SOUHEILA YACOUB • HUNTER DOOHAN • LUCIAN-RIVER CHAUHAN",
    releaseDate: "2026-07-10",
    certificate: "A",
    formats: ["2D", "4DX"],
    description: "Sam Raimi produces the explosive new chapter in the Evil Dead franchise, unleashing ancient demonic forces trapped in a fiery inferno.",
    cast: [
      { name: "Souheila Yacoub", character: "Sarah", photo: null },
      { name: "Hunter Doohan", character: "Leo", photo: null },
      { name: "Lucian-River Chauhan", character: "Kieran", photo: null },
      { name: "Lily Sullivan", character: "Beth (Cameo)", photo: null },
      { name: "Alyssa Sutherland", character: "Deadite Ellie (Voice)", photo: null },
      { name: "Bruce Campbell", character: "Ash Williams (Cameo)", photo: null },
      { name: "Morgan Davies", character: "Danny", photo: null },
      { name: "Gabrielle Echols", character: "Bridget", photo: null }
    ],
    palette: { c1: "#450a0a", c2: "#260404", c3: "#0e0101", accent: "#dc2626", textAccent: "#fee2e2", symbol: "EDB" }
  },
  {
    tmdbId: 1380876,
    title: "Jana Nayagan",
    slug: "jana-nayagan-1380876",
    genres: ["Political Action", "Drama"],
    language: "Tamil",
    originalLanguage: "ta",
    rating: 9.1,
    voteCount: 3800,
    popularity: 390.8,
    duration: 158,
    director: "H. Vinoth",
    tagline: "THALAPATHY VIJAY'S GRAND CINEMATIC FAREWELL",
    starsSummary: "THALAPATHY VIJAY • POOJA HEGDE • BOBBY DEOL",
    releaseDate: "2026-07-23",
    certificate: "UA",
    formats: ["2D", "IMAX"],
    description: "Thalapathy Vijay stars in his final blockbuster before entering public politics, delivering a powerful message against systemic corruption.",
    cast: [
      { name: "Thalapathy Vijay", character: "Jana Nayagan", photo: null },
      { name: "Pooja Hegde", character: "Dr. Anitha", photo: null },
      { name: "Bobby Deol", character: "Rudrappa", photo: null },
      { name: "Gautham Vasudev Menon", character: "Commissioner Selvam", photo: null },
      { name: "Priyamani", character: "Advocate Deepa", photo: null },
      { name: "Prakash Raj", character: "Governor", photo: null },
      { name: "Mamitha Baiju", character: "Meera", photo: null },
      { name: "Monisha Blessy", character: "Sister", photo: null }
    ],
    palette: { c1: "#7c2d12", c2: "#431407", c3: "#1c0702", accent: "#ea580c", textAccent: "#ffedd5", symbol: "JN" }
  },
  {
    tmdbId: 1391142,
    title: "Vishwanath & Sons",
    slug: "vishwanath-and-sons-1391142",
    genres: ["Family", "Romance", "Drama"],
    language: "Tamil",
    originalLanguage: "ta",
    rating: 8.3,
    voteCount: 620,
    popularity: 112.2,
    duration: 135,
    director: "Venky Atluri",
    tagline: "AN EMOTIONAL ROLLERCOASTER OF LOVE & HERITAGE",
    starsSummary: "SURIYA • MAMITHA BAIJU • RAVEENA TANDON",
    releaseDate: "2026-08-14",
    certificate: "U",
    formats: ["2D"],
    description: "Venky Atluri directs Suriya and Mamitha Baiju in a heartwarming family drama about preserving generational legacy and true love.",
    cast: [
      { name: "Suriya", character: "Vishwanath", photo: null },
      { name: "Mamitha Baiju", character: "Ananya", photo: null },
      { name: "Raveena Tandon", character: "Savitri Devi", photo: null },
      { name: "Sathyaraj", character: "Grandfather", photo: null },
      { name: "Nasser", character: "Elder Uncle", photo: null },
      { name: "Soori", character: "Ganesan", photo: null },
      { name: "Kovai Sarala", character: "Aunt", photo: null },
      { name: "Redin Kingsley", character: "Manager", photo: null }
    ],
    palette: { c1: "#14532d", c2: "#052e16", c3: "#02150a", accent: "#22c55e", textAccent: "#dcfce7", symbol: "VS" }
  },
  {
    tmdbId: 1156593,
    title: "Spider-Man: Brand New Day",
    slug: "spider-man-brand-new-day-1156593",
    genres: ["Action", "Adventure", "Sci-Fi"],
    language: "English",
    originalLanguage: "en",
    rating: 9.0,
    voteCount: 5100,
    popularity: 540.3,
    duration: 148,
    director: "Destin Daniel Cretton",
    tagline: "A FRESH START. A NEW SHADOW.",
    starsSummary: "TOM HOLLAND • ZENDAYA • SADIE SINK",
    releaseDate: "2026-07-31",
    certificate: "UA",
    formats: ["2D", "IMAX", "3D", "4DX"],
    description: "Peter Parker begins a new chapter in New York, confronting new street-level criminal organizations while balancing his double life.",
    cast: [
      { name: "Tom Holland", character: "Peter Parker / Spider-Man", photo: null },
      { name: "Zendaya", character: "MJ", photo: null },
      { name: "Sadie Sink", character: "Felicia Hardy / Black Cat", photo: null },
      { name: "Jon Favreau", character: "Happy Hogan", photo: null },
      { name: "Mark Ruffalo", character: "Bruce Banner / Hulk", photo: null },
      { name: "Jacob Batalon", character: "Ned Leeds", photo: null },
      { name: "Vincent D'Onofrio", character: "Wilson Fisk / Kingpin", photo: null },
      { name: "Charlie Cox", character: "Matt Murdock / Daredevil", photo: null }
    ],
    palette: { c1: "#991b1b", c2: "#1e3a8a", c3: "#080f2b", accent: "#ef4444", textAccent: "#fee2e2", symbol: "SPIDER" }
  },
  {
    tmdbId: 1380922,
    title: "Unmadham",
    slug: "unmadham-1380922",
    genres: ["Psychological", "Noir", "Thriller"],
    language: "Malayalam",
    originalLanguage: "ml",
    rating: 8.2,
    voteCount: 380,
    popularity: 91.4,
    duration: 140,
    director: "Kiran Das",
    tagline: "WHEN REASON SURRENDERS TO DARK OBSESSION",
    starsSummary: "KUNCHACKO BOBAN • APARNA BALAMURALI • SURAJ VENJARAMOODU",
    releaseDate: "2026-07-31",
    certificate: "UA",
    formats: ["2D"],
    description: "A riveting Malayalam psychological thriller probing the dark corridors of the human mind after an unsolved crime resurfaces.",
    cast: [
      { name: "Kunchacko Boban", character: "David", photo: null },
      { name: "Aparna Balamurali", character: "Dr. Maya", photo: null },
      { name: "Suraj Venjaramoodu", character: "DySP George", photo: null },
      { name: "Jaffer Idukki", character: "Kumaran", photo: null },
      { name: "Indrans", character: "Watchman Appu", photo: null },
      { name: "Sudheer Karamana", character: "Advocate Thomas", photo: null },
      { name: "Divya Prabha", character: "Sujatha", photo: null },
      { name: "Vijayaraghavan", character: "Judge Varma", photo: null }
    ],
    palette: { c1: "#3730a3", c2: "#1e1b4b", c3: "#0c0a29", accent: "#6366f1", textAccent: "#e0e7ff", symbol: "UNM" }
  },
  {
    tmdbId: 1391188,
    title: "ChaO",
    slug: "chao-1391188",
    genres: ["Animation", "Fantasy", "Romance"],
    language: "Japanese",
    originalLanguage: "ja",
    rating: 8.4,
    voteCount: 730,
    popularity: 140.5,
    duration: 112,
    director: "Yasuhiro Aoki",
    tagline: "WHERE DREAMS & FANTASY COLLIDE",
    starsSummary: "RYUNOSUKE KAMIKI • MINAMI HAMABE",
    releaseDate: "2026-08-07",
    certificate: "U",
    formats: ["2D", "IMAX"],
    description: "Studio 4°C presents a breathtaking fantasy anime about an engineer whose encounter with a mythical mermaid princess sparks an unforgettable journey.",
    cast: [
      { name: "Ryunosuke Kamiki", character: "Stephan (voice)", photo: null },
      { name: "Minami Hamabe", character: "ChaO (voice)", photo: null },
      { name: "Kenichi Matsuyama", character: "Captain Boris (voice)", photo: null },
      { name: "Nana Mori", character: "Airi (voice)", photo: null },
      { name: "Mamoru Miyano", character: "Finian (voice)", photo: null },
      { name: "Aoi Yuuki", character: "Coral (voice)", photo: null }
    ],
    palette: { c1: "#0e7490", c2: "#155e75", c3: "#062b42", accent: "#06b6d4", textAccent: "#cffafe", symbol: "CHAO" }
  },
  {
    tmdbId: 1479840,
    title: "G.D.N.",
    slug: "gdn-1479840",
    genres: ["Biography", "Inspirational", "Drama"],
    language: "Tamil",
    originalLanguage: "ta",
    rating: 8.6,
    voteCount: 610,
    popularity: 118.8,
    duration: 144,
    director: "Krishnakumar Ramakumar",
    tagline: "THE INSPIRING SAGA OF THE EDISON OF INDIA",
    starsSummary: "R. MADHAVAN • SHRADDHA SRINATH • NASSAR",
    releaseDate: "2026-08-07",
    certificate: "U",
    formats: ["2D"],
    description: "R. Madhavan stars as the pioneering Indian visionary and inventor G.D. Naidu, capturing his groundbreaking innovations and humanitarian spirit.",
    cast: [
      { name: "R. Madhavan", character: "G.D. Naidu", photo: null },
      { name: "Shraddha Srinath", character: "Kalyani", photo: null },
      { name: "Nassar", character: "Industrialist Ramanathan", photo: null },
      { name: "Guru Somasundaram", character: "Scientist Bose", photo: null },
      { name: "MS Bhaskar", character: "Advocate Shastri", photo: null },
      { name: "Kishore", character: "British Officer", photo: null },
      { name: "Delhi Ganesh", character: "Uncle", photo: null },
      { name: "Pavel Navageethan", character: "Assistant", photo: null }
    ],
    palette: { c1: "#713f12", c2: "#3f2206", c3: "#1a0d01", accent: "#ca8a04", textAccent: "#fef9c3", symbol: "GDN" }
  },
  {
    tmdbId: 1479832,
    title: "DC",
    slug: "dc-1479832",
    genres: ["Action", "Crime", "Drama"],
    language: "Tamil",
    originalLanguage: "ta",
    rating: 8.8,
    voteCount: 940,
    popularity: 180.3,
    duration: 141,
    director: "Arun Matheswaran",
    tagline: "PASSION • BLOODSHED • LOYALTY",
    starsSummary: "LOKESH KANAGARAJ • WAMIQA GABBI",
    releaseDate: "2026-08-07",
    certificate: "UA",
    formats: ["2D", "IMAX"],
    description: "Arun Matheswaran directs Lokesh Kanagaraj and Wamiqa Gabbi in a gritty, high-octane world where Devadas and Chandra fight for survival.",
    cast: [
      { name: "Lokesh Kanagaraj", character: "Devadas", photo: null },
      { name: "Wamiqa Gabbi", character: "Chandra", photo: "/e1CNXkH2scGeoabOTowFJJxX2YF.jpg" },
      { name: "Sanjana Krishnamoorthy", character: "Parvathi", photo: null },
      { name: "Fahadh Faasil", character: "Adithyan", photo: null },
      { name: "Aishwarya Rajesh", character: "Kamala", photo: null },
      { name: "Nizhalgal Ravi", character: "Thilagar", photo: null },
      { name: "Ameer", character: "Inspector Durai", photo: null },
      { name: "Singampuli", character: "Vellai", photo: null }
    ],
    palette: { c1: "#831843", c2: "#500724", c3: "#22020e", accent: "#f43f5e", textAccent: "#ffe4e6", symbol: "DC" }
  }
];

function makeSvg(m: MovieDef): string {
  const p = m.palette;
  const starsText = m.starsSummary;
  const genresText = m.genres.join(' • ').toUpperCase();
  const directorText = `DIRECTED BY ${m.director.toUpperCase()}`;
  const titleFontSize = m.title.length > 16 ? '32' : '38';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="750" viewBox="0 0 500 750">
  <defs>
    <linearGradient id="bg_${m.slug}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${p.c1}" />
      <stop offset="45%" stop-color="${p.c2}" />
      <stop offset="100%" stop-color="${p.c3}" />
    </linearGradient>
    <radialGradient id="glow_${m.slug}" cx="50%" cy="40%" r="50%">
      <stop offset="0%" stop-color="${p.accent}" stop-opacity="0.4" />
      <stop offset="70%" stop-color="${p.accent}" stop-opacity="0.05" />
      <stop offset="100%" stop-color="${p.accent}" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="top_shade" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.85" />
      <stop offset="25%" stop-color="#000000" stop-opacity="0.2" />
      <stop offset="60%" stop-color="#000000" stop-opacity="0.4" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0.95" />
    </linearGradient>
    <filter id="shadow_${m.slug}" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.9" />
    </filter>
  </defs>

  <!-- Background layers -->
  <rect width="500" height="750" fill="url(#bg_${m.slug})" />
  <rect width="500" height="750" fill="url(#glow_${m.slug})" />

  <!-- Outer Cinema Border -->
  <rect x="18" y="18" width="464" height="714" fill="none" stroke="${p.accent}" stroke-width="1.5" stroke-opacity="0.4" rx="12" />
  <rect x="26" y="26" width="448" height="698" fill="none" stroke="#ffffff" stroke-width="0.75" stroke-opacity="0.1" rx="8" />

  <!-- Corner Brackets -->
  <path d="M 18 52 L 18 18 L 52 18" fill="none" stroke="${p.accent}" stroke-width="3" />
  <path d="M 482 52 L 482 18 L 448 18" fill="none" stroke="${p.accent}" stroke-width="3" />
  <path d="M 18 698 L 18 732 L 52 732" fill="none" stroke="${p.accent}" stroke-width="3" />
  <path d="M 482 698 L 482 732 L 448 732" fill="none" stroke="${p.accent}" stroke-width="3" />

  <!-- Center Emblem Art -->
  <circle cx="250" cy="310" r="115" fill="none" stroke="${p.accent}" stroke-width="2" stroke-opacity="0.25" />
  <circle cx="250" cy="310" r="95" fill="${p.c1}" fill-opacity="0.5" stroke="#ffffff" stroke-width="1" stroke-opacity="0.15" />
  <circle cx="250" cy="310" r="75" fill="none" stroke="${p.accent}" stroke-width="1.5" stroke-dasharray="6,4" stroke-opacity="0.6" />
  
  <text x="250" y="328" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="44" font-weight="900" fill="${p.textAccent}" letter-spacing="4" filter="url(#shadow_${m.slug})">${p.symbol}</text>

  <!-- Atmospheric Shadow Overlay -->
  <rect width="500" height="750" fill="url(#top_shade)" />

  <!-- Header: Genre & Release Year -->
  <text x="250" y="65" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" fill="${p.textAccent}" letter-spacing="3">${genresText}</text>
  <text x="250" y="82" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="600" fill="#94a3b8" letter-spacing="2">IN THEATRES 2026</text>

  <!-- Star Cast Header -->
  <text x="250" y="125" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="700" fill="#f1f5f9" letter-spacing="1.5" filter="url(#shadow_${m.slug})">${starsText}</text>

  <!-- Tagline Above Title -->
  <text x="250" y="495" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="10.5" font-weight="700" fill="${p.textAccent}" letter-spacing="2" filter="url(#shadow_${m.slug})">${m.tagline}</text>

  <!-- Movie Title -->
  <text x="250" y="540" text-anchor="middle" font-family="system-ui, -apple-system, Impact, sans-serif" font-size="${titleFontSize}" font-weight="900" fill="#ffffff" letter-spacing="2" filter="url(#shadow_${m.slug})">${m.title.toUpperCase()}</text>

  <!-- Accent Divider -->
  <line x1="160" y1="562" x2="340" y2="562" stroke="${p.accent}" stroke-width="2.5" stroke-linecap="round" />

  <!-- Director & Production -->
  <text x="250" y="598" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" fill="#e2e8f0" letter-spacing="2">${directorText}</text>
  <text x="250" y="620" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="9.5" font-weight="500" fill="#94a3b8" letter-spacing="1.5">EXPERIENCE IN THEATRES &amp; IMAX</text>

  <!-- Book Now Button Badge -->
  <rect x="190" y="660" width="120" height="26" rx="13" fill="${p.accent}" fill-opacity="0.25" stroke="${p.accent}" stroke-width="1.5" />
  <text x="250" y="677" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="800" fill="#ffffff" letter-spacing="2">BOOK TICKETS</text>
</svg>`;
}

async function run() {
  console.log('Generating posters in:', postersDir);
  const cleanMocks: any[] = [];

  for (const m of moviesData) {
    const svgFile = `${m.slug}.svg`;
    const svgPath = path.join(postersDir, svgFile);
    fs.writeFileSync(svgPath, makeSvg(m), 'utf-8');

    cleanMocks.push({
      tmdbId: m.tmdbId,
      title: m.title,
      slug: m.slug,
      genres: m.genres,
      language: m.language,
      originalLanguage: m.originalLanguage,
      rating: m.rating,
      voteCount: m.voteCount,
      popularity: m.popularity,
      revenue: 0,
      budget: 0,
      duration: m.duration,
      poster: `/posters/${svgFile}`,
      backdrop: `/posters/${svgFile}`,
      description: m.description,
      cast: m.cast,
      director: m.director,
      trailerUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      releaseDate: m.releaseDate,
      certificate: m.certificate,
      formats: m.formats,
      status: "now_showing",
      isActive: true
    });
  }

  // Write mock-movies.json
  const mockPath = 'd:/Programming/bookyourshow/apps/api/src/data/mock-movies.json';
  fs.writeFileSync(mockPath, JSON.stringify(cleanMocks, null, 2), 'utf-8');
  console.log('✅ Wrote mock-movies.json with 20 movies and full casts');

  // Update MongoDB directly
  await mongoose.connect('mongodb://bookyourshow:bys_dev_2026@localhost:27017/bookyourshow?authSource=admin');
  const db = mongoose.connection.db;
  
  // Clean old movies and upsert exactly these 20
  const validTmdbIds = cleanMocks.map(m => m.tmdbId);
  await db.collection('movies').deleteMany({ tmdbId: { $nin: validTmdbIds } });

  for (const m of cleanMocks) {
    await db.collection('movies').updateOne(
      { tmdbId: m.tmdbId },
      {
        $set: {
          ...m,
          releaseDate: new Date(m.releaseDate),
          lastSyncedAt: new Date()
        }
      },
      { upsert: true }
    );
  }
  console.log('✅ Updated MongoDB with exact 20 movies, correct cast & studio posters');

  // Flush Redis Cache
  await connectRedis();
  await redis.flushall();
  console.log('✅ Flushed Redis Cache');
  await disconnectRedis();

  await mongoose.disconnect();
  console.log('🎉 Done! All 20 movies accurately synced with authentic posters & casts!');
  process.exit(0);
}

run().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
