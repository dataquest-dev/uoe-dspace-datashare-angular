import {
  AsyncPipe,
  NgClass,
  NgIf,
} from '@angular/common';
import {
  AfterViewInit,
  Component,
  Inject,
  Input,
  OnInit,
} from '@angular/core';
import {
  Router,
  RouterOutlet,
} from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import {
  BehaviorSubject,
  combineLatest as combineLatestObservable,
  Observable,
  of,
} from 'rxjs';
import {
  filter,
  first,
  map,
  skipWhile,
  startWith,
  take,
} from 'rxjs/operators';
import { INotificationBoardOptions } from 'src/config/notifications-config.interfaces';

import { ThemeConfig } from '../../config/theme.config';
import { environment } from '../../environments/environment';
import { ThemedAdminSidebarComponent } from '../admin/admin-sidebar/themed-admin-sidebar.component';
import { getPageInternalServerErrorRoute } from '../app-routing-paths';
import { ThemedBreadcrumbsComponent } from '../breadcrumbs/themed-breadcrumbs.component';
import {
  NativeWindowRef,
  NativeWindowService,
} from '../core/services/window.service';
import { ThemedFooterComponent } from '../footer/themed-footer.component';
import { ThemedHeaderNavbarWrapperComponent } from '../header-nav-wrapper/themed-header-navbar-wrapper.component';
import { HostWindowService } from '../shared/host-window.service';
import { LiveRegionComponent } from '../shared/live-region/live-region.component';
import { ThemedLoadingComponent } from '../shared/loading/themed-loading.component';
import { MenuService } from '../shared/menu/menu.service';
import { MenuID } from '../shared/menu/menu-id.model';
import { NotificationsBoardComponent } from '../shared/notifications/notifications-board/notifications-board.component';
import { CSSVariableService } from '../shared/sass-helper/css-variable.service';
import { SystemWideAlertBannerComponent } from '../system-wide-alert/alert-banner/system-wide-alert-banner.component';

@Component({
  selector: 'ds-base-root',
  templateUrl: './root.component.html',
  styleUrls: ['./root.component.scss'],
  standalone: true,
  imports: [
    TranslateModule,
    ThemedAdminSidebarComponent,
    SystemWideAlertBannerComponent,
    ThemedHeaderNavbarWrapperComponent,
    ThemedBreadcrumbsComponent,
    NgIf,
    NgClass,
    ThemedLoadingComponent,
    RouterOutlet,
    ThemedFooterComponent,
    NotificationsBoardComponent,
    AsyncPipe,
    LiveRegionComponent,
  ],
})
export class RootComponent implements OnInit, AfterViewInit {
  theme: Observable<ThemeConfig> = of({} as any);
  isSidebarVisible$: Observable<boolean>;
  slideSidebarOver$: Observable<boolean>;
  collapsedSidebarWidth$: Observable<string>;
  expandedSidebarWidth$: Observable<string>;
  notificationOptions: INotificationBoardOptions;
  models: any;

  browserOsClasses = new BehaviorSubject<string[]>([]);

  /**
   * The admin-sidebar gutter state ('hidden' | 'unpinned' | 'pinned'), applied as a CSS class on the
   * outer wrapper. See {@link gutterTransitionEnabled}.
   */
  sidebarPaddingState$: Observable<string>;

  /**
   * The classes on the outer wrapper: the browser/OS classes plus the admin-sidebar gutter state.
   */
  outerWrapperClasses$: Observable<string[]>;

  /**
   * Whether the gutter may slide. Only enabled once the sidebar has resolved to visible after
   * bootstrap (see ngAfterViewInit), so that the initial gutter resolution never animates while
   * genuine pin/unpin toggles still do.
   */
  gutterTransitionEnabled = false;

  /**
   * Whether or not to show a full screen loader
   */
  @Input() shouldShowFullscreenLoader: boolean;

  /**
   * Whether or not to show a loader across the router outlet
   */
  @Input() shouldShowRouteLoader: boolean;

