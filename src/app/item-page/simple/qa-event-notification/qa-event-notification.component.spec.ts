import { CommonModule } from '@angular/common';
import {
  ComponentFixture,
  TestBed,
} from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { SplitPipe } from 'src/app/shared/utils/split.pipe';

import { APP_DATA_SERVICES_MAP } from '../../../../config/app-config.interface';
import { RemoteDataBuildService } from '../../../core/cache/builders/remote-data-build.service';
import { ObjectCacheService } from '../../../core/cache/object-cache.service';
import { AuthorizationDataService } from '../../../core/data/feature-authorization/authorization-data.service';
import { RequestService } from '../../../core/data/request.service';
import { QualityAssuranceSourceObject } from '../../../core/notifications/qa/models/quality-assurance-source.model';
import { QualityAssuranceSourceDataService } from '../../../core/notifications/qa/source/quality-assurance-source-data.service';
import { HALEndpointService } from '../../../core/shared/hal-endpoint.service';
import { NotificationsService } from '../../../shared/notifications/notifications.service';
import { createSuccessfulRemoteDataObject$ } from '../../../shared/remote-data.utils';
import { ActivatedRouteStub } from '../../../shared/testing/active-router.stub';
import { HALEndpointServiceStub } from '../../../shared/testing/hal-endpoint-service.stub';
import { createPaginatedList } from '../../../shared/testing/utils.test';
import { QaEventNotificationComponent } from './qa-event-notification.component';

describe('QaEventNotificationComponent', () => {
  let component: QaEventNotificationComponent;
  let fixture: ComponentFixture<QaEventNotificationComponent>;
  let qualityAssuranceSourceDataServiceStub: any;
  let authorizationServiceStub: any;

  const obj = Object.assign(new QualityAssuranceSourceObject(), {
    id: 'sourceName:target',
    source: 'sourceName',
    target: 'target',
    totalEvents: 1,
  });

  const objPL = createSuccessfulRemoteDataObject$(createPaginatedList([obj]));
  const item = Object.assign({ uuid: '1234' });
  beforeEach(async () => {

    qualityAssuranceSourceDataServiceStub = {
      getSourcesByTarget: jasmine.createSpy('getSourcesByTarget').and.returnValue(objPL),
    };
    authorizationServiceStub = {
      isAuthorized: jasmine.createSpy('isAuthorized').and.returnValue(of(true)),
    };
    await TestBed.configureTestingModule({
      imports: [CommonModule, TranslateModule.forRoot(), QaEventNotificationComponent, SplitPipe],
      providers: [
        { provide: APP_DATA_SERVICES_MAP, useValue: {} },
        { provide: ActivatedRoute, useValue: new ActivatedRouteStub() },
        { provide: QualityAssuranceSourceDataService, useValue: qualityAssuranceSourceDataServiceStub },
        { provide: AuthorizationDataService, useValue: authorizationServiceStub },
        { provide: RequestService, useValue: {} },
        { provide: NotificationsService, useValue: {} },
        { provide: HALEndpointService, useValue: new HALEndpointServiceStub('test') },
        ObjectCacheService,
        RemoteDataBuildService,
        provideMockStore({}),
      ],
    })
      // The component declares QualityAssuranceSourceDataService in its own `providers`,
      // which would otherwise shadow the stub above with a real instance. Override it so
      // the component uses the stub we can assert against.
      .overrideComponent(QaEventNotificationComponent, {
        set: { providers: [{ provide: QualityAssuranceSourceDataService, useValue: qualityAssuranceSourceDataServiceStub }] },
      })
      .compileComponents();
    fixture = TestBed.createComponent(QaEventNotificationComponent);
    component = fixture.componentInstance;
    component.item = item;
    component.sources$ = of([obj]);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display sources if present', () => {
    const alertElements = fixture.debugElement.queryAll(By.css('.alert'));
    expect(alertElements.length).toBe(1);
  });

  it('should return the quality assurance route when getQualityAssuranceRoute is called', () => {
    const route = component.getQualityAssuranceRoute();
    expect(route).toBe('/notifications/quality-assurance');
  });

  it('should request QA sources when the user is authorized to see QA', () => {
    authorizationServiceStub.isAuthorized.and.returnValue(of(true));
    qualityAssuranceSourceDataServiceStub.getSourcesByTarget.calls.reset();
    let result: QualityAssuranceSourceObject[];
    component.getQualityAssuranceSources$().subscribe((sources) => result = sources);
    expect(qualityAssuranceSourceDataServiceStub.getSourcesByTarget).toHaveBeenCalled();
    expect(result).toEqual([obj]);
  });

  it('should NOT request QA sources when the user is not authorized', () => {
    authorizationServiceStub.isAuthorized.and.returnValue(of(false));
    qualityAssuranceSourceDataServiceStub.getSourcesByTarget.calls.reset();
    let result: QualityAssuranceSourceObject[];
    component.getQualityAssuranceSources$().subscribe((sources) => result = sources);
    expect(qualityAssuranceSourceDataServiceStub.getSourcesByTarget).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });
});
