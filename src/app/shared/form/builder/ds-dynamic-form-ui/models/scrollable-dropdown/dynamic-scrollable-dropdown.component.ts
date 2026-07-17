import {
  AsyncPipe,
  NgForOf,
  NgIf,
} from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Inject,
  Injector,
  Input,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import { UntypedFormGroup } from '@angular/forms';
import {
  NgbDropdown,
  NgbDropdownModule,
} from '@ng-bootstrap/ng-bootstrap';
import {
  DynamicFormArrayGroupModel,
  DynamicFormLayoutService,
  DynamicFormValidationService,
} from '@ng-dynamic-forms/core';
import { TranslateModule } from '@ngx-translate/core';
import { InfiniteScrollModule } from 'ngx-infinite-scroll';
import {
  Observable,
  of as observableOf,
  of,
} from 'rxjs';
import {
  catchError,
  finalize,
  map,
  take,
  timeout,
} from 'rxjs/operators';
import {
  APP_DATA_SERVICES_MAP,
  LazyDataServicesMap,
} from 'src/config/app-config.interface';

import { CacheableObject } from '../../../../../../core/cache/cacheable-object.model';
import { FindAllDataImpl } from '../../../../../../core/data/base/find-all-data';
import {
  buildPaginatedList,
  PaginatedList,
} from '../../../../../../core/data/paginated-list.model';
import { RemoteData } from '../../../../../../core/data/remote-data';
import { lazyDataService } from '../../../../../../core/lazy-data-service';
import { getFirstCompletedRemoteData } from '../../../../../../core/shared/operators';
import { PageInfo } from '../../../../../../core/shared/page-info.model';
import { VocabularyService } from '../../../../../../core/submission/vocabularies/vocabulary.service';
import { BtnDisabledDirective } from '../../../../../btn-disabled.directive';
import {
  hasValue,
  isEmpty,
  isNotEmpty,
} from '../../../../../empty.util';
import { FormFieldMetadataValueObject } from '../../../models/form-field-metadata-value.model';
import { DsDynamicVocabularyComponent } from '../dynamic-vocabulary.component';
import { DynamicScrollableDropdownModel } from './dynamic-scrollable-dropdown.model';

/**
 * Component representing a dropdown input field
 */
@Component({
  selector: 'ds-dynamic-scrollable-dropdown',
  styleUrls: ['./dynamic-scrollable-dropdown.component.scss'],
  templateUrl: './dynamic-scrollable-dropdown.component.html',
  imports: [
    NgbDropdownModule,
    NgIf,
    AsyncPipe,
    InfiniteScrollModule,
    NgForOf,
    TranslateModule,
    BtnDisabledDirective,
  ],
  standalone: true,
})
export class DsDynamicScrollableDropdownComponent extends DsDynamicVocabularyComponent implements OnInit {
  @ViewChild('dropdownMenu', { read: ElementRef }) dropdownMenu: ElementRef;

  @Input() bindId = true;
  @Input() group: UntypedFormGroup;
  @Input() model: DynamicScrollableDropdownModel;

  @Output() blur: EventEmitter<any> = new EventEmitter<any>();
  @Output() change: EventEmitter<any> = new EventEmitter<any>();
  @Output() focus: EventEmitter<any> = new EventEmitter<any>();

  public currentValue: Observable<string>;
  public loading = false;
  public pageInfo: PageInfo;
  public optionsList: any;
  public inputText: string = null;
  public selectedIndex = 0;
  public acceptableKeys = ['Space', 'NumpadMultiply', 'NumpadAdd', 'NumpadSubtract', 'NumpadDecimal', 'Semicolon', 'Equal', 'Comma', 'Minus', 'Period', 'Quote', 'Backquote'];

  public usedSiblingValues: Set<any> = new Set();

  /**
   * If true the component can rely on the findAll method for data loading.
   * This is a behaviour activated by dependency injection through the dropdown config.
   * If a service that implements findAll is not provided in the config the component falls back on the standard vocabulary service.
   *
   * @private
   */
  private useFindAllService: boolean;
  /**
   * A service that implements FindAllData.
   * If is provided in the config will be used for data loading in stead of the VocabularyService
   * @private
   */
  private findAllService: FindAllDataImpl<CacheableObject>;

  constructor(
    protected vocabularyService: VocabularyService,
    protected cdr: ChangeDetectorRef,
    protected layoutService: DynamicFormLayoutService,
    protected validationService: DynamicFormValidationService,
    protected parentInjector: Injector,
    @Inject(APP_DATA_SERVICES_MAP) private dataServiceMap: LazyDataServicesMap,
  ) {
    super(vocabularyService, layoutService, validationService);
  }

