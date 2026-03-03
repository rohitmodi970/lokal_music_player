# AI Features — LLM Stack in Lokal

This document describes every place large language models (LLMs) are used in the app, the three-tier fallback chain, caching strategy, and how to extend AI hooks.

---

## LLM Stack — Three-Tier Fallback

```
User action / app event
       │
       ▼
 aiService.ts
       │
       ├─ Tier 1: Google Gemini (gemini-flash-latest)
       │       └─ fast, low-latency, free tier available
       │
       ├─ Tier 2: api.ai.cc → gpt-4o-mini  (if Gemini fails)
       │       └─ OpenAI-compatible endpoint, acts as hot-standby
       │
       └─ Tier 3: Hardcoded keyword fallback  (if both LLMs fail)
               └─ 12 mood/genre categories, instant, no network
                  ↓
               Dynamic data / query / text
                  ├── JioSaavn search query  → searchSongs() → Song[]
                  ├── Queue suggestions      → searchSongs() → Song[]
                  └── Playlist name          → shown to user
```

All AI calls go through `src/api/aiService.ts`. The active call chain is:

1. `askAI(prompt, history)` — tries Gemini first
2. On Gemini failure → `askFallbackAI(prompt)` — calls `api.ai.cc` with `gpt-4o-mini`
3. On both failures → `getHardcodedFallback(userMessage)` — keyword-based instant response

**API keys (in `aiService.ts`):**
| Constant | Value | Model |
|----------|-------|-------|
| `GEMINI_API_KEY` | Google AI Studio key | `gemini-flash-latest` |
| `AICC_API_KEY` | api.ai.cc token | `gpt-4o-mini` |
| `AICC_URL` | `https://api.ai.cc/v1/chat/completions` | OpenAI-compatible |

---

## AI Features in Production

### 1. Dynamic Home Screen Feed
**File:** `src/screens/HomeScreen.tsx` + `src/api/aiService.ts` (`getDynamicHomeQuery()`)  
**Trigger:** App load / home screen mount  
**What it does:** Generates a time-of-day-aware search query used to populate the home feed.

| Time period | Period key | Static fallback (instant) | AI may refine to |
|-------------|-----------|--------------------------|------------------|
| 00:00–05:59 | `late_night` | `"late night chill"` | `"lofi chill beats"` |
| 06:00–11:59 | `morning` | `"morning energy"` | `"morning motivation hits"` |
| 12:00–16:59 | `afternoon` | `"afternoon focus"` | `"focus study music"` |
| 17:00–20:59 | `evening` | `"evening relaxing"` | `"evening soul vibes"` |
| 21:00–23:59 | `night` | `"night vibes"` | `"night jazz smooth"` |

**Performance strategy (no blocking AI wait):**
1. `getDynamicHomeQuery()` returns the static fallback string **immediately** (zero latency)
2. Simultaneously fires an LLM call in the background to get a refined query
3. Background result is written to cache key `home_query_<period>` with `TTL.LONG` (1 hour)
4. On the **next** call within the same hour-period, the cache is served — the AI-refined query is used instantly with no network wait at all

**HomeScreen cache-first loading:**
1. On mount, `HomeScreen` checks AsyncStorage for `search_<staticQuery>_1_40`
2. Cache hit → songs rendered instantly, no spinner; background refresh runs silently
3. Cache miss → shows spinner, fetches fresh, cache is populated for next open

**Fallback chain:** Static string → Gemini → api.ai.cc → `"top hits"`

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

The system prompt (`SYSTEM_PROMPT` in `aiService.ts`) instructs the LLM to act as "Lokal AI" — a friendly music assistant that recommends songs available on JioSaavn.

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

### Tier 1 — Gemini
| Setting | Value | Notes |
|---------|-------|-------|
| Model | `gemini-flash-latest` | Fast, cost-effective for short completions |
| Max output tokens | 500 | Prevents runaway long responses |
| Temperature | 0.7 | Balanced creativity vs. consistency |
| System prompt | `SYSTEM_PROMPT` const | Scopes the model to music topics |

### Tier 2 — api.ai.cc (gpt-4o-mini)
| Setting | Value | Notes |
|---------|-------|-------|
| Model | `gpt-4o-mini` | OpenAI-compatible, low-cost |
| Endpoint | `https://api.ai.cc/v1/chat/completions` | Drop-in OpenAI API replacement |
| Max tokens | 500 | Same cap as Gemini |
| Temperature | 0.7 | Same as Gemini for consistency |

### Tier 3 — Hardcoded Keyword Fallback
Matches keywords in the user's message against 12 categories:  
`chill`, `workout`, `romantic`, `sad`, `party`, `road trip`, `morning`, `night`, `bollywood`, `trending`, `punjabi`, `focus`  
Each category returns a fixed list of songs in `"Song Name" by Artist` format, which `extractSongNames()` can parse for JioSaavn searching.

**Key location:** `src/api/aiService.ts`  
**Gemini key:** Replace `GEMINI_API_KEY` — get from [Google AI Studio](https://aistudio.google.com/)  
**api.ai.cc key:** Replace `AICC_API_KEY` — get from [api.ai.cc console](https://api.ai.cc/console/token)

---

## Adding New AI Features

1. Add a new async function in `src/api/aiService.ts` that calls `askAI(prompt, history)`
2. `askAI` already handles the full three-tier fallback — you get Gemini → api.ai.cc → hardcoded automatically
3. Keep prompts precise and request structured output (one item per line, specific format)
4. Cache the result where appropriate using `setCached(key, data, TTL.LONG)` from `src/utils/cache.ts`
5. Always add a `try/catch` with a sensible static fallback so LLM failures never block the UI
6. Document the new feature in this file

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
