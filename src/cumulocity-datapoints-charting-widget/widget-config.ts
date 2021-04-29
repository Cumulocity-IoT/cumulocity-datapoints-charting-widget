/** @format */

//
// Helper classes and interfaces
//
// import { IDropdownSettings } from "ng-multiselect-dropdown";
// import { ListItem } from "ng-multiselect-dropdown/multiselect.model";
import { Observable, of } from "rxjs";
import { ChartConfig } from "./widget-charts";

/**
 * All multi selects can handle object lists
 * this defines one that can be used with the
 * select definition in this file.
 *
 * optional generic field for label/text/date formatting etc
 */
export interface RawListItem {
    id: any;
    text: any;
    format?: string;
    isGroup?: boolean;
    groupname?: string;
}

/**
 * This class will contain all the bespoke config for the widget
 */
export class WidgetConfig {
    /**
     * Members for the config
     */
    selectedDevices: RawListItem[];
    selectedMeasurements: RawListItem[];

    /**
     * charts configuration
     */
    chart: ChartConfig;
    changed: boolean = false;

    /**
     *  Create an instance of the config object
     */
    constructor() {
        this.selectedDevices = [];
        this.selectedMeasurements = [];
    }
}
