export interface SongImage {
  quality: string;
  link?: string;
  url?: string;
}

export interface SongDownloadUrl {
  quality: string;
  link?: string;
  url?: string;
}

export interface SongAlbum {
  id: string;
  name: string;
  url?: string;
}

export interface SongArtist {
  id: string;
  name: string;
  url?: string;
  image?: SongImage[];
  type?: string;
  role?: string;
}

export interface Song {
  id: string;
  name: string;
  type?: string;
  album: SongAlbum;
  year?: string;
  duration: number | string;
  label?: string;
  primaryArtists?: string;
  primaryArtistsId?: string;
  artists?: {
    primary?: SongArtist[];
    featured?: SongArtist[];
    all?: SongArtist[];
  };
  language?: string;
  hasLyrics?: string;
  url?: string;
  image: SongImage[];
  downloadUrl: SongDownloadUrl[];
  playCount?: string;
  explicitContent?: number;
  copyright?: string;
  releaseDate?: string | null;
  featuredArtists?: string;
  featuredArtistsId?: string;
  /** Local device file URI — used instead of downloadUrl when playing local songs */
  localUri?: string;
}

export type RepeatMode = 'off' | 'all' | 'one';

export type HomeTabType = 'Suggested' | 'Songs' | 'Albums' | 'Artists' | 'Local';

export type RootStackParamList = {
  MainTabs: undefined;
  Player: undefined;
  Queue: undefined;
  Search: undefined;
  ArtistDetail: { artistId: string; artistName: string; artistImage?: string };
  AiChat: undefined;
  PlaylistDetail: { playlistId: string; playlistName: string; emoji?: string };
};

export type MainTabParamList = {
  Home: undefined;
  Favorites: undefined;
  Playlists: undefined;
  Settings: undefined;
};

declare global {
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
