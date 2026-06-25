import {
  AsyncPipe,
  NgFor,
  NgIf,
} from '@angular/common';
import {
  Component,
  Input,
  OnInit,
} from '@angular/core';
import {
  TranslateModule,
  TranslateService,
} from '@ngx-translate/core';
import {
  Observable,
  of,
} from 'rxjs';
import { map } from 'rxjs/operators';

import { DSONameService } from '../../core/breadcrumbs/dso-name.service';
import { DSpaceObjectDataService } from '../../core/data/dspace-object-data.service';
import { PaginationService } from '../../core/pagination/pagination.service';
import {
  getFinishedRemoteData,
  getRemoteDataPayload,
} from '../../core/shared/operators';
import {
  Point,
  UsageReport,
} from '../../core/statistics/models/usage-report.model';
import { isEmpty } from '../../shared/empty.util';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { PaginationComponentOptions } from '../../shared/pagination/pagination-component-options.model';

/**
 * Component representing a statistics table for a given usage report.
 */
@Component({
  selector: 'ds-statistics-table',
  templateUrl: './statistics-table.component.html',
  styleUrls: ['./statistics-table.component.scss'],
  standalone: true,
  imports: [NgIf, NgFor, AsyncPipe, TranslateModule, PaginationComponent],
})
export class StatisticsTableComponent implements OnInit {

  /**
   * The usage report to display a statistics table for
   */
  @Input()
  report: UsageReport;

  /**
   * The number of points (e.g. datasets, countries, cities) to show per page.
   */
  @Input()
  pageSize = 10;

  /**
   * Boolean indicating whether the usage report has data
   */
  hasData: boolean;

  /**
   * The table headers
   */
  headers: string[];

  /**
   * Configuration for the {@link PaginationComponent} (ds-pagination) used to page through the points.
   */
  paginationOptions: PaginationComponentOptions;

  /**
   * The points to render for the currently selected page.
   */
  paginatedPoints$: Observable<Point[]>;

  constructor(
    protected dsoService: DSpaceObjectDataService,
    protected nameService: DSONameService,
    protected paginationService: PaginationService,
    private translateService: TranslateService,
  ) {

  }

  ngOnInit() {
    this.hasData = this.report.points.length > 0;
    if (this.hasData) {
      this.headers = Object.keys(this.report.points[0].values);
    }

    this.paginationOptions = Object.assign(new PaginationComponentOptions(), {
      // Unique per report AND scope so multiple tables paginate independently and a report doesn't pick up
      // another scope's page from the URL. report.id is `<dso-uuid>_<reportType>`, e.g. `<uuid>_TotalVisits`.
      id: `stats-${this.report.id}`,
      // pageSize is the default; users can change it via the ds-pagination "results per page" selector.
      pageSize: this.pageSize,
      pageSizeOptions: [10, 20, 40, 60, 80, 100],
      currentPage: 1,
    });

    this.paginatedPoints$ = this.paginationService.getCurrentPagination(this.paginationOptions.id, this.paginationOptions).pipe(
      map((pagination) => {
        const start = (pagination.currentPage - 1) * pagination.pageSize;
        return this.report.points.slice(start, start + pagination.pageSize);
      }),
    );
  }

  /**
   * Get the row label to display for a statistics point.
   * @param point the statistics point to get the label for
   */
  getLabel(point: Point): Observable<string> {
    switch (this.report.reportType) {
      case 'TotalVisits':
        return this.dsoService.findById(point.id).pipe(
          getFinishedRemoteData(),
          getRemoteDataPayload(),
          map((item) => !isEmpty(item) ?  this.nameService.getName(item) : this.translateService.instant('statistics.table.no-name')),
        );
      case 'TopCities':
      case 'topCountries':
      default:
        return of(point.label);
    }
  }
}
