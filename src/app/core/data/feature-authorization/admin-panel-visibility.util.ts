import { Observable, combineLatest } from 'rxjs';
import {
  distinctUntilChanged,
  map,
} from 'rxjs/operators';

import { AuthorizationDataService } from './authorization-data.service';
import { FeatureID } from './feature-id';

/**
 * Returns whether the current user should see the admin panel.
 */
export function canDisplayAdminPanel(authorizationService: AuthorizationDataService): Observable<boolean> {
  return combineLatest([
    authorizationService.isAuthorized(FeatureID.AdministratorOf),
    authorizationService.isAuthorized(FeatureID.IsCommunityAdmin),
    authorizationService.isAuthorized(FeatureID.IsCollectionAdmin),
    authorizationService.isAuthorized(FeatureID.CanManageGroups),
    authorizationService.isAuthorized(FeatureID.CanSeeQA),
  ]).pipe(
    map((authorizations: boolean[]) => authorizations.some(Boolean)),
    distinctUntilChanged(),
  );
}