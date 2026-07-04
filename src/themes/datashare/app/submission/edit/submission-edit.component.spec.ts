import {
  applyRightsTextareaState,
  LICENCE_DROPDOWN_OBSERVED_ATTRIBUTES,
  shouldDisableRightsTextarea,
} from './submission-edit.component';

/**
 * Regression tests for the DataShare licence "Rights" textarea handling in the submission editor.
 *
 * Guards issue dataquest-dev/dspace-customers#777: the previous MutationObserver + detectChanges
 * implementation froze the browser tab. These tests pin the loop-safety guarantee (idempotent
 * updates keyed on the textarea's actual state) and the intended licence -> textarea behaviour. The
 * logic lives in pure module-level functions, so the tests need no TestBed and stay fast and
 * deterministic.
 */
describe('DataShare submission editor - licence Rights textarea (#777)', () => {

  const CC_LICENCE = 'Creative Commons Attribution 4.0 International Public License';

  describe('shouldDisableRightsTextarea', () => {
    it('keeps the Rights textarea editable only for "Other"', () => {
      expect(shouldDisableRightsTextarea('Other')).toBe(false);
    });

    it('disables the Rights textarea for a concrete licence', () => {
      expect(shouldDisableRightsTextarea(CC_LICENCE)).toBe(true);
    });

    it('disables the Rights textarea when no licence is selected', () => {
      expect(shouldDisableRightsTextarea('')).toBe(true);
    });
  });

  describe('applyRightsTextareaState (loop-safety guarantee)', () => {
    let textarea: HTMLTextAreaElement;

    beforeEach(() => {
      textarea = document.createElement('textarea');
    });

    it('disables and clears the textarea for a concrete licence', () => {
      textarea.value = 'some rights';

      const changed = applyRightsTextareaState(textarea, CC_LICENCE);

      expect(changed).toBe(true);
      expect(textarea.disabled).toBe(true);
      expect(textarea.value).toBe('');
      expect(textarea.classList.contains('disabled-field')).toBe(true);
    });

    it('enables the textarea for "Other"', () => {
      textarea.disabled = true;
      textarea.classList.add('disabled-field');

      const changed = applyRightsTextareaState(textarea, 'Other');

      expect(changed).toBe(true);
      expect(textarea.disabled).toBe(false);
      expect(textarea.classList.contains('disabled-field')).toBe(false);
    });

    it('is a no-op (and preserves the user text) when already enabled for "Other"', () => {
      applyRightsTextareaState(textarea, 'Other');
      textarea.value = 'my custom rights';

      // A repeated observer fire with the same enabled state must not touch the textarea.
      const changed = applyRightsTextareaState(textarea, 'Other');

      expect(changed).toBe(false);
      expect(textarea.value).toBe('my custom rights');
      expect(textarea.disabled).toBe(false);
    });

    it('is a no-op once the concrete-licence textarea is already disabled and empty', () => {
      applyRightsTextareaState(textarea, CC_LICENCE);
      const addSpy = spyOn(textarea.classList, 'add').and.callThrough();

      const changed = applyRightsTextareaState(textarea, CC_LICENCE);

      expect(changed).toBe(false);
      expect(addSpy).not.toHaveBeenCalled();
    });

    it('re-clears if a disabled field was re-populated with stale text (keyed on state, not licence)', () => {
      applyRightsTextareaState(textarea, CC_LICENCE);
      // Simulate the form re-patching stale free-text into the disabled field.
      textarea.value = 'stale rights that must not survive';

      const changed = applyRightsTextareaState(textarea, CC_LICENCE);

      expect(changed).toBe(true);
      expect(textarea.value).toBe('');
    });
  });

  describe('LICENCE_DROPDOWN_OBSERVED_ATTRIBUTES', () => {
    // The scrollable-dropdown marks its selected option with [class.active] and a moving
    // [attr.id]="..._selected" (dynamic-scrollable-dropdown.component.html). If these are dropped
    // from the observed attributes, the textarea stops reacting to an in-session licence change.
    it('watches the attributes that actually change on a licence selection', () => {
      expect(LICENCE_DROPDOWN_OBSERVED_ATTRIBUTES).toContain('class');
      expect(LICENCE_DROPDOWN_OBSERVED_ATTRIBUTES).toContain('id');
    });
  });
});
