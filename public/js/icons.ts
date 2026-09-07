/**
 * Inline SVG icon set for the whole UI.
 *
 * Emoji render differently on every OS (and not at all in some enterprise
 * fonts); these draw identically everywhere, inherit the theme color through
 * `currentColor`, and match the journal's hand-inked line weight. 20×20
 * viewBox, stroke-based, no fills — size them with CSS (`1em` next to text).
 */

const PATHS = {
  sword: '<path d="M14.5 3.5l2 2L7 15l-3 1 1-3 9.5-9.5zM12.5 5.5l2 2"/>',
  search: '<circle cx="8.5" cy="8.5" r="4"/><path d="M11.5 11.5L16 16"/>',
  chat: '<path d="M4 5a1 1 0 011-1h10a1 1 0 011 1v7a1 1 0 01-1 1H9l-3 3v-3H5a1 1 0 01-1-1V5z"/>',
  run: '<circle cx="11.5" cy="4" r="1.6"/><path d="M10.5 7.5L8 11l3 2v4M8 11l-3 .5M11 13l3 .5 1 3"/>',
  brain: '<path d="M10 4.5A2.5 2.5 0 007.5 3 2.7 2.7 0 005 5.6a2.5 2.5 0 00-1 4.4A2.6 2.6 0 005.5 15a2.4 2.4 0 004.5 1V4.5zM10 4.5A2.5 2.5 0 0112.5 3 2.7 2.7 0 0115 5.6a2.5 2.5 0 011 4.4A2.6 2.6 0 0114.5 15a2.4 2.4 0 01-4.5 1"/>',
  shield: '<path d="M10 3l6 2v5c0 4-3 6.5-6 7.5C7 16.5 4 14 4 10V5l6-2z"/>',
  potion: '<path d="M8 3h4M9 3v4l-3.5 7a3 3 0 003 4h3a3 3 0 003-4L11 7V3M6.2 12.5h7.6"/>',
  spellbook: '<path d="M5 3h9a2 2 0 012 2v12H7a2 2 0 00-2 2V3zM5 17a2 2 0 012-2M8.5 7l1 2 2 .3-1.5 1.4.4 2-1.9-1-1.9 1 .4-2L5.5 9.3l2-.3z"/>',
  dice: '<rect x="3" y="3" width="14" height="14" rx="3"/><circle cx="7" cy="7" r=".9"/><circle cx="13" cy="7" r=".9"/><circle cx="10" cy="10" r=".9"/><circle cx="7" cy="13" r=".9"/><circle cx="13" cy="13" r=".9"/>',
  candle: '<path d="M10 2c1.4 1.9 2 2.8 2 4a2 2 0 01-4 0c0-1.2.6-2.1 2-4zM10 7v2M7.5 9h5v8h-5z"/>',
  heart: '<path d="M10 17s-6-4.4-6-9a3.5 3.5 0 016-2.4A3.5 3.5 0 0116 8c0 4.6-6 9-6 9z"/>',
  gear: '<circle cx="10" cy="10" r="3"/><path d="M10 2v2.5M10 15.5V18M2 10h2.5M15.5 10H18M4.4 4.4l1.8 1.8M13.8 13.8l1.8 1.8M15.6 4.4l-1.8 1.8M6.2 13.8l-1.8 1.8"/>',
  dial: '<path d="M3 6h14M3 14h14"/><circle cx="7" cy="6" r="2"/><circle cx="13" cy="14" r="2"/>',
  backpack: '<rect x="5" y="7" width="10" height="10" rx="2"/><path d="M8 7V5a2 2 0 014 0v2M7.5 13h5"/>',
  scroll: '<path d="M6 3h10a2 2 0 012 2H8a2 2 0 00-2 2v9a2 2 0 01-2-2V5a2 2 0 012-2zM10 8h5M10 11.5h5"/>',
  "folder-open": '<path d="M3 6a1 1 0 011-1h4l2 2h6a1 1 0 011 1v1H3V6zM3 10h15l-2.2 6H5.2L3 10z"/>',
  trash: '<path d="M5 6h10l-1 11H6L5 6zM8 6V4h4v2M8.5 9.5v4M11.5 9.5v4"/>',
  flag: '<path d="M5 3v14M5 4h10l-2 3 2 3H5"/>',
  "arrow-right": '<path d="M4 10h11M11 6l4 4-4 4"/>',
} as const;

export type IconName = keyof typeof PATHS;
export const ICON_NAMES = Object.keys(PATHS) as IconName[];

/** Inline `<svg>` markup for `name`, sized by CSS, colored by `currentColor`. */
export function icon(name: IconName): string {
  return `<svg class="icon" viewBox="0 0 20 20" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name]}</svg>`;
}
