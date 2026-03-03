import { getCached, setCached, TTL } from '../utils/cache';

// EXPO_PUBLIC_ prefix is required for Expo to expose these vars to the JS bundle
// Priority: AICC (multiple model fallbacks) → Gemini → hardcoded fallback
const AICC_API_KEY = process.env.EXPO_PUBLIC_AICC_API_KEY || '';
const AICC_URL =
  process.env.EXPO_PUBLIC_AICC_URL || 'https://api.ai.cc/v1/chat/completions';

// AICC model cascade — tries each in order until one works
// Models verified against api.ai.cc /v1/models endpoint
const AICC_MODELS = [
  'gpt-5-nano',                  // Fastest & cheapest — ideal for music suggestions
  'gpt-4.1',                     // GPT-4.1 — solid fallback
  'gpt-5-chat',                  // GPT-5 Chat — heavier but reliable
];

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// ─── Build a rich, context-aware system prompt ─────────────────────────────
function buildSystemPrompt(): string {
  const now = new Date();
  const hour = now.getHours();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const day = dayNames[now.getDay()];
  const date = now.getDate();
  const month = monthNames[now.getMonth()];
  const year = now.getFullYear();

  const timeOfDay =
    hour < 5 ? 'late night (past midnight)' :
    hour < 9 ? 'early morning' :
    hour < 12 ? 'morning' :
    hour < 14 ? 'lunchtime' :
    hour < 17 ? 'afternoon' :
    hour < 20 ? 'evening' :
    hour < 23 ? 'night' : 'late night';

  const isWeekend = now.getDay() === 0 || now.getDay() === 6;

  // Indian festival awareness (approximate dates, checked by month+date range)
  const festivals = getUpcomingFestivals(now);
  const festivalCtx = festivals.length > 0
    ? `\nUpcoming/current Indian festivals: ${festivals.join(', ')}. Factor this into recommendations when relevant.`
    : '';

  // Season in India
  const monthNum = now.getMonth(); // 0-indexed
  const season =
    monthNum <= 1 ? 'winter' :
    monthNum <= 4 ? 'spring/pre-summer' :
    monthNum <= 5 ? 'peak summer' :
    monthNum <= 8 ? 'monsoon season' :
    monthNum <= 9 ? 'autumn/post-monsoon' : 'early winter';

  return `You are Lokal AI — a smart, friendly music discovery assistant inside the Lokal music player.
You behave like the recommendation engine of Spotify or YouTube Music but with deep knowledge of Indian music.

CONTEXT (use this to personalise suggestions):
- Current time: ${timeOfDay} on ${day}, ${date} ${month} ${year}
- Season in India: ${season}
- Weekend: ${isWeekend ? 'Yes — user likely has more leisure time' : 'No — weekday'}${festivalCtx}

BEHAVIOUR RULES:
1. Recommend songs that match the user's mood, context, time-of-day, and season.
2. STRONGLY PREFER modern songs (2020-2025) — AP Dhillon, Diljit Dosanjh, King, Shubh, Karan Aujla, Anuv Jain, MC Stan, Hanumankind, Seedhe Maut, Prateek Kuhad, Vishal Mishra, etc. Only include pre-2020 songs if specifically asked for retro/classic.
3. Mix well-known hits with lesser-known gems (80/20 ratio) — don't always suggest the same top 10.
4. Cover diversity: vary across genres (Bollywood, Indie, Punjabi, Rap/Hip-hop, Sufi, Pop, Lo-fi) and keep it fresh/current.
5. When the user asks a vague question ("play something", "suggest songs"), infer the best context from time/day/season/festival and lean toward trending/viral songs.
6. Keep responses concise — max 6-8 song recommendations per response.
7. Format each song recommendation as: "Song Name" by Artist Name
8. Add a brief 1-line intro/theme and a short sign-off emoji. Use Gen-Z friendly language.
9. All songs must be searchable on JioSaavn (Indian music catalog).
10. Never repeat the same set of songs across different responses — vary your picks.
11. If the user mentions a specific artist, suggest songs from that artist AND similar artists.
12. Understand Hinglish (Hindi + English mix), slang, and regional language queries.
13. For festival queries, suggest iconic songs associated with that festival (modern versions preferred).
14. Avoid generic/outdated responses — every reply should feel current, personal, and like a friend recommending songs.`;
}

