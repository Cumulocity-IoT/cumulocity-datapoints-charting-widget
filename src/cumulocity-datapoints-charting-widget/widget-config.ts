/** @format */

//
// Helper classes and interfaces
//
import { IDropdownSettings } from "ng-multiselect-dropdown";
import { ChartConfig } from "./widget-charts";

/**
 * All multiselects can handle object lists
 * this defines one that can be used with the
 * select definition in this file.
 *
 * optional generic field for label/text/date formatting etc
 */
export interface ListItem {
  id: any;
  text: any;
  format?: string;
}

/**
 * This class will contain all the bespoke config for the widget
 */
export class WidgetConfig {
  /**
   * Members for the config
   */
  selectedDevices: ListItem[];
  selectedMeasurements: ListItem[];

  /**
   * charts configuration
   */
  chart: ChartConfig;

  /**
   * Multi select component needs a few defaults
   * List item has id and text fields tell the component
   * what to pick for what (selection will be a listitem)
   */
  multiDropdownSettings: IDropdownSettings = {
    singleSelection: false,
    idField: "id",
    textField: "text",
    selectAllText: "Select All",
    unSelectAllText: "UnSelect All",
    itemsShowLimit: 3,
    allowSearchFilter: false,
    closeDropDownOnSelection: true,
  };

  singleDropdownSettings: IDropdownSettings = {
    singleSelection: true,
    idField: "id",
    textField: "text",
    itemsShowLimit: 3,
    allowSearchFilter: false,
  };

  /**
   *  Create an instance of the config object
   */
  constructor() {
    this.selectedDevices = [];
    this.selectedMeasurements = [];
  }
}
