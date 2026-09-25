import { useId } from 'react';
import { clsx } from 'clsx';

export interface UserAvatarProps {
  name?: string | null;
  size?: number;
  className?: string;
  alt?: string;
}

// Simple deterministic string hashing (DJB2 + FNV hybrid for good distribution)
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// Color palettes tailored to Avari aesthetic
interface Palette {
  name: string;
  bgGradient: [string, string];
  primary: string;
  glow: string;
  accent: string;
}

const PALETTES: Palette[] = [
  {
    name: 'gold',
    bgGradient: ['#3a280e', '#151007'],
    primary: '#f59e0b',
    glow: '#fbbf24',
    accent: '#d5ad68',
  },
  {
    name: 'cyan',
    bgGradient: ['#083344', '#04161d'],
    primary: '#06b6d4',
    glow: '#65d9f5',
    accent: '#22d3ee',
  },
  {
    name: 'emerald',
    bgGradient: ['#064e3b', '#031f18'],
    primary: '#10b981',
    glow: '#34d399',
    accent: '#8cd7b0',
  },
  {
    name: 'ruby',
    bgGradient: ['#4c0519', '#1f020a'],
    primary: '#f43f5e',
    glow: '#fb7185',
    accent: '#f29b98',
  },
  {
    name: 'purple',
    bgGradient: ['#3b0764', '#170327'],
    primary: '#a855f7',
    glow: '#c084fc',
    accent: '#d8b4fe',
  },
  {
    name: 'sapphire',
    bgGradient: ['#172554', '#091024'],
    primary: '#3b82f6',
    glow: '#60a5fa',
    accent: '#93c5fd',
  },
  {
    name: 'amber',
    bgGradient: ['#451a03', '#1c0a01'],
    primary: '#f97316',
    glow: '#fb923c',
    accent: '#fdba74',
  },
  {
    name: 'teal',
    bgGradient: ['#134e4a', '#06201e'],
    primary: '#14b8a6',
    glow: '#2dd4bf',
    accent: '#5eead4',
  },
  {
    name: 'rose',
    bgGradient: ['#500724', '#21020f'],
    primary: '#e11d48',
    glow: '#f43f5e',
    accent: '#fda4af',
  },
  {
    name: 'indigo',
    bgGradient: ['#1e1b4b', '#0c0a21'],
    primary: '#6366f1',
    glow: '#818cf8',
    accent: '#a5b4fc',
  },
];

// Keyword adjective to palette mapping
const ADJECTIVE_MAP: Record<string, string> = {
  golden: 'gold',
  amber: 'amber',
  solar: 'amber',
  blazing: 'amber',
  cyber: 'cyan',
  quantum: 'cyan',
  atomic: 'cyan',
  electric: 'cyan',
  pulsar: 'cyan',
  emerald: 'emerald',
  forest: 'emerald',
  ancient: 'emerald',
  ruby: 'ruby',
  plasma: 'ruby',
  epic: 'ruby',
  amethyst: 'purple',
  cosmic: 'purple',
  astral: 'purple',
  nebula: 'purple',
  mystic: 'purple',
  shadow: 'purple',
  sapphire: 'sapphire',
  frosty: 'sapphire',
  polar: 'sapphire',
  stellar: 'sapphire',
  turbo: 'teal',
  vivid: 'teal',
  aurora: 'teal',
  velvet: 'rose',
  radiant: 'rose',
  neon: 'indigo',
  vector: 'indigo',
  hyper: 'indigo',
  infinite: 'indigo',
};

