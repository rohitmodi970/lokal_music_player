const GEMINI_API_KEY = 'AIzaSyDwmHUf3T5RC0-ps4_PRYMQNeuiPg2ISDQ'; // Replace with your actual Gemini key

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

const SYSTEM_PROMPT = `You are Mume AI, an intelligent music assistant inside the Mume music player app.
You help users discover music, create playlists, find songs by mood/genre, and answer music-related questions.
Keep responses concise and friendly. When recommending songs, suggest popular tracks available on JioSaavn.
You can suggest songs by mood, genre, artist, occasion, or similar artists.
Format song recommendations as: "Song Name" by Artist Name
Always be helpful, conversational, and music-focused.`;

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
      return "Sorry, I'm having trouble connecting right now. Please try again later.";
    }

    const data: GeminiResponse = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return text || "I didn't get a response. Please try again.";
  } catch (error) {
    console.error('AI service error:', error);
    return 'Sorry, something went wrong. Please check your connection and try again.';
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
  let ctx =
    hour < 6
      ? 'late night ambient chill'
      : hour < 12
      ? 'morning energetic upbeat'
      : hour < 17
      ? 'afternoon focus work'
      : hour < 21
      ? 'evening mood relaxing'
      : 'night vibes mellow';
  try {
    const raw = await askAI(
      `You are a music search assistant. Suggest ONE concise 2-3 word music search query for "${ctx}" music. Reply with ONLY the search query, nothing else.`,
      [],
    );
    const cleaned = raw.split('\n')[0].replace(/["'.!]/g, '').trim();
    return cleaned.length > 2 && cleaned.length < 40 ? cleaned : 'top hits';
  } catch {
    return 'top hits';
  }
}

/**
 * AI-powered smart queue suggestions after a song ends.
 * Returns up to 3 JioSaavn-searchable query strings.
 */
export async function getSmartQueueSuggestions(
  songName: string,
  artistName: string,
): Promise<string[]> {
  try {
    const resp = await askAI(
      `I just listened to "${songName}" by ${artistName}. Give me 3 similar songs I might enjoy. List each as "Song Title by Artist" on a separate line. No bullets, no numbering.`,
      [],
    );
    return resp
      .split('\n')
      .map((l) => l.replace(/^[-•*\d.]+\s*/, '').trim())
      .filter((l) => l.length > 2)
      .slice(0, 3);
  } catch {
    return [];
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
