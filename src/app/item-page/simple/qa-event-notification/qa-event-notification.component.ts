import {
  AsyncPipe,
  NgForOf,
  NgIf,
} from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import {
  Observable,
  of as observableOf,
} from 'rxjs';
import {
  catchError,
  map,
  switchMap,
} from 'rxjs/operators';

import { getNotificatioQualityAssuranceRoute } from '../../../admin/admin-routing-paths';
import { RequestParam } from '../../../core/cache/models/request-param.model';
import { AuthorizationDataService } from '../../../core/data/feature-authorization/authorization-data.service';
import { FeatureID } from '../../../core/data/feature-authorization/feature-id';
import { FindListOptions } from '../../../core/data/find-list-options.model';
import { PaginatedList } from '../../../core/data/paginated-list.model';
import { RemoteData } from '../../../core/data/remote-data';
import { QualityAssuranceSourceObject } from '../../../core/notifications/qa/models/quality-assurance-source.model';
import { QualityAssuranceSourceDataService } from '../../../core/notifications/qa/source/quality-assurance-source-data.service';
import { Item } from '../../../core/shared/item.model';
import { getFirstCompletedRemoteData } from '../../../core/shared/operators';
import { SplitPipe } from '../../../shared/utils/split.pipe';

@Component({
  selector: 'ds-qa-event-notification',
  templateUrl: './qa-event-notification.component.html',
  styleUrls: ['./qa-event-notification.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [QualityAssuranceSourceDataService],
  imports: [
    NgIf,
    NgForOf,
    AsyncPipe,
    RouterLink,
    TranslateModule,
    SplitPipe,
  ],
  standalone: true,
})
/**
 * Component for displaying quality assurance event notifications for an item.
 */
export class QaEventNotificationComponent implements OnChanges {
  /**
   * The item to display quality assurance event notifications for.
   */
  @Input() item: Item;

  /**
   * An observable that emits an array of QualityAssuranceSourceObject.
   */
  sources$: Observable<QualityAssuranceSourceObject[]>;

  constructor(
    private qualityAssuranceSourceDataService: QualityAssuranceSourceDataService,
    private authorizationService: AuthorizationDataService,
  ) {}

  /**
    * Detect changes to the item input and update the sources$ observable.
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes.item && changes.item.currentValue.uuid !== changes.item.previousValue?.uuid) {
      this.sources$ = this.getQualityAssuranceSources$();
    }
  }
  /**
   * Returns an Observable of QualityAssuranceSourceObject[] for the current item.
   * @returns An Observable of QualityAssuranceSourceObject[] for the current item.
   * Note: sourceId is composed as: id: "sourceName:<target>"
   */
  getQualityAssuranceSources$(): Observable<QualityAssuranceSourceObject[]> {
    // Quality Assurance sources are only available to authorized users. Checking the
    // authorization first avoids issuing the `qualityassurancesources/search/byTarget`
    // request for anonymous/unauthorized users, which would otherwise return a 401 that
    // shows up as a failed request in the browser. Authorized users keep the same behavior.
    return this.authorizationService.isAuthorized(FeatureID.CanSeeQA).pipe(
      switchMap((canSeeQA: boolean) => {
        if (!canSeeQA) {
          return observableOf([] as QualityAssuranceSourceObject[]);
        }
        const findListTopicOptions: FindListOptions = {
          searchParams: [new RequestParam('target', this.item.uuid)],
        };
        return this.qualityAssuranceSourceDataService.getSourcesByTarget(findListTopicOptions, false)
          .pipe(
            getFirstCompletedRemoteData(),
            map((data: RemoteData<PaginatedList<QualityAssuranceSourceObject>>) => {
              if (data.hasSucceeded) {
                return data.payload.page;
              }
              return [];
            }),
          );
      }),
      catchError(() => observableOf([] as QualityAssuranceSourceObject[])),
    );
  }

  /**
   * Returns the quality assurance route.
   * @returns The quality assurance route.
   */
  getQualityAssuranceRoute(): string {
    return getNotificatioQualityAssuranceRoute();
  }
}
