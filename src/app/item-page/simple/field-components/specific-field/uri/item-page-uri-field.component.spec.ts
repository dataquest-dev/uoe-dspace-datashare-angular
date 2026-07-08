import {
  ChangeDetectionStrategy,
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

import { APP_CONFIG } from '../../../../../../config/app-config.interface';
import { environment } from '../../../../../../environments/environment';
import { BrowseService } from '../../../../../core/browse/browse.service';
import { BrowseDefinitionDataService } from '../../../../../core/browse/browse-definition-data.service';
import { BrowseDefinitionDataServiceStub } from '../../../../../shared/testing/browse-definition-data-service.stub';
import { BrowseServiceStub } from '../../../../../shared/testing/browse-service.stub';
import { TranslateLoaderMock } from '../../../../../shared/testing/translate-loader.mock';
import { MetadataUriValuesComponent } from '../../../../field-components/metadata-uri-values/metadata-uri-values.component';
import { mockItemWithMetadataFieldsAndValue } from '../item-page-field.component.spec';
import { ItemPageUriFieldComponent } from './item-page-uri-field.component';

let comp: ItemPageUriFieldComponent;
let fixture: ComponentFixture<ItemPageUriFieldComponent>;

const mockField = 'dc.identifier.uri';
const mockValue = 'https://doi.org/10.1234/test';
const mockLabel = 'test label';

describe('ItemPageUriFieldComponent', () => {
  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot({
        loader: {
          provide: TranslateLoader,
          useClass: TranslateLoaderMock,
        },
      }), ItemPageUriFieldComponent, MetadataUriValuesComponent],
      providers: [
        { provide: APP_CONFIG, useValue: environment },
        { provide: BrowseDefinitionDataService, useValue: BrowseDefinitionDataServiceStub },
        { provide: BrowseService, useValue: BrowseServiceStub },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).overrideComponent(ItemPageUriFieldComponent, {
      set: { changeDetection: ChangeDetectionStrategy.Default },
    }).compileComponents();
  }));

  beforeEach(waitForAsync(() => {
    fixture = TestBed.createComponent(ItemPageUriFieldComponent);
    comp = fixture.componentInstance;
    comp.item = mockItemWithMetadataFieldsAndValue([mockField], mockValue);
    comp.fields = [mockField];
    comp.label = mockLabel;
    fixture.detectChanges();
  }));

  it('should display display the correct metadata value', () => {
    expect(fixture.nativeElement.innerHTML).toContain(mockValue);
  });

  // DATASHARE - start
  describe('when used as a DOI field with a pending (unregistered) DOI', () => {
    beforeEach(() => {
      // The item only has a handle, the DOI is still queued for registration by the CRON job
      comp.item = mockItemWithMetadataFieldsAndValue([mockField], 'https://hdl.handle.net/123456789/1');
      comp.fields = [mockField];
      comp.label = mockLabel;
      comp.doiField = true;
      fixture.detectChanges();
    });

    it('should still display the DOI field wrapper even though no DOI link is present yet', () => {
      const wrapper = fixture.debugElement.query(By.css('.simple-view-element'));
      expect(wrapper).not.toBeNull();
      expect(wrapper.nativeElement.classList).not.toContain('d-none');
    });

    it('should not render the handle as a link', () => {
      expect(fixture.debugElement.queryAll(By.css('a')).length).toBe(0);
    });
  });
  // DATASHARE - end
});
