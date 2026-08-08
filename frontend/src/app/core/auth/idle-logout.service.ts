import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, filter } from 'rxjs';

import { AuthService } from './auth.service';

/**
 * How long a session survives without any sign of the user.
 *
 * <p>A product ruling, deliberately fixed rather than user-configurable: a preference that lets a
 * reader extend their own idle window is a preference that will be set to "never". ADR 032 records
 * the decision and why the timeout lives on the client at all.
 */
export const IDLE_TIMEOUT_MS = 30 * 60_000;

/**
 * How long before the logout the warning appears.
 *
 * <p>Also a ruling, and long enough to be a warning rather than a formality: two minutes is time
 * to finish a sentence and click, not a notice that flashes as the session ends.
 */
export const IDLE_WARNING_MS = 2 * 60_000;

/** Activity that counts. Pointer, keyboard, touch and wheel cover every way a page gets used. */
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'wheel'] as const;

/**
 * The shortest gap between two re-arms.
 *
 * <p>Without it a scroll gesture would tear down and rebuild the timers on every wheel tick. The
 * cost is that activity in the last second before a deadline may not register, which against a
 * thirty-minute window is not a distinction worth paying for.
 */
const REARM_THROTTLE_MS = 1_000;

/**
 * Signs a walked-away user out, and warns them first.
 *
 * @remarks
 * Client-side because the server cannot see activity: with a single non-refreshing token
 * (ADR 032) there is no round trip to observe, so a token valid for another nine hours stays valid
 * on an unattended screen no matter what the backend does. The timer closes that window.
 *
 * The logout lands on exactly the destination the 401 interceptor uses - `/login` with
 * `reason=expired` - so an idle expiry and a server-side expiry are one tested experience rather
 * than two that drift.
 */
@Injectable({ providedIn: 'root' })
export class IdleLogoutService {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);

  private warningTimer: ReturnType<typeof setTimeout> | null = null;
  private logoutTimer: ReturnType<typeof setTimeout> | null = null;
  private navigation: Subscription | null = null;
  private lastRearm = 0;
  private running = false;

  private readonly warning = signal(false);

  /** True while the warning is on screen; the shell watches this to raise its snackbar. */
  readonly warningActive = this.warning.asReadonly();

  /** Arms the timers and starts listening. Idempotent, so a re-entered shell cannot double-arm. */
  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    for (const event of ACTIVITY_EVENTS) {
      this.document.addEventListener(event, this.onActivity, { passive: true });
    }
    // A route change is activity even when it came from a click this service already saw; it is
    // also the only signal on a page driven entirely by keyboard-free navigation.
    this.navigation = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.rearm());
    this.arm();
  }

  /** Disarms and unsubscribes. After this the service holds no timers and no listeners. */
  stop(): void {
    this.running = false;
    this.clearTimers();
    this.warning.set(false);
    for (const event of ACTIVITY_EVENTS) {
      this.document.removeEventListener(event, this.onActivity);
    }
    this.navigation?.unsubscribe();
    this.navigation = null;
    this.lastRearm = 0;
  }

  /**
   * Treats the moment as activity: full re-arm and the warning, if showing, withdrawn.
   *
   * <p>Public because the snackbar's "Stay signed in" action is activity that produces no DOM
   * event this service listens for - the click lands inside the overlay, and dismissing it is the
   * whole point of pressing it.
   */
  notifyActivity(): void {
    if (!this.running) {
      return;
    }
    this.lastRearm = Date.now();
    this.arm();
  }

  // An arrow property, so removeEventListener sees the same reference addEventListener was given;
  // a bound method would be a new function each call and the listeners would never come off.
  private readonly onActivity = (): void => this.rearm();

  private rearm(): void {
    if (!this.running) {
      return;
    }
    const now = Date.now();
    // Throttled, except while the warning is up: there the whole point of the click is to clear it,
    // and a throttle that swallowed it would leave the reader staring at a warning they answered.
    if (!this.warning() && now - this.lastRearm < REARM_THROTTLE_MS) {
      return;
    }
    this.lastRearm = now;
    this.arm();
  }

  private arm(): void {
    this.clearTimers();
    this.warning.set(false);
    this.warningTimer = setTimeout(() => this.warning.set(true), IDLE_TIMEOUT_MS - IDLE_WARNING_MS);
    this.logoutTimer = setTimeout(() => this.expire(), IDLE_TIMEOUT_MS);
  }

  private clearTimers(): void {
    if (this.warningTimer !== null) {
      clearTimeout(this.warningTimer);
      this.warningTimer = null;
    }
    if (this.logoutTimer !== null) {
      clearTimeout(this.logoutTimer);
      this.logoutTimer = null;
    }
  }

  private expire(): void {
    this.stop();
    this.auth.logout();
    void this.router.navigate(['/login'], { queryParams: { reason: 'expired' } });
  }
}
