# Storage, Caching & Local Persistence Guide

This document explains every piece of data the app reads from / writes to the device, the strategy behind each, and which keys are used.

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         App Data                            │
├─────────────────┬──────────────────┬────────────────────────┤
│   In-Memory     │  AsyncStorage    │  Notes                 │
│   (Zustand)     │  (Persistent)    │                        │
├─────────────────┼──────────────────┼────────────────────────┤
│ Player state    │ Queue + index    │ Restored on relaunch   │
│ Theme mode      │ Theme pref       │ Restored on relaunch   │
│ Favorites list  │ Favorites        │ Restored on relaunch   │
│ Playlists       │ User playlists   │ Restored on relaunch   │
│ History         │ History songs    │ Restored on relaunch   │
│ Recent searches │ Recent searches  │ Restored on relaunch   │
│ API responses   │ API cache + TTL  │ Expires after TTL      │
└─────────────────┴──────────────────┴────────────────────────┘
```

---

## 2. AsyncStorage Keys

All keys use a prefix to avoid collisions.

| Key | Prefix | Description | Managed by |
|-----|--------|-------------|------------|
| `@lokal_player_queue` | `@lokal_` | Current playback queue (array of `Song`) | `usePlayerStore` |
| `@lokal_player_current_index` | `@lokal_` | Index of the currently playing song | `usePlayerStore` |
| `@lokal_theme_mode` | `@lokal_` | `"light"` or `"dark"` | `useThemeStore` |
| `@lokal_favorites` | `@lokal_` | Array of liked `Song` objects | `useLibraryStore` |
| `@lokal_playlists` | `@lokal_` | Array of user-created `Playlist` objects | `useLibraryStore` |
| `@lokal_history` | `@lokal_` | Array of recently played `Song` objects (max 100) | `useLibraryStore` |
| `@lokal_recent_searches` | `@lokal_` | Array of recent search strings (max 10) | `SearchScreen` |
| `@lokal_cache_*` | `@lokal_cache_` | API response cache entries with TTL metadata | `src/utils/cache.ts` |

---

## 3. Zustand Stores

### `usePlayerStore` — `src/store/usePlayerStore.ts`

**What it holds:**
- `queue: Song[]` — The current playback queue
- `currentIndex: number` — Index of the playing song
- `isPlaying`, `isLoading`, `positionMs`, `durationMs` — Live playback state
- `shuffle: boolean`, `repeat: RepeatMode` — Mode flags

**Persistence:**
- Queue and current index are persisted to AsyncStorage on every mutation via `persistQueue()`.
- Restored at app launch via `loadPersistedQueue()` (called in `App.tsx` `useEffect`).
- Live playback state (position, duration, isPlaying) is **not** persisted — it reflects the audio engine state.

---

### `useThemeStore` — `src/store/useThemeStore.ts`

**What it holds:**
- `mode: "light" | "dark"` — Current theme
- `colors: ThemeColors` — Derived color map (never stored, computed from mode)
- `isDark: boolean`

**Persistence:**
- Theme mode is saved to `@lokal_theme_mode` on every toggle.
- Restored at app launch via `loadTheme()`.

---

### `useLibraryStore` — `src/store/useLibraryStore.ts`

**What it holds:**
- `favorites: Song[]` — Songs the user has liked (heart button)
- `history: Song[]` — Last 100 played songs (newest first)
- `playlists: Playlist[]` — Combined array of system + user playlists

**Playlist structure:**
```typescript
interface Playlist {
  id: string;         // unique ID (e.g. "__history__", "playlist_1700000000")
  name: string;       // display name
  songs: Song[];      // songs in this playlist
  isSystem: boolean;  // true = cannot be deleted/renamed by user
  createdAt: number;  // Unix ms timestamp
  emoji?: string;     // optional visual icon
}
```

**System Playlists (auto-managed, not stored directly):**
| ID | Name | Populated by |
|----|------|--------------|
| `__likes__` | Liked Songs | `addFavorite` / `removeFavorite` |
| `__history__` | History | `addToHistory` (called by `audioManager` on every song load) |

System playlists are **derived** from `favorites` and `history` arrays at load time — they are not written to `@lokal_playlists` directly.

**User Playlists:**
- Stored in `@lokal_playlists` as a JSON array.
- Only non-system playlists are persisted.
- Created via the Playlists tab ("New" button) or a future "Create" flow.

**Persistence flow:**
```
App start → loadLibrary()
  → read @lokal_favorites        → set favorites
  → read @lokal_history          → set history
  → read @lokal_playlists        → set user playlists
  → build system playlists       → merged into playlists[]