/** Get upcoming Indian festivals based on approximate calendar dates */
function getUpcomingFestivals(now: Date): string[] {
  const m = now.getMonth(); // 0-indexed
  const d = now.getDate();
  const festivals: string[] = [];

  // Approximate festival windows (can shift by a few days each year)
  if (m === 0 && d >= 10 && d <= 16) festivals.push('Makar Sankranti / Pongal / Lohri');
  if (m === 0 && d >= 24 && d <= 28) festivals.push('Republic Day');
  if (m === 1 && d >= 12 && d <= 16) festivals.push('Basant Panchami');
  if (m === 2 && d >= 1 && d <= 20) festivals.push('Holi / Holika Dahan');
  if (m === 2 && d >= 25 || (m === 3 && d <= 5)) festivals.push('Ugadi / Gudi Padwa / Navratri (Chaitra)');
  if (m === 3 && d >= 10 && d <= 18) festivals.push('Ram Navami / Baisakhi');
  if (m === 4 && d >= 1 && d <= 10) festivals.push('Eid ul-Fitr (approximate)');
  if (m === 5 && d >= 15 && d <= 25) festivals.push('Eid ul-Adha (approximate)');
  if (m === 7 && d >= 10 && d <= 20) festivals.push('Raksha Bandhan');
  if (m === 7 && d >= 25 || (m === 8 && d <= 5)) festivals.push('Janmashtami');
  if (m === 8 && d >= 5 && d <= 15) festivals.push('Ganesh Chaturthi');
  if (m === 8 && d >= 25 || (m === 9 && d <= 10)) festivals.push('Navratri / Durga Puja starts');
  if (m === 9 && d >= 10 && d <= 20) festivals.push('Dussehra / Vijayadashami');
  if (m === 9 && d >= 25 || (m === 10 && d <= 5)) festivals.push('Diwali / Deepavali');
  if (m === 10 && d >= 10 && d <= 20) festivals.push('Chhath Puja / Guru Nanak Jayanti');
  if (m === 11 && d >= 20 && d <= 31) festivals.push('Christmas / New Year');
  if (m === 7 && d === 15) festivals.push('Independence Day');

  return festivals;
}

