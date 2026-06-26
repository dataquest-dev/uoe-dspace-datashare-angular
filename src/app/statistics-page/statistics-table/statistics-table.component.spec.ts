import {
  Component,
  DebugElement,
  Input,
} from '@angular/core';
import {
  ComponentFixture,
  TestBed,
  waitForAsync,
} from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TranslateModule } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs';

import { DSONameService } from '../../core/breadcrumbs/dso-name.service';
import { DSpaceObjectDataService } from '../../core/data/dspace-object-data.service';
import { PaginationService } from '../../core/pagination/pagination.service';
import { UsageReport } from '../../core/statistics/models/usage-report.model';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { PaginationComponentOptions } from '../../shared/pagination/pagination-component-options.model';
import { StatisticsTableComponent } from './statistics-table.component';

/**
 * Lightweight stand-in for ds-pagination so the table can be tested in isolation; the current page is
 * driven through the (mocked) PaginationService, exactly as the real component does via the URL.
 */
@Component({
  selector: 'ds-pagination',
  standalone: true,
  template: '<ng-content></ng-content>',
})
class MockPaginationComponent {
  @Input() paginationOptions: PaginationComponentOptions;
  @Input() collectionSize: number;
  @Input() hideGear: boolean;
  @Input() hidePaginationDetail: boolean;
  @Input() hideSortOptions: boolean;
  @Input() retainScrollPosition: boolean;
}

describe('StatisticsTableComponent', () => {

  let component: StatisticsTableComponent;
  let de: DebugElement;
  let fixture: ComponentFixture<StatisticsTableComponent>;
  let currentPagination$: BehaviorSubject<PaginationComponentOptions>;

  const paginationService = {
    getCurrentPagination: (_id: string, _options: PaginationComponentOptions) => currentPagination$.asObservable(),
  };

  const setPage = (currentPage: number, pageSize = 10) => {
    currentPagination$.next(Object.assign(new PaginationComponentOptions(), { currentPage, pageSize }));
  };

  beforeEach(waitForAsync(() => {
    currentPagination$ = new BehaviorSubject(Object.assign(new PaginationComponentOptions(), { currentPage: 1, pageSize: 10 }));

    TestBed.configureTestingModule({
      imports: [
        TranslateModule.forRoot(),
        StatisticsTableComponent,
      ],
      providers: [
        { provide: DSpaceObjectDataService, useValue: {} },
        { provide: DSONameService, useValue: {} },
        { provide: PaginationService, useValue: paginationService },
      ],
    })
      .overrideComponent(StatisticsTableComponent, {
        remove: { imports: [PaginationComponent] },
        add: { imports: [MockPaginationComponent] },
      })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(StatisticsTableComponent);
    component = fixture.componentInstance;
    de = fixture.debugElement;
    component.report = Object.assign(new UsageReport(), {
      points: [],
    });
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('when the storage report is empty', () => {

    it ('should not display a table', () => {
      expect(de.query(By.css('table'))).toBeNull();
    });

    it('should not display a pagination control', () => {
      expect(de.query(By.directive(MockPaginationComponent))).toBeNull();
    });
  });

  describe('when the storage report has data', () => {

    beforeEach(() => {
      component.report = Object.assign(new UsageReport(), {
        points: [
          {
            id: 'item_1',
            values: {
              views: 7,
              downloads: 4,
            },
          },
          {
            id: 'item_2',
            values: {
              views: 8,
              downloads: 8,
            },
          },
        ],
      });
      component.ngOnInit();
      fixture.detectChanges();
    });

    it ('should display a table with the correct data', () => {

      expect(de.query(By.css('table'))).toBeTruthy();

      expect(de.query(By.css('th.views-header')).nativeElement.innerText)
        .toEqual('views');
      expect(de.query(By.css('th.downloads-header')).nativeElement.innerText)
        .toEqual('downloads');

      expect(de.query(By.css('td.item_1-views-data')).nativeElement.innerText)
        .toEqual('7');
      expect(de.query(By.css('td.item_1-downloads-data')).nativeElement.innerText)
        .toEqual('4');
      expect(de.query(By.css('td.item_2-views-data')).nativeElement.innerText)
        .toEqual('8');
      expect(de.query(By.css('td.item_2-downloads-data')).nativeElement.innerText)
        .toEqual('8');
    });

    it('should wrap the table in a ds-pagination control with the report size', () => {
      const pagination = de.query(By.directive(MockPaginationComponent));
      expect(pagination).toBeTruthy();
      expect(pagination.componentInstance.collectionSize).toEqual(2);
    });

    it('should hide the page-size selector when everything fits on a single page', () => {
      expect(de.query(By.directive(MockPaginationComponent)).componentInstance.hideGear).toBeTrue();
    });
  });

  describe('when the report has more points than the page size', () => {

    const numberOfPoints = 25;

    beforeEach(() => {
      const points = [];
      for (let i = 0; i < numberOfPoints; i++) {
        points.push({
          id: `item_${i}`,
          label: `item_${i}`,
          values: {
            views: i,
          },
        });
      }
      component.report = Object.assign(new UsageReport(), { points });
      component.ngOnInit();
      fixture.detectChanges();
    });

    it('should pass the full report size to the pagination control', () => {
      expect(de.query(By.directive(MockPaginationComponent)).componentInstance.collectionSize)
        .toEqual(numberOfPoints);
    });

    it('should offer the page-size selector with its options when there is more than one page', () => {
      const pagination = de.query(By.directive(MockPaginationComponent)).componentInstance;
      expect(pagination.hideGear).toBeFalse();
      expect(pagination.paginationOptions.pageSizeOptions).toEqual([10, 20, 40, 60, 80, 100]);
    });

    it('should render more rows when a larger page size is selected', () => {
      setPage(1, 20);
      fixture.detectChanges();

      expect(de.queryAll(By.css('[data-test="statistics-label"]')).length).toEqual(20);
      expect(de.query(By.css('td.item_19-views-data'))).toBeTruthy();
    });

    it('should only render the first page of points', () => {
      expect(de.queryAll(By.css('[data-test="statistics-label"]')).length)
        .toEqual(component.pageSize);
      expect(de.query(By.css('td.item_0-views-data'))).toBeTruthy();
      expect(de.query(By.css('td.item_10-views-data'))).toBeNull();
    });

    it('should render the next page of points when the current page changes', () => {
      setPage(2);
      fixture.detectChanges();

      expect(de.query(By.css('td.item_0-views-data'))).toBeNull();
      expect(de.query(By.css('td.item_10-views-data'))).toBeTruthy();
      expect(de.queryAll(By.css('[data-test="statistics-label"]')).length)
        .toEqual(component.pageSize);
    });

    it('should render the remaining points on the last page', () => {
      const lastPage = Math.ceil(numberOfPoints / component.pageSize);
      setPage(lastPage);
      fixture.detectChanges();

      const remaining = numberOfPoints - (lastPage - 1) * component.pageSize;
      expect(de.queryAll(By.css('[data-test="statistics-label"]')).length)
        .toEqual(remaining);
      expect(de.query(By.css(`td.item_${numberOfPoints - 1}-views-data`))).toBeTruthy();
    });
  });
});
