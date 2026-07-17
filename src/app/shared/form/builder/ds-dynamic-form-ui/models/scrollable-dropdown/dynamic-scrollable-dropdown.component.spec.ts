// Load the implementations that should be tested
import {
  ChangeDetectorRef,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  Injector,
} from '@angular/core';
import {
  ComponentFixture,
  fakeAsync,
  inject,
  TestBed,
  tick,
  waitForAsync,
} from '@angular/core/testing';
import {
  FormsModule,
  ReactiveFormsModule,
  UntypedFormControl,
  UntypedFormGroup,
} from '@angular/forms';
import { By } from '@angular/platform-browser';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import {
  DynamicFormArrayModel,
  DynamicFormLayoutService,
  DynamicFormsCoreModule,
  DynamicFormValidationService,
} from '@ng-dynamic-forms/core';
import { DynamicFormsNGBootstrapUIModule } from '@ng-dynamic-forms/ui-ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';
import { InfiniteScrollModule } from 'ngx-infinite-scroll';

import { APP_DATA_SERVICES_MAP } from '../../../../../../../config/app-config.interface';
import { VocabularyEntry } from '../../../../../../core/submission/vocabularies/models/vocabulary-entry.model';
import { VocabularyOptions } from '../../../../../../core/submission/vocabularies/models/vocabulary-options.model';
import { VocabularyService } from '../../../../../../core/submission/vocabularies/vocabulary.service';
import { NotificationsService } from '../../../../../notifications/notifications.service';
import {
  mockDynamicFormLayoutService,
  mockDynamicFormValidationService,
} from '../../../../../testing/dynamic-form-mock-services';
import { NotificationsServiceStub } from '../../../../../testing/notifications-service.stub';
import {
  createTestComponent,
  hasClass,
} from '../../../../../testing/utils.test';
import { VocabularyServiceStub } from '../../../../../testing/vocabulary-service.stub';
import { DsDynamicScrollableDropdownComponent } from './dynamic-scrollable-dropdown.component';
import { DynamicScrollableDropdownModel } from './dynamic-scrollable-dropdown.model';

export const SD_TEST_GROUP = new UntypedFormGroup({
  dropdown: new UntypedFormControl(),
});

export const SD_TEST_MODEL_CONFIG = {
  vocabularyOptions: {
    closed: false,
    name: 'common_iso_languages',
  } as VocabularyOptions,
  disabled: false,
  errorMessages: { required: 'Required field.' },
  id: 'dropdown',
  label: 'Language',
  maxOptions: 10,
  name: 'dropdown',
  placeholder: 'Language',
  readOnly: false,
  required: false,
  repeatable: false,
  value: undefined,
  metadataFields: [],
  submissionId: '1234',
  hasSelectableMetadata: false,
};