// ─── Hardcoded fallback catalogue (2024-25 modern songs) ─────────────────────
const FALLBACK_RESPONSES: { keywords: string[]; response: string }[] = [
  // ── FESTIVALS ────────────────────────────────────────────────────────────
  {
    keywords: ['holi', 'rang', 'color', 'colour', 'gulal', 'bura na mano'],
    response: `Holi party starters — rang do sabko! 🎨🕺

"Balam Pichkari" by Vishal Dadlani & Shalmali Kholgade
"Badri Ki Dulhania" by Dev Negi & Monali Thakur
"Lahu Munh Lag Gaya" by Shilpa Rao
"Rang Lageya" by Mohit Chauhan & Rochak Kohli
"Players" by Badshah
"Bijlee Bijlee" by Harrdy Sandhu

Happy Holi — go crazy! 🌈🎉`,
  },
  {
    keywords: ['diwali', 'deepawali', 'diya', 'patakha', 'crackers', 'festival of lights'],
    response: `Diwali bangers — light it up! 🪔✨

"Tauba Tauba" by Karan Aujla
"GOAT" by Diljit Dosanjh
"Soulmate" by Badshah & Arijit Singh
"Heeriye" by Jasleen Royal & Arijit Singh
"What Jhumka" by Arijit Singh
"Nain Ta Heere" by Diljit Dosanjh

Shubh Diwali! 🎆🪔`,
  },
  {
    keywords: ['navratri', 'garba', 'dandiya', 'durga', 'navdurga'],
    response: `Navratri garba & dandiya fire! 🥁🌺

"Chogada" by Darshan Raval & Asees Kaur
"Kamariya" by Darshan Raval
"Dholida" by Udit Narayan & Palak Muchhal
"What Jhumka" by Arijit Singh
"Param Sundari" by Shreya Ghoshal
"Naiyo Lagda" by Salman Ali & Shreya Ghoshal

Jai Mata Di! 🙏🎶`,
  },
  {
    keywords: ['eid', 'eid mubarak', 'ramadan', 'ramzan', 'bakrid'],
    response: `Eid Mubarak vibes! 🌙⭐

"Kun Faya Kun" by AR Rahman & Javed Ali
"Pasoori" by Ali Sethi & Shae Gill
"Phir Aur Kya Chahiye" by Arijit Singh
"Heeriye" by Jasleen Royal & Arijit Singh
"Apna Bana Le" by Arijit Singh
"Chaleya" by Arijit Singh & Anuv Jain

Eid Mubarak! 🌙`,
  },
  {
    keywords: ['christmas', 'xmas', 'new year', 'nye', '31st', 'countdown', 'celebration'],
    response: `New Year party mode — countdown starts! 🎄🎆

"Tauba Tauba" by Karan Aujla
"Elevated" by Shubh
"Hass Hass" by Diljit Dosanjh & Sia
"GOAT" by Diljit Dosanjh
"Brown Munde" by AP Dhillon
"Lover" by Diljit Dosanjh

Cheers to the new year! 🥂✨`,
  },
  {
    keywords: ['wedding', 'shaadi', 'baraat', 'mehndi', 'sangeet', 'dulha', 'dulhan', 'bride', 'groom'],
    response: `Shaadi playlist — sangeet ready! 👰🤵

"Nain Ta Heere" by Diljit Dosanjh
"Bijlee Bijlee" by Harrdy Sandhu
"Kala Chashma" by Badshah & Amar Arshi
"What Jhumka" by Arijit Singh
"Param Sundari" by Shreya Ghoshal
"Tauba Tauba" by Karan Aujla
"Maan Meri Jaan" by King

Full filmi shaadi vibes! 🎊`,
  },

  // ── MOODS ─────────────────────────────────────────────────────────────────
  {
    keywords: ['happy', 'happiness', 'joy', 'joyful', 'cheerful', 'good mood', 'amazing', 'great', 'khush', 'khushi'],
    response: `Happy vibes only! 😄🎶

"Heeriye" by Jasleen Royal & Arijit Singh
"Maan Meri Jaan" by King
"Lover" by Diljit Dosanjh
"Obsessed" by Riar Saab & Abhijay Sharma
"Bijlee Bijlee" by Harrdy Sandhu
"Besharam Rang" by Shilpa Rao

Keep the energy up! 😊`,
  },
  {
    keywords: ['chill', 'relax', 'calm', 'peaceful', 'lofi', 'lo-fi', 'lazy', 'sunday', 'afternoon'],
    response: `Chill zone — no stress allowed 🎵☕

"Husn" by Anuv Jain
"Phir Aur Kya Chahiye" by Arijit Singh
"Satranga" by Arijit Singh
"Baarishein" by Anuv Jain
"Kasoor" by Prateek Kuhad
"Jo Tum Mere Ho" by Anuv Jain

Pure vibes, pure relaxation 🌙`,
  },
  {
    keywords: ['sad', 'heartbreak', 'broken heart', 'cry', 'crying', 'tears', 'miss', 'missing', 'dukhi', 'dard'],
    response: `Feels playlist — it's okay to feel 🥺

"Pehle Bhi Main" by Vishal Mishra
"Channa Mereya" by Arijit Singh
"O Bedardeya" by Arijit Singh
"Akhiyaan Gulaab" by Mitraz
"Apna Bana Le" by Arijit Singh
"Tu Hai Kahan" by AUR

It gets better, I promise 💙`,
  },
  {
    keywords: ['lonely', 'alone', 'alone time', 'introvert', 'quiet', 'solitude', 'akela'],
    response: `Solo time — just you and the music 🎧

"Husn" by Anuv Jain
"Pehle Bhi Main" by Vishal Mishra
"Softly" by Karan Aujla
"Gul" by Anuv Jain
"Tu Hai Kahan" by AUR
"Satranga" by Arijit Singh

Your own company hits different 💫`,
  },
  {
    keywords: ['angry', 'anger', 'frustrated', 'rage', 'irritated', 'annoyed', 'stressed', 'gussa'],
    response: `Let it out — rage playlist activated 🔥😤

"Big Dawgs" by Hanumankind
"295" by Sidhu Moose Wala
"Meri Jaan" by MC Stan
"Sher Aaya Sher" by Divine
"Arjan Vailly" by Bhupinder Babbal
"No Love" by Shubh

Channel that energy! 💥`,
  },
  {
    keywords: ['bored', 'boring', 'nothing to do', 'dull', 'ennui', 'ajeeb', 'pagal'],
    response: `Boredom killer — instant mood shift! 🎲

"Players" by Badshah
"Excuses" by AP Dhillon
"Bijlee Bijlee" by Harrdy Sandhu
"Maan Meri Jaan" by King
"GOAT" by Diljit Dosanjh
"Brown Munde" by AP Dhillon

What boredom? We vibing now 🕺`,
  },
  {
    keywords: ['breakup', 'ex', 'dumped', 'left', 'moved on', 'letting go', 'forget', 'over you'],
    response: `Breakup era — villain arc loading 💅

"Pehle Bhi Main" by Vishal Mishra
"O Bedardeya" by Arijit Singh
"No Love" by Shubh
"Akhiyaan Gulaab" by Mitraz
"Heeriye" by Jasleen Royal & Arijit Singh
"Softly" by Karan Aujla

Best revenge is glow up 😤✨`,
  },
  {
    keywords: ['nostalgic', 'nostalgia', 'throwback', 'childhood', 'school', 'college', 'memories', 'yaadein'],
    response: `Throwback mode — nostalgia hits different 🕰️💛

"Kesariya" by Arijit Singh
"Pasoori" by Ali Sethi & Shae Gill
"Raataan Lambiyan" by Jubin Nautiyal
"Khairiyat" by Arijit Singh
"Shayad" by Arijit Singh
"Tera Ban Jaunga" by Akhil Sachdeva & Tulsi Kumar

Those memories though 🥹`,
  },
  {
    keywords: ['romantic', 'love', 'romance', 'date', 'couple', 'valentine', 'pyaar', 'ishq', 'mohabbat'],
    response: `Romantic playlist — set the mood right 💕

"Phir Aur Kya Chahiye" by Arijit Singh
"Maan Meri Jaan" by King
"Apna Bana Le" by Arijit Singh
"Heeriye" by Jasleen Royal & Arijit Singh
"Obsessed" by Riar Saab & Abhijay Sharma
"Tere Vaaste" by Varun Jain

Love is in the playlist! 🌹`,
  },
  {
    keywords: ['motivational', 'motivation', 'inspire', 'inspired', 'hustle', 'grind', 'success', 'achieve', 'goal'],
    response: `Motivation unlocked — sigma grindset! 🚀

"Big Dawgs" by Hanumankind
"295" by Sidhu Moose Wala
"Elevated" by Shubh
"GOAT" by Diljit Dosanjh
"King Shit" by Shubh
"Born to Shine" by Diljit Dosanjh

Nothing can stop you! 💪`,
  },

  // ── SITUATIONS ────────────────────────────────────────────────────────────
  {
    keywords: ['workout', 'gym', 'exercise', 'run', 'running', 'jogging', 'cycling', 'pump'],
    response: `Gym playlist — beast mode ON 💪🔥

"Big Dawgs" by Hanumankind
"Arjan Vailly" by Bhupinder Babbal
"295" by Sidhu Moose Wala
"Jhoome Jo Pathaan" by Arijit Singh
"GOAT" by Diljit Dosanjh
"No Love" by Shubh

Push through! 🏋️`,
  },
  {
    keywords: ['party', 'dance', 'club', 'dance floor', 'dj', 'disco', 'nonstop', 'sangeet'],
    response: `Party anthems — floor is yours! 🎉

"Tauba Tauba" by Karan Aujla
"Brown Munde" by AP Dhillon
"Bijlee Bijlee" by Harrdy Sandhu
"Players" by Badshah
"GOAT" by Diljit Dosanjh
"What Jhumka" by Arijit Singh

Time to dance! 🕺💃`,
  },
  {
    keywords: ['road trip', 'drive', 'long drive', 'travel', 'journey', 'highway', 'road'],
    response: `Road trip essentials — windows down! 🚗🎶

"Excuses" by AP Dhillon
"Lover" by Diljit Dosanjh
"Softly" by Karan Aujla
"Elevated" by Shubh
"Husn" by Anuv Jain
"Hass Hass" by Diljit Dosanjh & Sia

Roll down and vibe! 🌄`,
  },
  {
    keywords: ['morning', 'wake up', 'fresh', 'sunrise', 'start', 'subah', 'good morning'],
    response: `Good morning — fresh start energy! ☀️

"Maan Meri Jaan" by King
"Heeriye" by Jasleen Royal & Arijit Singh
"Husn" by Anuv Jain
"Phir Aur Kya Chahiye" by Arijit Singh
"Baarishein" by Anuv Jain
"Lover" by Diljit Dosanjh

Start the day right! 🌅`,
  },
  {
    keywords: ['night', 'sleep', 'midnight', 'late night', 'insomnia', 'dark', 'sleepless', '2am', '3am'],
    response: `Late night feels — 3am thoughts 🌙

"Husn" by Anuv Jain
"Pehle Bhi Main" by Vishal Mishra
"Satranga" by Arijit Singh
"Tu Hai Kahan" by AUR
"Softly" by Karan Aujla
"Kasoor" by Prateek Kuhad

Goodnight world 🌠`,
  },
  {
    keywords: ['rain', 'rainy', 'monsoon', 'barish', 'baarish', 'sawan', 'cloudy', 'thunder', 'drizzle'],
    response: `Baarish vibes — monsoon magic 🌧️

"Baarishein" by Anuv Jain
"Husn" by Anuv Jain
"Phir Aur Kya Chahiye" by Arijit Singh
"O Bedardeya" by Arijit Singh
"Gul" by Anuv Jain
"Satranga" by Arijit Singh

Chai + rain + music = perfect! ☕🌧️`,
  },
  {
    keywords: ['focus', 'study', 'work', 'concentration', 'productive', 'coding', 'deep work'],
    response: `Focus mode — zero distractions 📚

"Husn" by Anuv Jain
"Kasoor" by Prateek Kuhad
"Baarishein" by Anuv Jain
"Jo Tum Mere Ho" by Anuv Jain
"Gul" by Anuv Jain
"Phir Aur Kya Chahiye" by Arijit Singh

Deep focus activated! 💡`,
  },
  {
    keywords: ['meditation', 'spiritual', 'yoga', 'peace', 'mantra', 'bhajan', 'prayer', 'god', 'devotion'],
    response: `Spiritual & peaceful playlist 🙏✨

"Kun Faya Kun" by AR Rahman & Javed Ali
"Namo Namo" by Amit Trivedi
"Satranga" by Arijit Singh
"Phir Aur Kya Chahiye" by Arijit Singh
"Ik Onkar" by Harshdeep Kaur
"Meri Jaan" by Gangubai Kathiawadi

Find your inner peace 🕉️`,
  },
  {
    keywords: ['summer', 'heat', 'hot', 'beach', 'pool', 'vacation', 'holiday', 'garmi'],
    response: `Summer vibes — beach mode on! ☀️🏖️

"Insane" by AP Dhillon
"Summer High" by AP Dhillon
"Bijlee Bijlee" by Harrdy Sandhu
"Lover" by Diljit Dosanjh
"Players" by Badshah
"Excuses" by AP Dhillon

Summer never ends! 🌊`,
  },
  {
    keywords: ['winter', 'cold', 'fog', 'blanket', 'cozy', 'warm', 'sardi', 'january', 'december'],
    response: `Winter cozy playlist — blanket weather! ❄️🧣

"Husn" by Anuv Jain
"Pehle Bhi Main" by Vishal Mishra
"Satranga" by Arijit Singh
"Kasoor" by Prateek Kuhad
"Phir Aur Kya Chahiye" by Arijit Singh
"Apna Bana Le" by Arijit Singh

Stay warm, stay cozy 🔥`,
  },
  {
    keywords: ['college', 'hostel', 'campus', 'bunk', 'canteen', 'dost', 'yaar', 'friends', 'friendship'],
    response: `College vibes — yaari forever! 🎓

"Maan Meri Jaan" by King
"Excuses" by AP Dhillon
"Heeriye" by Jasleen Royal & Arijit Singh
"Brown Munde" by AP Dhillon
"Tu Hai Kahan" by AUR
"Obsessed" by Riar Saab

Best days, best people! 🍻`,
  },

  // ── GENRES & LANGUAGES ───────────────────────────────────────────────────
  {
    keywords: ['bollywood', 'hindi', 'classic', 'retro', 'purana', '90s', '80s', '70s', 'old bollywood'],
    response: `Timeless Bollywood — nostalgia loading 🎬

"Tujhe Dekha Toh" by Kumar Sanu & Lata Mangeshkar
"Pehla Nasha" by Udit Narayan & Sadhana Sargam
"Chaiyya Chaiyya" by Sukhwinder Singh
"Dil Chahta Hai" by Shankar Mahadevan
"Kal Ho Naa Ho" by Sonu Nigam
"Tere Bina Zindagi Se" by Lata Mangeshkar

When music was pure gold 💛`,
  },
  {
    keywords: ['trending', 'new', 'latest', 'top', 'popular', 'hit', 'best', 'viral', '2024', '2025'],
    response: `Trending right now — certified hits! 🔥🎧

"Tauba Tauba" by Karan Aujla
"Pehle Bhi Main" by Vishal Mishra
"Big Dawgs" by Hanumankind
"Heeriye" by Jasleen Royal & Arijit Singh
"Softly" by Karan Aujla
"Obsessed" by Riar Saab & Abhijay Sharma

All bangers, no skips! 🎵`,
  },
  {
    keywords: ['punjabi', 'bhangra', 'desi', 'folk', 'haryanvi'],
    response: `Punjabi hits — full bass! 🥳

"Tauba Tauba" by Karan Aujla
"GOAT" by Diljit Dosanjh
"Elevated" by Shubh
"Brown Munde" by AP Dhillon
"Lover" by Diljit Dosanjh
"Softly" by Karan Aujla

Punjabi tadka full on! 🕺`,
  },
  {
    keywords: ['rap', 'hip hop', 'trap', 'desi hip hop', 'gully', 'rap god', 'bars', 'rhyme'],
    response: `Indian rap — straight fire! 🎤🔥

"Big Dawgs" by Hanumankind
"295" by Sidhu Moose Wala
"Meri Jaan" by MC Stan
"Suno" by King
"Pablo" by King
"Nanchaku" by Seedhe Maut

Real bars from the streets! 💯`,
  },
  {
    keywords: ['sufi', 'qawwali', 'ghazal', 'classical', 'raga', 'raag', 'hindustani'],
    response: `Sufi & soul — hits the rooh! 🕌

"Kun Faya Kun" by AR Rahman & Javed Ali
"Chaleya" by Arijit Singh & Anuv Jain
"Pasoori" by Ali Sethi & Shae Gill
"Phir Aur Kya Chahiye" by Arijit Singh
"Satranga" by Arijit Singh
"Apna Bana Le" by Arijit Singh

Rooh ko sukoon mile 🙏`,
  },
  {
    keywords: ['indie', 'underground', 'alternative', 'non filmi', 'independent', 'band'],
    response: `Indian indie gems — pure artistry! 🎸

"Husn" by Anuv Jain
"Kasoor" by Prateek Kuhad
"Cold Mess" by Prateek Kuhad
"Gul" by Anuv Jain
"Tu Hai Kahan" by AUR
"Udd Gaye" by Ritviz

Indie scene is booming ✨`,
  },

  // ── NEW GEN-Z CATEGORIES ─────────────────────────────────────────────────
  {
    keywords: ['genz', 'gen z', 'gen-z', 'zoomer', 'vibe', 'vibes', 'aesthetic', 'slay', 'sigma'],
    response: `Gen-Z starter pack — immaculate vibes! 🤙

"Maan Meri Jaan" by King
"Husn" by Anuv Jain
"Obsessed" by Riar Saab & Abhijay Sharma
"Excuses" by AP Dhillon
"Elevated" by Shubh
"Softly" by Karan Aujla

Main character energy only 💅`,
  },
  {
    keywords: ['funky', 'funk', 'groovy', 'groove', 'bass', 'upbeat'],
    response: `Funky & groovy — get moving! 🎸🕺

"Players" by Badshah
"Brown Munde" by AP Dhillon
"Bijlee Bijlee" by Harrdy Sandhu
"Tauba Tauba" by Karan Aujla
"What Jhumka" by Arijit Singh
"Param Sundari" by Shreya Ghoshal

Can't sit still to these! 🔊`,
  },
  {
    keywords: ['english', 'hollywood', 'western', 'international', 'pop', 'kpop', 'k-pop'],
    response: `Global hits with desi flavor! 🌍

"Hass Hass" by Diljit Dosanjh & Sia
"Pasoori" by Ali Sethi & Shae Gill
"With You" by AP Dhillon
"Insane" by AP Dhillon
"Summer High" by AP Dhillon
"Elevated" by Shubh

East meets West! 🎧`,
  },
];

