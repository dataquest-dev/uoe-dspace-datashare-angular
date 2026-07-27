// Regression specs for the row -> FormControl binding of a repeatable field.
//
// `getControlOfGroup()` used to stamp a `startingIndex` on the group model the first time a row
// rendered and then resolve that row's FormGroup as `control.get([startingIndex])` forever.
// Nothing re-synced it when the FormArray was mutated, so after removing a non-last row the
// surviving rows bound to the wrong FormGroup (or to null), and after remove+insert two rows
// could alias onto the same FormGroup.
//
// That is what let a value the user never touched be overwritten, and what made the duplicate
// detection in DsDynamicScrollableDropdownComponent read stale sibling values.
import { HttpClient } from '@angular/common/http';
import { EventEmitter } from '@angular/core';
import {
  ComponentFixture,
  inject,
  TestBed,
} from '@angular/core/testing';
import {
  ReactiveFormsModule,
  UntypedFormArray,
} from '@angular/forms';
import { By } from '@angular/platform-browser';
import {
  DYNAMIC_FORM_CONTROL_MAP_FN,
  DynamicFormLayoutService,
  DynamicFormService,
  DynamicFormValidationService,
  DynamicInputModel,
} from '@ng-dynamic-forms/core';
import { provideMockStore } from '@ngrx/store/testing';
import {
  TranslateModule,
  TranslateService,
} from '@ngx-translate/core';
import { NgxMaskModule } from 'ngx-mask';
import { of } from 'rxjs';

import {
  APP_CONFIG,
  APP_DATA_SERVICES_MAP,
} from '../../../../../../../config/app-config.interface';
import { environment } from '../../../../../../../environments/environment.test';
import { SubmissionService } from '../../../../../../submission/submission.service';
import { LiveRegionService } from '../../../../../live-region/live-region.service';
import { getLiveRegionServiceStub } from '../../../../../live-region/live-region.service.stub';
import { DsDynamicFormControlContainerComponent } from '../../ds-dynamic-form-control-container.component';
import { dsDynamicFormControlMapFn } from '../../ds-dynamic-form-control-map-fn';
import { DynamicRowArrayModel } from '../ds-dynamic-row-array-model';
import { DsDynamicFormArrayComponent } from './dynamic-form-array.component';

