import {
  NgForOf,
  NgIf,
} from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  Inject,
  Input,
  OnInit,
} from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import {
  APP_CONFIG,
  AppConfig,
} from '../../../../config/app-config.interface';
import { ConfigurationDataService } from '../../../core/data/configuration-data.service';
import { MetadataValue } from '../../../core/shared/metadata.models';
import { getFirstCompletedRemoteData } from '../../../core/shared/operators';
import { isNotEmpty } from '../../../shared/empty.util';
import { MetadataFieldWrapperComponent } from '../../../shared/metadata-field-wrapper/metadata-field-wrapper.component';
import { MetadataValuesComponent } from '../metadata-values/metadata-values.component';

// DATASHARE - start
/**
 * Default DOI resolver, used when the backend does not expose/define {@link DOI_RESOLVER_PROPERTY}.
 * Kept in sync with the DSpace default (DOIServiceImpl#RESOLVER_DEFAULT).
 */
export const DEFAULT_DOI_RESOLVER = 'https://doi.org';

/**
 * Backend configuration property holding the DOI resolver base URL.
 */
export const DOI_RESOLVER_PROPERTY = 'identifier.doi.resolver';
// DATASHARE - end

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
export class MetadataUriValuesComponent extends MetadataValuesComponent implements OnInit {

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
   *  - only DOI values (starting with the configured {@link doiResolver}) are rendered as links
   *    (the handle is hidden);
   *  - the field label/wrapper is always shown, even while a DOI is still queued for
   *    registration by the scheduled task (i.e. no DOI value is present yet),
   *    so users can see that a DOI exists / is pending.
   * When false (the default) the upstream generic behaviour is kept: every URI value is
   * rendered as a link and the field is hidden when it has no value.
   */
  @Input() doiField = false;

  /**
   * The DOI resolver base URL. Loaded from the backend configuration ({@link DOI_RESOLVER_PROPERTY})
   * so that the same value drives the frontend as the backend, instead of hard-coding it here.
   * Falls back to {@link DEFAULT_DOI_RESOLVER} when the property is not exposed/defined.
   */
  doiResolver = DEFAULT_DOI_RESOLVER;

  constructor(
    @Inject(APP_CONFIG) appConfig: AppConfig,
    private configurationService: ConfigurationDataService,
    private cdr: ChangeDetectorRef,
  ) {
    super(appConfig);
  }

  ngOnInit(): void {
    if (this.doiField) {
      this.configurationService.findByPropertyName(DOI_RESOLVER_PROPERTY).pipe(
        getFirstCompletedRemoteData(),
      ).subscribe((rd) => {
        if (rd.hasSucceeded && isNotEmpty(rd.payload?.values)) {
          this.doiResolver = rd.payload.values[0];
          this.cdr.markForCheck();
        }
      });
    }
  }

  /**
   * The DOI values (starting with {@link doiResolver}) among {@link mdValues}. Used in
   * {@link doiField} mode so that only DOIs are shown as links and the separator is computed
   * against the visible DOIs only.
   */
  get doiValues(): MetadataValue[] {
    return (this.mdValues ?? []).filter(v => typeof v.value === 'string' && v.value.startsWith(this.doiResolver));
  }
  // DATASHARE - end
}