const DEFAULT_FALLBACKS = [
  `Here are today's top picks! 🎵

"Tauba Tauba" by Karan Aujla
"Maan Meri Jaan" by King
"Husn" by Anuv Jain
"Heeriye" by Jasleen Royal & Arijit Singh
"Big Dawgs" by Hanumankind

Try asking me a mood, genre, or vibe! 🎧`,

  `Can't reach AI right now, but here's a fire mix 🎶

"Pehle Bhi Main" by Vishal Mishra
"Softly" by Karan Aujla
"Excuses" by AP Dhillon
"Obsessed" by Riar Saab
"GOAT" by Diljit Dosanjh

Ask me: "chill vibes", "gym songs", "sad playlist"! ☀️`,

  `AI is busy — here's a handpicked playlist 🎼

"Elevated" by Shubh
"Phir Aur Kya Chahiye" by Arijit Singh
"Brown Munde" by AP Dhillon
"Lover" by Diljit Dosanjh
"Tu Hai Kahan" by AUR

Try again for personalized picks! 🌟`,
];

function getHardcodedFallback(userMessage: string): string {
  const msg = userMessage.toLowerCase();
  for (const entry of FALLBACK_RESPONSES) {
    if (entry.keywords.some((kw) => msg.includes(kw))) {
      return entry.response;
    }
  }
  // Rotate through defaults so it doesn't always look the same
  return DEFAULT_FALLBACKS[Math.floor(Date.now() / 60000) % DEFAULT_FALLBACKS.length];
}

