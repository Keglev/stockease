import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * Placeholder behind the sidebar's Help entry, rendering nothing but the page title. It exists so
 * the link resolves inside the shell instead of falling through to the not-found page, and a later
 * change fills it with the topic-based help system.
 */
@Component({
  selector: 'app-help',
  imports: [TranslatePipe],
  templateUrl: './help.component.html',
  styleUrl: './help.component.scss'
})
export class HelpComponent {}
