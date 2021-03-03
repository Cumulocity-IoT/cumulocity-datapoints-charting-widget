/** @format */

import { formatDate } from "@angular/common";
import _ from "lodash";
import { sma } from "moving-averages";
import { IResultList, IMeasurement, MeasurementService } from "@c8y/client";
import { ChartPoint } from "chart.js";

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

    constructor(
        deviceId: string,
        name: string,
        fragment: string,
        series: string,
        averagePeriod?: number
    ) {
        this.deviceId = deviceId;
        this.name = name;
        this.fragment = fragment;
        this.series = series;
        this.pageSize = 50;
        this.queryDateFormat = "yyyy-MM-ddTHH:mm:ssZ";
        this.locale = "en";
        this.avgPeriod = averagePeriod;
    }

    public setFilter(from: Date, to: Date, count: number) {
        if (from) {
            _.set(this, "dateFrom", from);
        }

        if (to) {
            _.set(this, "dateTo", to);
        }
        this.pageSize = count;
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
            _.set(
                filter,
                "dateFrom",
                formatDate(
                    _.get(this, "dateFrom"),
                    this.queryDateFormat,
                    this.locale
                )
            );
        }

        //this should always be "now" for the moment it can't be entered manually
        if (_.has(this, "dateTo")) {
            _.set(
                filter,
                "dateTo",
                formatDate(
                    _.get(this, "dateTo"),
                    this.queryDateFormat,
                    this.locale
                )
            );
        }

        // //console.log("FILTER");
        // //console.log(filter);
        return filter;
    }
}

/**
 * The product of this class is a list of value/date pairs
 * tagged with the source
 */
export class MeasurementList {
    sourceCriteria: MeasurementOptions;
    aggregate: any[];
    valtimes: { x: Date; y: any }[];
    mx: Number;
    mn: Number;
    sm: Number;
    av: Number;

    constructor(
        options: MeasurementOptions,
        aggregate: number[],
        valtimes: { x: Date; y: any }[],
        mx: number,
        mn: number,
        sm: number
    ) {
        if (options !== undefined) {
            this.sourceCriteria = options;
            this.aggregate = aggregate;
            this.valtimes = valtimes;
            this.av = sm / valtimes.length;
            this.mx = mx;
            this.mn = mn;
        } else {
            this.sourceCriteria = new MeasurementOptions("", "", "", "");
            this.aggregate = [];
            this.valtimes = [];
            this.av = 0;
            this.mx = 0;
            this.mn = 0;
        }
    }
}

/**
 * extract the retrieval and storage of
 * measurement values
 */

export class MeasurementHelper {
    constructor() {
        //empty
    }

    /**
     * Use the options to return a MeasurementList. 
     * There may be many pages of measurements, we 
     * can return them all 
     *
     * @param options
     * @param from
     * @param to
     * @param count
     */
    public async getMeasurements(
        measurementService: MeasurementService,
        options: MeasurementOptions,
        dateFrom?: Date,
        dateTo?: Date,
        count?: number
    ): Promise<MeasurementList> {
        options.setFilter(dateFrom, dateTo, count);
        let filter = options.filter();

        //get the first page
        _.set(filter, "currentPage", 1);
        let data = [];
        let page = 1;
        let resp = await measurementService.list(options.filter());
        if (resp.res.status == 200) {
            data = [...resp.data];
            page = resp.paging.nextPage;
            while (page != null) {
                console.log(`requesting page ${page}`);
                // Need to handle errors here and also could there be
                // other status codes to handle?
                resp = await resp.paging.next();
                if (resp.res.status == 200) {
                    //add next range of stuff...
                    data = [...data, ...resp.data];
                }

                page = resp.paging.nextPage;
            }
            console.log(`total of ${data.length} points`);
        }
        return this.processData(data, options);
    }

    /**
     * process the measurements and create the current stats
     *
     * @param data the array of measurements
     */
    private processData(
        data: IMeasurement[],
        options: MeasurementOptions
    ): MeasurementList {
        //We may get any fragment/series so use lowdash
        //simplify
        //console.log("RESPONSE");
        //console.log(resp);
        let rawData = data.reduce(
            (newArr, row) => {
                //default
                let measurementDate = new Date(row.time);
                let measurementValue = 0;
                //need the fragment, series
                if (_.has(row, options.fragment)) {
                    let frag = _.get(row, options.fragment);
                    if (_.has(frag, options.series)) {
                        let ser = _.get(frag, options.series);
                        ////console.log(ser);
                        measurementValue = ser.value;
                        if (measurementValue > newArr.mx) {
                            newArr.mx = measurementValue;
                        }
                        if (measurementValue < newArr.mn) {
                            newArr.mn = measurementValue;
                        }
                        newArr.sm = newArr.sm + measurementValue;
                    }
                }

                newArr.vl.push({ x: measurementDate, y: measurementValue });
                return newArr;
            },
            { vl: [], mx: 0, mn: Number.MAX_VALUE, sm: 0 }
        );

        //display the data in reverse (earlier on left)
        rawData.vl = rawData.vl.reverse();

        //Create aggregate function from data (decompose and recompose {x,y}[])
        let aggseries = [];
        if (options.avgPeriod && options.avgPeriod > 0) {
            //just the values
            let source = rawData.vl.map((val) => val.y);
            //average and bollinger bands
            let a = sma(source, options.avgPeriod, 3);
            aggseries = a.map((v, index) => {
                return { x: rawData.vl[index].x, y: v };
            });
        }

        let measurementList: MeasurementList = new MeasurementList(
            options,
            aggseries,
            rawData.vl,
            rawData.mx,
            rawData.mn,
            rawData.sm
        );
        ////console.log(measurementList);
        return measurementList;
    }
}