// ─────────────────────────────────────────────────────────────────────────────

/** Tier 2: Gemini fallback when AICC is unavailable */
async function askGeminiFallback(
  userMessage: string,
  conversationHistory: ChatMessage[] = [],
): Promise<string | null> {
  if (!GEMINI_API_KEY) return null;
  try {
    const contents = [
      ...conversationHistory
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
      { role: 'user', parts: [{ text: userMessage }] },
    ];

    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-goog-api-key': GEMINI_API_KEY },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: buildSystemPrompt() }] },
        contents,
        generationConfig: { maxOutputTokens: 500, temperature: 0.7 },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Gemini fallback error:', response.status, err);
      return null;
    }
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return text && text.length > 2 ? text : null;
  } catch {
    return null;
  }
}

/**
 * Primary AI: AICC (multi-model cascade) → Gemini → hardcoded fallback
 */
export async function askAI(
  userMessage: string,
  conversationHistory: ChatMessage[] = [],
): Promise<string> {
  const messages = [
    { role: 'system', content: buildSystemPrompt() },
    ...conversationHistory
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
    { role: 'user', content: userMessage },
  ];

  // ── Tier 1: AICC — try each model in cascade ─────────────────────────────
  if (AICC_API_KEY) {
    for (const model of AICC_MODELS) {
      try {
        const response = await fetch(AICC_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AICC_API_KEY}` },
          body: JSON.stringify({ model, messages, max_tokens: 600, temperature: 0.8 }),
        });

        if (response.ok) {
          const data = await response.json();
          const text = data?.choices?.[0]?.message?.content?.trim();
          if (text && text.length > 2) return text;
        } else {
          const errText = await response.text();
          const isModelError = errText.includes('model_not_found') || errText.includes('does not exist');
          console.warn(`AICC model "${model}" failed (${response.status}):`, errText.slice(0, 200));
          // If it's specifically a model-not-found error, try the next model immediately
          if (isModelError) continue;
          // For other errors (rate limit, auth, server), skip remaining AICC models
          break;
        }
      } catch (error) {
        console.error(`AICC request failed for model "${model}":`, error);
        break; // network error — no point trying more AICC models
      }
    }
  }

  // ── Tier 2: Gemini fallback ───────────────────────────────────────────────
  const geminiResult = await askGeminiFallback(userMessage, conversationHistory);
  if (geminiResult) return geminiResult;

  // ── Tier 3: hardcoded keyword fallback ───────────────────────────────────
  return getHardcodedFallback(userMessage);
}

/**
 * Extract song names from AI response for searching
 */
export function extractSongNames(aiResponse: string): string[] {
  const pattern = /"([^"]+)"\s+by\s+([^,\n]+)/gi;
  const songs: string[] = [];
  let match;
  while ((match = pattern.exec(aiResponse)) !== null) {
    songs.push(`${match[1]} ${match[2].trim()}`);
  }
  return songs;
}

/**
 * AI-powered dynamic home screen search query based on time of day.
 * Returns a query string like "morning workout beats" or "late night jazz".
 * Falls back to a static default on error.
 */
export async function getDynamicHomeQuery(): Promise<string> {
  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay(); // 0=Sun
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const monthNum = now.getMonth();

  const period =
    hour < 5 ? 'late_night' :
    hour < 9 ? 'early_morning' :
    hour < 12 ? 'morning' :
    hour < 14 ? 'lunch' :
    hour < 17 ? 'afternoon' :
    hour < 20 ? 'evening' :
    hour < 23 ? 'night' : 'late_night';

  const season =
    monthNum <= 1 ? 'winter' :
    monthNum <= 4 ? 'spring' :
    monthNum <= 5 ? 'summer' :
    monthNum <= 8 ? 'monsoon' :
    monthNum <= 9 ? 'autumn' : 'winter';

  // Festival-aware static fallbacks
  const festivals = getUpcomingFestivals(now);
  const festivalQuery = festivals.length > 0
    ? festivals[0].split('/')[0].trim().toLowerCase() + ' special songs'
    : null;

  // Rich varied static fallbacks per period (pick one randomly)
  const staticPool: Record<string, string[]> = {
    late_night: ['late night lofi', 'midnight calm', 'sleepless night songs', 'after hours chill'],
    early_morning: ['morning raaga', 'sunrise meditation', 'early morning devotional', 'fresh morning vibes'],
    morning: ['morning energy bollywood', 'upbeat Hindi morning', 'feel good morning', 'coffee time music'],
    lunch: ['afternoon chill hindi', 'lunchtime vibes', 'midday mood', 'light hearted songs'],
    afternoon: ['afternoon focus', 'work mode playlist', 'instrumental bollywood', 'productive afternoon'],
    evening: ['evening bollywood hits', 'sunset drive songs', 'golden hour vibes', 'evening romantic'],
    night: ['night drive hindi', 'bollywood night vibes', 'chill night songs', 'after dark Indian'],
  };

  const weekendExtras: string[] = isWeekend
    ? ['weekend party mix', 'Sunday chill bollywood', 'weekend road trip', 'lazy weekend lofi']
    : [];

  const seasonExtras: Record<string, string[]> = {
    winter: ['winter cozy songs', 'sardi special'],
    spring: ['spring fresh music', 'basant vibes'],
    summer: ['summer party hits', 'garmi special'],
    monsoon: ['baarish songs', 'monsoon romantic', 'rain day bollywood'],
    autumn: ['autumn mellow', 'october vibes'],
  };

  // Build candidate pool
  const pool = [
    ...(staticPool[period] ?? ['top hits']),
    ...weekendExtras,
    ...(seasonExtras[season] ?? []),
  ];
  if (festivalQuery) pool.push(festivalQuery);

  // Pick a static result (rotate based on minute to feel fresh)
  const staticResult = pool[Math.floor(Date.now() / 120000) % pool.length];

  // Check cache first (keyed by period + weekend/weekday, valid 30 min)
  const cacheKey = `home_query_${period}_${isWeekend ? 'we' : 'wd'}`;
  try {
    const cached = await getCached<string>(cacheKey);
    if (cached) return cached;
  } catch { /* ignore */ }

  // Fire-and-forget: ask AI for a refined query in the background
  (async () => {
    try {
      const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];
      const festivalHint = festivals.length > 0 ? ` The festival "${festivals[0]}" is happening around now.` : '';
      const prompt = `You are a music search engine query optimizer for an Indian music app (JioSaavn catalog).
Context: It's ${period.replace('_', ' ')} on a ${dayName}, ${season} season in India.${festivalHint}
The user just opened the app and wants fresh music.

Generate ONE short (2-4 word) search query that would return great results for this moment.
Be creative and varied — don't always say the same generic queries.
Consider: time of day, day of week, season, any festivals, and current music trends.
Mix between moods, genres, and occasions.

Reply with ONLY the search query, nothing else.`;

      const raw = await askAI(prompt, []);
      const cleaned = raw.split('\n')[0].replace(/["'.!]/g, '').trim();
      if (cleaned.length > 2 && cleaned.length < 50) {
        await setCached(cacheKey, cleaned, TTL.MEDIUM);
      }
    } catch { /* background — safe to ignore */ }
  })();

  return staticResult;
}

/**
 * AI-powered smart queue suggestions after a song ends.
 * Returns up to 3 JioSaavn-searchable query strings.
 */
const SMART_QUEUE_FALLBACKS = [
  'Kesariya Arijit Singh',
  'Raataan Lambiyan Jubin Nautiyal',
  'Tum Hi Ho Arijit Singh',
];

export async function getSmartQueueSuggestions(
  songName: string,
  artistName: string,
): Promise<string[]> {
  try {
    const hour = new Date().getHours();
    const timeHint =
      hour < 6 ? 'late night — lean towards calm/mellow' :
      hour < 12 ? 'morning — can be upbeat' :
      hour < 17 ? 'afternoon — moderate energy' :
      hour < 21 ? 'evening — versatile energy' : 'night — chill or emotional';

    const resp = await askAI(
      `The user just finished listening to "${songName}" by ${artistName}.
Suggest 5 songs to play next — like Spotify's autoplay or YouTube Music's Up Next.

Rules:
- 2 songs should be similar in mood/genre to the current song
- 1 song should be from the same artist or a close collaborator
- 2 songs should be a discovery pick — same genre but different artist / slightly different vibe
- Current time context: ${timeHint}
- All songs must be available on JioSaavn (Indian music catalog)
- Mix eras: don't only suggest old or only new songs

List each as "Song Title" by Artist on a separate line. No bullets, numbering, or explanations.`,
      [],
    );
    const results = resp
      .split('\n')
      .map((l) => l.replace(/^[-•*\d.]+\s*/, '').replace(/^"/, '').replace(/"\s*$/, '').trim())
      .filter((l) => l.length > 2 && l.includes(' by '))
      .slice(0, 5);
    return results.length > 0 ? results : SMART_QUEUE_FALLBACKS;
  } catch {
    return SMART_QUEUE_FALLBACKS;
  }
}

/**
 * AI-powered playlist name generator.
 * Analyzes a sample of song names and proposes a creative name.
 */
export async function generateSmartPlaylistName(songNames: string[]): Promise<string> {
  if (songNames.length === 0) return 'My Playlist';
  try {
    const sample = songNames.slice(0, 8).join(', ');
    const resp = await askAI(
      `You're naming a user's playlist like Spotify does (e.g. "Chill Vibes", "Bollywood Beats", "Late Night Feels", "Monsoon Moods").

Songs in the playlist: ${sample}

Analyze the mood, genre, and era of these songs. Create a creative, catchy playlist name (2-4 words).
Make it feel personal and aesthetic — not generic.
Avoid using "My" or "Playlist" in the name.

Reply with ONLY the playlist name, nothing else.`,
      [],
    );
    const name = resp.split('\n')[0].replace(/["'.]/g, '').trim();
    return name.length > 0 && name.length < 50 ? name : 'My Playlist';
  } catch {
    return 'My Playlist';
  }
}

/**
 * AI-powered mood-to-query mapper.
 * Given a mood string (e.g. "happy", "sad", "workout"), returns a search query.
 */
export async function moodToSearchQuery(mood: string): Promise<string> {
  try {
    const hour = new Date().getHours();
    const timeCtx =
      hour < 6 ? 'late night' : hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night';

    const resp = await askAI(
      `You are a music search optimizer for JioSaavn (Indian music catalog).
The user described their mood/vibe as: "${mood}"
Current time: ${timeCtx}

Convert this into one specific, search-friendly query (2-4 words) that will return great Indian music results.
Think like YouTube Music or Spotify — match the mood to actual music styles, genres, or well-known playlist vibes.
Examples: "rainy day bollywood" not "rain", "upbeat punjabi party" not "happy", "midnight sufi" not "night"

Reply with ONLY the optimized search query.`,
      [],
    );
    const q = resp.split('\n')[0].replace(/["'.!]/g, '').trim();
    return q.length > 0 && q.length < 50 ? q : mood;
  } catch {
    return mood;
  }
}