describe('DsDynamicFormArrayComponent row/control binding', () => {
  const translateServiceStub = {
    get: () => of('translated-text'),
    instant: () => 'translated-text',
    onLangChange: new EventEmitter(),
    onTranslationChange: new EventEmitter(),
    onDefaultLangChange: new EventEmitter(),
  };

  let component: DsDynamicFormArrayComponent;
  let fixture: ComponentFixture<DsDynamicFormArrayComponent>;
  // FormBuilderService only inherits these from DynamicFormService; using the base service keeps
  // the fixture free of the whole submission dependency graph.
  let forms: DynamicFormService;

  /** The FormArray backing the rows of the repeatable field. */
  const formArray = (): UntypedFormArray => component.group.get(component.model.id) as UntypedFormArray;

  /** Value currently held by the control that row `i` is bound to. */
  const boundValue = (i: number): any =>
    (component.getControlOfGroup(component.model.groups[i]) as any)?.get('rowInput')?.value;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ReactiveFormsModule,
        DsDynamicFormArrayComponent,
        NgxMaskModule.forRoot(),
        TranslateModule.forRoot(),
      ],
      providers: [
        DynamicFormLayoutService,
        DynamicFormValidationService,
        provideMockStore(),
        { provide: APP_DATA_SERVICES_MAP, useValue: {} },
        { provide: TranslateService, useValue: translateServiceStub },
        { provide: HttpClient, useValue: {} },
        { provide: SubmissionService, useValue: {} },
        { provide: APP_CONFIG, useValue: environment },
        { provide: DYNAMIC_FORM_CONTROL_MAP_FN, useValue: dsDynamicFormControlMapFn },
        { provide: LiveRegionService, useValue: getLiveRegionServiceStub() },
      ],
    }).overrideComponent(DsDynamicFormArrayComponent, {
      remove: { imports: [DsDynamicFormControlContainerComponent] },
    }).compileComponents();
  });

  beforeEach(inject([DynamicFormService],
    (service: DynamicFormService) => {
      forms = service;

      const formModel = [
        new DynamicRowArrayModel({
          id: 'typeArray',
          initialCount: 3,
          notRepeatable: false,
          relationshipConfig: undefined,
          submissionId: '1234',
          isDraggable: true,
          groupFactory: () => [new DynamicInputModel({ id: 'rowInput' })],
          required: false,
          metadataKey: 'dc.type',
          metadataFields: ['dc.type'],
          hasSelectableMetadata: true,
          showButtons: true,
        }),
      ];

      fixture = TestBed.createComponent(DsDynamicFormArrayComponent);
      component = fixture.componentInstance;
      component.model = formModel[0] as DynamicRowArrayModel;
      component.group = service.createFormGroup(formModel);
      fixture.detectChanges();

      // Give each row a distinct value, as if the user had picked three Types.
      ['Article', 'Book', 'Dataset'].forEach((value, i) => {
        formArray().at(i).get('rowInput').setValue(value);
        (component.model.groups[i].group[0] as any).value = value;
      });

      // Render once so every row gets its binding resolved (this is what used to freeze it).
      component.model.groups.forEach((g) => component.getControlOfGroup(g));
    }));

  it('binds every row to its own control before any mutation', () => {
    expect([boundValue(0), boundValue(1), boundValue(2)]).toEqual(['Article', 'Book', 'Dataset']);
  });

  it('rebinds the surviving rows after the MIDDLE row is removed', () => {
    forms.removeFormArrayGroup(1, formArray(), component.model);
    fixture.detectChanges();

    expect(component.model.groups.length).withContext('one row removed').toBe(2);
    expect(boundValue(0)).withContext('row 0 keeps Article').toBe('Article');
    expect(boundValue(1)).withContext('row 1 must now resolve to Dataset, not to Book or null').toBe('Dataset');
  });

  it('never resolves two rows to the same control after remove + insert', () => {
    forms.removeFormArrayGroup(1, formArray(), component.model);
    forms.insertFormArrayGroup(component.model.groups.length, formArray(), component.model);
    fixture.detectChanges();

    const controls = component.model.groups.map((g) => component.getControlOfGroup(g));
    expect(controls.length).toBe(3);
    controls.forEach((c, i) => expect(c).withContext(`row ${i} must be bound to a control`).not.toBeNull());
    expect(new Set(controls).size).withContext('each row must own a distinct FormGroup').toBe(controls.length);
  });

  it('keeps the surviving row\'s value intact after remove + insert', () => {
    forms.removeFormArrayGroup(1, formArray(), component.model);
    forms.insertFormArrayGroup(component.model.groups.length, formArray(), component.model);
    fixture.detectChanges();

    expect(boundValue(0)).withContext('Article untouched').toBe('Article');
    expect(boundValue(1)).withContext('Dataset must survive the delete+add').toBe('Dataset');
    expect(boundValue(2)).withContext('the freshly added row is empty').toBeFalsy();
  });

  it('rebinds after the FIRST row is removed', () => {
    forms.removeFormArrayGroup(0, formArray(), component.model);
    fixture.detectChanges();

    expect(boundValue(0)).withContext('Book moved up into position 0').toBe('Book');
    expect(boundValue(1)).withContext('Dataset moved up into position 1').toBe('Dataset');
  });

  it('keeps rows and controls in sync when a keyboard reorder is cancelled', () => {
    const dropList = fixture.debugElement.query(By.css('.cdk-drop-list')).nativeElement;
    const rowEl = dropList.querySelectorAll('[cdkDrag]')[0] as HTMLDivElement;

    // Pick row 0 up, move it down twice, then abandon the reorder with Escape.
    component.toggleKeyboardDragAndDrop(new KeyboardEvent('keydown', { key: ' ' }), rowEl, 0, 3);
    component.handleArrowPress(new KeyboardEvent('keydown', { key: 'ArrowDown' }), dropList, 3, 0, 'down');
    component.handleArrowPress(new KeyboardEvent('keydown', { key: 'ArrowDown' }), dropList, 3, 1, 'down');
    fixture.detectChanges();

    component.cancelKeyboardDragAndDrop(rowEl, 2, 3);
    fixture.detectChanges();

    expect([boundValue(0), boundValue(1), boundValue(2)])
      .withContext('cancelling must restore the original order for models AND controls')
      .toEqual(['Article', 'Book', 'Dataset']);
  });

  it('keeps rows and controls in sync through a completed keyboard reorder', () => {
    const dropList = fixture.debugElement.query(By.css('.cdk-drop-list')).nativeElement;
    const rowEl = dropList.querySelectorAll('[cdkDrag]')[0] as HTMLDivElement;

    component.toggleKeyboardDragAndDrop(new KeyboardEvent('keydown', { key: ' ' }), rowEl, 0, 3);
    component.handleArrowPress(new KeyboardEvent('keydown', { key: 'ArrowDown' }), dropList, 3, 0, 'down');
    fixture.detectChanges();

    expect([boundValue(0), boundValue(1), boundValue(2)])
      .withContext('Article moved down one place, controls followed')
      .toEqual(['Book', 'Article', 'Dataset']);
  });

  it('rebinds after a row is inserted in the middle', () => {
    forms.insertFormArrayGroup(1, formArray(), component.model);
    fixture.detectChanges();

    expect(boundValue(0)).toBe('Article');
    expect(boundValue(1)).withContext('the inserted row is empty').toBeFalsy();
    expect(boundValue(2)).withContext('Book shifted down').toBe('Book');
    expect(boundValue(3)).withContext('Dataset shifted down').toBe('Dataset');
  });
});
