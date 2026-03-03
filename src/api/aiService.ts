import { getCached, setCached, TTL } from '../utils/cache';

const GEMINI_API_KEY = 'AIzaSyDwmHUf3T5RC0-ps4_PRYMQNeuiPg2ISDQ';
const AICC_API_KEY = 'sk-OaVqW4vYpSjmcQtusAe1h19lOcBbDgFamC3vLOpkShrankmy';
const AICC_URL = 'https://api.ai.cc/v1/chat/completions'; // Replace with your actual Gemini key

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Gemini uses 'user' and 'model' roles
interface GeminiContent {
  role: 'user' | 'model';
  parts: { text: string }[];
}

interface GeminiResponse {
  candidates?: {
    content: {
      parts: { text: string }[];
    };
  }[];
}

const SYSTEM_PROMPT = `You are Lokal AI, an intelligent music assistant inside the Lokal music player app.
You help users discover music, create playlists, find songs by mood/genre, and answer music-related questions.
Keep responses concise and friendly. When recommending songs, suggest popular tracks available on JioSaavn.
You can suggest songs by mood, genre, artist, occasion, or similar artists.
Format song recommendations as: "Song Name" by Artist Name
Always be helpful, conversational, and music-focused.`;

// ─── Hardcoded fallback catalogue ────────────────────────────────────────────
const FALLBACK_RESPONSES: { keywords: string[]; response: string }[] = [
  {
    keywords: ['chill', 'relax', 'calm', 'peaceful', 'lofi', 'lo-fi'],
    response: `Here are some chill tracks you'll love 🎵

"Tum Hi Ho" by Arijit Singh
"Agar Tum Saath Ho" by Arijit Singh & Alka Yagnik
"Khairiyat" by Arijit Singh
"Raataan Lambiyan" by Jubin Nautiyal
"Bekhayali" by Sachet Tandon

Perfect for winding down! 🌙`,
  },
  {
    keywords: ['workout', 'gym', 'energy', 'pump', 'motivated', 'exercise', 'run'],
    response: `Pump-up tracks to crush your workout 💪🔥

"Zinda" by Siddharth Mahadevan
"Sultan" by Sukhwinder Singh
"Dangal" by Daler Mehndi
"The Humma Song" by Jubin Nautiyal
"Kar Har Maidaan Fateh" by Sukhwinder Singh

Let's gooo! 🏋️`,
  },
  {
    keywords: ['romantic', 'love', 'romance', 'date', 'couple', 'valentine', 'pyaar'],
    response: `Romantic songs to set the mood 💕

"Tere Bina" by Rehman & Chinmayi
"Tumse Pyaar Karke" by Armaan Malik
"Pehli Nazar Mein" by Atif Aslam
"Dil Diya Gallan" by Atif Aslam
"Hawayein" by Arijit Singh

Love is in the air! 🌹`,
  },
  {
    keywords: ['sad', 'heartbreak', 'broken', 'cry', 'miss', 'lonely', 'dukhi'],
    response: `Songs that understand your feelings 🥺

"Channa Mereya" by Arijit Singh
"Ae Dil Hai Mushkil" by Arijit Singh
"Tera Yaar Hoon Main" by Arijit Singh
"Judaai" by Rekha Bhardwaj
"Phir Bhi Tumko Chaahunga" by Arijit Singh

It gets better 💙`,
  },
  {
    keywords: ['party', 'dance', 'club', 'dance floor', 'dj', 'disco', 'nonstop'],
    response: `Banger party tracks incoming! 🎉

"Illegal Weapon 2.0" by Jasmine Sandlas
"Morni Banke" by Neha Kakkar
"DJ Waley Babu" by Badshah
"Swing Zara" by Haricharan & Shreya Ghoshal
"Badtameez Dil" by Uday Chopra

Time to dance! 🕺💃`,
  },
  {
    keywords: ['road trip', 'drive', 'travel', 'journey', 'long drive'],
    response: `Perfect road trip playlist 🚗🎶

"Highway Da Putt" by Jubin Nautiyal
"Musafir" by Atif Aslam
"Ik Vaari Aa" by Arijit Singh
"Soch Na Sake" by Arijit Singh
"Dooba Dooba" by Silk Route

Roll down the windows! 🌄`,
  },
  {
    keywords: ['morning', 'wake', 'fresh', 'sunrise', 'start'],
    response: `Start your day on a high note ☀️

"Ik Onkar" by Harshdeep Kaur
"Namo Namo" by Amit Trivedi
"Badlein Zyada" by Arijit Singh
"Subha Hone Na De" by KK
"Phoolon Ka Taron Ka" by Kishore Kumar

Good morning vibes! 🌅`,
  },
  {
    keywords: ['night', 'sleep', 'midnight', 'late', 'dark'],
    response: `Late night mellow picks 🌙

"Tum Ho" by Mohit Chauhan
"O Re Piya" by Rahat Fateh Ali Khan
"Kal Ho Na Ho" by Sonu Nigam
"Tera Hone Laga Hoon" by Atif Aslam
"Dil Hai Chota Sa" by Udit Narayan

Drift into the night 🌠`,
  },
  {
    keywords: ['bollywood', 'hindi', 'old', 'classic', 'retro', 'purana', '90s', '80s'],
    response: `Timeless Bollywood classics 🎬

"Kal Ho Na Ho" by Sonu Nigam
"Tujhe Dekha To" by Kumar Sanu
"Mere Sapno Ki Rani" by Kishore Kumar
"Ek Ladki Ko Dekha" by Kumar Sanu
"Yeh Dosti" by Kishore Kumar & Manna Dey

Nostalgia hits different 💛`,
  },
  {
    keywords: ['trending', 'new', 'latest', 'top', 'popular', 'hit', 'best'],
    response: `Hottest tracks right now 🔥

"Kesariya" by Arijit Singh
"Raataan Lambiyan" by Jubin Nautiyal
"Smooth Criminal" by AP Dhillon
"Brown Munde" by AP Dhillon
"Pasoori" by Ali Sethi & Shae Gill

These are certified bangers! 🎧`,
  },
  {
    keywords: ['punjabi', 'bhangra', 'desi', 'folk'],
    response: `Punjabi vibes loading 🥳

"Brown Munde" by AP Dhillon
"Lut Gaye" by Jubin Nautiyal
"Lahore" by Guru Randhawa
"Kala Chashma" by Badshah
"Proper Patola" by Diljit Dosanjh

Punjabi music always hits! 🕺`,
  },
  {
    keywords: ['focus', 'study', 'work', 'concentration', 'productive'],
    response: `Focus-mode playlist 📚

"Kun Faya Kun" by AR Rahman
"Dil Se Re" by AR Rahman
"Jai Ho" by AR Rahman
"Roja" by AR Rahman
"Vande Mataram" by AR Rahman

Stay in the zone! 💡`,
  },
];