// Glyphs rendered as SVG elements on a 100x100 canvas
function renderEmblem(motif: string, primary: string, glow: string, accent: string) {
  switch (motif) {
    case 'wolf':
    case 'fox':
    case 'lynx':
    case 'raccoon':
      return (
        <g stroke={glow} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
          {/* Ears */}
          <polygon points="26,46 32,22 44,38" fill={primary} fillOpacity="0.35" />
          <polygon points="74,46 68,22 56,38" fill={primary} fillOpacity="0.35" />
          {/* Head & Muzzle */}
          <polygon points="50,78 28,48 50,34 72,48" fill={accent} fillOpacity="0.15" />
          {/* Snout */}
          <polygon points="50,78 40,58 60,58" fill={glow} fillOpacity="0.3" />
          {/* Eyes */}
          <circle cx="40" cy="46" r="2.5" fill={glow} stroke="none" />
          <circle cx="60" cy="46" r="2.5" fill={glow} stroke="none" />
          {/* Nose */}
          <polygon points="50,74 46,68 54,68" fill={glow} stroke="none" />
        </g>
      );

    case 'dragon':
    case 'phoenix':
    case 'griffin':
      return (
        <g stroke={glow} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
          {/* Wings */}
          <path d="M50 52 C32 30 18 36 20 62 C30 58 42 62 50 68" fill={primary} fillOpacity="0.3" />
          <path d="M50 52 C68 30 82 36 80 62 C70 58 58 62 50 68" fill={primary} fillOpacity="0.3" />
          {/* Crest / Horns */}
          <path d="M50 20 L44 34 L50 30 L56 34 Z" fill={accent} fillOpacity="0.6" />
          <path d="M38 26 L45 36 M62 26 L55 36" />
          {/* Eyes */}
          <circle cx="44" cy="42" r="2" fill={glow} stroke="none" />
          <circle cx="56" cy="42" r="2" fill={glow} stroke="none" />
          {/* Tail / Flame Core */}
          <circle cx="50" cy="54" r="5" fill={glow} fillOpacity="0.5" />
        </g>
      );

    case 'totoro':
    case 'panda':
    case 'bear':
    case 'koala':
      return (
        <g stroke={glow} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
          {/* Ears */}
          <ellipse cx="32" cy="28" rx="7" ry="12" fill={primary} fillOpacity="0.3" transform="rotate(-15 32 28)" />
          <ellipse cx="68" cy="28" rx="7" ry="12" fill={primary} fillOpacity="0.3" transform="rotate(15 68 28)" />
          {/* Head & Body */}
          <ellipse cx="50" cy="58" rx="28" ry="26" fill={accent} fillOpacity="0.15" />
          {/* Belly */}
          <ellipse cx="50" cy="64" rx="18" ry="16" fill={primary} fillOpacity="0.25" />
          {/* Eyes */}
          <circle cx="38" cy="46" r="3.5" fill="#fff" stroke="none" />
          <circle cx="62" cy="46" r="3.5" fill="#fff" stroke="none" />
          <circle cx="39" cy="46" r="1.8" fill={primary} stroke="none" />
          <circle cx="61" cy="46" r="1.8" fill={primary} stroke="none" />
          {/* Nose */}
          <ellipse cx="50" cy="49" rx="3.5" ry="2" fill={glow} stroke="none" />
          {/* Belly markings */}
          <path d="M43 62 L46 66 L49 62 M51 62 L54 66 L57 62" />
        </g>
      );

    case 'capybara':
    case 'otter':
    case 'beaver':
      return (
        <g stroke={glow} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
          {/* Ears */}
          <circle cx="28" cy="38" r="5" fill={primary} fillOpacity="0.4" />
          <circle cx="72" cy="38" r="5" fill={primary} fillOpacity="0.4" />
          {/* Head */}
          <rect x="30" y="34" width="40" height="38" rx="14" fill={accent} fillOpacity="0.2" />
          {/* Snout */}
          <rect x="36" y="52" width="28" height="18" rx="8" fill={primary} fillOpacity="0.35" />
          {/* Eyes - Chill horizontal lines */}
          <line x1="36" y1="46" x2="44" y2="46" strokeWidth="3" />
          <line x1="56" y1="46" x2="64" y2="46" strokeWidth="3" />
          {/* Nose */}
          <ellipse cx="50" cy="58" rx="3" ry="2" fill={glow} stroke="none" />
        </g>
      );

    case 'owl':
    case 'falcon':
    case 'penguin':
      return (
        <g stroke={glow} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
          {/* Feather tufts / crest */}
          <path d="M28 30 L38 40 M72 30 L62 40" strokeWidth="3" />
          {/* Body */}
          <ellipse cx="50" cy="56" rx="26" ry="24" fill={accent} fillOpacity="0.2" />
          {/* Big Wise Eyes */}
          <circle cx="38" cy="48" r="9" fill={primary} fillOpacity="0.3" />
          <circle cx="62" cy="48" r="9" fill={primary} fillOpacity="0.3" />
          <circle cx="38" cy="48" r="4" fill={glow} stroke="none" />
          <circle cx="62" cy="48" r="4" fill={glow} stroke="none" />
          {/* Beak */}
          <polygon points="50,60 46,52 54,52" fill={glow} stroke="none" />
        </g>
      );

    case 'pikachu':
    case 'spark':
    case 'plasma':
    case 'lightning':
      return (
        <g stroke={glow} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
          {/* Long Ears */}
          <polygon points="26,44 18,18 36,32" fill={primary} fillOpacity="0.4" />
          <polygon points="74,44 82,18 64,32" fill={primary} fillOpacity="0.4" />
          {/* Ear tips */}
          <polygon points="18,18 22,28 26,23" fill={accent} stroke="none" />
          <polygon points="82,18 78,28 74,23" fill={accent} stroke="none" />
          {/* Head */}
          <circle cx="50" cy="56" r="22" fill={accent} fillOpacity="0.15" />
          {/* Cheeks */}
          <circle cx="34" cy="62" r="4.5" fill={glow} fillOpacity="0.6" stroke="none" />
          <circle cx="66" cy="62" r="4.5" fill={glow} fillOpacity="0.6" stroke="none" />
          {/* Eyes & Nose */}
          <circle cx="40" cy="52" r="2.5" fill={glow} stroke="none" />
          <circle cx="60" cy="52" r="2.5" fill={glow} stroke="none" />
          <polygon points="50,58 48,56 52,56" fill={glow} stroke="none" />
        </g>
      );

    case 'gandalf':
    case 'wizard':
    case 'magic':
    case 'mystic':
      return (
        <g stroke={glow} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
          {/* Wizard Hat */}
          <polygon points="50,16 26,42 74,42" fill={primary} fillOpacity="0.4" />
          <ellipse cx="50" cy="42" rx="28" ry="4" fill={accent} fillOpacity="0.3" />
          {/* Hat Star */}
          <polygon points="50,26 52,31 57,31 53,34 55,39 50,36 45,39 47,34 43,31 48,31" fill={glow} stroke="none" />
          {/* Beard & Face */}
          <circle cx="50" cy="52" r="12" fill={accent} fillOpacity="0.15" />
          <path d="M38 52 C38 74 46 82 50 84 C54 82 62 74 62 52 Z" fill={glow} fillOpacity="0.25" />
          {/* Eyes */}
          <circle cx="44" cy="50" r="1.5" fill={glow} stroke="none" />
          <circle cx="56" cy="50" r="1.5" fill={glow} stroke="none" />
        </g>
      );

    case 'star':
    case 'cosmic':
    case 'astral':
    case 'orbit':
    case 'galaxy':
      return (
        <g stroke={glow} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
          {/* Orbit rings */}
          <ellipse cx="50" cy="50" rx="36" ry="14" transform="rotate(-30 50 50)" strokeOpacity="0.4" />
          <ellipse cx="50" cy="50" rx="36" ry="14" transform="rotate(30 50 50)" strokeOpacity="0.4" />
          {/* Central 8-point star */}
          <polygon
            points="50,22 55,42 75,42 58,54 65,74 50,62 35,74 42,54 25,42 45,42"
            fill={primary}
            fillOpacity="0.3"
          />
          <circle cx="50" cy="50" r="7" fill={glow} fillOpacity="0.7" stroke="none" />
          {/* Tiny satellite dots */}
          <circle cx="22" cy="38" r="2.5" fill={accent} stroke="none" />
          <circle cx="78" cy="62" r="2.5" fill={accent} stroke="none" />
        </g>
      );

    case 'shield':
    case 'knight':
    case 'blade':
    case 'katana':
    case 'saber':
      return (
        <g stroke={glow} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
          {/* Knight Shield */}
          <path d="M50 20 L76 28 C76 56 64 74 50 82 C36 74 24 56 24 28 Z" fill={primary} fillOpacity="0.3" />
          {/* Inner Emblem Cross / Rune */}
          <line x1="50" y1="28" x2="50" y2="72" stroke={accent} strokeWidth="3" />
          <line x1="34" y1="44" x2="66" y2="44" stroke={accent} strokeWidth="3" />
          <circle cx="50" cy="44" r="5" fill={glow} stroke="none" />
        </g>
      );

    case 'crystal':
    case 'cookie':
    case 'gem':
    case 'relic':
    case 'amulet':
      return (
        <g stroke={glow} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
          {/* Faceted Gem / Diamond */}
          <polygon points="50,18 78,38 50,82 22,38" fill={primary} fillOpacity="0.25" />
          <polygon points="50,18 64,38 50,82 36,38" fill={accent} fillOpacity="0.3" />
          <line x1="22" y1="38" x2="78" y2="38" />
          <circle cx="50" cy="38" r="3.5" fill={glow} stroke="none" />
        </g>
      );

    default:
      // Sacred Geometry / Constellation Hexagram Emblem
      return (
        <g stroke={glow} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
          {/* Outer circle & inner hexagon */}
          <circle cx="50" cy="50" r="32" strokeOpacity="0.35" strokeDasharray="3 3" />
          <polygon points="50,22 74,36 74,64 50,78 26,64 26,36" fill={primary} fillOpacity="0.2" />
          {/* Triangle 1 & 2 */}
          <polygon points="50,26 71,62 29,62" stroke={accent} strokeOpacity="0.7" />
          <polygon points="50,74 71,38 29,38" stroke={accent} strokeOpacity="0.7" />
          {/* Core Node */}
          <circle cx="50" cy="50" r="6" fill={glow} fillOpacity="0.8" stroke="none" />
          {/* Corner Nodes */}
          <circle cx="50" cy="22" r="2.5" fill={accent} stroke="none" />
          <circle cx="74" cy="36" r="2.5" fill={accent} stroke="none" />
          <circle cx="74" cy="64" r="2.5" fill={accent} stroke="none" />
          <circle cx="50" cy="78" r="2.5" fill={accent} stroke="none" />
          <circle cx="26" cy="64" r="2.5" fill={accent} stroke="none" />
          <circle cx="26" cy="36" r="2.5" fill={accent} stroke="none" />
        </g>
      );
  }
}

