export type Order = 'id_desc' | 'id' | 'score' | 'favcount' | 'hot';

export type E621File = {
  url?: string;
  ext?: 'jpg' | 'png' | 'gif' | 'webm' | 'mp4';
};

export type E621Preview = {
  url?: string;
  alt?: string;
  width: number;
  height: number;
};

// alternates dla video w sample
export type E621SampleAlternates = {
  has: boolean;
  original?: {
    url: string;
    width: number;
    height: number;
    fps?: number;
    codec?: string;
    size?: number;
  };
  variants?: Record<
    string,
    {
      url: string;
      width: number;
      height: number;
      fps?: number;
      codec?: string;
      size?: number;
    }
  >;
  samples?: Record<
    string,
    {
      // np. "480p"
      url: string;
      width: number;
      height: number;
      fps?: number;
      codec?: string;
      size?: number;
    }
  >;
};

export type E621Sample = {
  has: boolean;
  url?: string;
  alt?: string;
  width: number;
  height: number;
  alternates?: E621SampleAlternates;
};

export type AutocompleteItem = {
  id: string;
  type: 'tag';
  name: string;
  post_count: number;
  category: number;
  antecedent_name: string | null; // 🔥 Dodaj antecedent_name
};

type E621Tags = {
  general: string[];
  artist: string[];
  contributor: string[];
  copyright: string[];
  character: string[];
  species: string[];
  invalid: string[];
  meta: string[];
  lore: string[];
};

export type E621Post = {
  id: number;
  created_at: string;
  file: E621File & { size?: number }; // Add size
  preview?: E621Preview;
  sample?: E621Sample;
  tags: E621Tags;
  rating: 's' | 'q' | 'e';
  duration?: number | null;
  is_favorited?: boolean;
  score: {
    up: number;
    down: number;
    total: number;
  };
  fav_count: number;
  sources: string[];
};

export type PostTag = {
  name: string;
  type: 'artist' | 'copyright' | 'general' | 'character' | 'species' | 'meta';
};

export type Post = {
  id: number;
  created_at: string;

  file: {
    url?: string;
    sample_url?: string; // tutaj będzie np. 480p video
    ext?: 'jpg' | 'png' | 'gif' | 'webm' | 'mp4';
    size?: number; // in bytes
    width?: number;
    height?: number;
  };

  preview: {
    url?: string;
    alt?: string;
    width: number;
    height: number;
  };

  sample: {
    has: boolean;
    url?: string; // tutaj możemy wrzucać video z alternates.samples
    alt?: string;
    width: number;
    height: number;
  };

  tags: PostTag[];
  is_favorited?: boolean;
  rating: 's' | 'q' | 'e';
  score: {
    up: number;
    down: number;
    total: number;
  };
  fav_count: number;
  sources: string[];
};
