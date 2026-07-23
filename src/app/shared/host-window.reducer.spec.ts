// eslint-disable-next-line import/no-namespace
import * as deepFreeze from 'deep-freeze';

import { HostWindowResizeAction } from './host-window.actions';
import { hostWindowReducer } from './search/host-window.reducer';

class NullAction extends HostWindowResizeAction {
  type = null;

  constructor() {
    super(0, 0);
  }
}

describe('hostWindowReducer', () => {

  it('should return the current state when no valid actions have been made', () => {
    const state = { width: 800, height: 600 };
    const action = new NullAction();
    const newState = hostWindowReducer(state, action);

    expect(newState).toEqual(state);
  });

  it('should start with a desktop default width and height (so SSR renders the desktop layout)', () => {
    // The initial width/height default to a desktop viewport so responsive components render their
    // desktop branch during SSR, matching the common (desktop) client hydration and avoiding a
    // layout shift on load. The browser overrides these with the real window size immediately
    // (see StoreEffects.resize / AppComponent).
    const action = new NullAction();
    const initialState = hostWindowReducer(undefined, action);

    expect(initialState.width).toEqual(1200);
    expect(initialState.height).toEqual(800);
  });

  it('should update the width and height in the state in response to a RESIZE action', () => {
    const state = { width: 800, height: 600 };
    const action = new HostWindowResizeAction(1024, 768);
    const newState = hostWindowReducer(state, action);

    expect(newState.width).toEqual(1024);
    expect(newState.height).toEqual(768);
  });

  it('should perform the RESIZE action without affecting the previous state', () => {
    const state = { width: 800, height: 600 };
    deepFreeze(state);

    const action = new HostWindowResizeAction(1024, 768);
    hostWindowReducer(state, action);

    // no expect required, deepFreeze will ensure an exception is thrown if the state
    // is mutated, and any uncaught exception will cause the test to fail
    expect().nothing();
  });

});
