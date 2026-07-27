// Regression specs for the two problems reported against #26/#32 on a repeatable,
// vocabulary-backed submission dropdown (Type, Funder):
//
//   BUG A - an option already chosen in another row could be picked again, producing
//           duplicate metadata. Three separate gaps: the caret opens the menu without
//           refreshing the used-value state, the state was a snapshot that nothing
//           invalidated, and the identity used for comparison did not survive a
//           server round-trip (authority vs plain value).
//
//   BUG B - clicking "next to" an open dropdown wiped the selected values, because the
//           options commit on mousedown and the destructive "Clear selection" entry sits
//           directly under the input, where a dismissing click lands.
import {
  ChangeDetectorRef,
  CUSTOM_ELEMENTS_SCHEMA,
  Injector,
} from '@angular/core';
import {
  ComponentFixture,
  fakeAsync,
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
import { VocabularyServiceStub } from '../../../../../testing/vocabulary-service.stub';
import { FormFieldMetadataValueObject } from '../../../models/form-field-metadata-value.model';
import { DsDynamicScrollableDropdownComponent } from './dynamic-scrollable-dropdown.component';
import { DynamicScrollableDropdownModel } from './dynamic-scrollable-dropdown.model';

const MODEL_CONFIG = {
  vocabularyOptions: { closed: false, name: 'common_types' } as VocabularyOptions,
  disabled: false,
  errorMessages: { required: 'Required field.' },
  id: 'dropdown',
  label: 'Type',
  maxOptions: 10,
  name: 'dropdown',
  placeholder: 'Type',
  readOnly: false,
  required: false,
  repeatable: true,
  value: undefined,
  metadataFields: [],
  submissionId: '1234',
  hasSelectableMetadata: false,
};

const entry = (value: any, authority: any = null, display?: string) =>
  Object.assign(new VocabularyEntry(), { authority, value, display: display ?? value });

describe('DsDynamicScrollableDropdownComponent duplicate/clearing regressions', () => {
  let fixture: ComponentFixture<DsDynamicScrollableDropdownComponent>;
  let comp: DsDynamicScrollableDropdownComponent;
  const vocabularyServiceStub = new VocabularyServiceStub();

  beforeEach(waitForAsync(() => {
    vocabularyServiceStub.setNewPayload([
      entry('Article'), entry('Book'), entry('Dataset'),
    ]);
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

  /** Build a repeatable field of `count` rows, wiring parents the way the form service does. */
  function buildArray(count: number): DynamicFormArrayModel {
    const arrayModel = new DynamicFormArrayModel({
      id: 'dropdownArray',
      groupFactory: () => [new DynamicScrollableDropdownModel(MODEL_CONFIG)],
      initialCount: count,
    });
    arrayModel.groups.forEach((g) => g.group.forEach((m) => ((m as any).parent = g)));
    return arrayModel;
  }

  function bindTo(rowModel: DynamicScrollableDropdownModel) {
    fixture = TestBed.createComponent(DsDynamicScrollableDropdownComponent);
    comp = fixture.componentInstance;
    comp.group = new UntypedFormGroup({ dropdown: new UntypedFormControl() });
    comp.model = rowModel;
    fixture.detectChanges();
  }

  const fakeRef: any = { open: () => undefined, close: () => undefined, isOpen: () => false };

  // ------------------------------------------------------------------ BUG A
  describe('BUG A - duplicate values', () => {

    it('disables a sibling value WITHOUT the dropdown having been opened first', fakeAsync(() => {
      // The caret (ngbDropdownToggle) opens the menu without going through openDropdown(),
      // so the disabled state must not depend on openDropdown() having run.
      const arr = buildArray(2);
      (arr.get(0).group[0] as any).value = entry('Article');
      bindTo(arr.get(1).group[0] as any);
      tick();

      expect(comp.isOptionDisabled(entry('Article')))
        .withContext('used by the sibling row -> must be disabled even before openDropdown()').toBeTruthy();
      expect(comp.isOptionDisabled(entry('Book')))
        .withContext('free -> selectable').toBeFalsy();
    }));

    it('re-evaluates when a sibling row changes AFTER the dropdown was opened', fakeAsync(() => {
      const arr = buildArray(2);
      bindTo(arr.get(1).group[0] as any);
      comp.openDropdown(fakeRef);
      tick();

      expect(comp.isOptionDisabled(entry('Article'))).withContext('nothing used yet').toBeFalsy();

      // Another row gains the value while this menu is already open.
      (arr.get(0).group[0] as any).value = entry('Article');

      expect(comp.isOptionDisabled(entry('Article')))
        .withContext('must reflect the sibling chosen after opening').toBeTruthy();
    }));

    it('stops disabling a value once the row that used it is removed', fakeAsync(() => {
      const arr = buildArray(3);
      (arr.get(0).group[0] as any).value = entry('Article');
      (arr.get(1).group[0] as any).value = entry('Book');
      bindTo(arr.get(2).group[0] as any);
      comp.openDropdown(fakeRef);
      tick();
      expect(comp.isOptionDisabled(entry('Book'))).withContext('Book is used').toBeTruthy();

      arr.removeGroup(1);       // the user deletes the "Book" row

      expect(comp.isOptionDisabled(entry('Book')))
        .withContext('Book is free again -> must not stay greyed out').toBeFalsy();
      expect(comp.isOptionDisabled(entry('Article')))
        .withContext('Article is still used').toBeTruthy();
    }));

    it('detects a duplicate when the sibling lost its authority in a server round-trip', fakeAsync(() => {
      // Picked in-session the value is a VocabularyEntry carrying an authority; rebuilt from the
      // server it is a FormFieldMetadataValueObject whose authority may be null. Keying on
      // `authority ?? value` made the two incomparable.
      const arr = buildArray(2);
      (arr.get(0).group[0] as any).value = new FormFieldMetadataValueObject('Article', null, null, 'Article');
      bindTo(arr.get(1).group[0] as any);
      comp.openDropdown(fakeRef);
      tick();

      expect(comp.isOptionDisabled(entry('Article', 'auth-article')))
        .withContext('same value, authority only on the option -> still a duplicate').toBeTruthy();
    }));

    it('detects a duplicate when only the sibling carries an authority', fakeAsync(() => {
      const arr = buildArray(2);
      (arr.get(0).group[0] as any).value = new FormFieldMetadataValueObject('Article', null, 'auth-article', 'Article');
      bindTo(arr.get(1).group[0] as any);
      comp.openDropdown(fakeRef);
      tick();

      expect(comp.isOptionDisabled(entry('Article')))
        .withContext('same value, authority only on the sibling -> still a duplicate').toBeTruthy();
    }));

    it('still matches on authority when the displayed values differ', fakeAsync(() => {
      const arr = buildArray(2);
      (arr.get(0).group[0] as any).value = new FormFieldMetadataValueObject('NSF', null, 'auth-1', 'NSF');
      bindTo(arr.get(1).group[0] as any);
      comp.openDropdown(fakeRef);
      tick();

      expect(comp.isOptionDisabled(entry('National Science Foundation', 'auth-1')))
        .withContext('same authority -> same entity -> duplicate').toBeTruthy();
    }));

    it('refuses to commit a duplicate even if the option is somehow activated', fakeAsync(() => {
      const arr = buildArray(2);
      (arr.get(0).group[0] as any).value = entry('Article');
      const rowModel = arr.get(1).group[0] as any;
      bindTo(rowModel);
      tick();

      spyOn(comp.change, 'emit');
      comp.selectEntry(entry('Article'), fakeRef);

      expect(comp.change.emit).not.toHaveBeenCalled();
      expect(rowModel.value).toBeUndefined();
    }));

    it('does not disable anything for a field that is not repeatable', fakeAsync(() => {
      bindTo(new DynamicScrollableDropdownModel(MODEL_CONFIG));
      comp.openDropdown(fakeRef);
      tick();

      expect(comp.isOptionDisabled(entry('Article'))).toBeFalsy();
    }));
  });

  // ------------------------------------------------------------------ BUG B
  describe('BUG B - values cleared by a click next to the field', () => {

    beforeEach(fakeAsync(() => {
      const arr = buildArray(1);
      bindTo(arr.get(0).group[0] as any);
      comp.optionsList = [entry('Article'), entry('Book'), entry('Dataset')];
      fixture.detectChanges();
      tick();
    }));

    it('clears exactly once for one full mouse interaction, not twice', () => {
      // The clear entry used to carry BOTH (click) and (mousedown), so a real mouse press fired
      // onSelect(undefined) twice and produced two change events / two JSON patches.
      const clear = fixture.debugElement.query(By.css('button.dropdown-item.scrollable-dropdown-clear'));
      expect(clear).withContext('the clear entry is rendered').not.toBeNull();

      spyOn(comp, 'onSelect');
      clear.nativeElement.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      clear.nativeElement.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      clear.nativeElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(comp.onSelect).toHaveBeenCalledTimes(1);
    });

    it('commits an option exactly once for one full mouse interaction', () => {
      // Options intentionally commit on mousedown: blurring the input flips showErrorMessages on a
      // required field and DsDynamicFormControlContainerComponent then destroys and re-creates this
      // control, so the element is gone before a click event could reach it. Committing on
      // mousedown must therefore not be paired with a second handler.
      const option = fixture.debugElement.queryAll(By.css('button.dropdown-item.collection-item'))
        .find((de) => (de.nativeElement.textContent || '').trim() === 'Article');
      expect(option).withContext('the Article option is rendered').toBeDefined();

      spyOn(comp, 'selectEntry');
      option.nativeElement.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      option.nativeElement.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      option.nativeElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(comp.selectEntry).toHaveBeenCalledTimes(1);
    });

    it('does not put the destructive clear entry directly under the input', () => {
      // The menu overlays the field and the rows beneath it, so whatever sits at the top of the
      // menu is what a dismissing click lands on. That must never be "Clear selection".
      const items = fixture.debugElement.queryAll(By.css('.scrollable-menu button.dropdown-item'));
      const firstItem = items[0].nativeElement;

      expect(firstItem.classList.contains('scrollable-dropdown-clear'))
        .withContext('the first entry of the menu must not be the clear action').toBeFalsy();
    });

    it('keeps the clear entry available (further down the menu)', () => {
      const clear = fixture.debugElement.query(By.css('button.dropdown-item.scrollable-dropdown-clear'));
      expect(clear).withContext('clearing must still be possible').not.toBeNull();
    });

    it('clears the value when the clear entry is actually chosen', fakeAsync(() => {
      (comp.model as any).value = entry('Article');
      spyOn(comp.change, 'emit');

      comp.onSelect(undefined);
      tick();

      expect(comp.change.emit).toHaveBeenCalled();
      expect((comp.model as any).value).toBeFalsy();
    }));
  });
});
