import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { switchMap, timer } from 'rxjs';

import { HealthProbe, HealthService } from '../../core/health/health.service';

const HEALTH_POLL_MS = 30_000;

/**
 * Application footer for the authenticated shell: product identity, outward links and a compact
 * API health indicator. It polls health on its own timer because it is on screen everywhere,
 * where the dashboard's health card exists on one page only.
 */
@Component({
  selector: 'app-footer',
  imports: [TranslatePipe],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss'
})
export class FooterComponent {
  private readonly health = inject(HealthService);

  // Same URLs the landing page publishes; both open in a new tab so the session is never lost.
  protected readonly repositoryUrl = 'https://github.com/Keglev/stockease';
  protected readonly documentationUrl = 'https://keglev.github.io/stockease/';

  protected readonly probe = signal<HealthProbe | null>(null);

  constructor() {
    // The dashboard card and this indicator deliberately share the service, not the
    // subscription: the footer must keep probing on every page, and a subscription owned by
    // the dashboard would stop the moment the user navigated away from it.
    timer(0, HEALTH_POLL_MS)
      .pipe(
        switchMap(() => this.health.check()),
        takeUntilDestroyed()
      )
      .subscribe((probe) => this.probe.set(probe));
  }
}
