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
import { NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';
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
import {
  getFinishedRemoteData,
  getRemoteDataPayload,
} from '../../core/shared/operators';
import {
  Point,
  UsageReport,
} from '../../core/statistics/models/usage-report.model';
import { isEmpty } from '../../shared/empty.util';

/**
 * Component representing a statistics table for a given usage report.
 */
@Component({
  selector: 'ds-statistics-table',
  templateUrl: './statistics-table.component.html',
  styleUrls: ['./statistics-table.component.scss'],
  standalone: true,
  imports: [NgIf, NgFor, AsyncPipe, TranslateModule, NgbPaginationModule],
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
   * The currently displayed page (1-based, as expected by ngb-pagination).
   */
  currentPage = 1;

  /**
   * Boolean indicating whether the usage report has data
   */
  hasData: boolean;

  /**
   * The table headers
   */
  headers: string[];

  constructor(
    protected dsoService: DSpaceObjectDataService,
    protected nameService: DSONameService,
    private translateService: TranslateService,
  ) {

  }

  ngOnInit() {
    this.hasData = this.report.points.length > 0;
    if (this.hasData) {
      this.headers = Object.keys(this.report.points[0].values);
    }
  }

  /**
   * The points to render for the currently selected page.
   */
  get paginatedPoints(): Point[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.report.points.slice(start, start + this.pageSize);
  }

  /**
   * Whether a pagination control is needed, i.e. there are more points than fit on a single page.
   */
  get showPagination(): boolean {
    return this.report.points.length > this.pageSize;
  }

  /**
   * Switch to the given page.
   * @param page the 1-based page number to display
   */
  onPageChange(page: number): void {
    this.currentPage = page;
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
