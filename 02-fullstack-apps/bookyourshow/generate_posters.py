import os
import json
from datetime import datetime

out_dir = r"d:\Programming\bookyourshow\apps\web\public\posters"
os.makedirs(out_dir, exist_ok=True)

# 20 Exact 2026 Theatrical Popular Movies
movies = [
    {
        "tmdbId": 1399617,
        "title": "Awarapan 2",
        "slug": "awarapan-2-1399617",
        "tagline": "REDEMPTION HAS A DEADLY PRICE",
        "stars": ["Emraan Hashmi", "Disha Patani", "Shabana Azmi"],
        "director": "Nitin Kakkar",
        "language": "Hindi",
        "originalLanguage": "hi",
        "genres": ["Action", "Crime", "Thriller"],
        "rating": 7.9,
        "voteCount": 320,
        "popularity": 95.4,
        "duration": 148,
        "releaseDate": "2026-08-14",
        "certificate": "UA",
        "formats": ["2D"],
        "description": "Shivam Pandit returns in a brooding Mumbai noir underworld thriller, caught between an oath of redemption and a rising cartel.",
        "cast": [
            {"name": "Emraan Hashmi", "character": "Shivam Pandit", "photo": None},
            {"name": "Disha Patani", "character": "Nisha", "photo": None},
            {"name": "Shabana Azmi", "character": "Begum Fatima", "photo": None},
            {"name": "Randeep Hooda", "character": "Inspector Rathod", "photo": None}
        ],
        "palette": {"c1": "#3b0764", "c2": "#18022b", "c3": "#07000d", "accent": "#a855f7", "textAccent": "#e9d5ff", "symbol": "A2"}
    },
    {
        "tmdbId": 1380921,
        "title": "Thudakkam",
        "slug": "thudakkam-1380921",
        "tagline": "THE BEGINNING OF THE END",
        "stars": ["Vismaya Mohanlal", "Mohanlal", "Pranav Mohanlal"],
        "director": "Jude Anthany Joseph",
        "language": "Malayalam",
        "originalLanguage": "ml",
        "genres": ["Action", "Thriller", "Drama"],
        "rating": 8.2,
        "voteCount": 410,
        "popularity": 89.6,
        "duration": 135,
        "releaseDate": "2026-08-07",
        "certificate": "UA",
        "formats": ["2D"],
        "description": "A high-octane Malayalam action thriller following Meenu, whose act of kindness pulls her into the crosshairs of an elusive coastal syndicate.",
        "cast": [
            {"name": "Vismaya Mohanlal", "character": "Meenu", "photo": None},
            {"name": "Mohanlal", "character": "Mathew (Cameo)", "photo": None},
            {"name": "Pranav Mohanlal", "character": "Anand", "photo": None},
            {"name": "Mamta Mohandas", "character": "Dr. Sarah", "photo": None}
        ],
        "palette": {"c1": "#064e3b", "c2": "#022c22", "c3": "#01140f", "accent": "#10b981", "textAccent": "#a7f3d0", "symbol": "THU"}
    },
    {
        "tmdbId": 1362845,
        "title": "Ishqnama",
        "slug": "ishqnama-1362845",
        "tagline": "A BORDERLESS LOVE STORY",
        "stars": ["Jayy Randhawa", "Shehnaaz Gill"],
        "director": "Arvvinder Khaira",
        "language": "Punjabi",
        "originalLanguage": "pa",
        "genres": ["Romance", "Period", "Drama"],
        "rating": 7.8,
        "voteCount": 270,
        "popularity": 82.1,
        "duration": 142,
        "releaseDate": "2026-07-24",
        "certificate": "U",
        "formats": ["2D"],
        "description": "An intense Punjabi period romance set against the India-Pakistan border, bridging generational divides through unforgettable soulful melodies.",
        "cast": [
            {"name": "Jayy Randhawa", "character": "Fateh", "photo": None},
            {"name": "Shehnaaz Gill", "character": "Noor", "photo": None},
            {"name": "Guggu Gill", "character": "Sardar Jarnail", "photo": None},
            {"name": "Nirmal Rishi", "character": "Bebe", "photo": None}
        ],
        "palette": {"c1": "#701a75", "c2": "#4a044e", "c3": "#1f0122", "accent": "#f43f5e", "textAccent": "#fbcfe8", "symbol": "ISH"}
    },
    {
        "tmdbId": 1391087,
        "title": "Batwara 1947",
        "slug": "batwara-1947-1391087",
        "tagline": "AN EPIC SAGA OF RESILIENCE & HOPE",
        "stars": ["Sunny Deol", "Preity Zinta", "Shabana Azmi"],
        "director": "Rajkumar Santoshi",
        "language": "Hindi",
        "originalLanguage": "hi",
        "genres": ["History", "War", "Drama"],
        "rating": 8.5,
        "voteCount": 780,
        "popularity": 145.2,
        "duration": 165,
        "releaseDate": "2026-08-14",
        "certificate": "UA",
        "formats": ["2D", "IMAX"],
        "description": "Rajkumar Santoshi and Aamir Khan present an epic tale of human resilience, courage, and compassion during the 1947 Partition of India.",
        "cast": [
            {"name": "Sunny Deol", "character": "Tarafdar Singh", "photo": None},
            {"name": "Preity Zinta", "character": "Amrit Kaur", "photo": None},
            {"name": "Shabana Azmi", "character": "Zeenat Begum", "photo": None},
            {"name": "Ali Fazal", "character": "Iqbal", "photo": None}
        ],
        "palette": {"c1": "#78350f", "c2": "#451a03", "c3": "#1c0a00", "accent": "#f59e0b", "textAccent": "#fde68a", "symbol": "1947"}
    },
    {
        "tmdbId": 1479835,
        "title": "Idhayam Murali",
        "slug": "idhayam-murali-1479835",
        "tagline": "A COMING OF AGE ROMANTIC MELODY",
        "stars": ["Atharvaa Murali", "Aditi Shankar", "Prakash Raj"],
        "director": "Aakash Baskaran",
        "language": "Tamil",
        "originalLanguage": "ta",
        "genres": ["Romance", "Drama", "Musical"],
        "rating": 8.3,
        "voteCount": 510,
        "popularity": 110.4,
        "duration": 138,
        "releaseDate": "2026-07-10",
        "certificate": "U",
        "formats": ["2D"],
        "description": "A touching coming-of-age romantic drama about a young man striving to win the love of his life while discovering his true calling.",
        "cast": [
            {"name": "Atharvaa Murali", "character": "Murali", "photo": None},
            {"name": "Aditi Shankar", "character": "Kavya", "photo": None},
            {"name": "Prakash Raj", "character": "Father", "photo": None},
            {"name": "Karunakaran", "character": "Friend", "photo": None}
        ],
        "palette": {"c1": "#1e3a8a", "c2": "#0f172a", "c3": "#020617", "accent": "#38bdf8", "textAccent": "#bae6fd", "symbol": "IM"}
    },
    {
        "tmdbId": 1391203,
        "title": "The End of Oak Street",
        "slug": "the-end-of-oak-street-1391203",
        "tagline": "TRAPPED IN A PREHISTORIC NIGHTMARE",
        "stars": ["Anne Hathaway", "Ewan McGregor"],
        "director": "David Robert Mitchell",
        "language": "English",
        "originalLanguage": "en",
        "genres": ["Sci-Fi", "Survival", "Thriller"],
        "rating": 7.8,
        "voteCount": 620,
        "popularity": 98.9,
        "duration": 118,
        "releaseDate": "2026-08-14",
        "certificate": "UA",
        "formats": ["2D", "IMAX"],
        "description": "An 80s suburban neighborhood is mysteriously displaced into a prehistoric era, forcing residents into a desperate fight for survival.",
        "cast": [
            {"name": "Anne Hathaway", "character": "Laura", "photo": None},
            {"name": "Ewan McGregor", "character": "Marcus", "photo": None},
            {"name": "Maisy Stella", "character": "Chloe", "photo": None}
        ],
        "palette": {"c1": "#134e4a", "c2": "#042f2e", "c3": "#011716", "accent": "#14b8a6", "textAccent": "#99f6e4", "symbol": "OAK"}
    },
    {
        "tmdbId": 1368904,
        "title": "Dhamaal 4",
        "slug": "dhamaal-4-1368904",
        "tagline": "THE CRAZIEST QUARTET IS BACK",
        "stars": ["Ajay Devgn", "Riteish Deshmukh", "Arshad Warsi", "Sanjay Dutt"],
        "director": "Indra Kumar",
        "language": "Hindi",
        "originalLanguage": "hi",
        "genres": ["Comedy", "Adventure", "Family"],
        "rating": 7.6,
        "voteCount": 890,
        "popularity": 165.7,
        "duration": 128,
        "releaseDate": "2026-07-10",
        "certificate": "U",
        "formats": ["2D", "3D"],
        "description": "The beloved Dhamaal gang embarks on their wildest and funniest adventure yet across uncharted jungles and quirky gangsters.",
        "cast": [
            {"name": "Ajay Devgn", "character": "Guddu", "photo": None},
            {"name": "Riteish Deshmukh", "character": "Roy", "photo": None},
            {"name": "Arshad Warsi", "character": "Manav", "photo": None},
            {"name": "Javed Jaffrey", "character": "Adi", "photo": None},
            {"name": "Sanjay Dutt", "character": "Kabir Nayak", "photo": None}
        ],
        "palette": {"c1": "#854d0e", "c2": "#422006", "c3": "#1a0c02", "accent": "#eab308", "textAccent": "#fef08a", "symbol": "D4"}
    },
    {
        "tmdbId": 1479821,
        "title": "Lenin",
        "slug": "lenin-1479821",
        "tagline": "A RURAL REVOLUTIONARY RISES",
        "stars": ["Akhil Akkineni", "Sreeleela", "Jagapathi Babu"],
        "director": "Murali Kishor Abburu",
        "language": "Telugu",
        "originalLanguage": "te",
        "genres": ["Action", "Political", "Drama"],
        "rating": 8.1,
        "voteCount": 540,
        "popularity": 105.3,
        "duration": 152,
        "releaseDate": "2026-07-10",
        "certificate": "UA",
        "formats": ["2D"],
        "description": "A fierce rural action drama about a young rebel who fights against systemic village oppression to deliver long-denied justice.",
        "cast": [
            {"name": "Akhil Akkineni", "character": "Lenin", "photo": None},
            {"name": "Sreeleela", "character": "Ananya", "photo": None},
            {"name": "Jagapathi Babu", "character": "Veeraraju", "photo": None}
        ],
        "palette": {"c1": "#881337", "c2": "#4c0519", "c3": "#1f010a", "accent": "#f43f5e", "textAccent": "#fecdd3", "symbol": "LEN"}
    },
    {
        "tmdbId": 1241982,
        "title": "Moana 2",
        "slug": "moana-1241982",
        "tagline": "THE OCEAN CALLS FOR THE ULTIMATE VOYAGE",
        "stars": ["Auliʻi Cravalho", "Dwayne Johnson"],
        "director": "David G. Derrick Jr.",
        "language": "English",
        "originalLanguage": "en",
        "genres": ["Animation", "Adventure", "Family"],
        "rating": 8.2,
        "voteCount": 2400,
        "popularity": 320.5,
        "duration": 100,
        "releaseDate": "2026-07-10",
        "certificate": "U",
        "formats": ["2D", "3D", "IMAX"],
        "description": "Moana sets sail on an epic new voyage into distant, dangerous waters after receiving an unexpected call from her wayfinding ancestors.",
        "cast": [
            {"name": "Auliʻi Cravalho", "character": "Moana (voice)", "photo": None},
            {"name": "Dwayne Johnson", "character": "Maui (voice)", "photo": None}
        ],
        "palette": {"c1": "#0284c7", "c2": "#0369a1", "c3": "#082f49", "accent": "#38bdf8", "textAccent": "#e0f2fe", "symbol": "M2"}
    },
    {
        "tmdbId": 950387,
        "title": "The Odyssey",
        "slug": "the-odyssey-950387",
        "tagline": "CHRISTOPHER NOLAN'S CINEMATIC MASTERPIECE",
        "stars": ["Matt Damon", "Anne Hathaway", "Robert Pattinson"],
        "director": "Christopher Nolan",
        "language": "English",
        "originalLanguage": "en",
        "genres": ["Epic", "Action", "Fantasy", "Drama"],
        "rating": 8.9,
        "voteCount": 4200,
        "popularity": 480.4,
        "duration": 166,
        "releaseDate": "2026-07-17",
        "certificate": "UA",
        "formats": ["2D", "IMAX", "70MM", "4DX"],
        "description": "An astronomical billion-dollar epic adapting Homer's Odyssey, taking Odysseus on a grand visual spectacle across mythical worlds.",
        "cast": [
            {"name": "Matt Damon", "character": "Odysseus", "photo": None},
            {"name": "Anne Hathaway", "character": "Penelope", "photo": None},
            {"name": "Robert Pattinson", "character": "Telemachus", "photo": None},
            {"name": "Tom Holland", "character": "Hermes", "photo": None},
            {"name": "Zendaya", "character": "Athena", "photo": None}
        ],
        "palette": {"c1": "#312e81", "c2": "#1e1b4b", "c3": "#0a0924", "accent": "#818cf8", "textAccent": "#e0e7ff", "symbol": "ODY"}
    },
    {
        "tmdbId": 1380914,
        "title": "Maaran",
        "slug": "maaran-1380914",
        "tagline": "THE PEN IS DEADLIER THAN THE SWORD",
        "stars": ["Dhanush", "Malavika Mohanan", "Samuthirakani"],
        "director": "Karthick Naren",
        "language": "Tamil",
        "originalLanguage": "ta",
        "genres": ["Action", "Crime", "Thriller"],
        "rating": 8.0,
        "voteCount": 480,
        "popularity": 92.1,
        "duration": 145,
        "releaseDate": "2026-07-31",
        "certificate": "UA",
        "formats": ["2D"],
        "description": "A fearless investigative journalist exposes a high-profile election tampering scam and must protect his family when the cartel retaliates.",
        "cast": [
            {"name": "Dhanush", "character": "Mathimaaran", "photo": None},
            {"name": "Malavika Mohanan", "character": "Thara", "photo": None},
            {"name": "Samuthirakani", "character": "Pazhani", "photo": None}
        ],
        "palette": {"c1": "#581c87", "c2": "#3b0764", "c3": "#19022e", "accent": "#a855f7", "textAccent": "#f3e8ff", "symbol": "MRN"}
    },
    {
        "tmdbId": 1380998,
        "title": "Get Set Go",
        "slug": "get-set-go-1380998",
        "tagline": "GUJARATI CINEMA'S BIGGEST ACTION ADVENTURE",
        "stars": ["Deepak Tijori", "Malhar Thakar", "Aarohi Patel"],
        "director": "Arnav Kumar",
        "language": "Gujarati",
        "originalLanguage": "gu",
        "genres": ["Action", "Adventure", "Comedy"],
        "rating": 7.7,
        "voteCount": 290,
        "popularity": 81.7,
        "duration": 122,
        "releaseDate": "2026-08-07",
        "certificate": "U",
        "formats": ["2D"],
        "description": "Deepak Tijori returns in a high-octane bicycle gang action heist film about young daredevils outsmarting a corrupt syndicate.",
        "cast": [
            {"name": "Deepak Tijori", "character": "Vikram Bhai", "photo": None},
            {"name": "Malhar Thakar", "character": "Jignesh", "photo": None},
            {"name": "Aarohi Patel", "character": "Pooja", "photo": None}
        ],
        "palette": {"c1": "#c2410c", "c2": "#7c2d12", "c3": "#300e04", "accent": "#f97316", "textAccent": "#ffedd5", "symbol": "GSG"}
    },
    {
        "tmdbId": 1379203,
        "title": "Evil Dead Burn",
        "slug": "evil-dead-burn-1379203",
        "tagline": "SURVIVE THE FIRE OR SUCCUMB TO THE DEAD",
        "stars": ["Souheila Yacoub", "Hunter Doohan"],
        "director": "Sébastien Vaniček",
        "language": "English",
        "originalLanguage": "en",
        "genres": ["Horror", "Supernatural", "Thriller"],
        "rating": 8.0,
        "voteCount": 1120,
        "popularity": 220.6,
        "duration": 98,
        "releaseDate": "2026-07-10",
        "certificate": "A",
        "formats": ["2D", "4DX"],
        "description": "Sam Raimi produces the explosive new chapter in the Evil Dead franchise, unleashing ancient demonic forces trapped in a fiery inferno.",
        "cast": [
            {"name": "Souheila Yacoub", "character": "Sarah", "photo": None},
            {"name": "Hunter Doohan", "character": "Leo", "photo": None}
        ],
        "palette": {"c1": "#450a0a", "c2": "#260404", "c3": "#0e0101", "accent": "#dc2626", "textAccent": "#fee2e2", "symbol": "EDB"}
    },
    {
        "tmdbId": 1380876,
        "title": "Jana Nayagan",
        "slug": "jana-nayagan-1380876",
        "tagline": "THALAPATHY VIJAY'S GRAND CINEMATIC FAREWELL",
        "stars": ["Thalapathy Vijay", "Pooja Hegde", "Bobby Deol"],
        "director": "H. Vinoth",
        "language": "Tamil",
        "originalLanguage": "ta",
        "genres": ["Political Action", "Drama"],
        "rating": 9.1,
        "voteCount": 3800,
        "popularity": 390.8,
        "duration": 158,
        "releaseDate": "2026-07-23",
        "certificate": "UA",
        "formats": ["2D", "IMAX"],
        "description": "Thalapathy Vijay stars in his final blockbuster before entering public politics, delivering a powerful message against systemic corruption.",
        "cast": [
            {"name": "Thalapathy Vijay", "character": "Jana Nayagan", "photo": None},
            {"name": "Pooja Hegde", "character": "Dr. Anitha", "photo": None},
            {"name": "Bobby Deol", "character": "Rudrappa", "photo": None},
            {"name": "Gautham Vasudev Menon", "character": "Commissioner", "photo": None}
        ],
        "palette": {"c1": "#7c2d12", "c2": "#431407", "c3": "#1c0702", "accent": "#ea580c", "textAccent": "#ffedd5", "symbol": "JN"}
    },
    {
        "tmdbId": 1391142,
        "title": "Vishwanath & Sons",
        "slug": "vishwanath-and-sons-1391142",
        "tagline": "AN EMOTIONAL ROLLERCOASTER OF LOVE & HERITAGE",
        "stars": ["Suriya", "Mamitha Baiju", "Raveena Tandon"],
        "director": "Venky Atluri",
        "language": "Tamil",
        "originalLanguage": "ta",
        "genres": ["Family", "Romance", "Drama"],
        "rating": 8.3,
        "voteCount": 620,
        "popularity": 112.2,
        "duration": 135,
        "releaseDate": "2026-08-14",
        "certificate": "U",
        "formats": ["2D"],
        "description": "Venky Atluri directs Suriya and Mamitha Baiju in a heartwarming family drama about preserving generational legacy and true love.",
        "cast": [
            {"name": "Suriya", "character": "Vishwanath", "photo": None},
            {"name": "Mamitha Baiju", "character": "Ananya", "photo": None},
            {"name": "Raveena Tandon", "character": "Mother", "photo": None}
        ],
        "palette": {"c1": "#14532d", "c2": "#052e16", "c3": "#02150a", "accent": "#22c55e", "textAccent": "#dcfce7", "symbol": "VS"}
    },
    {
        "tmdbId": 1156593,
        "title": "Spider-Man: Brand New Day",
        "slug": "spider-man-brand-new-day-1156593",
        "tagline": "A FRESH START. A NEW SHADOW.",
        "stars": ["Tom Holland", "Zendaya", "Sadie Sink"],
        "director": "Destin Daniel Cretton",
        "language": "English",
        "originalLanguage": "en",
        "genres": ["Action", "Adventure", "Sci-Fi"],
        "rating": 9.0,
        "voteCount": 5100,
        "popularity": 540.3,
        "duration": 148,
        "releaseDate": "2026-07-31",
        "certificate": "UA",
        "formats": ["2D", "IMAX", "3D", "4DX"],
        "description": "Peter Parker begins a new chapter in New York, confronting new street-level criminal organizations while balancing his double life.",
        "cast": [
            {"name": "Tom Holland", "character": "Peter Parker / Spider-Man", "photo": None},
            {"name": "Zendaya", "character": "MJ", "photo": None},
            {"name": "Sadie Sink", "character": "Felicia Hardy / Black Cat", "photo": None},
            {"name": "Jon Favreau", "character": "Happy Hogan", "photo": None}
        ],
        "palette": {"c1": "#991b1b", "c2": "#1e3a8a", "c3": "#080f2b", "accent": "#ef4444", "textAccent": "#fee2e2", "symbol": "SPIDER"}
    },
    {
        "tmdbId": 1380922,
        "title": "Unmadham",
        "slug": "unmadham-1380922",
        "tagline": "WHEN REASON SURRENDERS TO DARK OBSESSION",
        "stars": ["Kunchacko Boban", "Aparna Balamurali"],
        "director": "Kiran Das",
        "language": "Malayalam",
        "originalLanguage": "ml",
        "genres": ["Psychological", "Noir", "Thriller"],
        "rating": 8.2,
        "voteCount": 380,
        "popularity": 91.4,
        "duration": 140,
        "releaseDate": "2026-07-31",
        "certificate": "UA",
        "formats": ["2D"],
        "description": "A riveting Malayalam psychological thriller probing the dark corridors of the human mind after an unsolved crime resurfaces.",
        "cast": [
            {"name": "Kunchacko Boban", "character": "David", "photo": None},
            {"name": "Aparna Balamurali", "character": "Dr. Maya", "photo": None},
            {"name": "Suraj Venjaramoodu", "character": "DySP George", "photo": None}
        ],
        "palette": {"c1": "#3730a3", "c2": "#1e1b4b", "c3": "#0c0a29", "accent": "#6366f1", "textAccent": "#e0e7ff", "symbol": "UNM"}
    },
    {
        "tmdbId": 1391188,
        "title": "ChaO",
        "slug": "chao-1391188",
        "tagline": "WHERE DREAMS & FANTASY COLLIDE",
        "stars": ["Ryunosuke Kamiki", "Minami Hamabe"],
        "director": "Yasuhiro Aoki",
        "language": "Japanese",
        "originalLanguage": "ja",
        "genres": ["Animation", "Fantasy", "Romance"],
        "rating": 8.4,
        "voteCount": 730,
        "popularity": 140.5,
        "duration": 112,
        "releaseDate": "2026-08-07",
        "certificate": "U",
        "formats": ["2D", "IMAX"],
        "description": "Studio 4°C presents a breathtaking fantasy anime about an engineer whose encounter with a mythical mermaid princess sparks an unforgettable journey.",
        "cast": [
            {"name": "Ryunosuke Kamiki", "character": "Stephan (voice)", "photo": None},
            {"name": "Minami Hamabe", "character": "ChaO (voice)", "photo": None}
        ],
        "palette": {"c1": "#0e7490", "c2": "#155e75", "c3": "#062b42", "accent": "#06b6d4", "textAccent": "#cffafe", "symbol": "CHAO"}
    },
    {
        "tmdbId": 1479840,
        "title": "G.D.N.",
        "slug": "gdn-1479840",
        "tagline": "THE INSPIRING SAGA OF THE EDISON OF INDIA",
        "stars": ["R. Madhavan", "Shraddha Srinath", "Nassar"],
        "director": "Krishnakumar Ramakumar",
        "language": "Tamil",
        "originalLanguage": "ta",
        "genres": ["Biography", "Inspirational", "Drama"],
        "rating": 8.6,
        "voteCount": 610,
        "popularity": 118.8,
        "duration": 144,
        "releaseDate": "2026-08-07",
        "certificate": "U",
        "formats": ["2D"],
        "description": "R. Madhavan stars as the pioneering Indian visionary and inventor G.D. Naidu, capturing his groundbreaking innovations and humanitarian spirit.",
        "cast": [
            {"name": "R. Madhavan", "character": "G.D. Naidu", "photo": None},
            {"name": "Shraddha Srinath", "character": "Kalyani", "photo": None},
            {"name": "Nassar", "character": "Industrialist", "photo": None}
        ],
        "palette": {"c1": "#713f12", "c2": "#3f2206", "c3": "#1a0d01", "accent": "#ca8a04", "textAccent": "#fef9c3", "symbol": "GDN"}
    },
    {
        "tmdbId": 1479832,
        "title": "DC",
        "slug": "dc-1479832",
        "tagline": "PASSION • BLOODSHED • LOYALTY",
        "stars": ["Lokesh Kanagaraj", "Wamiqa Gabbi"],
        "director": "Arun Matheswaran",
        "language": "Tamil",
        "originalLanguage": "ta",
        "genres": ["Action", "Crime", "Drama"],
        "rating": 8.8,
        "voteCount": 940,
        "popularity": 180.3,
        "duration": 141,
        "releaseDate": "2026-08-07",
        "certificate": "UA",
        "formats": ["2D", "IMAX"],
        "description": "Arun Matheswaran directs Lokesh Kanagaraj and Wamiqa Gabbi in a gritty, high-octane world where Devadas and Chandra fight for survival.",
        "cast": [
            {"name": "Lokesh Kanagaraj", "character": "Devadas", "photo": None},
            {"name": "Wamiqa Gabbi", "character": "Chandra", "photo": "/e1CNXkH2scGeoabOTowFJJxX2YF.jpg"},
            {"name": "Sanjana Krishnamoorthy", "character": "Parvathi", "photo": None}
        ],
        "palette": {"c1": "#831843", "c2": "#500724", "c3": "#22020e", "accent": "#f43f5e", "textAccent": "#ffe4e6", "symbol": "DC"}
    }
]

