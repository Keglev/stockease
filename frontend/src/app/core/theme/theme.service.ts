import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

export const THEME_MODES = ['light', 'dark'] as const;

type ThemeMode = (typeof THEME_MODES)[number];

export const THEME_STORAGE_KEY = 'stockease.theme';

const FALLBACK_THEME: ThemeMode = 'light';

const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);

  private readonly current = signal<ThemeMode>(FALLBACK_THEME);

  readonly currentTheme = this.current.asReadonly();

  /** Applies the resolved theme at startup so the first render is already correct. */
  initialize(): void {
    this.setTheme(this.resolveInitialTheme());
  }

  /** Unsupported values are ignored rather than silently resetting the user's choice. */
  setTheme(mode: string): void {
    const supported = this.toSupported(mode);
    if (!supported) {
      return;
    }
    // Material emits every system colour as light-dark(), so setting the root
    // color-scheme is all that is needed to repaint the whole app.
    this.document.documentElement.style.colorScheme = supported;
    this.persist(supported);
    this.current.set(supported);
  }

  toggle(): void {
    this.setTheme(this.current() === 'dark' ? 'light' : 'dark');
  }

  private resolveInitialTheme(): ThemeMode {
    const stored = this.toSupported(this.readStored());
    if (stored) {
      return stored;
    }
    return this.prefersDark() ? 'dark' : FALLBACK_THEME;
  }

  private prefersDark(): boolean {
    try {
      return this.document.defaultView?.matchMedia(DARK_MEDIA_QUERY).matches ?? false;
    } catch {
      // matchMedia is unavailable in some non-browser rendering targets.
      return false;
    }
  }

  private toSupported(mode: string | null | undefined): ThemeMode | null {
    return THEME_MODES.includes(mode as ThemeMode) ? (mode as ThemeMode) : null;
  }

  private readStored(): string | null {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  private persist(mode: ThemeMode): void {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // Storage can be unavailable (private mode); the in-memory choice still applies.
    }
  }
}
