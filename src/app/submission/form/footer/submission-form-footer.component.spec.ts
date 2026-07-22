import {
  ChangeDetectorRef,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  signal,
  SimpleChange,
} from '@angular/core';
import {
  ComponentFixture,
  discardPeriodicTasks,
  fakeAsync,
  inject,
  TestBed,
  tick,
  waitForAsync,
} from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import {
  NgbModal,
  NgbModule,
} from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';
import {
  cold,
  getTestScheduler,
  hot,
} from 'jasmine-marbles';
import {
  BehaviorSubject,
  of as observableOf,
} from 'rxjs';
import { TestScheduler } from 'rxjs/testing';

import { SubmissionRestService } from '../../../core/submission/submission-rest.service';
import { DatashareSubmissionService } from '../../../datashare/datashare-submission.service';
import { DatashareUploadFromPathService } from '../../../datashare/datashare-upload-from-path.service';
import { BtnDisabledDirective } from '../../../shared/btn-disabled.directive';
import { mockSubmissionId } from '../../../shared/mocks/submission.mock';
import { SubmissionRestServiceStub } from '../../../shared/testing/submission-rest-service.stub';
import { SubmissionServiceStub } from '../../../shared/testing/submission-service.stub';
import { createTestComponent } from '../../../shared/testing/utils.test';
import { SubmissionService } from '../../submission.service';
import { SubmissionFormFooterComponent } from './submission-form-footer.component';

const submissionServiceStub: SubmissionServiceStub = new SubmissionServiceStub();

const submissionId = mockSubmissionId;

const mockDatashareSubmissionService = {
  hasUploadFilesErrorsSignal: signal(true),
};

const pathIngestPending$ = new BehaviorSubject<boolean>(false);

const mockDatashareUploadFromPathService = {
  isPendingForSubmission: () => pathIngestPending$.asObservable(),
};

