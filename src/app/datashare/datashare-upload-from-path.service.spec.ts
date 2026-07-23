import { BehaviorSubject } from 'rxjs';

import { JsonPatchOperationType } from '../core/json-patch/json-patch.model';
import {
  JsonPatchOperationObject,
  JsonPatchOperationsResourceEntry,
} from '../core/json-patch/json-patch-operations.reducer';
import { SubmissionObjectEntry } from '../submission/objects/submission-objects.reducer';
import { DatashareUploadFromPathService } from './datashare-upload-from-path.service';

describe('DatashareUploadFromPathService', () => {

  const submissionId = '826';
  const sectionId = 'metadatapageone';
  const otherSectionId = 'sectionOfAnotherSubmission';
  const serverPath = '/srv/dspace/ingest/dataset.zip';

  let submission$: BehaviorSubject<SubmissionObjectEntry>;
  let sectionOperations$: BehaviorSubject<JsonPatchOperationsResourceEntry>;
  let service: DatashareUploadFromPathService;

  const submissionWithSectionData = (data: any): SubmissionObjectEntry => ({
    sections: {
      [sectionId]: { data } as any,
    },
  });

  const operationOn = (path: string, value: any): JsonPatchOperationObject => ({
    operation: {
      op: JsonPatchOperationType.add,
      path,
      value,
    },
    timeCompleted: 1,
  });

  const pendingOperations = (children: { [resourceId: string]: JsonPatchOperationObject[] }): JsonPatchOperationsResourceEntry => ({
    children: Object.keys(children).reduce((acc: any, key: string) => Object.assign(acc, { [key]: { body: children[key] } }), {}),
    transactionStartTime: null,
    commitPending: false,
  });

  const pathOperation = (value: any, onSectionId = sectionId): JsonPatchOperationObject =>
    operationOn(`/sections/${onSectionId}/${DatashareUploadFromPathService.PATH_FIELD}`, value);

  const removeOperationOn = (path: string): JsonPatchOperationObject => ({
    operation: {
      op: JsonPatchOperationType.remove,
      path,
      value: null,
    },
    timeCompleted: 2,
  });

  const pathRemoveOperation = (onSectionId = sectionId): JsonPatchOperationObject =>
    removeOperationOn(`/sections/${onSectionId}/${DatashareUploadFromPathService.PATH_FIELD}`);

  const collectEmissions = (): boolean[] => {
    const emitted: boolean[] = [];
    service.isPendingForSubmission(submissionId).subscribe((pending: boolean) => emitted.push(pending));
    return emitted;
  };

  beforeEach(() => {
    submission$ = new BehaviorSubject(submissionWithSectionData({}));
    sectionOperations$ = new BehaviorSubject(pendingOperations({ [sectionId]: [] }));

    const submissionServiceMock = {
      getSubmissionObject: () => submission$.asObservable(),
    };
    const storeMock = {
      select: () => sectionOperations$.asObservable(),
    };

    service = new DatashareUploadFromPathService(submissionServiceMock as any, storeMock as any);
  });

  it('should emit true when the submission already carries a non-empty path value', () => {
    submission$.next(submissionWithSectionData({
      'dc.title': [{ value: 'A dataset' }],
      [DatashareUploadFromPathService.PATH_FIELD]: [{ value: serverPath }],
    }));

    expect(collectEmissions()).toEqual([true]);
  });

  it('should emit true while an unsaved patch operation carries a non-empty path value', () => {
    sectionOperations$.next(pendingOperations({
      [sectionId]: [pathOperation([{ value: serverPath }])],
    }));

    expect(collectEmissions()).toEqual([true]);
  });

  it('should emit false when the path field is absent', () => {
    submission$.next(submissionWithSectionData({ 'dc.title': [{ value: 'A dataset' }] }));

    expect(collectEmissions()).toEqual([false]);
  });

  it('should emit false when the path field holds only blank values', () => {
    submission$.next(submissionWithSectionData({
      [DatashareUploadFromPathService.PATH_FIELD]: [{ value: '   ' }],
    }));
    sectionOperations$.next(pendingOperations({
      [sectionId]: [pathOperation([{ value: '' }])],
    }));

    expect(collectEmissions()).toEqual([false]);
  });

  it('should emit false when a pending remove clears a path that is still in the saved section data', () => {
    // Section data is only refreshed from a server response, so it still holds the old path while the
    // administrator is clearing the field. The save will ingest nothing, and must not be labelled as
    // an ingest. A value can be in the field without this feature having put it there - an import or
    // the item-edit page can set it too.
    submission$.next(submissionWithSectionData({
      [DatashareUploadFromPathService.PATH_FIELD]: [{ value: serverPath }],
    }));
    sectionOperations$.next(pendingOperations({
      [sectionId]: [pathRemoveOperation()],
    }));

    expect(collectEmissions()).toEqual([false]);
  });

  it('should still emit true when the saved path is left untouched by the pending operations', () => {
    submission$.next(submissionWithSectionData({
      [DatashareUploadFromPathService.PATH_FIELD]: [{ value: serverPath }],
    }));
    sectionOperations$.next(pendingOperations({
      [sectionId]: [operationOn(`/sections/${sectionId}/dc.title`, [{ value: 'A dataset' }])],
    }));

    expect(collectEmissions()).toEqual([true]);
  });

  it('should emit false when a later remove cancels the add of a path', () => {
    sectionOperations$.next(pendingOperations({
      [sectionId]: [pathOperation([{ value: serverPath }]), pathRemoveOperation()],
    }));

    expect(collectEmissions()).toEqual([false]);
  });

  it('should emit true when a path is added again after being removed', () => {
    sectionOperations$.next(pendingOperations({
      [sectionId]: [
        pathOperation([{ value: serverPath }]),
        pathRemoveOperation(),
        pathOperation([{ value: serverPath }]),
      ],
    }));

    expect(collectEmissions()).toEqual([true]);
  });

  it('should emit false when a later operation replaces the path with whitespace', () => {
    sectionOperations$.next(pendingOperations({
      [sectionId]: [pathOperation([{ value: serverPath }]), pathOperation([{ value: '  \t ' }])],
    }));

    expect(collectEmissions()).toEqual([false]);
  });

  it('should not let a remove on another field cancel the path', () => {
    sectionOperations$.next(pendingOperations({
      [sectionId]: [
        pathOperation([{ value: serverPath }]),
        removeOperationOn(`/sections/${sectionId}/dc.title`),
      ],
    }));

    expect(collectEmissions()).toEqual([true]);
  });

  it('should ignore pending operations belonging to a section of another submission', () => {
    sectionOperations$.next(pendingOperations({
      [otherSectionId]: [pathOperation([{ value: serverPath }], otherSectionId)],
    }));

    expect(collectEmissions()).toEqual([false]);
  });

  it('should ignore pending operations on other metadata fields', () => {
    sectionOperations$.next(pendingOperations({
      [sectionId]: [operationOn(`/sections/${sectionId}/dc.title`, [{ value: serverPath }])],
    }));

    expect(collectEmissions()).toEqual([false]);
  });

  it('should not re-emit when an unrelated change occurs', () => {
    const emitted = collectEmissions();

    submission$.next(submissionWithSectionData({ 'dc.title': [{ value: 'A dataset' }] }));
    sectionOperations$.next(pendingOperations({
      [sectionId]: [operationOn(`/sections/${sectionId}/dc.title`, [{ value: 'A dataset' }])],
    }));

    expect(emitted).toEqual([false]);
  });

  it('should emit once per change of the pending state', () => {
    const emitted = collectEmissions();

    sectionOperations$.next(pendingOperations({
      [sectionId]: [pathOperation([{ value: serverPath }])],
    }));
    submission$.next(submissionWithSectionData({
      [DatashareUploadFromPathService.PATH_FIELD]: [{ value: serverPath }],
    }));
    sectionOperations$.next(pendingOperations({ [sectionId]: [] }));

    expect(emitted).toEqual([false, true]);
  });

});
