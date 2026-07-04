import {
  AfterViewInit,
  Component,
  OnDestroy,
} from '@angular/core';

import { SubmissionEditComponent as BaseComponent } from '../../../../../app/submission/edit/submission-edit.component';
import { SubmissionFormComponent } from '../../../../../app/submission/form/submission-form.component';

/** The licence value for which the free-text Rights textarea stays editable. */
export const OTHER_LICENCE_VALUE = 'Other';

const DROPDOWN_SELECTOR = '#combobox_ds_license_dropdown-value_listbox';
const TEXTAREA_SELECTOR = '#ds_license_rights-text';
const SETUP_DELAY_MS = 500;
const RETRY_DELAY_MS = 1000;
const MAX_SETUP_RETRIES = 10;

/**
 * Attributes to watch on the licence combobox so a selection is detected. The scrollable-dropdown
 * marks the selected option with `[class.active]` and a moving `[attr.id]="..._selected"` (see
 * `dynamic-scrollable-dropdown.component.html`), so `class` and `id` are the attributes that
 * actually change on selection; `aria-selected` and `title` cover native-`<select>`/other fallbacks
 * that {@link getSelectedDropdownValue} also understands. (These must NOT be narrowed away or the
 * Rights textarea stops reacting to a licence change - the loop is prevented by idempotency, not by
 * starving the observer.)
 */
export const LICENCE_DROPDOWN_OBSERVED_ATTRIBUTES = ['class', 'id', 'aria-selected', 'title'];

/**
 * Pure decision helper: the Rights textarea is disabled for every licence except "Other".
 */
export function shouldDisableRightsTextarea(licenceValue: string): boolean {
  return licenceValue !== OTHER_LICENCE_VALUE;
}

/**
 * Enable/disable (and clear) the Rights textarea to match the selected licence.
 *
 * Idempotent by the textarea's ACTUAL state (not by remembering the last licence): if the textarea
 * is already in the state the licence requires, it is a no-op and returns `false`. Keying on the
 * real DOM state - rather than on licence equality - means a repeated observer fire is a no-op, yet
 * a needed correction still happens if something else (e.g. a form re-patch) put the field back into
 * the wrong state. Because it only ever writes to the textarea, which the MutationObserver does not
 * watch, and it converges to a stable state, it cannot sustain a loop (issue #777). Returns `true`
 * when it applied a change.
 *
 * NOTE (known limitation, tracked as a follow-up): the clear is a raw DOM write and does not push
 * the empty value back into the ng-dynamic-forms `dc.rights` control, so a previously typed free
 * text could still be carried in the model. Dispatching an input event here is unsafe because the
 * licence dropdown and this textarea are BOTH bound to `dc.rights`; the correct fix is to drive this
 * from the reactive form model instead of the DOM. This preserves the pre-existing behaviour while
 * removing the freeze.
 */
export function applyRightsTextareaState(textarea: HTMLTextAreaElement, licence: string): boolean {
  if (shouldDisableRightsTextarea(licence)) {
    if (textarea.disabled && textarea.value === '' && textarea.classList.contains('disabled-field')) {
      return false;
    }
    textarea.value = '';
    textarea.disabled = true;
    textarea.classList.add('disabled-field');
    return true;
  }
  if (!textarea.disabled && !textarea.classList.contains('disabled-field')) {
    return false;
  }
  textarea.disabled = false;
  textarea.classList.remove('disabled-field');
  return true;
}

/**
 * This component allows to edit an existing workspaceitem/workflowitem.
 *
 * DATASHARE customization: the DataShare "Licence" section (submission form `datashareLicenseForm`)
 * exposes two `dc.rights` fields - a "Licence" dropdown (value-pairs `datashare_license_types`:
 * "Creative Commons Attribution 4.0 International Public License" or "Other") and a free-text
 * "Rights" textarea. The Rights textarea is only meaningful when the licence is "Other"; for a
 * concrete licence it is disabled and cleared. Because the licence control is rendered by
 * ng-dynamic-forms as a combobox (not a native `<select>`), the selected value is read from the DOM.
 *
 * IMPORTANT - issue dataquest-dev/dspace-customers#777 (submission editor freeze):
 * The previous implementation drove this from a broad MutationObserver (the dropdown AND its parent,
 * with `subtree: true` + attribute changes) whose callback called `ChangeDetectorRef.detectChanges()`,
 * plus an `effect()` that wrote to the textarea. Forcing a synchronous re-render from inside the
 * observer produced new DOM mutations, which re-fired the observer, which re-rendered ... an
 * unbounded synchronous loop that froze the browser tab while depositing: the main thread never
 * yielded, so NO request reached the server and the footer "Saving" spinner hung forever. A tab
 * refresh (and re-filling the licence fields) was the only workaround.
 *
 * This rewrite removes that feedback loop:
 *  - the observer is scoped to the dropdown only (never its parent / the whole form),
 *  - the callback NEVER forces change detection,
 *  - the textarea update is idempotent (a no-op once the textarea already matches the licence) and
 *    re-entrancy guarded, and it only writes to the textarea (which the observer does not watch),
 * so it can never sustain a loop.
 */