// Detect the best matching visual motif from the name tokens
function detectMotif(name: string, hash: number): string {
  const clean = name.toLowerCase();

  // Explicit keyword checks
  const motifs = [
    { key: 'wolf', match: ['wolf', 'vader', 'batman', 'terminator', 'blade', 'johnwick'] },
    { key: 'fox', match: ['fox', 'cheshire', 'corgi', 'chameleon', 'lemur'] },
    { key: 'dragon', match: ['dragon', 'phoenix', 'griffin', 'sukuna', 'goku', 'naruto'] },
    { key: 'totoro', match: ['totoro', 'panda', 'koala', 'shrek', 'donkey', 'mononoke'] },
    { key: 'capybara', match: ['capybara', 'otter', 'beaver', 'quokka', 'axolotl', 'walrus', 'seal'] },
    { key: 'owl', match: ['owl', 'falcon', 'penguin', 'doctorwho', 'spock', 'kirk'] },
    { key: 'pikachu', match: ['pikachu', 'spark', 'plasma', 'lightning', 'sonic', 'turbo', 'blitz'] },
    { key: 'gandalf', match: ['gandalf', 'wizard', 'frodo', 'aragorn', 'legolas', 'howl', 'calcifer', 'edward', 'gojo'] },
    { key: 'star', match: ['star', 'cosmic', 'astral', 'orbit', 'galaxy', 'luke', 'yoda', 'grogu', 'mandalorian', 'neo', 'morpheus'] },
    { key: 'shield', match: ['shield', 'knight', 'blade', 'katana', 'saber', 'zoro', 'levi', 'eren', 'geralt', 'tanjiro'] },
    { key: 'crystal', match: ['crystal', 'cookie', 'gem', 'relic', 'amulet', 'chalice', 'matrix', 'prism', 'orb', 'tome'] },
  ];

  for (const m of motifs) {
    if (m.match.some((keyword) => clean.includes(keyword))) {
      return m.key;
    }
  }

  // Fallback to deterministic pseudo-random motif if no keyword matched
  const allMotifs = ['wolf', 'fox', 'dragon', 'totoro', 'capybara', 'owl', 'pikachu', 'gandalf', 'star', 'shield', 'crystal', 'default'];
  return allMotifs[hash % allMotifs.length];
}