const DEFAULT_FALLBACK = `Hi there! 👋 I'm having trouble connecting to AI right now, but here are some popular songs you might enjoy:

"Kesariya" by Arijit Singh
"Raataan Lambiyan" by Jubin Nautiyal
"Tum Hi Ho" by Arijit Singh
"Brown Munde" by AP Dhillon
"Pasoori" by Ali Sethi & Shae Gill

Try again in a moment for personalized suggestions! 🎵`;

function getHardcodedFallback(userMessage: string): string {
  const msg = userMessage.toLowerCase();
  for (const entry of FALLBACK_RESPONSES) {
    if (entry.keywords.some((kw) => msg.includes(kw))) {
      return entry.response;
    }
  }
  return DEFAULT_FALLBACK;
}

/** Secondary AI fallback using api.ai.cc (OpenAI-compatible) */
async function askFallbackAI(
  userMessage: string,
  conversationHistory: ChatMessage[] = [],
): Promise<string | null> {
  try {
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...conversationHistory
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
      { role: 'user', content: userMessage },
    ];

    const response = await fetch(AICC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AICC_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    return text && text.length > 2 ? text : null;
  } catch {
    return null;
  }
}
// ─────────────────────────────────────────────────────────────────────────────

function toGeminiContents(
  conversationHistory: ChatMessage[],
  userMessage: string,
): GeminiContent[] {
  const contents: GeminiContent[] = [];

  for (const msg of conversationHistory) {
    if (msg.role === 'system') continue; // system handled via systemInstruction
    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    });
  }

  contents.push({ role: 'user', parts: [{ text: userMessage }] });
  return contents;
}

