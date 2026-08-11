import { Component, input, output } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * The windows the period toggles offer. One type for all five tabs that have one - profit, cash
 * flow, losses, changes and analytics: they present the same choices, and only the date each tab's
 * endpoint compares against differs, such as payment dates for cash flow against booking dates for
 * profit.
 */
export type ReportPeriod = 'd30' | 'd90' | 'd180' | 'year' | 'all';

/**
 * The window presets a periodic report tab offers.
 *
 * @remarks
 * Presentational. It renders the five presets and announces the one that was picked; whether that
 * is a reason to go back to the server stays with the tab, whose handler still decides.
 *
 * The emission is passed on exactly as the group made it, including the valueless one the group
 * fires while it is being created. Filtering that here would move a guard away from the decision
 * it guards, and every tab's handler already rejects it.
 */
@Component({
  selector: 'app-period-toggle',
  imports: [MatButtonToggleModule, TranslatePipe],
  templateUrl: './period-toggle.component.html',
  styleUrl: './period-toggle.component.scss'
})
export class PeriodToggleComponent {
  readonly value = input.required<ReportPeriod>();

  readonly selected = output<ReportPeriod>();
}
