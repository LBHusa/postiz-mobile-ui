// Phase 3: static map of format options per platform provider.
// Phase 4+: replaced with GET /api/workflow/formats?platform=:p from Server-Agent.

export interface FormatOption {
  value: string;
  label: string;
}

export interface PlatformFormats {
  formatOptions: FormatOption[];
  supportsCarousel: boolean;
  supportsCollaborators: boolean;
}

const PLATFORM_FORMAT_MAP: Record<string, PlatformFormats> = {
  linkedin: {
    formatOptions: [
      { value: 'text', label: 'Text' },
      { value: 'carousel', label: 'Karussell' },
    ],
    supportsCarousel: true,
    supportsCollaborators: false,
  },
  instagram: {
    formatOptions: [
      { value: 'post', label: 'Post' },
      { value: 'story', label: 'Story' },
      { value: 'reel', label: 'Reel' },
    ],
    supportsCarousel: false,
    supportsCollaborators: true,
  },
  facebook: {
    formatOptions: [
      { value: 'post', label: 'Post' },
      { value: 'story', label: 'Story' },
      { value: 'reel', label: 'Reel' },
    ],
    supportsCarousel: false,
    supportsCollaborators: false,
  },
};

const DEFAULT_FORMATS: PlatformFormats = {
  formatOptions: [{ value: 'post', label: 'Post' }],
  supportsCarousel: false,
  supportsCollaborators: false,
};

export function usePlatformFormats(provider: string): PlatformFormats {
  return PLATFORM_FORMAT_MAP[provider.toLowerCase()] ?? DEFAULT_FORMATS;
}

export function useStatusStates() {
  return [
    { value: 'idea', label: 'Idee' },
    { value: 'draft', label: 'Entwurf' },
    { value: 're_gen', label: 'Re-Gen' },
    { value: 'approved', label: 'Freigegeben' },
    { value: 'scheduled', label: 'Geplant' },
    { value: 'online', label: 'Online' },
    { value: 'failed', label: 'Fehler' },
    { value: 'proposal', label: 'Vorschlag' },
  ] as const;
}
