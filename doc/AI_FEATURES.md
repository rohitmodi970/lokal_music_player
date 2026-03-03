# AI Features — How Gemini Powers Mume

This document describes every place the Gemini AI API is used in the app, what it does, why it was chosen over a hardcoded algorithm, and how to add more AI hooks.

---

## Architecture Overview

```
User action / app event
       │
       ▼
aiService.ts  (Gemini Flash API)
       │
       ▼
Dynamic data / query / text
       │
       ├── JioSaavn search query  → searchSongs() → Song[]
       ├── Queue suggestions      → searchSongs() → Song[]
       └── Playlist name          → shown to user
```

All AI calls go through `src/api/aiService.ts`. The Gemini `flash-latest` model is used for all requests (fast, low-latency, good for short completions).

---

## AI Features in Production

### 1. Dynamic Home Screen Feed
**File:** `src/screens/HomeScreen.tsx` (calls `getDynamicHomeQuery()`)  
**Trigger:** App load / home screen mount  
**What it does:** Instead of always loading the same hardcoded artist (previously "arijit singh"), the AI reads the current time-of-day and generates a context-aware search query:

| Time | Context sent to AI | Example query returned |
|------|-------------------|----------------------|
| 00:00 – 05:59 | "late night ambient chill" | "lofi chill beats" |
| 06:00 – 11:59 | "morning energetic upbeat" | "morning motivation hits" |
| 12:00 – 16:59 | "afternoon focus work" | "focus study music" |
| 17:00 – 20:59 | "evening mood relaxing" | "evening soul vibes" |
| 21:00 – 23:59 | "night vibes mellow" | "night jazz smooth" |

The query is then passed to `searchSongs()` to populate the home feed. A small `✨ AI picked: <query>` label is shown at the top of the Suggested tab so the user can see what the AI chose.

**Fallback:** If the AI call fails or times out, falls back to `"top hits"`.

---

### 2. Smart Queue Suggestions
**File:** `src/api/aiService.ts` — `getSmartQueueSuggestions(songName, artistName)`  
**Trigger:** Can be called after a song finishes or from the "You may also like" feature (hook it wherever you want auto-play next)  
**What it does:** Given the currently playing song + artist, asks Gemini to suggest 3 similar songs. Returns raw search query strings to pass into `searchSongs()`.

**Example prompt:**
```
I just listened to "Blinding Lights" by The Weeknd. Give me 3 similar songs I might enjoy. 
List each as "Song Title by Artist" on a separate line.
```
**Example response:** `"Starboy by The Weeknd"`, `"Save Your Tears by The Weeknd"`, `"Can't Feel My Face by The Weeknd"`

**How to use in code:**
```typescript
const suggestions = await getSmartQueueSuggestions(song.name, artistName);
for (const q of suggestions) {
  const result = await searchSongs(q, 1, 1);
  if (result.songs.length) addToQueue(result.songs[0]);
}
```

---

### 3. AI Music Chat (AiChatScreen)
**File:** `src/screens/AiChatScreen.tsx` (calls `askAI()`)  
**Trigger:** User types a message in the chat UI  
**What it does:** Full conversation loop using Gemini with a music-focused system prompt. Users can:
- Ask for song/artist recommendations
- Request songs by mood, genre, or occasion
- Ask music trivia
- Get playlist ideas

The system prompt (`SYSTEM_PROMPT` in `aiService.ts`) instructs Gemini to act as "Mume AI" — a friendly music assistant that recommends songs available on JioSaavn.

**Song extraction:** `extractSongNames(aiResponse)` parses `"Song Name" by Artist` patterns from the AI response so the app can directly search and play them.

---

### 4. AI Playlist Name Generator
**File:** `src/api/aiService.ts` — `generateSmartPlaylistName(songNames)`  
**Trigger:** Called when user creates a new playlist (can be wired to the "Create Playlist" flow in `PlaylistsScreen.tsx`)  
**What it does:** Takes up to 5 song names from the playlist and asks Gemini to suggest a creative, short (2-4 word) playlist name.

**Example prompt:**
```
Create a creative, short (2-4 words) playlist name for a playlist containing songs like: 
Blinding Lights, Starboy, Save Your Tears, As It Was, Heat Waves.
Reply with ONLY the playlist name.
```
**Example response:** `"Neon Night Feels"`

**How to wire it in PlaylistsScreen:**
```typescript
import { generateSmartPlaylistName } from '../api/aiService';
// After user adds songs:
const aiName = await generateSmartPlaylistName(playlist.songs.map(s => s.name));
setPlaylistNameInput(aiName); // pre-fill the input field
```

---

### 5. Mood-to-Query Mapper
**File:** `src/api/aiService.ts` — `moodToSearchQuery(mood)`  
**Trigger:** Can be wired to a mood picker UI (e.g., chips: "Happy", "Sad", "Workout", "Party")  
**What it does:** Converts a mood/vibe string into a JioSaavn-searchable query.

**Example:**
```typescript
const query = await moodToSearchQuery('workout');
// Returns: "high energy gym" or "workout motivation hits"
const result = await searchSongs(query, 1, 30);
```

---

## API Configuration

| Setting | Value | Notes |
|---------|-------|-------|
| Model | `gemini-flash-latest` | Fast, cost-effective for short completions |
| Max output tokens | 500 | Prevents runaway long responses |
| Temperature | 0.7 | Balanced creativity vs. consistency |
| System prompt | In `SYSTEM_PROMPT` const | Scopes the model to music topics |

**Key location:** `src/api/aiService.ts`  
**API key:** Replace `GEMINI_API_KEY` with your own key from [Google AI Studio](https://aistudio.google.com/)

---

## Adding New AI Features

1. Add a new async function in `src/api/aiService.ts` that calls `askAI(prompt, history)`
2. Keep prompts precise and request structured output (one item per line, specific format)
3. Always add a `try/catch` with a sensible fallback so AI failures don't break the UI
4. Document the new feature in this file

---

## What Is NOT AI (by Design)

| Feature | Why hardcoded / algorithmic |
|---------|-----------------------------|
| Favorites | User's explicit choice — no AI needed |
| History | Chronological record — no AI needed |  
| Artist songs loading | API call — deterministic |
| Playback controls | Real-time audio — no AI needed |
| Cache TTL | Performance optimization — fixed constants |
| Sort options | User preference — deterministic |
