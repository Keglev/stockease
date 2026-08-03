import { HELP_TOPICS as DE } from './help-content.de';
import { HELP_TOPICS as EN } from './help-content.en';
import { HelpSection, HelpTopic } from './help-content.types';

/**
 * The parity guarantee the translation files get from CI, applied to the prose modules instead.
 *
 * <p>Nothing outside this spec checks that the two languages describe the same product: the shared
 * types force the shape, but only these assertions force the same topics, in the same order, with
 * the same sections in each - which is what a reader switching language actually experiences.
 */
describe('helpContent', () => {
  const sectionIds = (topic: HelpTopic): string[] => topic.sections.map((section) => section.id);

  const everySection = (topics: readonly HelpTopic[]): HelpSection[] =>
    topics.flatMap((topic) => topic.sections);

  it('topics_bothLanguages_declareTheSameIdsInTheSameOrder', () => {
    // Order matters as much as membership: the nav renders in array order, so a reordered German
    // module would silently give the two languages different manuals.
    expect(DE.map((topic) => topic.id)).toEqual(EN.map((topic) => topic.id));
  });

  it('topics_bothLanguages_declareTheEightRuledTopics', () => {
    expect(EN.map((topic) => topic.id)).toEqual([
      'overview',
      'products',
      'invoices',
      'movements',
      'reports',
      'partners',
      'demo',
      'language-theme'
    ]);
  });

  it('sections_bothLanguages_declareTheSameIdsPerTopic', () => {
    const byLanguage = EN.map((topic, index) => [sectionIds(topic), sectionIds(DE[index])]);

    for (const [en, de] of byLanguage) {
      expect(de).toEqual(en);
    }
  });

  it.each([
    ['en', EN],
    ['de', DE]
  ])('headings_%sModule_areAllNonEmpty', (_language, topics) => {
    const headings = everySection(topics).map((section) => section.heading.trim());

    expect(headings.length).toBeGreaterThan(0);
    expect(headings.every((heading) => heading.length > 0)).toBe(true);
  });

  it.each([
    ['en', EN],
    ['de', DE]
  ])('paragraphs_%sModule_areAllPresentAndNonEmpty', (_language, topics) => {
    const sections = everySection(topics);

    // A section with no prose is a heading promising something the page does not deliver.
    expect(sections.every((section) => section.paragraphs.length > 0)).toBe(true);
    expect(
      sections.every((section) => section.paragraphs.every((text) => text.trim().length > 0))
    ).toBe(true);
  });

  it.each([
    ['en', EN],
    ['de', DE]
  ])('bullets_%sModuleWherePresent_areNonEmpty', (_language, topics) => {
    const lists = everySection(topics)
      .map((section) => section.bullets)
      .filter((bullets): bullets is readonly string[] => bullets !== undefined);

    // Optional, so absence is fine - but an empty or blank list renders an empty <ul>.
    expect(lists.every((bullets) => bullets.length > 0)).toBe(true);
    expect(lists.every((bullets) => bullets.every((text) => text.trim().length > 0))).toBe(true);
  });
});