  /**
   * Initialize the component, setting up the init form value
   */
  ngOnInit() {
    const lazyProvider$: Observable<Cache> = hasValue(this.model.resourceType) ?
      lazyDataService(this.dataServiceMap, this.model.resourceType.value, this.parentInjector) : of(null);

    lazyProvider$.pipe(take(1)).subscribe((dataService) => {
      this.findAllService = dataService as unknown as FindAllDataImpl<CacheableObject>;
      this.useFindAllService = hasValue(this.findAllService?.findAll) && typeof this.findAllService.findAll === 'function';
      this.updatePageInfo(this.model.maxOptions, 1);
      this.loadOptions(true);
    });


    // No distinctUntilChanged: the duplicate-value guard may revert the control to its
    // previous object reference, and the displayed value must still refresh.
    this.group.get(this.model.id).valueChanges
      .subscribe((value) => {
        this.setCurrentValue(value);
      });
  }

  /**
   * Get service and method to use to retrieve dropdown options
   */
  getDataFromService(): Observable<RemoteData<PaginatedList<CacheableObject>>> {
    if (this.useFindAllService) {
      return this.findAllService.findAll({ elementsPerPage: this.pageInfo.elementsPerPage, currentPage: this.pageInfo.currentPage });
    } else {
      return this.vocabularyService.getVocabularyEntriesByValue(this.inputText, false, this.model.vocabularyOptions, this.pageInfo);
    }
  }

  loadOptions(fromInit: boolean) {
    this.loading = true;
    this.getDataFromService().pipe(
      timeout({ each: 15000 }),
      getFirstCompletedRemoteData(),
      map((rd) => {
        if (!rd.hasSucceeded) {
          this.notifyVocabularyLoadError();
        }
        return (rd.hasSucceeded && hasValue(rd.payload)) ? rd.payload : buildPaginatedList(new PageInfo(), []);
      }),
      catchError(() => {
        this.notifyVocabularyLoadError();
        return observableOf(buildPaginatedList(new PageInfo(), []));
      }),
      finalize(() => this.loading = false),
    ).subscribe((list: PaginatedList<CacheableObject>) => {
      this.optionsList = list.page;
      if (fromInit && this.model.value) {
        this.setCurrentValue(this.model.value, true);
      }

      this.updatePageInfo(
        list.pageInfo.elementsPerPage,
        list.pageInfo.currentPage,
        list.pageInfo.totalElements,
        list.pageInfo.totalPages,
      );
      this.selectedIndex = 0;
      this.cdr.detectChanges();
    });
  }

  /**
   * Converts an item from the result list to a `string` to display in the `<input>` field.
   */
  inputFormatter = (x: any): string => (this.model.formatFunction ? this.model.formatFunction(x) : (x.display || x.value));

  /**
   * Opens dropdown menu
   * @param sdRef The reference of the NgbDropdown.
   */
  openDropdown(sdRef: NgbDropdown) {
    if (!this.model.readOnly) {
      this.group.markAsUntouched();
      this.inputText = null;
      this.usedSiblingValues = this.getUsedSiblingValues();
      this.updatePageInfo(this.model.maxOptions, 1);
      this.loadOptions(false);
      sdRef.open();
    }
  }

  private getUsedSiblingValues(): Set<any> {
    const used = new Set<any>();
    const parent = this.model.parent;
    if (parent instanceof DynamicFormArrayGroupModel) {
      parent.context.groups
        .filter((rowGroup) => rowGroup !== parent)
        .forEach((rowGroup) => {
          rowGroup.group
            .filter((siblingModel) => siblingModel.name === this.model.name)
            .forEach((siblingModel) => {
              const value = (siblingModel as any).value;
              const canonical = typeof value === 'string' ? value : value?.value;
              if (isNotEmpty(canonical)) {
                used.add(canonical);
              }
            });
        });
    }
    return used;
  }

  isOptionDisabled(entry: any): boolean {
    return hasValue(entry) && this.usedSiblingValues.has(entry.value);
  }

  selectEntry(entry: any, sdRef: NgbDropdown) {
    if (this.isOptionDisabled(entry)) {
      return;
    }
    this.onSelect(entry);
    sdRef.close();
  }

