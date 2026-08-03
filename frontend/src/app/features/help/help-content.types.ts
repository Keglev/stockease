/**
 * The eight help topics, in the order the nav lists them.
 *
 * <p>A union rather than a string, because these ids are the route's `:topic` values, the keys of
 * the `help.topics.*` translations and the identity both language modules are checked against. A
 * typo in any one of the three would otherwise surface as an empty page rather than a build error.
 */
export type HelpTopicId =
  | 'overview'
  | 'products'
  | 'invoices'
  | 'movements'
  | 'reports'
  | 'partners'
  | 'demo'
  | 'language-theme';

/** A run of prose under one heading. */
export interface HelpSection {
  /** Stable across languages: the parity spec pairs EN and DE sections by this. */
  readonly id: string;
  readonly heading: string;
  readonly paragraphs: readonly string[];
  readonly bullets?: readonly string[];
}

/** One topic's whole body. The title is not here - it comes from `help.topics.<id>`. */
export interface HelpTopic {
  readonly id: HelpTopicId;
  readonly sections: readonly HelpSection[];
}

/** Route segment a bare or unrecognised topic falls back to. */
export const DEFAULT_HELP_TOPIC: HelpTopicId = 'overview';

/** The `help.topics.*` key for a topic; the hyphenated id is not a legal key path segment. */
export function helpTopicTitleKey(id: HelpTopicId): string {
  return id === 'language-theme' ? 'help.topics.languageTheme' : `help.topics.${id}`;
}
