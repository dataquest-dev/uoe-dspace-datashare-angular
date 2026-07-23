import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import {
  combineLatest as observableCombineLatest,
  Observable,
} from 'rxjs';
import {
  distinctUntilChanged,
  map,
  startWith,
} from 'rxjs/operators';

import { CoreState } from '../core/core-state.model';
import { JsonPatchOperationType } from '../core/json-patch/json-patch.model';
import {
  JsonPatchOperationObject,
  JsonPatchOperationsResourceEntry,
} from '../core/json-patch/json-patch-operations.reducer';
import { jsonPatchOperationsByResourceType } from '../core/json-patch/selectors';
import { hasValue } from '../shared/empty.util';
import {
  SubmissionObjectEntry,
  SubmissionSectionEntry,
} from '../submission/objects/submission-objects.reducer';
import { SubmissionService } from '../submission/submission.service';

/**
 * The JSON PATCH resource type under which every submission section stores its unsaved operations.
 */
const SECTIONS_RESOURCE_TYPE = 'sections';

/**
 * Tells the submission UI whether the next (or currently running) save will make the server ingest a
 * bitstream from a path on its own filesystem, so that the user can be shown an honest long-running
 * indicator instead of the ordinary "Saving" one.
 *
 * The value is read from two places, because neither on its own covers the whole window during which
 * the indicator has to be shown:
 * <ul>
 *   <li>the unsaved JSON PATCH operations, which hold the path from the moment it is typed until the
 *       PATCH response arrives — this is the window in which the ingest actually happens;</li>
 *   <li>the submission object in the store, whose section data only ever holds server-supplied values,
 *       and therefore only carries the path if a previous ingest did not clear it.</li>
 * </ul>
 */
@Injectable({
  providedIn: 'root',
})
export class DatashareUploadFromPathService {

  /**
   * Metadata field whose presence means that a save will trigger a server-side ingest.
   */
  public static readonly PATH_FIELD = 'local.bitstream.redirectToURL';

  constructor(private submissionService: SubmissionService,
              private store: Store<CoreState>) {
  }

  /**
   * Emits true while the given submission carries a non-empty {@link PATH_FIELD} value, either
   * already saved on the server or waiting in an unsaved JSON PATCH operation.
   *
   * @param submissionId the id of the submission being edited
   * @return an observable that emits only when the pending state changes
   */
  public isPendingForSubmission(submissionId: string): Observable<boolean> {
    const sections$: Observable<SubmissionSectionEntry> = this.submissionService.getSubmissionObject(submissionId).pipe(
      map((submission: SubmissionObjectEntry) => hasValue(submission) && hasValue(submission.sections) ? submission.sections : {}),
      startWith({} as SubmissionSectionEntry),
    );

    const operations$: Observable<JsonPatchOperationsResourceEntry> =
      this.store.select(jsonPatchOperationsByResourceType(SECTIONS_RESOURCE_TYPE));

    return observableCombineLatest([sections$, operations$]).pipe(
      map(([sections, operations]: [SubmissionSectionEntry, JsonPatchOperationsResourceEntry]) => {
        // Section data is only ever refreshed from a server response, so it still holds the old value
        // while the user is clearing the field. A pending operation therefore has the final say, and
        // the saved value is consulted only when nothing pending touches the field at all.
        const pending: boolean | undefined = this.pendingOutcome(sections, operations);
        return hasValue(pending) ? pending : this.isInSectionData(sections);
      }),
      distinctUntilChanged(),
    );
  }

  /**
   * Does any section of the submission already hold a saved path value?
   *
   * @param sections the submission's sections as held in the store
   * @return true when at least one section's data carries a non-blank path
   */
  private isInSectionData(sections: SubmissionSectionEntry): boolean {
    return Object.keys(sections)
      .map((sectionId: string) => sections[sectionId]?.data)
      .some((data: any) => hasValue(data) && this.isNonBlankValue(data[DatashareUploadFromPathService.PATH_FIELD]));
  }

  /**
   * What do the unsaved JSON PATCH operations of the submission do to the path field?
   *
   * The JSON PATCH state is keyed by section id only, so it is scoped back to the submission by
   * keeping just the sections the submission actually owns.
   *
   * @param sections   the submission's sections as held in the store
   * @param operations the JSON PATCH operations pending for every submission section
   * @return true when they leave a non-blank path, false when they clear it, and undefined when
   *         nothing pending touches the field
   */
  private pendingOutcome(sections: SubmissionSectionEntry, operations: JsonPatchOperationsResourceEntry): boolean | undefined {
    if (!hasValue(operations) || !hasValue(operations.children)) {
      return undefined;
    }
    const outcomes: boolean[] = Object.keys(operations.children)
      .filter((sectionId: string) => hasValue(sections[sectionId]))
      .map((sectionId: string) => this.pathOutcome(operations.children[sectionId]?.body ?? []))
      .filter((outcome: boolean | undefined): outcome is boolean => hasValue(outcome));

    if (outcomes.length === 0) {
      return undefined;
    }
    return outcomes.some((outcome: boolean) => outcome);
  }

  /**
   * Replay a section's pending operations in order and report the state the path field is left in.
   *
   * The operations have to be folded rather than tested one by one: a user who types a path and then
   * clears the field again leaves both the add and the remove in the body, and only the last of them
   * describes what the save will send.
   *
   * @param body the section's pending JSON PATCH operations, in the order they were dispatched
   * @return true when the last operation touching the path field leaves a non-blank value, false when
   *         it clears it, and undefined when no operation touches the field
   */
  private pathOutcome(body: JsonPatchOperationObject[]): boolean | undefined {
    return body.reduce((leftBehind: boolean | undefined, entry: JsonPatchOperationObject) => {
      if (!this.isPathFieldOperation(entry)) {
        return leftBehind;
      }
      if (entry.operation.op === JsonPatchOperationType.remove) {
        return false;
      }
      return this.isNonBlankValue(entry.operation.value);
    }, undefined);
  }

  /**
   * Does this operation target the path field of a section, whatever it does to it?
   *
   * @param entry a pending JSON PATCH operation
   * @return true when the operation's path addresses the path field
   */
  private isPathFieldOperation(entry: JsonPatchOperationObject): boolean {
    const path: string = entry?.operation?.path;
    if (!hasValue(path)) {
      return false;
    }
    // Paths are '/sections/<sectionId>/<field>' for a whole field and '/sections/<sectionId>/<field>/<index>' for one value.
    return path.split('/')[3] === DatashareUploadFromPathService.PATH_FIELD;
  }

  /**
   * Is this a metadata value, or list of metadata values, carrying actual text?
   *
   * @param value a raw string, a metadata value object, or a list of either
   * @return true when at least one of the values is a non-blank string
   */
  private isNonBlankValue(value: any): boolean {
    const candidates: any[] = Array.isArray(value) ? value : [value];
    return candidates.some((candidate: any) => {
      if (typeof candidate === 'string') {
        return candidate.trim().length > 0;
      }
      return hasValue(candidate) && typeof candidate === 'object' && this.isNonBlankValue(candidate.value);
    });
  }

}
