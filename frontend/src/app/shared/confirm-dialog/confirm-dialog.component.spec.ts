import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { LanguageService } from '../../core/i18n/language.service';
import { provideTestTranslations } from '../../testing/i18n-testing';
import { ConfirmDialogComponent, ConfirmDialogData } from './confirm-dialog.component';

const TRANSLATIONS = {
  en: {
    common: { confirm: 'Confirm', cancel: 'Cancel' },
    suppliers: {
      delete: { title: 'Delete supplier', message: 'Do you really want to delete "{{name}}"?' }
    }
  }
};

const DATA: ConfirmDialogData = {
  titleKey: 'suppliers.delete.title',
  messageKey: 'suppliers.delete.message',
  messageParams: { name: 'Acme' }
};

describe('ConfirmDialogComponent', () => {
  let fixture: ComponentFixture<ConfirmDialogComponent>;
  let dialogRef: { close: ReturnType<typeof vi.fn> };

  function click(selector: string): void {
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>(selector)
      ?.click();
  }

  beforeEach(async () => {
    localStorage.clear();
    TestBed.resetTestingModule();
    dialogRef = { close: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [ConfirmDialogComponent],
      providers: [
        provideTestTranslations(TRANSLATIONS),
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: DATA }
      ]
    }).compileComponents();

    TestBed.inject(LanguageService).initialize().subscribe();

    fixture = TestBed.createComponent(ConfirmDialogComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('render_providedKeys_showsTranslatedTitleAndMessage', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Delete supplier');
    expect(text).toContain('Do you really want to delete "Acme"?');
  });

  it('confirm_clicked_closesWithTrue', () => {
    click('.confirm-accept');

    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('cancel_clicked_closesWithFalse', () => {
    click('.confirm-cancel');

    expect(dialogRef.close).toHaveBeenCalledWith(false);
  });
});
