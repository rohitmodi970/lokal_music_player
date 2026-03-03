import { Song, SongDownloadUrl, SongImage } from '../types';

/**
 * Get image URL from the image array.
 * The search API uses "link", the songs API uses "url".
 */
export function getImageUrl(
  images: SongImage[] | undefined,
  quality: '50x50' | '150x150' | '500x500' = '500x500',
): string {
  if (!images || images.length === 0) return '';
  const match = images.find((img) => img.quality === quality);
  if (match) return match.link || match.url || '';
  // Fallback to highest quality available
  const last = images[images.length - 1];
  return last?.link || last?.url || '';
}

/**
 * Get download URL from the downloadUrl array.
 * The search API uses "link", the songs API uses "url".
 */
export function getDownloadUrl(
  urls: SongDownloadUrl[] | undefined,
  quality: string = '320kbps',
): string {
  if (!urls || urls.length === 0) return '';
  const match = urls.find((u) => u.quality === quality);
  if (match) return match.link || match.url || '';
  // Fallback to highest quality available
  const last = urls[urls.length - 1];
  return last?.link || last?.url || '';
}

/** Format milliseconds to m:ss */
export function formatTime(ms: number): string {
  if (isNaN(ms) || ms < 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** Extract a display-friendly artist name from a Song */
export function getArtistName(song: Song): string {
  if (song.primaryArtists) return song.primaryArtists;
  if (song.artists?.primary?.length) {
    return song.artists.primary.map((a) => a.name).join(', ');
  }
  return 'Unknown Artist';
}

/** Convert song duration (seconds string or number) to milliseconds */
export function getDurationMs(song: Song): number {
  const dur =
    typeof song.duration === 'string'
      ? parseInt(song.duration, 10)
      : song.duration;
  return (dur || 0) * 1000;
}

/** Decode HTML entities that may appear in song/artist names */
export function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/** Format large play counts: 180221404 -> "180.2M" */
export function formatPlayCount(count: string | number | undefined): string {
  if (!count) return '';
  const n = typeof count === 'string' ? parseInt(count, 10) : count;
  if (isNaN(n)) return '';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

/**
 * Format duration from seconds to mm:ss
 */
export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Truncate text to a max length with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Get image URL from a Song object
 */
export function getImageUrlFromSong(
  song: Song,
  quality: '50x50' | '150x150' | '500x500' = '500x500',
): string {
  return getImageUrl(song.image, quality);
}
