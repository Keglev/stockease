import { InjectionToken } from '@angular/core';

import { environment } from '../../../environments/environment';

/**
 * Whether this deployment is the public demo, as opposed to a fact about the signed-in user.
 * Only presentation depends on it; nothing in the auth or authorization path reads it.
 */
// Injected rather than imported straight into the template path, for the same reason CHART_ENGINE
// is: an environment import is fixed at module load, so a spec could only ever assert the value the
// build happened to compile in. The seam is what lets the shell spec pin both directions.
export const DEMO_MODE = new InjectionToken<boolean>('DEMO_MODE', {
  providedIn: 'root',
  factory: () => environment.demo
});
