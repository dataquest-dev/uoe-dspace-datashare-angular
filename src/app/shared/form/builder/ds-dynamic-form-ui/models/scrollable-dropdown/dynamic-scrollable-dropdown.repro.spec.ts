// Reproduction spec for PR #26 reported issues:
//  Issue 1: duplicate value can be added after deleting a row.
//  Issue 2: opening the dropdown and clicking outside (blur) clears selected value(s).
//
// This spec uses the REAL @ng-dynamic-forms DynamicFormArrayModel semantics
// (parent wiring, removeGroup/insertGroup reindex) that the production form builder uses.
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

const SD_TEST_MODEL_CONFIG = {
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
  repeatable: true,
  value: undefined,
  metadataFields: [],
  submissionId: '1234',
  hasSelectableMetadata: false,
};

const entry = (v: any, display?: string) =>
  Object.assign(new VocabularyEntry(), { authority: v, display: display ?? ('e' + v), value: v });

/**
 * Build a repeatable DynamicFormArrayModel and wire each child model's `parent`
 * to its group, exactly like the library's createFormArray/createFormGroup does.
 */
function buildArray(count: number): DynamicFormArrayModel {
  const arrayModel = new DynamicFormArrayModel({
    id: 'dropdownArray',
    groupFactory: () => [new DynamicScrollableDropdownModel(SD_TEST_MODEL_CONFIG)],
    initialCount: count,
  });
  arrayModel.groups.forEach((g) => g.group.forEach((m) => ((m as any).parent = g)));
  return arrayModel;
}

/** Faithful to DynamicFormService.insertFormArrayGroup: insertGroup + createFormGroup(parent). */
function addRow(arrayModel: DynamicFormArrayModel, index: number) {
  const g = arrayModel.insertGroup(index);
  g.group.forEach((m) => ((m as any).parent = g));
  return g;
}

/** Faithful to DynamicFormService.removeFormArrayGroup (model side): removeGroup(splice+reindex). */
function removeRow(arrayModel: DynamicFormArrayModel, index: number) {
  arrayModel.removeGroup(index);
}