@Component({
  selector: 'ds-themed-submission-edit',
  styleUrls: ['./submission-edit.component.scss', '../../../../../app/submission/edit/submission-edit.component.scss'],
  templateUrl: '../../../../../app/submission/edit/submission-edit.component.html',
  standalone: true,
  imports: [
    SubmissionFormComponent,
  ],
})
export class SubmissionEditComponent extends BaseComponent implements AfterViewInit, OnDestroy {
  // DATASHARE - start

  private dropdownElement: HTMLElement | null = null;
  private textareaElement: HTMLTextAreaElement | null = null;
  private mutationObserver?: MutationObserver;
  private setupRetryCount = 0;

  /** True while we are mutating the textarea ourselves, so our own writes are ignored. */
  private applyingTextareaState = false;

  ngAfterViewInit(): void {
    // The submission form renders asynchronously; give it a moment before looking for the licence
    // controls. Every schedule here is one-shot (setTimeout) - never a tight loop.
    setTimeout(() => this.setupLicenceElements(), SETUP_DELAY_MS);
  }

  ngOnDestroy(): void {
    this.mutationObserver?.disconnect();
    this.mutationObserver = undefined;
    if (super.ngOnDestroy) {
      super.ngOnDestroy();
    }
  }

  /**
   * Locate the licence dropdown and Rights textarea in the DOM and, once both are present, wire up
   * the observer and apply the initial state. Retries a bounded number of times while the section is
   * still rendering.
   */
  private setupLicenceElements(): void {
    this.dropdownElement = document.querySelector<HTMLElement>(DROPDOWN_SELECTOR);
    this.textareaElement = document.querySelector<HTMLTextAreaElement>(TEXTAREA_SELECTOR);

    if (this.dropdownElement && this.textareaElement) {
      this.setupMutationObserver();
      this.syncRightsTextareaFromDom();
      this.setupRetryCount = 0;
      return;
    }

    if (++this.setupRetryCount < MAX_SETUP_RETRIES) {
      setTimeout(() => this.setupLicenceElements(), RETRY_DELAY_MS);
    }
  }

  /**
   * Observe ONLY the dropdown (never its parent / the whole form) and only the attributes that
   * change when a combobox option is selected. The callback never forces change detection.
   */
  private setupMutationObserver(): void {
    if (!this.dropdownElement) {
      return;
    }
    this.mutationObserver = new MutationObserver(() => this.syncRightsTextareaFromDom());
    this.mutationObserver.observe(this.dropdownElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: LICENCE_DROPDOWN_OBSERVED_ATTRIBUTES,
    });
  }

  /**
   * Read the selected licence from the DOM and apply the Rights-textarea state. The re-entrancy
   * guard plus the idempotency of {@link applyRightsTextareaState} mean this cannot sustain a loop,
   * even if the MutationObserver fires repeatedly (issue #777).
   */
  private syncRightsTextareaFromDom(): void {
    if (this.applyingTextareaState || !this.textareaElement) {
      return;
    }
    this.applyingTextareaState = true;
    try {
      applyRightsTextareaState(this.textareaElement, this.getSelectedDropdownValue());
    } finally {
      this.applyingTextareaState = false;
    }
  }

  /**
   * Best-effort read of the currently selected value from the licence combobox, which may be
   * rendered in several shapes. Returns an empty string when no value can be determined.
   */
  private getSelectedDropdownValue(): string {
    if (!this.dropdownElement) {
      return '';
    }

    // 1) Selected option carrying the value in its title attribute (within the dropdown or parent).
    const selectedInScope = this.dropdownElement
      .querySelector('#combobox_ds_license_dropdown-value_selected')?.getAttribute('title');
    if (selectedInScope) {
      return selectedInScope;
    }
    const selectedInParent = this.dropdownElement.parentElement
      ?.querySelector('#combobox_ds_license_dropdown-value_selected')?.getAttribute('title');
    if (selectedInParent) {
      return selectedInParent;
    }

    // 2) Native <select> fallback.
    if (this.dropdownElement.tagName === 'SELECT') {
      const selectElement = this.dropdownElement as HTMLSelectElement;
      return selectElement.options[selectElement.selectedIndex]?.text || selectElement.value || '';
    }

    // 3) aria-selected option.
    const ariaSelected = this.dropdownElement.querySelector('[aria-selected="true"]');
    if (ariaSelected) {
      return ariaSelected.textContent?.trim() || ariaSelected.getAttribute('title') || '';
    }

    // 4) A "selected"/"active" option class.
    const activeOption = this.dropdownElement.querySelector('.selected, .active, [class*="selected"]');
    if (activeOption) {
      return activeOption.textContent?.trim() || activeOption.getAttribute('title') || '';
    }

    // 5) Input-based combobox.
    const inputElement = this.dropdownElement.querySelector('input');
    if (inputElement) {
      return inputElement.value;
    }

    return '';
  }
  // DATASHARE - end
}
