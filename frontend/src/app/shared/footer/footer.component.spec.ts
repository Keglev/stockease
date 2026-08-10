import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';

import { HealthProbe, HealthService } from '../../core/health/health.service';
import { LanguageService } from '../../core/i18n/language.service';
import { provideTestTranslations } from '../../testing/i18n-testing';
import { FooterComponent } from './footer.component';

const TRANSLATIONS = {
  en: {
    common: { appName: 'Bestandskontrolle' },
    footer: {
      tagline: 'Inventory management demo',
      repository: 'Repository',
      documentation: 'Documentation',
      apiDown: 'API unavailable',
      apiLatency: 'API {{ms}} ms'
    }
  }
};

class HealthServiceStub {
  calls = 0;
  probe: HealthProbe = { up: true, latencyMs: 42 };

  check(): Observable<HealthProbe> {
    this.calls += 1;
    return of(this.probe);
  }
}

/*
 * The footer's own health poll: it shows the measured latency when the probe is up, an unavailable label
 * when it is down, re-probes on its interval, and stops polling on destroy.
 * Out of scope: what the probe itself does with a failure - health.service.spec.ts.
 */
describe('FooterComponent', () => {
  let fixture: ComponentFixture<FooterComponent>;
  let health: HealthServiceStub;

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function textOf(selector: string): string {
    return host().querySelector(selector)?.textContent?.trim() ?? '';
  }

  /*
   * The app is zoneless, so fakeAsync is unavailable and vitest's timers stand in for the
   * poll's rxjs timer. They must be faked before the component subscribes.
   */
  async function render(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [FooterComponent],
      providers: [
        provideTestTranslations(TRANSLATIONS),
        { provide: HealthService, useValue: health }
      ]
    }).compileComponents();

    TestBed.inject(LanguageService).initialize().subscribe();

    fixture = TestBed.createComponent(FooterComponent);
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.resetTestingModule();
    health = new HealthServiceStub();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('render_anyState_showsProductNameAndTagline', async () => {
    await render();

    expect(textOf('.footer-name')).toBe('Bestandskontrolle');
    expect(textOf('.footer-tagline')).toBe('Inventory management demo');
  });

  it('render_anyState_linksToRepositoryAndDocumentation', async () => {
    await render();

    const repository = host().querySelector('.footer-repository');
    const documentation = host().querySelector('.footer-documentation');
    expect(repository?.getAttribute('href')).toBe('https://github.com/Keglev/stockease');
    expect(documentation?.getAttribute('href')).toBe('https://keglev.github.io/stockease/');
    expect(repository?.getAttribute('rel')).toBe('noopener');
    expect(documentation?.getAttribute('target')).toBe('_blank');
  });

  it('healthIndicator_probeUp_showsMeasuredLatency', async () => {
    await render();

    expect(textOf('.footer-latency')).toBe('API 42 ms');
    expect(host().querySelector('.footer-dot-up')).not.toBeNull();
  });

  it('healthIndicator_probeDown_showsUnavailableLabel', async () => {
    health.probe = { up: false, latencyMs: 5000 };
    await render();

    expect(textOf('.footer-down')).toBe('API unavailable');
    expect(host().querySelector('.footer-dot-up')).toBeNull();
  });

  it('healthIndicator_pollInterval_reprobesAndUpdates', async () => {
    await render();
    expect(health.calls).toBe(1);

    health.probe = { up: false, latencyMs: 0 };
    vi.advanceTimersByTime(30_000);
    fixture.detectChanges();

    expect(health.calls).toBe(2);
    expect(textOf('.footer-down')).toBe('API unavailable');
  });

  it('destroy_afterSubscribing_stopsPolling', async () => {
    await render();

    fixture.destroy();
    vi.advanceTimersByTime(60_000);

    // takeUntilDestroyed must end the stream, or every navigation would leak a poller.
    expect(health.calls).toBe(1);
  });
});