describe('Dynamic Dynamic Scrollable Dropdown component', () => {

  let testComp: TestComponent;
  let scrollableDropdownComp: DsDynamicScrollableDropdownComponent;
  let testFixture: ComponentFixture<TestComponent>;
  let scrollableDropdownFixture: ComponentFixture<DsDynamicScrollableDropdownComponent>;
  let html;
  let modelValue;

  const vocabularyServiceStub = new VocabularyServiceStub();

  // waitForAsync beforeEach
  beforeEach(waitForAsync(() => {

    TestBed.configureTestingModule({
      imports: [
        DynamicFormsCoreModule,
        DynamicFormsNGBootstrapUIModule,
        FormsModule,
        InfiniteScrollModule,
        ReactiveFormsModule,
        NgbModule,
        TranslateModule.forRoot(),
        DsDynamicScrollableDropdownComponent,
        TestComponent,
      ],
      providers: [
        { provide: NotificationsService, useValue: new NotificationsServiceStub() },
        Injector,
        ChangeDetectorRef,
        DsDynamicScrollableDropdownComponent,
        { provide: VocabularyService, useValue: vocabularyServiceStub },
        { provide: DynamicFormLayoutService, useValue: mockDynamicFormLayoutService },
        { provide: DynamicFormValidationService, useValue: mockDynamicFormValidationService },
        { provide: APP_DATA_SERVICES_MAP, useValue: {} },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });

  }));

  describe('', () => {
    // synchronous beforeEach
    beforeEach(() => {
      html = `
      <ds-dynamic-scrollable-dropdown [bindId]="bindId"
                                      [group]="group"
                                      [model]="model"
                                      (blur)="onBlur($event)"
                                      (change)="onValueChange($event)"
                                      (focus)="onFocus($event)"></ds-dynamic-scrollable-dropdown>`;

      testFixture = createTestComponent(html, TestComponent) as ComponentFixture<TestComponent>;
      testComp = testFixture.componentInstance;
    });

    it('should create DsDynamicScrollableDropdownComponent', inject([DsDynamicScrollableDropdownComponent], (app: DsDynamicScrollableDropdownComponent) => {

      expect(app).toBeDefined();
    }));
  });

  describe('', () => {
    describe('when init model value is empty', () => {
      beforeEach(() => {

        scrollableDropdownFixture = TestBed.createComponent(DsDynamicScrollableDropdownComponent);
        scrollableDropdownComp = scrollableDropdownFixture.componentInstance; // FormComponent test instance
        scrollableDropdownComp.group = SD_TEST_GROUP;
        scrollableDropdownComp.model = new DynamicScrollableDropdownModel(SD_TEST_MODEL_CONFIG);
        scrollableDropdownFixture.detectChanges();
      });

      afterEach(() => {
        scrollableDropdownFixture.destroy();
        scrollableDropdownComp = null;
      });

      it('should init component properly', () => {
        expect(scrollableDropdownComp.optionsList).toBeDefined();
        expect(scrollableDropdownComp.optionsList).toEqual(vocabularyServiceStub.getList());
      });

      it('should display dropdown menu entries', () => {
        const de = scrollableDropdownFixture.debugElement.query(By.css('input.form-control'));
        const btnEl = de.nativeElement;

        const deMenu = scrollableDropdownFixture.debugElement.query(By.css('div.scrollable-dropdown-menu'));
        const menuEl = deMenu.nativeElement;

        btnEl.click();
        scrollableDropdownFixture.detectChanges();

        expect(hasClass(menuEl, 'show')).toBeTruthy();
      });

      it('should fetch the next set of results when the user scroll to the end of the list', fakeAsync(() => {
        scrollableDropdownComp.pageInfo.currentPage = 1;
        scrollableDropdownComp.pageInfo.totalPages = 2;

        scrollableDropdownFixture.detectChanges();

        scrollableDropdownComp.onScroll();
        tick();

        expect(scrollableDropdownComp.optionsList.length).toBe(4);
      }));

      it('should select a results entry properly', fakeAsync(() => {
        const selectedValue = Object.assign(new VocabularyEntry(), { authority: 1, display: 'one', value: 1 });

        let de: any = scrollableDropdownFixture.debugElement.query(By.css('input.form-control'));
        let btnEl = de.nativeElement;

        const mousedownEvent = new MouseEvent('mousedown');

        btnEl.dispatchEvent(mousedownEvent);
        scrollableDropdownFixture.detectChanges();

        de = scrollableDropdownFixture.debugElement.queryAll(By.css('button.dropdown-item'));
        btnEl = de[1].nativeElement;

        btnEl.dispatchEvent(mousedownEvent);
        scrollableDropdownFixture.detectChanges();

        expect((scrollableDropdownComp.model as any).value).toEqual(selectedValue);
      }));

      it('should emit blur Event onBlur', () => {
        spyOn(scrollableDropdownComp.blur, 'emit');
        scrollableDropdownComp.onBlur(new Event('blur'));
        expect(scrollableDropdownComp.blur.emit).toHaveBeenCalled();
      });

      it('should emit focus Event onFocus', () => {
        spyOn(scrollableDropdownComp.focus, 'emit');
        scrollableDropdownComp.onFocus(new Event('focus'));
        expect(scrollableDropdownComp.focus.emit).toHaveBeenCalled();
      });

    });

    describe('duplicate values in repeatable fields', () => {
      beforeEach(() => {
        scrollableDropdownFixture = TestBed.createComponent(DsDynamicScrollableDropdownComponent);
        scrollableDropdownComp = scrollableDropdownFixture.componentInstance;
        scrollableDropdownComp.group = SD_TEST_GROUP;

        const arrayModel = new DynamicFormArrayModel({
          id: 'dropdownArray',
          groupFactory: () => [new DynamicScrollableDropdownModel(SD_TEST_MODEL_CONFIG)],
          initialCount: 2,
        });
        const ownGroup = arrayModel.get(0);
        const siblingGroup = arrayModel.get(1);
        (siblingGroup.group[0] as any).value = Object.assign(new VocabularyEntry(), { authority: 1, display: 'one', value: 1 });

        const ownModel = ownGroup.group[0] as DynamicScrollableDropdownModel;
        (ownModel as any).parent = ownGroup;
        scrollableDropdownComp.model = ownModel;
        scrollableDropdownFixture.detectChanges();
      });

      afterEach(() => {
        scrollableDropdownFixture.destroy();
        scrollableDropdownComp = null;
      });

      it('should disable an option already selected in another row of the same field', () => {
        const de = scrollableDropdownFixture.debugElement.query(By.css('input.form-control'));
        de.nativeElement.dispatchEvent(new MouseEvent('mousedown'));
        de.nativeElement.click();
        scrollableDropdownFixture.detectChanges();

        expect(scrollableDropdownComp.usedSiblingValues.has(1)).toBeTruthy();
        expect(scrollableDropdownComp.isOptionDisabled({ value: 1 })).toBeTruthy();
        expect(scrollableDropdownComp.isOptionDisabled({ value: 2 })).toBeFalsy();

        const options = scrollableDropdownFixture.debugElement.queryAll(By.css('button.dropdown-item.collection-item'));
        expect(hasClass(options[1].nativeElement, 'disabled')).toBeTruthy();
        expect(hasClass(options[2].nativeElement, 'disabled')).toBeFalsy();
      });

      it('should ignore selection of a disabled option', () => {
        scrollableDropdownComp.usedSiblingValues = new Set([1]);
        spyOn(scrollableDropdownComp.change, 'emit');

        scrollableDropdownComp.onSelect(Object.assign(new VocabularyEntry(), { authority: 1, display: 'one', value: 1 }));

        expect(scrollableDropdownComp.change.emit).not.toHaveBeenCalled();
        expect((scrollableDropdownComp.model as any).value).toBeUndefined();
      });

      it('should not select a disabled option via keyboard and keep the dropdown open', () => {
        scrollableDropdownComp.usedSiblingValues = new Set([1]);
        scrollableDropdownComp.optionsList = [Object.assign(new VocabularyEntry(), { authority: 1, display: 'one', value: 1 })];
        scrollableDropdownComp.selectedIndex = 0;
        spyOn(scrollableDropdownComp.change, 'emit');
        const sdRef = jasmine.createSpyObj('NgbDropdown', ['isOpen', 'open', 'close']);
        sdRef.isOpen.and.returnValue(true);

        scrollableDropdownComp.selectOnKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }), sdRef);

        expect(scrollableDropdownComp.change.emit).not.toHaveBeenCalled();
        expect(sdRef.close).not.toHaveBeenCalled();
      });

      it('should refresh used sibling values when opened via keyboard', () => {
        spyOn(scrollableDropdownComp, 'openDropdown');
        const sdRef = jasmine.createSpyObj('NgbDropdown', ['isOpen', 'open', 'close']);
        sdRef.isOpen.and.returnValue(false);

        scrollableDropdownComp.selectOnKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }), sdRef);

        expect(scrollableDropdownComp.openDropdown).toHaveBeenCalledWith(sdRef);
        expect(sdRef.open).not.toHaveBeenCalled();
      });

      it('should still allow clearing the value', () => {
        scrollableDropdownComp.usedSiblingValues = new Set([1]);
        spyOn(scrollableDropdownComp.change, 'emit');

        scrollableDropdownComp.onSelect(undefined);

        expect(scrollableDropdownComp.change.emit).toHaveBeenCalled();
      });

      it('should not disable any option for a field without repeatable siblings', () => {
        scrollableDropdownComp.model = new DynamicScrollableDropdownModel(SD_TEST_MODEL_CONFIG);

        scrollableDropdownComp.openDropdown({ open: () => undefined } as any);

        expect(scrollableDropdownComp.usedSiblingValues.size).toBe(0);
        expect(scrollableDropdownComp.isOptionDisabled({ value: 1 })).toBeFalsy();
      });

      it('should keep a display value reverted synchronously by a change handler', () => {
        const previousEntry = Object.assign(new VocabularyEntry(), { authority: 2, display: 'two', value: 2 });
        const selectedEntry = Object.assign(new VocabularyEntry(), { authority: 3, display: 'three', value: 3 });
        scrollableDropdownComp.change.subscribe(() => {
          SD_TEST_GROUP.get('dropdown').setValue(previousEntry);
        });

        scrollableDropdownComp.onSelect(selectedEntry);

        let displayed: string;
        scrollableDropdownComp.currentValue.subscribe((v) => displayed = v);
        expect(displayed).toBe('two');
      });
    });

    describe('when init model value is not empty', () => {
      beforeEach(() => {

        scrollableDropdownFixture = TestBed.createComponent(DsDynamicScrollableDropdownComponent);
        scrollableDropdownComp = scrollableDropdownFixture.componentInstance; // FormComponent test instance
        scrollableDropdownComp.group = SD_TEST_GROUP;
        modelValue = Object.assign(new VocabularyEntry(), { authority: 1, display: 'one', value: 1 });
        scrollableDropdownComp.model = new DynamicScrollableDropdownModel(SD_TEST_MODEL_CONFIG);
        scrollableDropdownComp.model.value = modelValue;
        scrollableDropdownFixture.detectChanges();
      });

      afterEach(() => {
        scrollableDropdownFixture.destroy();
        scrollableDropdownComp = null;
      });

      it('should init component properly', () => {
        expect(scrollableDropdownComp.optionsList).toBeDefined();
        expect(scrollableDropdownComp.optionsList).toEqual(vocabularyServiceStub.getList());
        expect(scrollableDropdownComp.model.value).toEqual(modelValue);
      });
    });
  });
});

// declare a test component
@Component({
  selector: 'ds-test-cmp',
  template: ``,
  standalone: true,
  imports: [DynamicFormsCoreModule,
    DynamicFormsNGBootstrapUIModule,
    FormsModule,
    InfiniteScrollModule,
    ReactiveFormsModule,
    NgbModule],
})
class TestComponent {

  group: UntypedFormGroup = SD_TEST_GROUP;

  model = new DynamicScrollableDropdownModel(SD_TEST_MODEL_CONFIG);

  showErrorMessages = false;

}
