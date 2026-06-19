import { DebugElement } from '@angular/core';
import {
  ComponentFixture,
  TestBed,
  waitForAsync,
} from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TranslateModule } from '@ngx-translate/core';

import { DSONameService } from '../../core/breadcrumbs/dso-name.service';
import { DSpaceObjectDataService } from '../../core/data/dspace-object-data.service';
import { UsageReport } from '../../core/statistics/models/usage-report.model';
import { StatisticsTableComponent } from './statistics-table.component';

describe('StatisticsTableComponent', () => {

  let component: StatisticsTableComponent;
  let de: DebugElement;
  let fixture: ComponentFixture<StatisticsTableComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [
        TranslateModule.forRoot(),
        StatisticsTableComponent,
      ],
      providers: [
        { provide: DSpaceObjectDataService, useValue: {} },
        { provide: DSONameService, useValue: {} },
      ],
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

    it('should not display a pagination control when all points fit on a single page', () => {
      expect(de.query(By.css('ngb-pagination'))).toBeNull();
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

    it('should only render the first page of points', () => {
      expect(de.queryAll(By.css('[data-test="statistics-label"]')).length)
        .toEqual(component.pageSize);
      expect(de.query(By.css('td.item_0-views-data'))).toBeTruthy();
      expect(de.query(By.css('td.item_10-views-data'))).toBeNull();
    });

    it('should display a pagination control', () => {
      expect(de.query(By.css('ngb-pagination'))).toBeTruthy();
    });

    it('should render the next page of points when the page changes', () => {
      component.onPageChange(2);
      fixture.detectChanges();

      expect(de.query(By.css('td.item_0-views-data'))).toBeNull();
      expect(de.query(By.css('td.item_10-views-data'))).toBeTruthy();
      expect(de.queryAll(By.css('[data-test="statistics-label"]')).length)
        .toEqual(component.pageSize);
    });

    it('should render the remaining points on the last page', () => {
      const lastPage = Math.ceil(numberOfPoints / component.pageSize);
      component.onPageChange(lastPage);
      fixture.detectChanges();

      const remaining = numberOfPoints - (lastPage - 1) * component.pageSize;
      expect(de.queryAll(By.css('[data-test="statistics-label"]')).length)
        .toEqual(remaining);
      expect(de.query(By.css(`td.item_${numberOfPoints - 1}-views-data`))).toBeTruthy();
    });
  });
});
