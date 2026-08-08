import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Root component: renders the routed view and nothing else. Chrome, navigation and layout belong
 * to the shell behind the authenticated routes, so nothing above the router outlet lives here.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {}
