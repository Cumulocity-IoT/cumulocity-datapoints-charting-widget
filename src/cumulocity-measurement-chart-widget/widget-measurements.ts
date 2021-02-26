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
    displayDateFormat: string;
    queryDateFormat: string;
    locale: string;
    avgPeriod: number;
    dateFrom?: Date;
    dateTo?: Date;

    constructor(
        deviceId: string,
        name: string,
        df: string,
        fragment: string,
        series: string,
        averagePeriod?: number
    ) {
        this.deviceId = deviceId;
        this.name = name;
        this.fragment = fragment;
        this.series = series;
        this.pageSize = 50;
        this.displayDateFormat = df;
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
        //_.set(filter, "withTotalPages", true);
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
    vals: any[];
    aggregate: any[];
    times: Date[];
    valtimes: { x: string; y: any }[];
    mx: Number;
    mn: Number;
    sm: Number;
    av: Number;

    constructor(
        options: MeasurementOptions,
        vals: number[],
        aggregate: number[],
        times: Date[],
        valtimes: { x: string; y: any }[],
        mx: number,
        mn: number,
        sm: number
    ) {
        if (options !== undefined) {
            this.sourceCriteria = options;
            this.vals = vals;
            this.aggregate = aggregate;
            this.times = times;
            this.valtimes = valtimes;
            this.av = sm / vals.length;
            this.mx = mx;
            this.mn = mn;
        } else {
            this.sourceCriteria = new MeasurementOptions("", "", "", "", "");
            this.vals = [];
            this.aggregate = [];
            this.times = [];
            this.valtimes = [];
            this.av = 0;
            this.mx = 0;
            this.mn = 0;
        }
    }

    public createAggregatedCounts(freq: string): number[] {
        //aggregate data: for loop to access both arrays
        let rawData = [];
        //console.log(freq);
        for (let index = 0; index < this.vals.length; index++) {
            let currentDate: Date = new Date(this.times[index]);
            let day = currentDate.getDay();
            let hour = currentDate.getHours();
            let min = currentDate.getMinutes();

            if (freq == "hourly") {
                if (rawData[hour] === undefined) {
                    rawData[hour] = 1;
                } else {
                    rawData[hour] += 1;
                }
            } else if (freq == "mins") {
                let key = `${hour}:${min}`;

                if (rawData[key] === undefined) {
                    rawData[key] = 1;
                } else {
                    rawData[key] += 1;
                }
            } else if (freq == "daily") {
                if (rawData[day] === undefined) {
                    rawData[day] = 1;
                } else {
                    rawData[day] += 1;
                }
            }
        }
        return rawData;
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
     * Use the options to return a MeasurementList
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
        const resp = await measurementService.list(options.filter());
        return this.processData(resp, options);
    }

    /**
     * process the measurements and create the current stats
     *
     * @param data the array of measurements
     */
    private processData(
        resp: IResultList<IMeasurement>,
        options: MeasurementOptions
    ): MeasurementList {
        //We may get any fragment/series so use lowdash
        //simplify
        //console.log("RESPONSE");
        //console.log(resp);
        let rawData = resp.data.reduce(
            (newArr, row) => {
                //default
                let measurementDate = row.time;
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

                let d = formatDate(
                    measurementDate,
                    options.displayDateFormat,
                    options.locale
                );
                newArr.v.push(measurementValue);
                newArr.l.push(d);
                newArr.vl.push({ x: d, y: measurementValue });
                return newArr;
            },
            { v: [], l: [], vl: [], mx: 0, mn: Number.MAX_VALUE, sm: 0 }
        );

        //display the data in reverse (earlier on left)
        rawData.v = rawData.v.reverse();
        rawData.l = rawData.l.reverse();
        rawData.vl = rawData.vl.reverse();

        let aggseries = [];
        if (options.avgPeriod && options.avgPeriod > 0) {
            //Need to apply the correct function here
            aggseries = sma(rawData.v, options.avgPeriod, 3);
        }

        //add labels
        aggseries = aggseries.reduce((acc: ChartPoint[], val, index) => {
            acc.push({ x: rawData.l[index], y: val });
            return acc;
        }, []);

        let measurementList: MeasurementList = new MeasurementList(
            options,
            rawData.v,
            aggseries,
            rawData.l,
            rawData.vl,
            rawData.mx,
            rawData.mn,
            rawData.sm
        );
        ////console.log(measurementList);
        return measurementList;
    }
}
