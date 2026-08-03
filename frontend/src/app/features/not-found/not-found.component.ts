import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { FooterComponent } from '../../shared/footer/footer.component';
import { PublicHeaderComponent } from '../../shared/public-header/public-header.component';

/**
 * Rendered by the wildcard route for any URL the router cannot match. It stands outside the
 * authenticated shell, because an unmatched URL says nothing about whether a session exists.
 */
@Component({
  selector: 'app-not-found',
  imports: [
    FooterComponent,
    PublicHeaderComponent,
    MatButtonModule,
    MatCardModule,
    RouterLink,
    TranslatePipe
  ],
  templateUrl: './not-found.component.html',
  styleUrl: './not-found.component.scss'
})
export class NotFoundComponent {}
