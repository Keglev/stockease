/**
 * The layout boundaries the app has to observe from TypeScript rather than match in CSS, because
 * what they decide is structural - the sidenav mode, the chart heights, and which controls exist at
 * all - rather than how an element looks. Both mirror tiers in src/styles/_breakpoints.scss, which
 * is the single source of truth for the values; changing them there means changing them here too.
 */
export const DESKTOP_MEDIA_QUERY = '(min-width: 1024px)';

/**
 * The phone tier, mirroring `$phone-max`.
 *
 * <p>Observed rather than styled because a control hidden with `display: none` is still in the
 * document: it keeps its accessible name and stays reachable by a screen reader, which is the wrong
 * answer for a label that has been dropped because it does not fit.
 */
export const PHONE_MEDIA_QUERY = '(max-width: 599.98px)';