  constructor(
    private router: Router,
    private cssService: CSSVariableService,
    private menuService: MenuService,
    private windowService: HostWindowService,
    @Inject(NativeWindowService) private _window: NativeWindowRef,
  ) {
    this.notificationOptions = environment.notifications;
  }

  ngOnInit() {
    const browserName = this.getBrowserName();
    if (browserName) {
      const browserOsClasses = new Array<string>();
      browserOsClasses.push(`browser-${browserName}`);
      const osName = this.getOSName();
      if (osName) {
        browserOsClasses.push(`browser-${browserName}-${osName}`);
      }
      this.browserOsClasses.next(browserOsClasses);
    }

    this.isSidebarVisible$ = this.menuService.isMenuVisibleWithVisibleSections(MenuID.ADMIN);

    this.expandedSidebarWidth$ = this.cssService.getVariable('--ds-admin-sidebar-total-width').pipe(
      skipWhile((val) => !val),
      first(),
    );
    this.collapsedSidebarWidth$ = this.cssService.getVariable('--ds-admin-sidebar-fixed-element-width').pipe(
      skipWhile((val) => !val),
      first(),
    );

    const sidebarCollapsed = this.menuService.isMenuCollapsed(MenuID.ADMIN);
    this.slideSidebarOver$ = combineLatestObservable([sidebarCollapsed, this.windowService.isXsOrSm()])
      .pipe(
        map(([collapsed, mobile]) => collapsed || mobile),
        startWith(true),
      );

    // Drive the outer-wrapper gutter via a CSS class instead of the @slideSidebarPadding animation: the
    // animation needs a concrete width from the browser-only CSS-variable store, so on the server it
    // rendered padding-left:0 and the authenticated page jumped right when the SSR snapshot was removed.
    // The CSS class resolves the gutter from `--ds-admin-sidebar-*` (see root.component.scss), identically
    // on server and browser -- fixing the jump without any hardcoded width.
    this.sidebarPaddingState$ = combineLatestObservable([this.isSidebarVisible$, this.slideSidebarOver$]).pipe(
      map(([visible, over]: [boolean, boolean]) => !visible ? 'hidden' : over ? 'unpinned' : 'pinned'),
    );

    this.outerWrapperClasses$ = combineLatestObservable([
      this.browserOsClasses.asObservable(),
      this.sidebarPaddingState$,
    ]).pipe(
      map(([osClasses, paddingState]: [string[], string]) => [...osClasses, `ds-admin-sidebar-${paddingState}`]),
    );

    if (this.router.url === getPageInternalServerErrorRoute()) {
      this.shouldShowRouteLoader = false;
    }
  }

  ngAfterViewInit(): void {
    // Browser only; requestAnimationFrame is not defined under SSR.
    if (typeof requestAnimationFrame !== 'function') {
      return;
    }
    // Enable the gutter slide only once the sidebar has resolved to visible *after bootstrap*, not
    // merely after the first paint. Angular discards the server-rendered DOM and re-renders it from
    // scratch, so the gutter briefly falls back to 'hidden' well after that first paint; enabling the
    // transition any earlier makes that recovery slide the whole page sideways -- the very jump this
    // fixes. Waiting for `visible` also means the class is only armed when there is a sidebar to pin,
    // which is the only case where the slide is wanted.
    this.isSidebarVisible$.pipe(
      filter((visible: boolean) => visible),
      take(1),
    ).subscribe(() => requestAnimationFrame(() => this.gutterTransitionEnabled = true));
  }

  skipToMainContent() {
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      mainContent.tabIndex = -1;
      mainContent.focus();
    }
  }

  getBrowserName(): string {
    const userAgent = this._window.nativeWindow.navigator?.userAgent;
    if (/Firefox/.test(userAgent)) {
      return 'firefox';
    }
    if (/Safari/.test(userAgent)) {
      return 'safari';
    }
    return undefined;
  }

  getOSName(): string {
    const userAgent = this._window.nativeWindow.navigator?.userAgent;
    if (/Windows/.test(userAgent)) {
      return 'windows';
    }
    return undefined;
  }
}