// Pick palette based on adjective keywords or hash
function selectPalette(name: string, hash: number): Palette {
  const clean = name.toLowerCase();
  for (const [adj, paletteKey] of Object.entries(ADJECTIVE_MAP)) {
    if (clean.includes(adj)) {
      const found = PALETTES.find((p) => p.name === paletteKey);
      if (found) return found;
    }
  }
  return PALETTES[hash % PALETTES.length];
}

export function UserAvatar({
  name,
  size = 32,
  className,
  alt,
}: UserAvatarProps) {
  const id = useId().replace(/:/g, '');
  const effectiveName = (name && name.trim()) || 'anonymous-user';
  const hash = hashString(effectiveName);
  const palette = selectPalette(effectiveName, hash);
  const motif = detectMotif(effectiveName, hash);

  const gradId = `av-grad-${id}`;
  const auraId = `av-aura-${id}`;

  return (
    <div
      className={clsx(
        'relative inline-flex items-center justify-center shrink-0 rounded-full overflow-hidden select-none',
        'border border-[var(--av-border-control)]/70 shadow-sm bg-[var(--av-surface)] transition-transform hover:scale-105',
        className
      )}
      style={{ width: size, height: size }}
      role="img"
      aria-label={alt || `Аватар пользователя ${effectiveName}`}
      title={effectiveName}
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={palette.bgGradient[0]} />
            <stop offset="100%" stopColor={palette.bgGradient[1]} />
          </linearGradient>
          <radialGradient id={auraId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={palette.glow} stopOpacity="0.25" />
            <stop offset="100%" stopColor={palette.glow} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Dynamic Background Base */}
        <rect width="100" height="100" rx="50" fill={`url(#${gradId})`} />

        {/* Ambient Glow Aura */}
        <circle cx="50" cy="50" r="46" fill={`url(#${auraId})`} />

        {/* Subtle Constellation Star Dust (Deterministic positions from hash) */}
        <circle cx={20 + (hash % 15)} cy={25 + ((hash >> 2) % 15)} r="1.5" fill={palette.glow} fillOpacity="0.6" />
        <circle cx={75 - ((hash >> 4) % 15)} cy={30 + ((hash >> 3) % 15)} r="1.2" fill={palette.accent} fillOpacity="0.5" />
        <circle cx={25 + ((hash >> 5) % 15)} cy={75 - ((hash >> 2) % 15)} r="1.2" fill={palette.accent} fillOpacity="0.5" />
        <circle cx={70 - ((hash >> 6) % 15)} cy={70 - ((hash >> 4) % 15)} r="1.5" fill={palette.glow} fillOpacity="0.6" />

        {/* Outer Ring Accent */}
        <circle
          cx="50"
          cy="50"
          r="48"
          fill="none"
          stroke={palette.glow}
          strokeOpacity="0.3"
          strokeWidth="1.5"
        />

        {/* Center Dynamic Emblem */}
        {renderEmblem(motif, palette.primary, palette.glow, palette.accent)}
      </svg>
    </div>
  );
}
