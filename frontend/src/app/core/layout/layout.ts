/**
 * The one layout boundary the app has to observe from TypeScript rather than match in CSS, because
 * the sidenav mode and the chart heights are component inputs, not styles. It mirrors the
 * `desktop` tier in src/styles/_breakpoints.scss, which is the single source of truth for the
 * tier values; changing it there means changing it here too.
 */
export const DESKTOP_MEDIA_QUERY = '(min-width: 1024px)';