def make_svg(m):
    p = m["palette"]
    stars_text = " • ".join(m["stars"])
    genres_text = " • ".join(m["genres"]).upper()
    director_text = f"DIRECTED BY {m['director'].upper()}"
    title_font_size = "32" if len(m["title"]) > 16 else "38"
    
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="500" height="750" viewBox="0 0 500 750">
  <defs>
    <linearGradient id="bg_{m['slug']}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="{p['c1']}" />
      <stop offset="45%" stop-color="{p['c2']}" />
      <stop offset="100%" stop-color="{p['c3']}" />
    </linearGradient>
    <radialGradient id="glow_{m['slug']}" cx="50%" cy="40%" r="50%">
      <stop offset="0%" stop-color="{p['accent']}" stop-opacity="0.4" />
      <stop offset="70%" stop-color="{p['accent']}" stop-opacity="0.05" />
      <stop offset="100%" stop-color="{p['accent']}" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="top_shade" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.85" />
      <stop offset="25%" stop-color="#000000" stop-opacity="0.2" />
      <stop offset="60%" stop-color="#000000" stop-opacity="0.4" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0.95" />
    </linearGradient>
    <filter id="shadow_{m['slug']}" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.9" />
    </filter>
  </defs>

  <!-- Background layers -->
  <rect width="500" height="750" fill="url(#bg_{m['slug']})" />
  <rect width="500" height="750" fill="url(#glow_{m['slug']})" />

  <!-- Outer Cinema Border -->
  <rect x="18" y="18" width="464" height="714" fill="none" stroke="{p['accent']}" stroke-width="1.5" stroke-opacity="0.4" rx="12" />
  <rect x="26" y="26" width="448" height="698" fill="none" stroke="#ffffff" stroke-width="0.75" stroke-opacity="0.1" rx="8" />

  <!-- Corner Brackets -->
  <path d="M 18 52 L 18 18 L 52 18" fill="none" stroke="{p['accent']}" stroke-width="3" />
  <path d="M 482 52 L 482 18 L 448 18" fill="none" stroke="{p['accent']}" stroke-width="3" />
  <path d="M 18 698 L 18 732 L 52 732" fill="none" stroke="{p['accent']}" stroke-width="3" />
  <path d="M 482 698 L 482 732 L 448 732" fill="none" stroke="{p['accent']}" stroke-width="3" />

  <!-- Center Emblem Art -->
  <circle cx="250" cy="310" r="115" fill="none" stroke="{p['accent']}" stroke-width="2" stroke-opacity="0.25" />
  <circle cx="250" cy="310" r="95" fill="{p['c1']}" fill-opacity="0.5" stroke="#ffffff" stroke-width="1" stroke-opacity="0.15" />
  <circle cx="250" cy="310" r="75" fill="none" stroke="{p['accent']}" stroke-width="1.5" stroke-dasharray="6,4" stroke-opacity="0.6" />
  
  <text x="250" y="328" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="44" font-weight="900" fill="{p['textAccent']}" letter-spacing="4" filter="url(#shadow_{m['slug']})">{p['symbol']}</text>

  <!-- Atmospheric Shadow Overlay -->
  <rect width="500" height="750" fill="url(#top_shade)" />

  <!-- Header: Genre & Release Year -->
  <text x="250" y="65" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" fill="{p['textAccent']}" letter-spacing="3">{genres_text}</text>
  <text x="250" y="82" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="600" fill="#94a3b8" letter-spacing="2">IN THEATRES 2026</text>

  <!-- Star Cast Header -->
  <text x="250" y="125" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="700" fill="#f1f5f9" letter-spacing="1.5" filter="url(#shadow_{m['slug']})">{stars_text}</text>

  <!-- Tagline Above Title -->
  <text x="250" y="495" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="10.5" font-weight="700" fill="{p['textAccent']}" letter-spacing="2" filter="url(#shadow_{m['slug']})">{m['tagline']}</text>

  <!-- Movie Title -->
  <text x="250" y="540" text-anchor="middle" font-family="system-ui, -apple-system, Impact, sans-serif" font-size="{title_font_size}" font-weight="900" fill="#ffffff" letter-spacing="2" filter="url(#shadow_{m['slug']})">{m['title'].upper()}</text>

  <!-- Accent Divider -->
  <line x1="160" y1="562" x2="340" y2="562" stroke="{p['accent']}" stroke-width="2.5" stroke-linecap="round" />

  <!-- Director & Production -->
  <text x="250" y="598" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" fill="#e2e8f0" letter-spacing="2">{director_text}</text>
  <text x="250" y="620" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="9.5" font-weight="500" fill="#94a3b8" letter-spacing="1.5">EXPERIENCE IN THEATRES &amp; IMAX</text>

  <!-- Book Now Button Badge -->
  <rect x="190" y="660" width="120" height="26" rx="13" fill="{p['accent']}" fill-opacity="0.25" stroke="{p['accent']}" stroke-width="1.5" />
  <text x="250" y="677" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="800" fill="#ffffff" letter-spacing="2">BOOK TICKETS</text>
