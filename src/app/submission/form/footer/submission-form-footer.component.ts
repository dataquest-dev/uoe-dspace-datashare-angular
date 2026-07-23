import { CommonModule } from '@angular/common';
import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';
import {
  Observable,
  of as observableOf,
  timer,
} from 'rxjs';
import {
  distinctUntilChanged,
  map,
  switchMap,
  take,
} from 'rxjs/operators';

import { SubmissionRestService } from '../../../core/submission/submission-rest.service';
import { SubmissionScopeType } from '../../../core/submission/submission-scope-type';
import { DatashareUploadFromPathService } from '../../../datashare/datashare-upload-from-path.service';
import { BtnDisabledDirective } from '../../../shared/btn-disabled.directive';
import { isNotEmpty } from '../../../shared/empty.util';
import { BrowserOnlyPipe } from '../../../shared/utils/browser-only.pipe';
import { SubmissionService } from '../../submission.service';

// DATASHARE - start
/**
 * Message shown by the save progress bar for an ordinary save.
 */
export const SAVING_MESSAGE_KEY = 'submission.general.info.saving';

/**
 * Message shown by the save progress bar when the save also ingests a file from the server filesystem.
 */
export const INGESTING_FROM_PATH_MESSAGE_KEY = 'submission.general.info.ingesting-from-path';
// DATASHARE - end

/**
 * This component represents submission form footer bar.
 */
@Component({
  selector: 'ds-submission-form-footer',
  styleUrls: ['./submission-form-footer.component.scss'],
  templateUrl: './submission-form-footer.component.html',
  standalone: true,
  imports: [CommonModule, BrowserOnlyPipe, TranslateModule, BtnDisabledDirective],
})
export class SubmissionFormFooterComponent implements OnChanges {

  /**
   * The submission id
   * @type {string}
   */
  @Input() submissionId: string;

  /**
   * A boolean representing if a submission deposit operation is pending
   * @type {Observable<boolean>}
   */
  public processingDepositStatus: Observable<boolean>;

  /**
   * A boolean representing if a submission save operation is pending
   * @type {Observable<boolean>}
   */
  public processingSaveStatus: Observable<boolean>;

  /**
   * A boolean representing if showing deposit and discard buttons
   * @type {Observable<boolean>}
   */
  public showDepositAndDiscard: Observable<boolean>;

  /**
   * A boolean representing if submission form is valid or not
   * @type {Observable<boolean>}
   */
  public submissionIsInvalid: Observable<boolean> = observableOf(true);

  /**
   * A boolean representing if submission form has unsaved modifications
   */
  public hasUnsavedModification: Observable<boolean>;

  // DATASHARE - start
  /**
   * Whether the running save will make the server ingest a file; latched while a save runs.
   * @type {Observable<boolean>}
   */
  public pathIngestPending$: Observable<boolean> = observableOf(false);

  /**
   * The message key the save progress bar has to show
   * @type {Observable<string>}
   */
  public savingLabelKey$: Observable<string> = observableOf(SAVING_MESSAGE_KEY);

  /**
   * The mm:ss elapsed since the running save started, empty while no save is running
   * @type {Observable<string>}
   */
  public elapsed$: Observable<string> = observableOf('');
  // DATASHARE - end

  /**
   * Initialize instance variables
   *
   * @param {NgbModal} modalService
   * @param {SubmissionRestService} restService
   * @param {SubmissionService} submissionService
   * @param {DatashareUploadFromPathService} uploadFromPathService
   */
  constructor(private modalService: NgbModal,
              private restService: SubmissionRestService,
              private submissionService: SubmissionService,
              private uploadFromPathService: DatashareUploadFromPathService) {
  }

  /**
   * Initialize all instance variables
   */
  ngOnChanges(changes: SimpleChanges) {
    if (isNotEmpty(this.submissionId)) {
      this.submissionIsInvalid = this.submissionService.getSubmissionStatus(this.submissionId).pipe(
        map((isValid: boolean) => isValid === false),
      );

      this.processingSaveStatus = this.submissionService.getSubmissionSaveProcessingStatus(this.submissionId);
      this.processingDepositStatus = this.submissionService.getSubmissionDepositProcessingStatus(this.submissionId);
      this.showDepositAndDiscard = observableOf(this.submissionService.getSubmissionScope() === SubmissionScopeType.WorkspaceItem);
      this.hasUnsavedModification = this.submissionService.hasUnsavedModification();

      // DATASHARE - start
      const livePathIngestPending$ = this.uploadFromPathService.isPendingForSubmission(this.submissionId);
      // A running save must latch its pending state: read live, the label would track a body already
      // gone. While nothing is saving, the live value is all there is.
      this.pathIngestPending$ = this.processingSaveStatus.pipe(
        distinctUntilChanged(),
        switchMap((saving: boolean) => saving ? livePathIngestPending$.pipe(take(1)) : livePathIngestPending$),
        distinctUntilChanged(),
      );
      this.savingLabelKey$ = this.pathIngestPending$.pipe(
        map((pending: boolean) => pending ? INGESTING_FROM_PATH_MESSAGE_KEY : SAVING_MESSAGE_KEY),
        distinctUntilChanged(),
      );
      // The ingest runs inside the save request, so only elapsed time (not byte progress) is available.
      this.elapsed$ = this.processingSaveStatus.pipe(
        distinctUntilChanged(),
        switchMap((saving: boolean) => {
          if (!saving) {
            return observableOf('');
          }
          // Measured against the clock, not counted ticks: backgrounded tabs throttle timers to ~1/min,
          // so counting ticks would under-report a long ingest's elapsed time.
          const startedAt: number = Date.now();
          return timer(0, 1000).pipe(map(() => this.formatElapsed(Date.now() - startedAt)));
        }),
      );
      // DATASHARE - end
    }
  }

  /**
   * Dispatch a submission save action
   */
  save(event) {
    this.submissionService.dispatchSave(this.submissionId, true);
  }

  /**
   * Dispatch a submission save for later action
   */
  saveLater(event) {
    this.submissionService.dispatchSaveForLater(this.submissionId);
  }

  /**
   * Dispatch a submission deposit action
   */
  public deposit(event) {
    this.submissionService.dispatchDeposit(this.submissionId);
  }

  /**
   * Dispatch a submission discard action
   */
  public confirmDiscard(content) {
    this.modalService.open(content).result.then(
      (result) => {
        if (result === 'ok') {
          this.submissionService.dispatchDiscard(this.submissionId);
        }
      },
    );
  }

  // DATASHARE - start
  /**
   * Render a duration as mm:ss, letting the minutes run past 59 so an hour-plus ingest reads as "72:15".
   *
   * @param elapsedMillis the milliseconds since the running save started
   */
  private formatElapsed(elapsedMillis: number): string {
    // Clamp at 0: the clock can step backwards (manual change, NTP), and a negative count would alarm.
    const elapsedSeconds = Math.max(0, Math.floor(elapsedMillis / 1000));
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  // DATASHARE - end
}
