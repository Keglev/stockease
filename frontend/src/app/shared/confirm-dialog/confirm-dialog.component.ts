import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';

export interface ConfirmDialogData {
  titleKey: string;
  messageKey: string;
  messageParams?: Record<string, unknown>;
}

/** Generic confirmation dialog; callers supply translation keys, nothing domain-specific lives here. */
@Component({
  selector: 'app-confirm-dialog',
  imports: [MatButtonModule, MatDialogModule, TranslatePipe],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss'
})
export class ConfirmDialogComponent {
  private readonly dialogRef = inject<MatDialogRef<ConfirmDialogComponent, boolean>>(MatDialogRef);

  protected readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);

  protected confirm(): void {
    this.dialogRef.close(true);
  }

  protected cancel(): void {
    this.dialogRef.close(false);
  }
}
