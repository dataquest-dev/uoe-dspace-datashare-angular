import {
  combineLatest,
  Observable,
  of as observableOf,
} from 'rxjs';
import {
  map,
  switchMap,
  take,
} from 'rxjs/operators';

import { AuthService } from '../../auth/auth.service';
import { AuthorizationDataService } from './authorization-data.service';
import { FeatureID } from './feature-id';

/**
 * The features that grant access to the admin panel. A user holding any of these sees the panel.
 *
 * Keep this list in sync with the feature checks in {@link MenuResolverService#createAdminMenu$}.
 * {@link FeatureID#CanSubmit}, {@link FeatureID#CanEditItem} and {@link FeatureID#CoarNotifyEnabled}
 * are deliberately excluded: they apply to (nearly) every signed-in submitter, and including them
 * would show the admin panel to regular users again.
 */
export const ADMIN_PANEL_FEATURES: FeatureID[] = [
  FeatureID.AdministratorOf,
  FeatureID.IsCommunityAdmin,
  FeatureID.IsCollectionAdmin,
  FeatureID.CanManageGroups,
  FeatureID.CanSeeQA,
];

/**
 * Returns whether the current user should see the admin panel.
 *
 * Anonymous users short-circuit to false without any authorization requests, so public
 * page loads (including SSR renders) stay free of authorization traffic.
 */
export function canDisplayAdminPanel(
  authService: AuthService,
  authorizationService: AuthorizationDataService,
): Observable<boolean> {
  return authService.isAuthenticated().pipe(
    take(1),
    switchMap((isAuthenticated: boolean) => {
      if (!isAuthenticated) {
        return observableOf(false);
      }
      return combineLatest(
        ADMIN_PANEL_FEATURES.map((feature: FeatureID) => authorizationService.isAuthorized(feature)),
      ).pipe(
        map((authorizations: boolean[]) => authorizations.some(Boolean)),
      );
    }),
  );
}
