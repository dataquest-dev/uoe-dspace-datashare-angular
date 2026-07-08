import {
  ChangeDetectionStrategy,
  DebugElement,
  NO_ERRORS_SCHEMA,
} from '@angular/core';
import {
  ComponentFixture,
  TestBed,
  waitForAsync,
} from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import {
  TranslateLoader,
  TranslateModule,
} from '@ngx-translate/core';

import { APP_CONFIG } from '../../../../config/app-config.interface';
import { environment } from '../../../../environments/environment';
import { ConfigurationDataService } from '../../../core/data/configuration-data.service';
import { ConfigurationProperty } from '../../../core/shared/configuration-property.model';
import { MetadataValue } from '../../../core/shared/metadata.models';
import { isNotEmpty } from '../../../shared/empty.util';
import { TranslateLoaderMock } from '../../../shared/mocks/translate-loader.mock';
import { createSuccessfulRemoteDataObject$ } from '../../../shared/remote-data.utils';
import { MetadataUriValuesComponent } from './metadata-uri-values.component';

let comp: MetadataUriValuesComponent;
let fixture: ComponentFixture<MetadataUriValuesComponent>;

const mockMetadata = [
  {
    language: 'en_US',
    value: 'https://doi.org/10.1234/fakelink',
  },
  {
    language: 'en_US',
    value: 'https://doi.org/10.5678/another-fakelink',
  },
] as MetadataValue[];
const mockSeperator = '<br/>';
const mockLabel = 'fake.message';
const mockLinkText = 'fake link text';

// Controls what the (stubbed) backend returns for the identifier.doi.resolver config property.
// Empty => the component falls back to its default resolver (https://doi.org).
let doiResolverConfigValues: string[] = [];
const configurationServiceStub = {
  findByPropertyName: (name: string) => createSuccessfulRemoteDataObject$(
    Object.assign(new ConfigurationProperty(), { name, values: doiResolverConfigValues }),
  ),
};