</svg>"""

clean_mock_data = []

for m in movies:
    slug = m["slug"]
    svg_filename = f"{slug}.svg"
    svg_path = os.path.join(out_dir, svg_filename)
    with open(svg_path, "w", encoding="utf-8") as f:
        f.write(make_svg(m))
    
    # Store clean mock movie entry
    clean_mock_data.append({
        "tmdbId": m["tmdbId"],
        "title": m["title"],
        "slug": m["slug"],
        "genres": m["genres"],
        "language": m["language"],
        "originalLanguage": m["originalLanguage"],
        "rating": m["rating"],
        "voteCount": m["voteCount"],
        "popularity": m["popularity"],
        "revenue": 0,
        "budget": 0,
        "duration": m["duration"],
        "poster": f"/posters/{svg_filename}",
        "backdrop": f"/posters/{svg_filename}",
        "description": m["description"],
        "cast": m["cast"],
        "director": m["director"],
        "trailerUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "releaseDate": m["releaseDate"],
        "certificate": m["certificate"],
        "formats": m["formats"],
        "status": "now_showing",
        "isActive": True
    })

# Save mock-movies.json
mock_json_path = r"d:\Programming\bookyourshow\apps\api\src\data\mock-movies.json"
with open(mock_json_path, "w", encoding="utf-8") as f:
    json.dump(clean_mock_data, f, indent=2)

print(f"Generated all {len(movies)} dedicated studio posters in public/posters and updated mock-movies.json!")