```

---

## 4. API Cache — `src/utils/cache.ts`

**Purpose:** Avoid redundant network requests by caching JioSaavn API responses and LLM-generated queries locally with a TTL.

**Storage key format:** `@lokal_cache_<key>`

**Cache entry shape:**
```typescript
interface CacheEntry<T> {
  data: T;         // The cached response
  timestamp: number; // Unix ms when cached
  ttl: number;     // Max age in ms
}
```

**TTL constants:**
| Constant | Value | Used for |
|----------|-------|----------|
| `TTL.SHORT` | 5 minutes | Trending / home songs |
| `TTL.MEDIUM` | 15 minutes | Search results, suggestions, artist songs |
| `TTL.LONG` | 1 hour | Single song by ID, AI-generated home query per time-period |
| `TTL.DAY` | 24 hours | Available for long-lived preferences |

**Per-function cache keys:**
| Source | Key format | TTL | Notes |
|--------|-----------|-----|-------|
| `searchSongs(q, page, limit)` | `search_<q>_<page>_<limit>` | MEDIUM | Cached in `saavnApi.ts` |
| `getSongById(id)` | `song_<id>` | LONG | |
| `getSongSuggestions(id)` | `suggestions_<id>` | MEDIUM | |
| `getTrendingSongs(limit)` | `trending_<limit>` | SHORT | |
| `getArtistSongs(artistId, page)` | `artist_songs_<artistId>_<page>` | MEDIUM | |
| `getDynamicHomeQuery()` | `home_query_<period>` | LONG | Period = `morning`\|`afternoon`\|`evening`\|`night`\|`late_night` |

**Cache miss flow:**
```
getCached(key) → null (miss or expired)
  → fetch from API
  → setCached(key, data, ttl)
  → return data
```

**Cache invalidation:**
- Entries expire automatically when `Date.now() - timestamp > ttl`.
- `clearAllCache()` removes all `@lokal_cache_*` keys — accessible via Settings → Clear Cache.
- `removeCached(key)` removes a single entry.

---

## 5. Recent Searches — `SearchScreen`

- Key: `@lokal_recent_searches`
- Format: `string[]` (search terms, max 10, newest first)
- Written in `SearchScreen` on every successful search.
- Read on `SearchScreen` mount.

---

## 6. Load Order at App Start

```
App.tsx useEffect (runs once)
│
├── initAudio()             // configure expo-av
├── startStoreSubscription() // watch store changes → load songs
├── loadPersistedQueue()    // restore playback queue
├── loadTheme()             // restore light/dark preference
├── initNotifications()     // request permissions, set up channels
└── loadLibrary()           // restore favorites, history, playlists
```

---

## 7. Data Flow Diagram

```
User likes a song
    │
    ▼
useLibraryStore.toggleFavorite(song)
    │
    ├── updates favorites[] in memory
    ├── syncs __likes__ playlist
    └── AsyncStorage.setItem(@lokal_favorites, JSON)

Song starts playing (audioManager.loadAndPlay)
    │
    ├── useLibraryStore.addToHistory(song)
    │       ├── prepend to history[], max 100
    │       ├── syncs __history__ playlist
    │       └── AsyncStorage.setItem(@lokal_history, JSON)
    │
    └── showPlaybackNotification(song, true)

User creates playlist
    │
    ▼
useLibraryStore.createPlaylist(name, emoji)
    ├── creates Playlist{ id, name, songs:[], isSystem:false }
    ├── appends to playlists[]
    └── AsyncStorage.setItem(@lokal_playlists, JSON of user playlists only)
```
