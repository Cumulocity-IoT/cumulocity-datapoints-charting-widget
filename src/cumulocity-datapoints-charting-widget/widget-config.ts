/** @format */

//
// Helper classes and interfaces
//
import { formatDate } from "@angular/common";
import { ChartConfig } from "./widget-charts";
import * as _ from 'lodash';

/**
 * These elements can form the criteria
 * for selecting measurements from c8y
 */
export class MeasurementOptions {
    deviceId: string;
    name: string;
    fragment: string;
    series: string;
    pageSize: number;
    queryDateFormat: string;
    locale: string;
    avgPeriod: number;
    dateFrom?: Date;
    dateTo?: Date;
    targetGraphType: string;
    timeBucket: boolean;
    bucketPeriod: string;
    labelDateFormat: string;
    numdp: number;
    sizeBuckets: number;
    mnBuckets: number;
    mxBuckets: number;
    groupby: boolean;
    cumulative: boolean;
    group: string;

    constructor(
        averagePeriod: number,
        targetGraphType: string,
        numdp: number,
        sizeBuckets: number,
        mnBuckets: number,
        mxBuckets: number,
        groupby: boolean,
        cumulative: boolean,
        group: string = "default"
    ) {
        this.pageSize = 50;
        this.queryDateFormat = "yyyy-MM-ddTHH:mm:ssZ";
        this.locale = "en";
        this.avgPeriod = averagePeriod;
        this.targetGraphType = targetGraphType;
        this.timeBucket = false;
        this.bucketPeriod = "minute";
        this.labelDateFormat = "HH:mm";
        this.numdp = numdp;
        this.sizeBuckets = sizeBuckets;
        this.mnBuckets = mnBuckets;
        this.mxBuckets = mxBuckets;
        this.groupby = groupby;
        this.cumulative = cumulative;
        this.group = group;
    }

    public setFilter(
        deviceId: string,
        name: string,
        fragment: string,
        series: string,
        from: Date,
        to: Date,
        count: number,
        targetGraphType: string,
        timeBucket: boolean,
        bucketPeriod: string,
        labelDateFormat: string
    ) {
        this.deviceId = deviceId;
        this.name = name;
        this.fragment = fragment;
        this.series = series;
        if (from) {
            _.set(this, "dateFrom", from);
        }

        if (to) {
            _.set(this, "dateTo", to);
        }
        this.pageSize = count;
        this.targetGraphType = targetGraphType;
        this.timeBucket = timeBucket;
        this.bucketPeriod = bucketPeriod;
        this.labelDateFormat = labelDateFormat;
    }

    public filter(): Object {
        let filter = {};
        _.set(filter, "source", this.deviceId);
        _.set(filter, "valueFragmentType", this.fragment);
        _.set(filter, "valueFragmentSeries", this.series);
        _.set(filter, "pageSize", 2000);
        _.set(filter, "revert", true);
        _.set(filter, "withTotalPages", true);

        //dates are strings in the filter
        if (_.has(this, "dateFrom")) {
            _.set(filter, "dateFrom", formatDate(_.get(this, "dateFrom"), this.queryDateFormat, this.locale));
        }

        //this should always be "now" for the moment it can't be entered manually
        if (_.has(this, "dateTo")) {
            _.set(filter, "dateTo", formatDate(_.get(this, "dateTo"), this.queryDateFormat, this.locale));
        }

        return filter;
    }
}



export interface DataObject {
    data: any;
    key: string;
    options: MeasurementOptions;
}

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
