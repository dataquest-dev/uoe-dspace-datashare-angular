import { NgIf } from '@angular/common';
import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import {
  Observable,
  of as observableOf,
  Subscription,
} from 'rxjs';
import {
  first,
  take,
} from 'rxjs/operators';

import { WorkspaceItem } from '../../../core/submission/models/workspaceitem.model';
import { SubmissionJsonPatchOperationsService } from '../../../core/submission/submission-json-patch-operations.service';
import { normalizeSectionData } from '../../../core/submission/submission-response-parsing.service';
import {
  hasValue,
  isEmpty,
  isNotEmpty,
} from '../../../shared/empty.util';
import { NotificationsService } from '../../../shared/notifications/notifications.service';
import { UploaderComponent } from '../../../shared/upload/uploader/uploader.component';
import { UploaderCompleteEvent } from '../../../shared/upload/uploader/uploader-complete-event.model';
import { UploaderError } from '../../../shared/upload/uploader/uploader-error.model';
import { UploaderOptions } from '../../../shared/upload/uploader/uploader-options.model';
import { SectionsService } from '../../sections/sections.service';
import { SectionsType } from '../../sections/sections-type';
import { SubmissionService } from '../../submission.service';
import parseSectionErrors from '../../utils/parseSectionErrors';

/**
 * This component represents the drop zone that provides to add files to the submission.
 */
@Component({
  selector: 'ds-base-submission-upload-files',
  templateUrl: './submission-upload-files.component.html',
  imports: [
    UploaderComponent,
    NgIf,
  ],
  standalone: true,
})
export class SubmissionUploadFilesComponent implements OnChanges, OnDestroy {

  /**
   * The collection id this submission belonging to
   * @type {string}
   */
  @Input() collectionId: string;

  /**
   * The submission id
   * @type {string}
   */
  @Input() submissionId: string;

  /**
   * The uploader configuration options
   * @type {UploaderOptions}
   */
  @Input() uploadFilesOptions: UploaderOptions;

  /**
   * A boolean representing if is possible to active drop zone over the document page
   * @type {boolean}
   */
  public enableDragOverDocument = true;

  /**
   * i18n message label
   * @type {string}
   */
  public dropOverDocumentMsg = 'submission.sections.upload.drop-message';

  /**
   * i18n message label
   * @type {string}
   */
  public dropMsg = 'submission.sections.upload.drop-message';

  /**
   * Array to track all subscriptions and unsubscribe them onDestroy
   * @type {Array}
   */
  private subs: Subscription[] = [];

  /**
   * A boolean representing if upload functionality is enabled
   * @type {boolean}
   */
  private uploadEnabled: Observable<boolean> = observableOf(false);

  /**
   * Save submission before to upload a file
   */
  public onBeforeUpload = () => {
    const sub: Subscription = this.operationsService.jsonPatchByResourceType(
      this.submissionService.getSubmissionObjectLinkName(),
      this.submissionId,
      'sections')
      .subscribe();
    this.subs.push(sub);
    return sub;
  };

  /**
   * Initialize instance variables
   *
   * @param {NotificationsService} notificationsService
   * @param {SubmissionJsonPatchOperationsService} operationsService
   * @param {SectionsService} sectionService
   * @param {SubmissionService} submissionService
   * @param {TranslateService} translate
   */
  constructor(private notificationsService: NotificationsService,
              private operationsService: SubmissionJsonPatchOperationsService,
              private sectionService: SectionsService,
              private submissionService: SubmissionService,
              private translate: TranslateService) {
  }

  /**
   * Check if upload functionality is enabled
   */
  ngOnChanges() {
    this.uploadEnabled = this.sectionService.isSectionTypeAvailable(this.submissionId, SectionsType.Upload);
  }

  /**
   * Parse the submission object retrieved from REST after upload
   *
   * @param event
   *    The completed upload event, carrying the submission object retrieved from REST and the
   *    client-side name of the file that completed
   */
  public onCompleteItem(event: UploaderCompleteEvent) {
    const workspaceitem = event.response as WorkspaceItem;
    const fileName = event.fileName;
    // Checks if upload section is enabled so do upload
    this.subs.push(
      this.uploadEnabled
        .pipe(first())
        .subscribe((isUploadEnabled) => {
          if (isUploadEnabled) {

            const { sections } = workspaceitem;
            const { errors } = workspaceitem;

            const errorsList = parseSectionErrors(errors);
            if (sections && isNotEmpty(sections)) {
              Object.keys(sections)
                .forEach((sectionId) => {
                  const sectionData = normalizeSectionData(sections[sectionId]);
                  const sectionErrors = errorsList[sectionId];
                  this.sectionService.isSectionType(this.submissionId, sectionId, SectionsType.Upload)
                    .pipe(take(1))
                    .subscribe((isUpload) => {
                      if (isUpload) {
                        // Look for errors on upload
                        if ((isEmpty(sectionErrors))) {
                          this.notificationsService.success(null, this.getNotificationContent('upload-successful', fileName));
                        } else {
                          this.notificationsService.error(null, this.getNotificationContent('upload-failed', fileName));
                        }
                      }
                    });
                  this.sectionService.updateSectionData(this.submissionId, sectionId, sectionData, sectionErrors, sectionErrors);
                });
            }

          }
        }),
    );
  }

  /**
   * Show error notification on upload fails
   *
   * @param error
   *    The upload error, carrying the file that failed to upload (when available)
   */
  public onUploadError(error?: UploaderError) {
    this.notificationsService.error(null, this.getNotificationContent('upload-failed', error?.item?.file?.name));
  }

  /**
   * Build the translated notification content for an upload outcome, including the file name when
   * available. Falls back to the generic (file-name-less) message when the file name is missing.
   *
   * @param suffix
   *    The i18n key suffix under `submission.sections.upload.` (e.g. `upload-successful`)
   * @param fileName
   *    The name of the file the notification refers to, if known
   */
  private getNotificationContent(suffix: string, fileName?: string): Observable<string> {
    return isNotEmpty(fileName)
      ? this.translate.get(`submission.sections.upload.${suffix}-file`, { fileName })
      : this.translate.get(`submission.sections.upload.${suffix}`);
  }

  /**
   * Unsubscribe from all subscriptions
   */
  ngOnDestroy() {
    this.subs
      .filter((subscription) => hasValue(subscription))
      .forEach((subscription) => subscription.unsubscribe());
  }
}