export async function askAI(
  userMessage: string,
  conversationHistory: ChatMessage[] = [],
): Promise<string> {
  try {
    const contents = toGeminiContents(conversationHistory, userMessage);

    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': GEMINI_API_KEY,
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: {
          maxOutputTokens: 500,
          temperature: 0.7,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);
      // Try secondary AI
      const fallback = await askFallbackAI(userMessage, conversationHistory);
      return fallback ?? getHardcodedFallback(userMessage);
    }

    const data: GeminiResponse = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return text || getHardcodedFallback(userMessage);
  } catch (error) {
    console.error('AI service error:', error);
    // Try secondary AI before hardcoded fallback
    const fallback = await askFallbackAI(userMessage, conversationHistory);
    return fallback ?? getHardcodedFallback(userMessage);
  }
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
  const hour = new Date().getHours();
  const period =
    hour < 6 ? 'late_night' : hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night';
  const ctx =
    period === 'late_night'
      ? 'late night ambient chill'
      : period === 'morning'
      ? 'morning energetic upbeat'
      : period === 'afternoon'
      ? 'afternoon focus work'
      : period === 'evening'
      ? 'evening mood relaxing'
      : 'night vibes mellow';

  // Use static fallback immediately — no wait
  const staticFallbacks: Record<string, string> = {
    late_night: 'late night chill',
    morning: 'morning energy',
    afternoon: 'afternoon focus',
    evening: 'evening relaxing',
    night: 'night vibes',
  };

  // Check cache first (keyed by time period, valid for 1 hour)
  const cacheKey = `home_query_${period}`;
  try {
    const cached = await getCached<string>(cacheKey);
    if (cached) return cached;
  } catch {
    // ignore cache errors
  }

  // Return static fallback immediately; warm cache in background
  const staticResult = staticFallbacks[period] ?? 'top hits';

  // Fire-and-forget: call AI in background to populate cache for next load
  (async () => {
    try {
      const raw = await askAI(
        `You are a music search assistant. Suggest ONE concise 2-3 word music search query for "${ctx}" music. Reply with ONLY the search query, nothing else.`,
        [],
      );
      const cleaned = raw.split('\n')[0].replace(/["'.!]/g, '').trim();
      const result = cleaned.length > 2 && cleaned.length < 40 ? cleaned : staticResult;
      await setCached(cacheKey, result, TTL.LONG);
    } catch {
      // background warm — safe to ignore
    }
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
    const resp = await askAI(
      `I just listened to "${songName}" by ${artistName}. Give me 3 similar songs I might enjoy. List each as "Song Title by Artist" on a separate line. No bullets, no numbering.`,
      [],
    );
    const results = resp
      .split('\n')
      .map((l) => l.replace(/^[-•*\d.]+\s*/, '').trim())
      .filter((l) => l.length > 2)
      .slice(0, 3);
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
    const sample = songNames.slice(0, 5).join(', ');
    const resp = await askAI(
      `Create a creative, short (2-4 words) playlist name for a playlist containing songs like: ${sample}. Reply with ONLY the playlist name.`,
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
    const resp = await askAI(
      `Convert this mood/vibe into a 2-3 word music search query for JioSaavn: "${mood}". Reply with ONLY the search query.`,
      [],
    );
    const q = resp.split('\n')[0].replace(/["'.]/g, '').trim();
    return q.length > 0 && q.length < 40 ? q : mood;
  } catch {
    return mood;
  }
}
