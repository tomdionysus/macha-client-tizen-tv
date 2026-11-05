import { px, colour } from '../styles/theme';

export type PlayerIconName =
  | 'back'
  | 'previous'
  | 'rewind'
  | 'play'
  | 'pause'
  | 'forward'
  | 'next'
  | 'options'
  | 'close'
  | 'restart'
  | 'volume'
  | 'mute';

/** The transport glyphs: the web client's `PlayerIcon` and `PlaybackIcons` path data. */
export function PlayerIcon({
  name,
  // `<svg width="20" height="20">` on the web; CSS px, so through `px()`.
  size = px(20),
  color = colour.heading,
}: {
  name: PlayerIconName;
  size?: number;
  color?: string;
}): React.JSX.Element {
  const stroke = { stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  switch (name) {
    case 'back':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M14.5 5 7.5 12l7 7M8 12h9" {...stroke} />
        </svg>
      );
    case 'previous':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M6 5h2v14H6V5Zm12 1-8 6 8 6V6Z" fill={color} />
        </svg>
      );
    case 'rewind':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M10.5 6 4.5 12l6 6V6Zm8 0-6 6 6 6V6Z" fill={color} />
        </svg>
      );
    case 'play':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M8 5.2v13.6L19 12 8 5.2Z" fill={color} />
        </svg>
      );
    case 'pause':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M7.5 6h3v12h-3V6Zm6 0h3v12h-3V6Z" fill={color} />
        </svg>
      );
    case 'forward':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="m13.5 6 6 6-6 6V6Zm-8 0 6 6-6 6V6Z" fill={color} />
        </svg>
      );
    case 'next':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M16 5h2v14h-2V5ZM6 6l8 6-8 6V6Z" fill={color} />
        </svg>
      );
    case 'options':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <circle cx={6} cy={12} r={1.5} fill={color} />
          <circle cx={12} cy={12} r={1.5} fill={color} />
          <circle cx={18} cy={12} r={1.5} fill={color} />
        </svg>
      );
    case 'close':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="m6 6 12 12M18 6 6 18" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
        </svg>
      );
    case 'restart':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M7.1 7.2H3.7V3.8" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 7.1A8.2 8.2 0 1 1 3.9 17" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
          <path d="M10 8.2v7.6l6-3.8-6-3.8Z" fill={color} />
        </svg>
      );
    case 'volume':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M4 10v4h3l4 3V7l-4 3H4Z" fill={color} />
          <path d="M14 9.2a4 4 0 0 1 0 5.6M16.6 6.8a7.3 7.3 0 0 1 0 10.4" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
        </svg>
      );
    case 'mute':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M4 10v4h3l4 3V7l-4 3H4Z" fill={color} />
          <path d="m15 9 5 6M20 9l-5 6" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
        </svg>
      );
  }
}
