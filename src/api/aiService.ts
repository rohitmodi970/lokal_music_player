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
