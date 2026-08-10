import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { AuthService } from './auth.service';
import { IDLE_TIMEOUT_MS, IDLE_WARNING_MS, IdleLogoutService } from './idle-logout.service';

/* When the warning is due: the quiet stretch before the last two minutes. */
const WARNING_AT_MS = IDLE_TIMEOUT_MS - IDLE_WARNING_MS;

class AuthServiceStub {
  logouts = 0;

  logout(): void {
    this.logouts++;
  }
}

/*
 * The idle window: silence for the full window signs out to the expired login, activity re-arms it,
 * and the warning fires at its own point and is cleared by activity. Also that the timers are
 * throttled, and that starting twice arms one window rather than two.
 * Out of scope: what the shell does with the warning - shell.component.spec.ts.
 */
describe('IdleLogoutService', () => {
  let idle: IdleLogoutService;
  let auth: AuthServiceStub;
  let navigate: ReturnType<typeof vi.spyOn>;

  function setUp(): void {
    TestBed.resetTestingModule();
    auth = new AuthServiceStub();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }]
    });
    idle = TestBed.inject(IdleLogoutService);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  }

  // The app is zoneless, so Angular's fakeAsync/tick are unavailable; vitest's timers are the
// established stand-in here, as dashboard.component.spec.ts records. Date is faked with them
  // because the re-arm throttle reads Date.now() and would otherwise never see time pass.
  beforeEach(() => {
    vi.useFakeTimers();
    setUp();
  });

  afterEach(() => {
    idle.stop();
    vi.useRealTimers();
  });

  /* Real user activity, as the document sees it. */
  function activity(type = 'mousedown'): void {
    document.dispatchEvent(new Event(type));
  }

  it('start_idleForTheWholeWindow_logsOutAndSendsToLoginAsExpired', () => {
    idle.start();

    vi.advanceTimersByTime(IDLE_TIMEOUT_MS);

    expect(auth.logouts).toBe(1);
    // Byte-identical to the 401 interceptor's destination: one expiry experience, not two.
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { reason: 'expired' } });
  });

  it('start_activityBeforeTheDeadline_rearmsTheFullWindow', () => {
    idle.start();

    vi.advanceTimersByTime(WARNING_AT_MS - 60_000);
    activity();
    vi.advanceTimersByTime(WARNING_AT_MS - 60_000);

    // Two stretches that each fall short of the window, so only a reset explains no logout.
    expect(auth.logouts).toBe(0);
    idle.stop();
  });

  it('start_activityThenSilence_stillLogsOutAtTheFullWindow', () => {
    idle.start();
    vi.advanceTimersByTime(WARNING_AT_MS - 60_000);
    activity();

    vi.advanceTimersByTime(IDLE_TIMEOUT_MS);

    expect(auth.logouts).toBe(1);
  });

  it('start_quietUntilTheWarningPoint_raisesTheWarning', () => {
    idle.start();

    vi.advanceTimersByTime(WARNING_AT_MS);

    expect(idle.warningActive()).toBe(true);
    expect(auth.logouts).toBe(0);
    idle.stop();
  });

  it('warning_activityDuringIt_clearsItAndRearms', () => {
    idle.start();
    vi.advanceTimersByTime(WARNING_AT_MS);
    expect(idle.warningActive()).toBe(true);

    activity();

    expect(idle.warningActive()).toBe(false);
    vi.advanceTimersByTime(WARNING_AT_MS);
    // The warning comes back only because the full window restarted, and no logout happened.
    expect(idle.warningActive()).toBe(true);
    expect(auth.logouts).toBe(0);
    idle.stop();
  });

  it('warning_ignored_logsOutAtTheDeadline', () => {
    idle.start();
    vi.advanceTimersByTime(WARNING_AT_MS);

    vi.advanceTimersByTime(IDLE_WARNING_MS);

    expect(auth.logouts).toBe(1);
    // The warning is withdrawn as the session ends rather than outliving it.
    expect(idle.warningActive()).toBe(false);
  });

  it('notifyActivity_duringWarning_clearsItAndRearms', () => {
    idle.start();
    vi.advanceTimersByTime(WARNING_AT_MS);

    // What the snackbar's action calls: a click inside the overlay raises no document event.
    idle.notifyActivity();

    expect(idle.warningActive()).toBe(false);
    vi.advanceTimersByTime(IDLE_WARNING_MS);
    expect(auth.logouts).toBe(0);
    idle.stop();
  });

  it('stop_beforeTheDeadline_preventsTheLogout', () => {
    idle.start();

    idle.stop();
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS);

    expect(auth.logouts).toBe(0);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('stop_thenActivity_doesNotRearmOrFire', () => {
    idle.start();
    idle.stop();

    activity();
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS);

    // The listeners are off, so a stray event cannot bring a stopped timer back to life.
    expect(auth.logouts).toBe(0);
  });

  it.each(['keydown', 'touchstart', 'wheel'])('start_%s_countsAsActivity', (type) => {
    idle.start();
    vi.advanceTimersByTime(WARNING_AT_MS);

    activity(type);

    expect(idle.warningActive()).toBe(false);
    idle.stop();
  });

  it('start_rapidActivity_isThrottledToOneRearmPerSecond', () => {
    idle.start();
    vi.advanceTimersByTime(10_000);

    // Two events inside one second: the second is swallowed, so the window still dates from the
    // first and the logout lands a full timeout after it rather than after the second.
    activity();
    vi.advanceTimersByTime(500);
    activity();
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS - 500);

    expect(auth.logouts).toBe(1);
  });

  it('start_calledTwice_armsOnlyOneWindow', () => {
    idle.start();
    idle.start();

    vi.advanceTimersByTime(IDLE_TIMEOUT_MS);

    // A re-entered shell must not stack timers; one logout, not two.
    expect(auth.logouts).toBe(1);
  });
});
