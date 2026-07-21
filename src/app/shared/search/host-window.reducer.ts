import {
  HostWindowAction,
  HostWindowActionTypes,
} from '../host-window.actions';

export interface HostWindowState {
  width: number;
  height: number;
}

// Assume a desktop viewport until the real one is measured in the browser (see StoreEffects.resize
// and AppComponent, which dispatch the true window size on the client). This default is what SSR
// renders with: with `width: null` the width observable stayed empty during SSR (HostWindowService
// filters out null widths), so responsive components — most visibly <ds-auth-nav-menu> — rendered
// their *mobile* branch on the server and then snapped to the *desktop* branch once the client
// measured the real width, shifting the header (login link -> login dropdown button) and resizing the
// search box on every page load. Defaulting to a desktop width makes the server markup match the
// common (desktop) hydration, so there is no branch swap and no header/search shift.
const initialState: HostWindowState = {
  width: 1200,
  height: 800,
};

export function hostWindowReducer(state = initialState, action: HostWindowAction): HostWindowState {
  switch (action.type) {

    case HostWindowActionTypes.RESIZE: {
      return Object.assign({}, state, action.payload);
    }

    default: {
      return state;
    }
  }
}
