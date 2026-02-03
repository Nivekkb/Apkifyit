export type ThemePreset = {
  id: string;
  name: string;
  description: string;
  previewStyle: Record<string, string | number>;
  vars: Record<string, string>;
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'serenix-night',
    name: 'Serenix Night',
    description: 'Dreamy gradients, soft glow, calm onboarding.',
    previewStyle: {
      background: 'linear-gradient(135deg, #070A16 0%, #0B1230 35%, #070A16 65%, #03040B 100%)',
      color: '#f8fafc'
    },
    vars: {
      '--df-bg': '#070A16',
      '--df-surface': '#0B1230',
      '--df-accent': '#8b5cf6',
      '--df-accent-2': '#ec4899',
      '--df-text': '#f8fafc',
      '--df-muted': '#cbd5f5'
    }
  },
  {
    id: 'soloops-command',
    name: 'SoloOps Command',
    description: 'Tactical ops cockpit with warm ember accents.',
    previewStyle: {
      background: 'radial-gradient(circle at 20% 20%, #1a221b 0%, #0a0e0a 60%, #050605 100%)',
      color: '#e6efe7'
    },
    vars: {
      '--df-bg': '#050605',
      '--df-surface': '#111813',
      '--df-accent': '#f15a2a',
      '--df-accent-2': '#3c4a3d',
      '--df-text': '#e6efe7',
      '--df-muted': '#9aa79c'
    }
  },
  {
    id: 'fintech-aurora',
    name: 'Fintech Aurora',
    description: 'Emerald + cyan clarity with a premium edge.',
    previewStyle: {
      background: 'linear-gradient(135deg, #020617 0%, #0f172a 60%, #020617 100%)',
      color: '#e2e8f0'
    },
    vars: {
      '--df-bg': '#020617',
      '--df-surface': '#0f172a',
      '--df-accent': '#34d399',
      '--df-accent-2': '#22d3ee',
      '--df-text': '#e2e8f0',
      '--df-muted': '#94a3b8'
    }
  },
  {
    id: 'persona-bloom',
    name: 'Persona Bloom',
    description: 'Soft violet + rose for identity work.',
    previewStyle: {
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 45%, #0f172a 100%)',
      color: '#f8fafc'
    },
    vars: {
      '--df-bg': '#0f172a',
      '--df-surface': '#1e1b4b',
      '--df-accent': '#a855f7',
      '--df-accent-2': '#fb7185',
      '--df-text': '#f8fafc',
      '--df-muted': '#c7d2fe'
    }
  },
  {
    id: 'aurora-mint',
    name: 'Aurora Mint',
    description: 'Cool mint gradients with glass depth.',
    previewStyle: {
      background: 'linear-gradient(135deg, #022c22 0%, #064e3b 50%, #022c22 100%)',
      color: '#ecfdf5'
    },
    vars: {
      '--df-bg': '#022c22',
      '--df-surface': '#064e3b',
      '--df-accent': '#2dd4bf',
      '--df-accent-2': '#a7f3d0',
      '--df-text': '#ecfdf5',
      '--df-muted': '#99f6e4'
    }
  },
  {
    id: 'desert-gold',
    name: 'Desert Gold',
    description: 'Warm sand + amber with editorial calm.',
    previewStyle: {
      background: 'linear-gradient(135deg, #1c1917 0%, #292524 55%, #1c1917 100%)',
      color: '#fef3c7'
    },
    vars: {
      '--df-bg': '#1c1917',
      '--df-surface': '#292524',
      '--df-accent': '#f59e0b',
      '--df-accent-2': '#f97316',
      '--df-text': '#fef3c7',
      '--df-muted': '#d6b98c'
    }
  },
  {
    id: 'noir-glass',
    name: 'Noir Glass',
    description: 'Minimal black glass with electric highlight.',
    previewStyle: {
      background: 'linear-gradient(135deg, #020202 0%, #0b0b0b 60%, #020202 100%)',
      color: '#f8fafc'
    },
    vars: {
      '--df-bg': '#020202',
      '--df-surface': '#0b0b0b',
      '--df-accent': '#38bdf8',
      '--df-accent-2': '#a855f7',
      '--df-text': '#f8fafc',
      '--df-muted': '#94a3b8'
    }
  }
];

export const getThemePreset = (id?: string) =>
  THEME_PRESETS.find((theme) => theme.id === id) || THEME_PRESETS[0];