  navigateDropdown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      this.selectedIndex = Math.min(this.selectedIndex + 1, this.optionsList.length - 1);
    } else if (event.key === 'ArrowUp') {
      this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
    }
    this.scrollToSelected();
  }

  scrollToSelected() {
    const dropdownItems = this.dropdownMenu.nativeElement.querySelectorAll('.dropdown-item');
    const selectedItem = dropdownItems[this.selectedIndex];
    if (selectedItem) {
      selectedItem.scrollIntoView({ block: 'nearest' });
    }
  }

  /**
   * KeyDown handler to allow toggling the dropdown via keyboard
   * @param event KeyboardEvent
   * @param sdRef The reference of the NgbDropdown.
   */
  selectOnKeyDown(event: KeyboardEvent, sdRef: NgbDropdown) {
    const keyName = event.key;

    if (keyName === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      if (sdRef.isOpen()) {
        this.selectEntry(this.optionsList[this.selectedIndex], sdRef);
      } else {
        this.openDropdown(sdRef);
      }
    } else if (keyName === 'ArrowDown' || keyName === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      this.navigateDropdown(event);
    } else if (keyName === 'Backspace') {
      this.removeKeyFromInput();
    } else if (this.isAcceptableKey(keyName)) {
      this.addKeyToInput(keyName);
    }
  }

  addKeyToInput(keyName: string) {
    if (this.inputText === null) {
      this.inputText = '';
    }
    this.inputText += keyName;
    // When a new key is added, we need to reset the page info
    this.updatePageInfo(this.model.maxOptions, 1);
    this.loadOptions(false);
  }

  removeKeyFromInput() {
    if (this.inputText !== null) {
      this.inputText = this.inputText.slice(0, -1);
      if (this.inputText === '') {
        this.inputText = null;
      }
      this.loadOptions(false);
    }
  }


  isAcceptableKey(keyPress: string): boolean {
    // allow all letters and numbers
    if (keyPress.length === 1 && keyPress.match(/^[a-zA-Z0-9]*$/)) {
      return true;
    }
    // Some other characters like space, dash, etc should be allowed as well
    return this.acceptableKeys.includes(keyPress);
  }

  /**
   * Loads any new entries
   */
  onScroll() {
    if (!this.loading && this.pageInfo.currentPage <= this.pageInfo.totalPages) {
      this.loading = true;
      this.updatePageInfo(
        this.pageInfo.elementsPerPage,
        this.pageInfo.currentPage + 1,
        this.pageInfo.totalElements,
        this.pageInfo.totalPages,
      );
      this.getDataFromService().pipe(
        timeout({ each: 15000 }),
        getFirstCompletedRemoteData(),
        map((rd) => {
          if (!rd.hasSucceeded) {
            this.notifyVocabularyLoadError();
          }
          return (rd.hasSucceeded && hasValue(rd.payload)) ? rd.payload : buildPaginatedList(new PageInfo(), []);
        }),
        catchError(() => {
          this.notifyVocabularyLoadError();
          return observableOf(buildPaginatedList(new PageInfo(), []));
        }),
        finalize(() => this.loading = false))
        .subscribe((list: PaginatedList<any>) => {
          this.optionsList = this.optionsList.concat(list.page);
          this.updatePageInfo(
            list.pageInfo.elementsPerPage,
            list.pageInfo.currentPage,
            list.pageInfo.totalElements,
            list.pageInfo.totalPages,
          );
          this.cdr.detectChanges();
        });
    }
  }

  /**
   * Emits a change event and set the current value with the given value.
   * @param event The value to emit.
   */
  onSelect(event) {
    if (this.isOptionDisabled(event)) {
      return;
    }
    this.group.markAsDirty();
    // setCurrentValue before dispatchUpdate: the change is handled synchronously and the
    // duplicate-value guard may revert the control, so dispatching first would leave the
    // rejected value on screen.
    this.setCurrentValue(event);
    this.dispatchUpdate(event);
  }

  /**
   * Sets the current value with the given value.
   * @param value The value to set.
   * @param init Representing if is init value or not.
   */
  setCurrentValue(value: any, init = false): void {
    let result: Observable<string>;

    if (init && !this.useFindAllService) {
      result = this.getInitValueFromModel().pipe(
        map((formValue: FormFieldMetadataValueObject) => formValue.display),
      );
    } else {
      if (isEmpty(value)) {
        result = observableOf('');
      } else if (typeof value === 'string') {
        result = observableOf(value);
      } else if (this.useFindAllService) {
        result = observableOf(value[this.model.displayKey]);
      } else {
        result = observableOf(value.display);
      }
    }

    this.currentValue = result;
  }

}
