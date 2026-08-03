import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { FooterComponent } from '../../../shared/footer/footer.component';
import { PublicHeaderComponent } from '../../../shared/public-header/public-header.component';

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