describe('SubmissionFormFooterComponent', () => {

  let comp: SubmissionFormFooterComponent;
  let compAsAny: any;
  let fixture: ComponentFixture<SubmissionFormFooterComponent>;
  let submissionRestServiceStub: SubmissionRestServiceStub;
  let scheduler: TestScheduler;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [
        NgbModule,
        TranslateModule.forRoot(),
        SubmissionFormFooterComponent,
        TestComponent,
        BtnDisabledDirective,
      ],
      providers: [
        { provide: SubmissionService, useValue: submissionServiceStub },
        { provide: SubmissionRestService, useClass: SubmissionRestServiceStub },
        { provide: DatashareSubmissionService, useValue: mockDatashareSubmissionService },
        { provide: DatashareUploadFromPathService, useValue: mockDatashareUploadFromPathService },
        ChangeDetectorRef,
        NgbModal,
        SubmissionFormFooterComponent,
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();
  }));

  describe('', () => {
    let testComp: TestComponent;
    let testFixture: ComponentFixture<TestComponent>;

    // synchronous beforeEach
    beforeEach(() => {
      submissionServiceStub.getSubmissionStatus.and.returnValue(observableOf(true));
      submissionServiceStub.getSubmissionSaveProcessingStatus.and.returnValue(observableOf(false));
      const html = `
        <ds-submission-form-footer [submissionId]="submissionId"></ds-submission-form-footer>`;

      testFixture = createTestComponent(html, TestComponent) as ComponentFixture<TestComponent>;
      testComp = testFixture.componentInstance;
      testFixture.detectChanges();
    });

    afterEach(() => {
      testFixture.destroy();
    });

    it('should create SubmissionFormFooterComponent', inject([SubmissionFormFooterComponent], (app: SubmissionFormFooterComponent) => {

      expect(app).toBeDefined();

    }));
  });

  describe('', () => {
    beforeEach(() => {
      scheduler = getTestScheduler();
      fixture = TestBed.createComponent(SubmissionFormFooterComponent);
      comp = fixture.componentInstance;
      compAsAny = comp;
      submissionRestServiceStub = TestBed.inject(SubmissionRestService as any);
      comp.submissionId = submissionId;

    });

    afterEach(() => {
      comp = null;
      compAsAny = null;
      fixture = null;
    });

    describe('ngOnChanges', () => {
      beforeEach(() => {
        submissionServiceStub.getSubmissionStatus.and.returnValue(hot('-a-b', {
          a: false,
          b: true,
        }));

        submissionServiceStub.getSubmissionSaveProcessingStatus.and.returnValue(hot('-a-b', {
          a: false,
          b: true,
        }));

        submissionServiceStub.getSubmissionDepositProcessingStatus.and.returnValue(hot('-a-b', {
          a: false,
          b: true,
        }));
      });

      it('should set submissionIsInvalid properly', () => {

        const expected = cold('-c-d', {
          c: true,
          d: false,
        });

        comp.ngOnChanges({
          submissionId: new SimpleChange(null, submissionId, true),
        });

        fixture.detectChanges();

        expect(compAsAny.submissionIsInvalid).toBeObservable(expected);
      });

      it('should set processingSaveStatus properly', () => {

        const expected = cold('-c-d', {
          c: false,
          d: true,
        });

        comp.ngOnChanges({
          submissionId: new SimpleChange(null, submissionId, true),
        });

        fixture.detectChanges();

        expect(comp.processingSaveStatus).toBeObservable(expected);
      });

      it('should set processingDepositStatus properly', () => {

        const expected = cold('-c-d', {
          c: false,
          d: true,
        });

        comp.ngOnChanges({
          submissionId: new SimpleChange(null, submissionId, true),
        });

        fixture.detectChanges();

        expect(comp.processingDepositStatus).toBeObservable(expected);
      });
    });

    it('should call dispatchSave on save', () => {

      comp.save(null);
      fixture.detectChanges();

      expect(submissionServiceStub.dispatchSave).toHaveBeenCalledWith(submissionId, true);
    });

    it('should call dispatchSaveForLater on save for later', () => {

      comp.saveLater(null);
      fixture.detectChanges();

      expect(submissionServiceStub.dispatchSaveForLater).toHaveBeenCalledWith(submissionId);
    });

    it('should call dispatchDeposit on save', () => {

      comp.deposit(null);
      fixture.detectChanges();

      expect(submissionServiceStub.dispatchDeposit).toHaveBeenCalledWith(submissionId);
    });

    describe('on discard confirmation', () => {
      beforeEach((done) => {
        comp.showDepositAndDiscard = observableOf(true);
        fixture.detectChanges();
        const modalBtn = fixture.debugElement.query(By.css('.btn-danger'));

        modalBtn.nativeElement.click();
        fixture.detectChanges();

        const confirmBtn: any = ((document as any).querySelector('.btn-danger:nth-child(2)'));

        confirmBtn.click();

        fixture.detectChanges();
        fixture.whenStable().then(() => {
          done();
        });
      });

      it('should call dispatchDiscard', () => {
        expect(submissionServiceStub.dispatchDiscard).toHaveBeenCalledWith(submissionId);
      });
    });

    it('should not have deposit button disabled when submission is not valid', () => {
      comp.showDepositAndDiscard = observableOf(true);
      compAsAny.submissionIsInvalid = observableOf(true);
      fixture.detectChanges();
      const depositBtn: any = fixture.debugElement.query(By.css('.btn-success'));

      expect(depositBtn.nativeElement.getAttribute('aria-disabled')).toBe('false');
      expect(depositBtn.nativeElement.classList.contains('disabled')).toBeFalse();
    });

    it('should not have deposit button disabled when submission is valid', () => {
      comp.showDepositAndDiscard = observableOf(true);
      compAsAny.submissionIsInvalid = observableOf(false);
      fixture.detectChanges();
      const depositBtn: any = fixture.debugElement.query(By.css('.btn-success'));

      expect(depositBtn.nativeElement.getAttribute('aria-disabled')).toBe('false');
      expect(depositBtn.nativeElement.classList.contains('disabled')).toBeFalse();
    });

    it('should disable save button when all modifications had been saved', () => {
      comp.hasUnsavedModification = observableOf(false);
      fixture.detectChanges();

      const saveBtn: any = fixture.debugElement.query(By.css('#save'));
      expect(saveBtn.nativeElement.getAttribute('aria-disabled')).toBe('true');
      expect(saveBtn.nativeElement.classList.contains('disabled')).toBeTrue();
    });

    it('should enable save button when there are not saved modifications', () => {
      comp.hasUnsavedModification = observableOf(true);
      fixture.detectChanges();

      const saveBtn: any = fixture.debugElement.query(By.css('#save'));
      expect(saveBtn.nativeElement.getAttribute('aria-disabled')).toBe('false');
      expect(saveBtn.nativeElement.classList.contains('disabled')).toBeFalse();
    });

    // DATASHARE - start
    describe('when a save is in progress', () => {

      const triggerNgOnChanges = () => comp.ngOnChanges({
        submissionId: new SimpleChange(null, submissionId, true),
      });

      beforeEach(() => {
        pathIngestPending$.next(false);
        submissionServiceStub.getSubmissionStatus.and.returnValue(observableOf(true));
        submissionServiceStub.getSubmissionSaveProcessingStatus.and.returnValue(observableOf(false));
        submissionServiceStub.getSubmissionDepositProcessingStatus.and.returnValue(observableOf(false));
        submissionServiceStub.hasUnsavedModification.and.returnValue(observableOf(false));
      });

      it('should label the save progress bar with the plain saving message when no path ingest is pending', () => {
        triggerNgOnChanges();

        let label: string;
        comp.savingLabelKey$.subscribe((key: string) => label = key);

        expect(label).toBe('submission.general.info.saving');
      });

      it('should label the save progress bar with the ingest message when a path ingest is pending', () => {
        pathIngestPending$.next(true);
        triggerNgOnChanges();

        let label: string;
        comp.savingLabelKey$.subscribe((key: string) => label = key);

        expect(label).toBe('submission.general.info.ingesting-from-path');
      });

      it('should render a translation key rather than hardcoded English while saving', () => {
        submissionServiceStub.getSubmissionSaveProcessingStatus.and.returnValue(observableOf(true));
        triggerNgOnChanges();
        fixture.detectChanges();

        const progressBar: any = fixture.debugElement.query(By.css('.progress-bar'));

        expect(progressBar.nativeElement.textContent).toContain('submission.general.info.saving');
        expect(progressBar.nativeElement.textContent).not.toContain('Saving...');
      });

      it('should render the ingest message while a path ingest is in progress', fakeAsync(() => {
        pathIngestPending$.next(true);
        submissionServiceStub.getSubmissionSaveProcessingStatus.and.returnValue(observableOf(true));
        triggerNgOnChanges();
        fixture.detectChanges();

        const progressBar: any = fixture.debugElement.query(By.css('.progress-bar'));

        expect(progressBar.nativeElement.textContent).toContain('submission.general.info.ingesting-from-path');
        discardPeriodicTasks();
      }));

      it('should render a translation key rather than hardcoded English while depositing', () => {
        submissionServiceStub.getSubmissionDepositProcessingStatus.and.returnValue(observableOf(true));
        triggerNgOnChanges();
        fixture.detectChanges();

        const progressBar: any = fixture.debugElement.query(By.css('.progress-bar'));

        expect(progressBar.nativeElement.textContent).toContain('submission.general.info.depositing');
        expect(progressBar.nativeElement.textContent).not.toContain('Depositing...');
      });

      it('should run the elapsed timer only while a save is in progress', fakeAsync(() => {
        const saving$ = new BehaviorSubject<boolean>(false);
        submissionServiceStub.getSubmissionSaveProcessingStatus.and.returnValue(saving$.asObservable());
        triggerNgOnChanges();

        const emitted: string[] = [];
        const subscription = comp.elapsed$.subscribe((elapsed: string) => emitted.push(elapsed));

        tick(3000);
        expect(emitted).toEqual(['']);

        saving$.next(true);
        tick(0);
        expect(emitted[emitted.length - 1]).toBe('00:00');

        tick(2000);
        expect(emitted[emitted.length - 1]).toBe('00:02');

        saving$.next(false);
        expect(emitted[emitted.length - 1]).toBe('');

        tick(5000);
        expect(emitted[emitted.length - 1]).toBe('');

        subscription.unsubscribe();
        discardPeriodicTasks();
      }));

      it('should count elapsed wall-clock time rather than timer ticks', fakeAsync(() => {
        const saving$ = new BehaviorSubject<boolean>(false);
        submissionServiceStub.getSubmissionSaveProcessingStatus.and.returnValue(saving$.asObservable());
        triggerNgOnChanges();

        // A tab that has been hidden for a while gets roughly one timer callback a minute, so the
        // number of emissions says nothing about how long the ingest has really been running.
        let clock = Date.now();
        spyOn(Date, 'now').and.callFake(() => clock);

        const emitted: string[] = [];
        const subscription = comp.elapsed$.subscribe((elapsed: string) => emitted.push(elapsed));

        saving$.next(true);
        tick(0);
        expect(emitted[emitted.length - 1]).toBe('00:00');

        clock += 180000;
        tick(1000);
        expect(emitted[emitted.length - 1]).toBe('03:00');

        clock += 120000;
        tick(1000);
        expect(emitted[emitted.length - 1]).toBe('05:00');

        subscription.unsubscribe();
        discardPeriodicTasks();
      }));

      it('should let the minutes run past 59 for an ingest longer than an hour', fakeAsync(() => {
        const saving$ = new BehaviorSubject<boolean>(false);
        submissionServiceStub.getSubmissionSaveProcessingStatus.and.returnValue(saving$.asObservable());
        triggerNgOnChanges();

        let clock = Date.now();
        spyOn(Date, 'now').and.callFake(() => clock);

        const emitted: string[] = [];
        const subscription = comp.elapsed$.subscribe((elapsed: string) => emitted.push(elapsed));

        saving$.next(true);
        tick(0);

        // 65 minutes and 15 seconds
        clock += 3915000;
        tick(1000);
        expect(emitted[emitted.length - 1]).toBe('65:15');

        subscription.unsubscribe();
        discardPeriodicTasks();
      }));

      it('should latch the pending state of the save that is running and ignore a later change', () => {
        const saving$ = new BehaviorSubject<boolean>(false);
        submissionServiceStub.getSubmissionSaveProcessingStatus.and.returnValue(saving$.asObservable());
        triggerNgOnChanges();

        const labels: string[] = [];
        const subscription = comp.savingLabelKey$.subscribe((key: string) => labels.push(key));

        saving$.next(true);
        // the path is typed while the PATCH that does not carry it is still in flight
        pathIngestPending$.next(true);

        expect(labels).toEqual(['submission.general.info.saving']);

        subscription.unsubscribe();
      });

      it('should keep claiming an ingest for the whole of a save that was dispatched with a path', () => {
        const saving$ = new BehaviorSubject<boolean>(false);
        submissionServiceStub.getSubmissionSaveProcessingStatus.and.returnValue(saving$.asObservable());
        pathIngestPending$.next(true);
        triggerNgOnChanges();

        const labels: string[] = [];
        const subscription = comp.savingLabelKey$.subscribe((key: string) => labels.push(key));

        saving$.next(true);
        // the server clears the field, so the live state goes false before the save has come back
        pathIngestPending$.next(false);

        expect(labels).toEqual(['submission.general.info.ingesting-from-path']);

        subscription.unsubscribe();
      });

    });
    // DATASHARE - end

  });
});

// declare a test component
@Component({
  selector: 'ds-test-cmp',
  template: ``,
  standalone: true,
  imports: [NgbModule],
})
class TestComponent {

  submissionId = mockSubmissionId;

}