describe('MetadataUriValuesComponent', () => {
  beforeEach(waitForAsync(() => {
    doiResolverConfigValues = [];
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot({
        loader: {
          provide: TranslateLoader,
          useClass: TranslateLoaderMock,
        },
      }), MetadataUriValuesComponent],
      providers: [
        { provide: APP_CONFIG, useValue: environment },
        { provide: ConfigurationDataService, useValue: configurationServiceStub },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).overrideComponent(MetadataUriValuesComponent, {
      set: { changeDetection: ChangeDetectionStrategy.Default },
    }).compileComponents();
  }));

  beforeEach(waitForAsync(() => {
    fixture = TestBed.createComponent(MetadataUriValuesComponent);
    comp = fixture.componentInstance;
    comp.mdValues = mockMetadata;
    comp.separator = mockSeperator;
    comp.label = mockLabel;
    fixture.detectChanges();
  }));

  it('should display all metadata values', () => {
    const innerHTML = fixture.nativeElement.innerHTML;
    for (const metadatum of mockMetadata) {
      expect(innerHTML).toContain(metadatum.value);
    }
  });

  it('should contain the correct hrefs', () => {
    const links = fixture.debugElement.queryAll(By.css('a'));
    for (const metadatum of mockMetadata) {
      expect(containsHref(links, metadatum.value)).toBeTruthy();
    }
  });

  it('should contain separators equal to the amount of metadata values minus one', () => {
    const separators = fixture.debugElement.queryAll(By.css('a span'));
    expect(separators.length).toBe(mockMetadata.length - 1);
  });

  describe('when linktext is defined', () => {

    beforeEach(() => {
      comp.linktext = mockLinkText;
      fixture.detectChanges();
    });

    it('should replace the metadata value with the linktext', () => {
      const link = fixture.debugElement.query(By.css('a'));
      expect(link.nativeElement.textContent).toContain(mockLinkText);
    });

  });

  // DATASHARE - start
  // The DOI / "Persistent Identifier" field on the simple item view is rendered through this
  // component. When a record is created its DOI is only registered asynchronously by a scheduled
  // task, so for a while the item has no https://doi.org value yet. The field must still be shown
  // (with an empty value) so users can see that a DOI exists / is pending, matching the behaviour
  // of the previous DataShare release.
  describe('when used as a DOI field (doiField = true)', () => {

    describe('and a registered DOI is present', () => {
      beforeEach(() => {
        comp.doiField = true;
        comp.mdValues = [
          { language: 'en_US', value: 'https://hdl.handle.net/123456789/99' },
          { language: 'en_US', value: 'https://doi.org/10.1234/registered' },
        ] as MetadataValue[];
        fixture.detectChanges();
      });

      it('should render the field wrapper and show the label', () => {
        const wrapper = fixture.debugElement.query(By.css('.simple-view-element'));
        expect(wrapper).not.toBeNull();
        expect(wrapper.nativeElement.classList).not.toContain('d-none');
        expect(fixture.debugElement.query(By.css('.simple-view-element-header'))).not.toBeNull();
      });

      it('should render only the DOI value as a link (not the handle)', () => {
        const links = fixture.debugElement.queryAll(By.css('a'));
        expect(links.length).toBe(1);
        expect(links[0].nativeElement.getAttribute('href')).toBe('https://doi.org/10.1234/registered');
      });
    });

    describe('and the DOI has not been registered yet (scheduled task pending)', () => {
      beforeEach(() => {
        comp.doiField = true;
        // Only a handle is present, the DOI is still queued for registration by the CRON job
        comp.mdValues = [
          { language: 'en_US', value: 'https://hdl.handle.net/123456789/99' },
        ] as MetadataValue[];
        fixture.detectChanges();
      });

      it('should still display the DOI field (label visible) even without a DOI link', () => {
        const wrapper = fixture.debugElement.query(By.css('.simple-view-element'));
        expect(wrapper).not.toBeNull();
        expect(wrapper.nativeElement.classList).not.toContain('d-none');
        expect(fixture.debugElement.query(By.css('.simple-view-element-header'))).not.toBeNull();
      });

      it('should not render the non-DOI (handle) value as a link', () => {
        expect(fixture.debugElement.queryAll(By.css('a')).length).toBe(0);
      });
    });

    describe('and the item has no identifier metadata at all', () => {
      beforeEach(() => {
        comp.doiField = true;
        comp.mdValues = [] as MetadataValue[];
        fixture.detectChanges();
      });

      it('should still display the (empty) DOI field wrapper', () => {
        const wrapper = fixture.debugElement.query(By.css('.simple-view-element'));
        expect(wrapper).not.toBeNull();
        expect(wrapper.nativeElement.classList).not.toContain('d-none');
      });
    });

    describe('and multiple DOIs are present followed by a non-DOI value', () => {
      beforeEach(() => {
        comp.doiField = true;
        comp.separator = '<br/>';
        comp.mdValues = [
          { language: 'en_US', value: 'https://doi.org/10.1234/one' },
          { language: 'en_US', value: 'https://doi.org/10.5678/two' },
          { language: 'en_US', value: 'https://hdl.handle.net/123456789/99' },
        ] as MetadataValue[];
        fixture.detectChanges();
      });

      it('should render only the DOI values as links', () => {
        expect(fixture.debugElement.queryAll(By.css('a')).length).toBe(2);
      });

      it('should only put a separator between the DOIs, not a trailing one after the last DOI', () => {
        // exactly one separator between the two visible DOIs (computed against the DOI subset,
        // not the full metadata array, so the trailing handle cannot add a stray separator)
        expect(fixture.debugElement.queryAll(By.css('a span')).length).toBe(1);
      });
    });

    describe('and a custom DOI resolver is configured in the backend (identifier.doi.resolver)', () => {
      beforeEach(() => {
        // The backend resolver is not the default https://doi.org
        doiResolverConfigValues = ['https://doi.example.org'];
        // Re-create the component so ngOnInit reads the configured resolver with doiField already set
        fixture = TestBed.createComponent(MetadataUriValuesComponent);
        comp = fixture.componentInstance;
        comp.doiField = true;
        comp.label = mockLabel;
        comp.mdValues = [
          { language: 'en_US', value: 'https://doi.example.org/10.1234/configured' },
          { language: 'en_US', value: 'https://doi.org/10.5678/default-resolver' },
        ] as MetadataValue[];
        fixture.detectChanges();
      });

      it('should treat values matching the configured resolver as DOIs', () => {
        const links = fixture.debugElement.queryAll(By.css('a'));
        expect(links.length).toBe(1);
        expect(links[0].nativeElement.getAttribute('href')).toBe('https://doi.example.org/10.1234/configured');
      });
    });
  });

  describe('when NOT used as a DOI field (doiField = false, the default)', () => {
    beforeEach(() => {
      comp.doiField = false;
      comp.mdValues = [
        { language: 'en_US', value: 'https://example.com/endorsement' },
      ] as MetadataValue[];
      fixture.detectChanges();
    });

    it('should render every URI value as a link (upstream behaviour)', () => {
      const links = fixture.debugElement.queryAll(By.css('a'));
      expect(links.length).toBe(1);
      expect(links[0].nativeElement.getAttribute('href')).toBe('https://example.com/endorsement');
    });
  });
  // DATASHARE - end

});

function containsHref(links: DebugElement[], href: string): boolean {
  for (const link of links) {
    const hrefAtt = link.properties.href;
    if (isNotEmpty(hrefAtt)) {
      if (hrefAtt === href) {
        return true;
      }
    }
  }
  return false;
}
