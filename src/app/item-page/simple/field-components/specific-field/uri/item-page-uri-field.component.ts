import {
  Component,
  Input,
} from '@angular/core';

import { Item } from '../../../../../core/shared/item.model';
import { MetadataUriValuesComponent } from '../../../../field-components/metadata-uri-values/metadata-uri-values.component';
import { ItemPageFieldComponent } from '../item-page-field.component';

@Component({
  selector: 'ds-item-page-uri-field',
  templateUrl: './item-page-uri-field.component.html',
  imports: [
    MetadataUriValuesComponent,
  ],
  standalone: true,
})
/**
 * This component can be used to represent any uri on a simple item page.
 * It expects 4 parameters: The item, a separator, the metadata keys and an i18n key
 */
export class ItemPageUriFieldComponent extends ItemPageFieldComponent {

  /**
   * The item to display metadata for
   */
  @Input() item: Item;

  /**
   * Separator string between multiple values of the metadata fields defined
   * @type {string}
   */
  @Input() separator: string;

  /**
   * Fields (schema.element.qualifier) used to render their values.
   */
  @Input() fields: string[];

  /**
   * Label i18n key for the rendered metadata
   */
  @Input() label: string;

  // DATASHARE - start
  /**
   * When true, this field is rendered as a DOI ("Persistent Identifier") field: only DOI links
   * are shown and the field label is always displayed, even while the DOI is still queued for
   * registration by the scheduled task (no DOI value yet). See {@link MetadataUriValuesComponent}.
   */
  @Input() doiField = false;
  // DATASHARE - end

}