describe('REPRO PR#26 – duplicate + clear-on-blur', () => {
  let fixture: ComponentFixture<DsDynamicScrollableDropdownComponent>;
  let comp: DsDynamicScrollableDropdownComponent;
  const vocabularyServiceStub = new VocabularyServiceStub();

  beforeEach(waitForAsync(() => {
    // Options available: value 1 ('one') and value 2 ('two') from the stub.
    vocabularyServiceStub.setNewPayload([
      Object.assign(new VocabularyEntry(), { authority: 1, display: 'one', value: 1 }),
      Object.assign(new VocabularyEntry(), { authority: 2, display: 'two', value: 2 }),
      Object.assign(new VocabularyEntry(), { authority: 3, display: 'three', value: 3 }),
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

  /** Bind the component under test to a specific row model of the array. */
  function bindComponentToRow(rowModel: DynamicScrollableDropdownModel) {
    fixture = TestBed.createComponent(DsDynamicScrollableDropdownComponent);
    comp = fixture.componentInstance;
    comp.group = new UntypedFormGroup({ dropdown: new UntypedFormControl() });
    comp.model = rowModel;
    fixture.detectChanges();
  }

  const fakeRef: any = { open: () => undefined, close: () => undefined, isOpen: () => false };

  it('SANITY: sibling value is disabled in a fresh 2-row array', fakeAsync(() => {
    const arr = buildArray(2);
    (arr.get(0).group[0] as any).value = entry(1);        // row0 -> value 1
    bindComponentToRow(arr.get(1).group[0] as any);        // component = row1
    comp.openDropdown(fakeRef);
    tick();
    expect(comp.isOptionDisabled(entry(1))).withContext('value 1 used by row0').toBeTruthy();
    expect(comp.isOptionDisabled({ value: 1 })).withContext('option 1 disabled').toBeTruthy();
    expect(comp.isOptionDisabled({ value: 2 })).withContext('option 2 free').toBeFalsy();
  }));

  it('ISSUE 1a: after deleting the MIDDLE row and adding a new row, still-present values must stay disabled', fakeAsync(() => {
    const arr = buildArray(3);
    (arr.get(0).group[0] as any).value = entry(1); // A=1
    (arr.get(1).group[0] as any).value = entry(2); // B=2
    (arr.get(2).group[0] as any).value = entry(3); // C=3

    removeRow(arr, 1);          // delete middle (B=2) -> rows [A=1, C=3]
    const newGroup = addRow(arr, 2); // add new empty row -> [A=1, C=3, new]
    bindComponentToRow(newGroup.group[0] as any);

    comp.openDropdown(fakeRef);
    tick();

    // A(1) and C(3) are still used in other rows => must be disabled. B(2) is free.
    expect(comp.isOptionDisabled({ value: 1 })).withContext('A=1 still used -> disabled').toBeTruthy();
    expect(comp.isOptionDisabled({ value: 3 })).withContext('C=3 still used -> disabled').toBeTruthy();
    expect(comp.isOptionDisabled({ value: 2 })).withContext('B=2 removed -> free').toBeFalsy();
  }));

  it('ISSUE 1b: sibling stored as FormFieldMetadataValueObject (server round-trip shape) must be detected', fakeAsync(() => {
    const arr = buildArray(2);
    // Plain (non-authority) vocabulary value after a server round-trip.
    (arr.get(0).group[0] as any).value = new FormFieldMetadataValueObject('one', null, null, 'one');
    bindComponentToRow(arr.get(1).group[0] as any);
    comp.openDropdown(fakeRef);
    tick();
    expect(comp.isOptionDisabled({ value: 'one' })).withContext('option one disabled').toBeTruthy();
  }));

  it('ISSUE 1e: authority-controlled duplicate IS detected via authority even when the display value differs', fakeAsync(() => {
    const arr = buildArray(2);
    // Sibling as it looks after a server round-trip for an authority vocabulary (Funder):
    // short value 'NSF' with an authority key.
    (arr.get(0).group[0] as any).value = new FormFieldMetadataValueObject('NSF', null, 'auth-1', 'NSF');
    bindComponentToRow(arr.get(1).group[0] as any);
    comp.openDropdown(fakeRef);
    tick();
    // The freshly-loaded option for the SAME funder (authority 'auth-1') whose value is
    // rendered as the full name. Same funder -> must be treated as a duplicate.
    const sameFunder = Object.assign(new VocabularyEntry(), {
      authority: 'auth-1', value: 'National Science Foundation', display: 'National Science Foundation',
    });
    expect(comp.isOptionDisabled(sameFunder))
      .withContext('same authority => same funder => must be disabled (dedup ignores authority)').toBeTruthy();
  }));

  it('ISSUE 1d: a value chosen by a sibling AFTER open is still blocked at commit (live re-check)', fakeAsync(() => {
    const arr = buildArray(2);
    (arr.get(0).group[0] as any).value = entry(1);
    const rowModel = arr.get(1).group[0] as any;
    bindComponentToRow(rowModel);
    comp.openDropdown(fakeRef);
    tick();

    // A sibling row gains value 2 AFTER this dropdown was opened.
    const g2 = addRow(arr, 2);
    (g2.group[0] as any).value = entry(2);

    spyOn(comp.change, 'emit');
    comp.selectEntry(entry(2), fakeRef); // must refresh live + block
    expect(comp.change.emit).withContext('duplicate committed via stale set').not.toHaveBeenCalled();
    expect(rowModel.value).withContext('value must remain unset').toBeUndefined();
  }));

  it('ISSUE 2: opening the dropdown then blurring (click outside) must NOT clear the selected value', fakeAsync(() => {
    const arr = buildArray(2);
    const rowModel = arr.get(0).group[0] as any;
    bindComponentToRow(rowModel);

    // user has selected value 1 (display 'e1')
    comp.onSelect(entry(1));
    tick();
    let displayed: any;
    comp.currentValue.subscribe((v) => (displayed = v));
    expect(rowModel.value).withContext('value selected').toEqual(entry(1));
    expect(displayed).withContext('display shows selection').toBe('e1');

    // user re-opens the dropdown, then clicks outside (blur) without selecting
    comp.openDropdown(fakeRef);
    tick();
    comp.onBlur(new Event('blur'));
    tick();
    comp.currentValue.subscribe((v) => (displayed = v));

    expect(rowModel.value).withContext('value must be preserved after blur').toEqual(entry(1));
    expect(displayed).withContext('display must be preserved after blur').toBe('e1');
  }));

  it('GUARD: a disabled option selected via mousedown path is ignored by selectEntry', fakeAsync(() => {
    const arr = buildArray(2);
    (arr.get(0).group[0] as any).value = entry(1);
    const rowModel = arr.get(1).group[0] as any;
    bindComponentToRow(rowModel);
    comp.openDropdown(fakeRef);
    tick();
    spyOn(comp.change, 'emit');
    // dsBtnDisabled does NOT block mousedown; selectEntry must guard instead.
    comp.selectEntry(entry(1), fakeRef);
    expect(comp.change.emit).withContext('disabled option must not be selected').not.toHaveBeenCalled();
    expect(rowModel.value).withContext('value untouched').toBeUndefined();
  }));
});
