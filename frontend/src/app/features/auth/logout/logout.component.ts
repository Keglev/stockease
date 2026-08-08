import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { FooterComponent } from '../../../shared/footer/footer.component';
import { PublicHeaderComponent } from '../../../shared/public-header/public-header.component';

/**
 * Confirms a signed-out session and offers the way back in. It holds no state and performs no
 * request: signing out has already happened by the time this route is reached, so the page exists
 * to say so rather than to do it.
 */
@Component({
  selector: 'app-logout',
  imports: [
    FooterComponent,
    PublicHeaderComponent,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    RouterLink,
    TranslatePipe
  ],
  templateUrl: './logout.component.html',
  styleUrl: './logout.component.scss'
})
export class LogoutComponent {}
