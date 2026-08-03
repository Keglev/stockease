import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../core/interceptors/error.interceptor';
import { FooterComponent } from '../../../shared/footer/footer.component';
import { PublicHeaderComponent } from '../../../shared/public-header/public-header.component';

@Component({
  selector: 'app-login',
  imports: [
    FooterComponent,
    PublicHeaderComponent,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    RouterLink,
    TranslatePipe
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly pending = signal(false);

  // Two signals rather than one string: a translated failure has to stay translated when the
  // visitor switches language mid-page, which only a live key in the template achieves.
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly errorKey = signal<string | null>(null);

  protected readonly passwordVisible = signal(false);

  // Read once at construction: the interceptor redirects here with reason=expired, and the notice
  // explains a logout the user never asked for. It is not an error of theirs, so it renders as its
  // own line rather than through the error signals a failed attempt owns.
  protected readonly sessionExpired =
    inject(ActivatedRoute).snapshot.queryParamMap.get('reason') === 'expired';

  protected readonly form = inject(FormBuilder).nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required]
  });

  protected submit(): void {
    if (this.form.invalid || this.pending()) {
      return;
    }
    this.pending.set(true);
    this.errorMessage.set(null);
    this.errorKey.set(null);

    const { username, password } = this.form.getRawValue();
    this.auth.login(username, password).subscribe({
      next: () => {
        this.pending.set(false);
        void this.router.navigate(['/app']);
      },
      error: (error: Error) => {
        this.pending.set(false);
        // Backend messages are English by design. Known cases are translated here at the
        // consumer; unknown ones pass through honestly rather than being guessed at.
        const rejectedCredentials = error instanceof ApiError && error.status === 401;
        this.errorKey.set(rejectedCredentials ? 'login.invalidCredentials' : null);
        this.errorMessage.set(rejectedCredentials ? null : error.message);
      }
    });
  }

  /** Reveals or masks the password so a visitor can check what they typed. */
  protected togglePasswordVisibility(): void {
    this.passwordVisible.update((visible) => !visible);
  }
}
