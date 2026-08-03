import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatListModule } from '@angular/material/list';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { map } from 'rxjs';

import { LanguageService } from '../../core/i18n/language.service';
import { DESKTOP_MEDIA_QUERY } from '../../core/layout/layout';
import { HELP_TOPICS as HELP_TOPICS_DE } from './help-content.de';
import { HELP_TOPICS as HELP_TOPICS_EN } from './help-content.en';
import { DEFAULT_HELP_TOPIC, HelpTopic, HelpTopicId, helpTopicTitleKey } from './help-content.types';

/**
 * The in-app manual: eight topics of prose, one on screen at a time, addressed by the route.
 *
 * <p>The URL is the single source of truth for which topic is open. Both pickers - the desktop nav
 * list and the select below it - navigate rather than setting local state, so the back button works
 * across topics and a topic can be linked to or bookmarked.
 *
 * <p>The prose itself is not in the translation files. It lives in two typed modules beside this
 * one, loaded with this route rather than eagerly at startup; ADR 029 records why. Only the topic
 * titles go through ngx-translate, because the nav has to read in the current language whether or
 * not the body has been rendered yet.
 */
@Component({
  selector: 'app-help',
  imports: [
    MatFormFieldModule,
    MatListModule,
    MatSelectModule,
    RouterLink,
    RouterLinkActive,
    TranslatePipe
  ],
  templateUrl: './help.component.html',
  styleUrl: './help.component.scss'
})
export class HelpComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly language = inject(LanguageService);
  private readonly breakpoints = inject(BreakpointObserver);

  // Seeded from isMatched rather than a default, so the first paint already picks the right control
  // instead of rendering the select and then swapping it for the nav - the shell does the same.
  protected readonly isDesktop = signal(this.breakpoints.isMatched(DESKTOP_MEDIA_QUERY));

  /** The requested topic, whatever it is; validity is decided below. */
  private readonly requestedTopic = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('topic'))),
    { initialValue: null }
  );

  /**
   * The prose for the active language.
   *
   * <p>Both modules are imported statically and travel in this route's chunk, so switching language
   * swaps an already-loaded array rather than fetching anything - the page rewrites itself with no
   * reload and no request.
   */
  protected readonly topics = computed<readonly HelpTopic[]>(() =>
    this.language.currentLang() === 'de' ? HELP_TOPICS_DE : HELP_TOPICS_EN
  );

  /** Nav entries: the id the route uses, and the key that renders it in the current language. */
  protected readonly navTopics = computed(() =>
    this.topics().map((topic) => ({ id: topic.id, titleKey: helpTopicTitleKey(topic.id) }))
  );

  /** The active topic id, or null when the URL names one that does not exist. */
  protected readonly topicId = computed<HelpTopicId | null>(() => {
    const requested = this.requestedTopic();
    return this.topics().some((topic) => topic.id === requested)
      ? (requested as HelpTopicId)
      : null;
  });

  protected readonly topic = computed(
    () => this.topics().find((candidate) => candidate.id === this.topicId()) ?? null
  );

  protected readonly titleKey = computed(() => {
    const id = this.topicId();
    return id === null ? 'help.title' : helpTopicTitleKey(id);
  });

  constructor() {
    this.breakpoints
      .observe(DESKTOP_MEDIA_QUERY)
      .pipe(takeUntilDestroyed())
      .subscribe((state) => this.isDesktop.set(state.matches));

    // An unrecognised topic is corrected in the URL rather than rendered as an empty page, and
    // replaceUrl keeps the bad address out of the history - going back from the overview should
    // return to wherever the reader came from, not to the address that bounced them here.
    effect(() => {
      if (this.requestedTopic() !== null && this.topicId() === null) {
        void this.router.navigate(['/app/help', DEFAULT_HELP_TOPIC], { replaceUrl: true });
      }
    });
  }

  /** Navigates rather than assigning: the URL, not this component, decides what is on screen. */
  protected selectTopic(id: HelpTopicId): void {
    void this.router.navigate(['/app/help', id]);
  }
}
