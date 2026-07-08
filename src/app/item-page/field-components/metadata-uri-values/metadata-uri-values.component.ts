import {
  NgForOf,
  NgIf,
} from '@angular/common';
import {
  Component,
  Input,
} from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { MetadataValue } from '../../../core/shared/metadata.models';
import { MetadataFieldWrapperComponent } from '../../../shared/metadata-field-wrapper/metadata-field-wrapper.component';
import { MetadataValuesComponent } from '../metadata-values/metadata-values.component';

/**
 * This component renders the configured 'values' into the ds-metadata-field-wrapper component as a link.
 * It puts the given 'separator' between each two values
 * and creates an 'a' tag for each value,
 * using the 'linktext' as it's value (if it exists)
 * and using the values as the 'href' attribute (and as value of the tag when no 'linktext' is defined)
 */
@Component({
  selector: 'ds-metadata-uri-values',
  styleUrls: ['./metadata-uri-values.component.scss'],
  templateUrl: './metadata-uri-values.component.html',
  imports: [
    MetadataFieldWrapperComponent,
    TranslateModule,
    NgForOf,
    NgIf,
  ],
  standalone: true,
})
export class MetadataUriValuesComponent extends MetadataValuesComponent {

  /**
   * Optional text to replace the links with
   * If undefined, the metadata value (uri) is displayed
   */
  @Input() linktext: any;

  /**
   * The metadata values to display
   */
  @Input() mdValues: MetadataValue[];

  /**
   * The seperator used to split the metadata values (can contain HTML)
   */
  @Input() separator: string;

  /**
   * The label for this iteration of metadata values
   */
  @Input() label: string;

  // DATASHARE - start
  /**
   * When true, this component renders a DOI ("Persistent Identifier") field:
   *  - only DOI values (https://doi.org/...) are rendered as links (the handle is hidden);
   *  - the field label/wrapper is always shown, even while a DOI is still queued for
   *    registration by the scheduled task (i.e. no https://doi.org value is present yet),
   *    so users can see that a DOI exists / is pending.
   * When false (the default) the upstream generic behaviour is kept: every URI value is
   * rendered as a link and the field is hidden when it has no value.
   */
  @Input() doiField = false;

  /**
   * The DOI values (https://doi.org/...) among {@link mdValues}. Used in {@link doiField} mode so
   * that only DOIs are shown as links and the separator is computed against the visible DOIs only.
   */
  get doiValues(): MetadataValue[] {
    return (this.mdValues ?? []).filter(v => typeof v.value === 'string' && v.value.startsWith('https://doi.org'));
  }
  // DATASHARE - end
}
