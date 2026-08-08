import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import { FormatService } from '../../core/format/format.service';
import { CSV_DOWNLOADER, buildCsv } from './csv-export';

/**
 * The reports page's export step, lifted so the list pages can perform it too.
 *
 * @remarks
 * It is deliberately thin: {@link buildCsv} still does the rendering and {@link CSV_DOWNLOADER}
 * still does the handing over. What lives here is the part every caller was about to copy - resolve
 * the header keys through the interface language, read the effective number locale, download - and
 * the reason it is worth extracting is that all three of those must happen at CLICK time. A cached
 * header row or a locale read at construction would ship a file in the language the page was opened
 * in rather than the one it is being read in.
 */
@Injectable({ providedIn: 'root' })
export class CsvExportService {
  private readonly translate = inject(TranslateService);
  private readonly format = inject(FormatService);
  private readonly download = inject(CSV_DOWNLOADER);

  /**
   * Builds one CSV from column keys and rows, and hands it to the browser.
   *
   * @param filename the download's name; the convention is a bare kebab-case entity name
   * @param columns column identifiers, appended to `keyPrefix` to resolve each header
   * @param rows the cells, already carrying whatever translation or formatting the table shows
   * @param keyPrefix the i18n namespace the column identifiers live under
   */
  export(
    filename: string,
    columns: string[],
    rows: (string | number | null)[][],
    keyPrefix: string
  ): void {
    const headers = columns.map((column) =>
      this.translate.instant(`${keyPrefix}${column}`)
    ) as string[];
    this.download(filename, buildCsv(headers, rows, this.format.numberLocale()));
  }
}
