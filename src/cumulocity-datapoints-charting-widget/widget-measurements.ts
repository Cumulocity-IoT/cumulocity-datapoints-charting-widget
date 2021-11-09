/** @format */

import { has, get } from "lodash";
import boll from "bollinger-bands";
import { IMeasurement, MeasurementService } from "@c8y/client";
import * as moment from "moment";
import * as Chart from "chart.js";
import { openDB } from "idb";
import { MeasurementOptions } from "./widget-config";

/**
 * The product of this class is a list of value/date pairs
 * tagged with the source
 */
export class MeasurementList {
    sourceCriteria: MeasurementOptions;
    upper: Chart.ChartPoint[]; // can be empty
    aggregate: Chart.ChartPoint[]; // can be empty
    lower: Chart.ChartPoint[]; // can be empty
    valtimes: Chart.ChartPoint[]; // this will contain the raw data
    valCount: number; // this will contain the raw data
    bucket: number[]; // pie/doughnut mainly
    labels: string[]; // pie/doughnut mainly
    mx: number;
    mn: number;
    sm: number;
    av: number;

    constructor(
        options: MeasurementOptions,
        upper: Chart.ChartPoint[],
        aggregate: Chart.ChartPoint[],
        lower: Chart.ChartPoint[],
        valtimes: Chart.ChartPoint[],
        valCount: number,
        bucket: number[],
        labels: string[],
        mx: number,
        mn: number,
        sm: number
    ) {
        if (options !== undefined) {
            this.sourceCriteria = options;
            this.upper = upper;
            this.aggregate = aggregate;
            this.lower = lower;
            this.valtimes = valtimes;
            this.valCount = valCount;
            this.bucket = bucket;
            this.labels = labels;
            this.av = sm / valtimes.length;
            this.mx = mx;
            this.mn = mn;
        } else {
            this.sourceCriteria = new MeasurementOptions(30, "line", 2, 5, 0, 10, false, false);
            this.aggregate = [];
            this.valtimes = [];
            this.valCount = 0;
            this.bucket = [];
            this.labels = [];
            this.av = 0;
            this.mx = 0;
            this.mn = 0;
        }
    }

    append(ml: MeasurementList) {
        this.sourceCriteria = ml.sourceCriteria;
        this.upper = [...this.upper, ...ml.upper];
        this.aggregate = [...this.aggregate, ...ml.aggregate];
        this.lower = [...this.lower, ...ml.lower];
        this.valtimes = [...this.lower, ...ml.lower];
        this.valCount = ml.valCount;
        this.bucket = [...this.bucket, ...ml.bucket];
        this.labels = [...this.labels, ...ml.labels];
    }
}

class RawData {
    vl: Chart.ChartPoint[];
    vlCounts: number[];
    mx: number;
    mn: number;
    sm: number;
    lastBucket = "";

    constructor() {
        this.vl = [];
        this.vlCounts = [];
        this.mx = 0;
        this.mn = Number.MAX_VALUE;
        this.sm = 0;
        this.lastBucket = "";
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
     * @param options query options and params
     * @param from date
     * @param to (usually now)
     * @param count pagesize
     * @param targetGraphType: some processing differs for types
     * @param timeBucket: are we aggregating counts in time (true/false)
     * @param bucketPeriod: bucket size (min, hour, day etc)
     * @param labelDateFormat: string determining date format (bucket labels based on this)
     * @param maxMeasurements: limit the measurements (used when #measurements required)
     */
    public async getMeasurements(
        chartID: string,
        deviceId: string,
        name: string,
        fragment: string,
        series: string,
        measurementService: MeasurementService,
        options: MeasurementOptions,
        dateFrom: Date,
        dateTo: Date,
        count: number,
        targetGraphType: string,
        timeBucket: boolean,
        bucketPeriod: string,
        labelDateFormat: string,
        maxMeasurements: number,
        useCache: boolean = false
    ): Promise<MeasurementList> {
        //options for this query
        let dbName = "cumulocity-datapoints-charting-widget-db";
        let storeName = `datasets`;
        let key = `${chartID}-${deviceId}.${fragment}.${series}`;
        const db = await openDB(dbName, 1, {
            upgrade(db, oldVersion, newVersion, transaction) {
               
                try {
                    transaction.objectStore(storeName);
                } catch (e) {
                    db.createObjectStore(storeName); //needs to be in here to work
                }
            },
        });
        let data: IMeasurement[] = [];
        if (useCache) {
            const item = await db.transaction(storeName).objectStore(storeName).get(key);
            data = JSON.parse(item ? item : "[]"); //array of measurements
        }

        let adjustedFrom = dateFrom;
        let adjustedTo = dateTo;
        let toDateInRange = undefined;
        let fromDateInRange = undefined;

        //shortcut here - old data is fine - will update on next RT
        if (data.length) {
            //reversed - newest first
            fromDateInRange = new Date(data[data.length - 1].time);
            toDateInRange = new Date(data[0].time);
        }

        if (data.length && moment(dateFrom).isSameOrAfter(fromDateInRange) && moment(dateFrom).isSameOrBefore(toDateInRange)) {
            //cache hit if from and/or to are within range
            if (moment(dateTo).isSameOrBefore(toDateInRange) && moment(dateTo).isSameOrAfter(fromDateInRange)) {
                //totally within range in cache 
            } else {
                //starts in range - need to get latestDateInRange to dateTo
                adjustedFrom = toDateInRange;
                options.setFilter(
                    deviceId,
                    name,
                    fragment,
                    series,
                    adjustedFrom,
                    adjustedTo,
                    count,
                    targetGraphType,
                    timeBucket,
                    bucketPeriod,
                    labelDateFormat
                );

                let filter = options.filter();
                data.pop(); //stop duplicate
                let newData = await this.getDataFromC8y(filter, measurementService, data, maxMeasurements);
                data = [...data, ...newData];
            }
        } else if (data.length > 0 && moment(dateTo).isSameOrBefore(toDateInRange) && moment(dateTo).isSameOrAfter(fromDateInRange)) {
            //ends in range - need to get dateFrom to earliestDateInRange
            adjustedTo = fromDateInRange;
            options.setFilter(
                deviceId,
                name,
                fragment,
                series,
                adjustedFrom,
                adjustedTo,
                count,
                targetGraphType,
                timeBucket,
                bucketPeriod,
                labelDateFormat
            );

            let filter = options.filter();
            data.shift(); //stop duplicate
            let newData = await this.getDataFromC8y(filter, measurementService, data, maxMeasurements);
            data = [...newData, ...data];

        } else {
            //we need everything.
            options.setFilter(deviceId, name, fragment, series, dateFrom, dateTo, count, targetGraphType, timeBucket, bucketPeriod, labelDateFormat);

            let filter = options.filter();
            //get the first page
            data = await this.getDataFromC8y(filter, measurementService, data, maxMeasurements);
        }

        if (useCache) {
            const tx = db.transaction(storeName, "readwrite");
            const store = await tx.objectStore(storeName);
            //store the data so we can reopen immediately
            await store.put(JSON.stringify(data), key);
            await tx.done;
        }
        db.close();

        //lets make sure we only show what's required.
        //From
        let startIndex = data.length - 1;
        if (startIndex >= 0) {
            let rangeStart = new Date(data[data.length - 1].time);
            while ((startIndex < data.length - 1) && moment(rangeStart).isBefore(dateFrom)) {
                rangeStart = new Date(data[--startIndex].time);
            }
        }

        //To
        let endIndex = 0;
        if (endIndex <= data.length - 1) {
            let rangeEnd = new Date(data[0].time);
            while ((endIndex > 0) && moment(rangeEnd).isAfter(dateTo)) {
                rangeEnd = new Date(data[++endIndex].time);
            }
        }

        options.setFilter(deviceId, name, fragment, series, dateFrom, dateTo, count, targetGraphType, timeBucket, bucketPeriod, labelDateFormat);
        return this.processData(data.slice(endIndex, startIndex), options);
    }

    private async getDataFromC8y(filter: object, measurementService: MeasurementService, data: IMeasurement[], maxMeasurements: number) {
       const f = {...filter, currentPage: 1};
        let page = 1;
        let resp = await measurementService.list(f);
        if (resp.res.status == 200) {
            data = [...resp.data];
            page = resp.paging.nextPage;
            while (page != null && (maxMeasurements == 0 || data.length < maxMeasurements)) {
                // Need to handle errors here and also could there be
                // other status codes to handle?
                resp = await resp.paging.next();
                if (resp.res.status == 200) {
                    //add next range of stuff...
                    data = [...data, ...resp.data];
                }

                page = resp.paging.nextPage;
            }
            if (maxMeasurements > 0 && data.length > maxMeasurements) {
                data.length = maxMeasurements;
            }
        }
        return data;
    }

    public async createAggregate(
        seriesData: { [key: string]: MeasurementList; },
        measurements: string[],
        options: MeasurementOptions,
        sumData: boolean = false
    ): Promise<MeasurementList> {
        let rawData: RawData = new RawData();
        let upper: Chart.ChartPoint[] = [];
        let lower: Chart.ChartPoint[] = [];
        let aggseries: Chart.ChartPoint[] = [];

        //we have the rawdata - MUST fill out the sources before attempting this.
        for (let index = 0; index < measurements.length; index++) {
            const seriesKey = measurements[index];
            const raw = seriesData[seriesKey];
            //lets accumulate the data...
            if (rawData.vl.length == 0) {
                rawData.vl = JSON.parse(JSON.stringify(raw.valtimes)); //deep copy
            } else {
                //add the values
                let theLength = Math.min(rawData.vl.length, raw.valtimes.length);
                rawData.vl.length = theLength;
                raw.valtimes.length = theLength;
                for (let innerIndex = 0; innerIndex < theLength; innerIndex++) {
                    const element = raw.valtimes[innerIndex];
                    (<number>rawData.vl[innerIndex].y) += <number>element.y;
                }
            }
        }

        if (!sumData) {
            for (let index = 0; index < rawData.vl.length; index++) {
                const point = rawData.vl[index];
                rawData.vl[index].y = parseFloat((<number>point.y / measurements.length).toFixed(options.numdp));
            }

        }
        //instance of data for use
        let measurementList: MeasurementList = new MeasurementList(
            options,
            upper,
            aggseries,
            lower,
            rawData.vl,
            rawData.vlCounts[rawData.vlCounts.length - 1], //last count so we can continue
            [], //bucket data
            [], //bucket labels
            rawData.mx,
            rawData.mn,
            rawData.sm
        );
        return measurementList;
    }

    /**
     * process the measurements and create the current stats
     *
     * @param data the array of measurements
     */
    private processData(data: IMeasurement[], options: MeasurementOptions): MeasurementList {
        //get the data.
        let rawData: RawData = this.retrieveData(data, options);

        //display the data in reverse (earlier on left)
        rawData.vl = rawData.vl.reverse();

        //Create aggregate function from data (decompose and recompose {x,y}[])
        let upper: Chart.ChartPoint[] = [];
        let aggseries: Chart.ChartPoint[] = [];
        let lower: Chart.ChartPoint[] = [];

        //only line graphs need this (Checked internally - noop if other)
        this.createAggregateSeries(options, rawData, upper, aggseries, lower);

        //only pie/doughnut/histogram graphs need this (Checked internally - noop if other)
        //histogram will be special type - need to add in handling for bucketing by value (stddev etc)
        const rawBucketData = this.createBucketSeries(options, rawData);

        //instance of data for use
        const measurementList = new MeasurementList(
            options,
            upper,
            aggseries,
            lower,
            rawData.vl,
            rawData.vlCounts[rawData.vlCounts.length - 1], //last count so we can continue
            rawBucketData.data,
            rawBucketData.labels,
            rawData.mx,
            rawData.mn,
            rawData.sm
        );
        return measurementList;
    }

    /**
     * Internal method for simplifying getMeasurements. Reduce the
     * data received into an intermediate structure that has various
     * stats
     *
     * @param data unprocessed IMeasurement array from measurement service
     * @param options chart options and params
     * @returns RawData structure
     */
    private retrieveData(data: IMeasurement[], options: MeasurementOptions): RawData {
        let d = data.reduce((newArr, row) => {
            //default
            let measurementDate = new Date(row.time);
            if (options.groupby === true) {
                switch (options.bucketPeriod) {
                    case "second": {
                        measurementDate.setMilliseconds(0);
                        break;
                    }
                    case "minute": {
                        measurementDate.setMilliseconds(0);
                        measurementDate.setSeconds(0);
                        break;
                    }
                    case "hour": {
                        measurementDate.setMilliseconds(0);
                        measurementDate.setSeconds(0);
                        measurementDate.setMinutes(0);
                        break;
                    }
                    default: {
                        measurementDate.setMilliseconds(0);
                        measurementDate.setSeconds(0);
                        measurementDate.setMinutes(0);
                        measurementDate.setHours(0);
                        break;
                    }
                }
            }

            let measurementValue = 0;
            //need the fragment, series
            if (has(row, options.fragment)) {
                let frag = get(row, options.fragment);
                if (has(frag, options.series)) {
                    let ser = get(frag, options.series);
                    //if there is a group by we need to either sum or average the
                    //value for the current set of measurements
                    measurementValue = parseFloat(parseFloat(ser.value).toFixed(options.numdp));
                    if (measurementValue > newArr.mx) {
                        newArr.mx = measurementValue;
                    }
                    if (measurementValue < newArr.mn) {
                        newArr.mn = measurementValue;
                    }
                    newArr.sm = newArr.sm + measurementValue;
                }
            }

            //t is the count of measurements in this Chart point.
            let v: Chart.ChartPoint = {
                x: measurementDate,
                y: measurementValue,
            };

            if (options.targetGraphType == "horizontalBar") {
                v = {
                    y: measurementDate,
                    x: measurementValue,
                };
            }

            if (options.groupby === true) {
                let lst = this.categorize(options, v);

                //new data point needed - deal with the last values
                if (newArr.lastBucket != lst) {
                    newArr.vl.push(v);
                    newArr.vlCounts.push(1);
                } else {
                    if (options.targetGraphType == "horizontalBar") {
                        newArr.vl[newArr.vl.length - 1].x = <number>newArr.vl[newArr.vl.length - 1].x + <number>v.x;
                    } else {
                        newArr.vl[newArr.vl.length - 1].y = <number>newArr.vl[newArr.vl.length - 1].y + <number>v.y;
                    }
                    newArr.vlCounts[newArr.vlCounts.length - 1] += 1; //increment
                }

                newArr.lastBucket = lst;
            } else {
                newArr.vl.push(v); //store raw
            }
            return newArr;
        }, new RawData());

        //if grouping, and iff !cumulative we need to average the last element
        let result: RawData = d;
        if (options.groupby === true) {
            if (!options.cumulative) {
                result.vl = d.vl.map((val, index) => {
                    if (options.targetGraphType == "horizontalBar") {
                        val.x = parseFloat((<number>val.x / d.vlCounts[index]).toFixed(options.numdp));
                    } else {
                        val.y = parseFloat((<number>val.y / d.vlCounts[index]).toFixed(options.numdp));
                    }
                    return val;
                });
            }
        }

        return result;
    }

    /**
     * Generate the ma/bollinger bands for a series if required.
     *
     * @param options options and params
     * @param rawData the results of retrieve data
     * @param upper target array for boll band series
     * @param aggseries target for moving average
     * @param lower target array for boll band series
     */
    private createAggregateSeries(options: MeasurementOptions, rawData: RawData, upper: Chart.ChartPoint[], aggseries: Chart.ChartPoint[], lower: Chart.ChartPoint[]) {
        if (options.targetGraphType == "line") {
            if (options.avgPeriod && options.avgPeriod > 0) {
                //just the values
                let source = rawData.vl.map((val) => val.y);
                if (!source.length) {
                    return;
                }
                //average and bollinger bands
                let avper = options.avgPeriod > source.length ? source.length : options.avgPeriod;
                let a = boll(source, avper, 2);

                for (let index = 0; index < rawData.vl.length; index++) {
                    const element = rawData.vl[index];

                    //same for all aggregate values (values lag real data)
                    if (!(index in a.upper)) {
                        upper.push({ x: element.x, y: rawData.mx });
                        aggseries.push({ x: element.x, y: element.y });
                        lower.push({ x: element.x, y: rawData.mn });
                    } else {
                        upper.push({ x: element.x, y: a.upper[index] });
                        aggseries.push({ x: element.x, y: a.mid[index] });
                        lower.push({ x: element.x, y: a.lower[index] });
                    }
                }
            }
        }
    }

    /**
     * Generate the series and labels for bucketed data. Unlike
     * "normal" we are using separate labels rather than the
     * ChartPoint structure of chartjs.
     *
     * @param options chart options and params
     * @param rawData the results of retrieve data
     * @returns object with the 2 arrays within it.
     */
    private createBucketSeries(options: MeasurementOptions, rawData: RawData): { labels: string[]; data: number[]; } {
        // Now we can turn this into the buckets and counts.
        let result: { [id: string]: number; } = {};
        if (options.targetGraphType == "pie" || options.targetGraphType == "doughnut" || options.targetGraphType == "histogram") {
            if (options.timeBucket) {
                //just the counts over time
                rawData.vl.map((val) => {
                    //we want to categorize and return the data
                    // same size as the input - but as labels
                    // simple 1 dim array
                    let mapped = this.categorize(options, val);
                    if (has(result, mapped)) {
                        result[mapped] = result[mapped] + 1;
                    } else {
                        result[mapped] = 1;
                    }
                });
            } else {
                //values buckets
                let vals = rawData.vl.map((val) => val.y as number);
                let hist = this.calculateHistogram(vals, options.mxBuckets, options.mnBuckets, options.sizeBuckets, options.numdp);
                return { labels: hist.labels, data: hist.counts };
            }
        }

        let bucketData: number[] = [];
        let bucketLabels: string[] = [];
        for (const bucketKey in result) {
            if (Object.prototype.hasOwnProperty.call(result, bucketKey)) {
                const bucket = result[bucketKey];
                bucketData.push(bucket);
                bucketLabels.push(bucketKey);
            }
        }

        return { labels: bucketLabels, data: bucketData };
    }

    /**
     * return a "bucket" for the point passed
     *
     * @param options chart options and params
     * @param val Point to be examined
     * @param mn optional
     * @param mx optional
     * @param buckets optional
     * @returns
     */
    public categorize(options: MeasurementOptions, val: Chart.ChartPoint, mn?: number, mx?: number, buckets?: number): string {
        //are we aggregating by time unit
        if (options.timeBucket || options.groupby) {
            if (options.targetGraphType == "horizontalBar") {
                return moment(val.y).format(options.labelDateFormat);
            }
            return moment(val.x).format(options.labelDateFormat);
        }

        //histogram
        let bin = "";

        if (typeof val.y !== "number") {
            bin = val.y.toString();
        } else {
            bin = Math.floor((val.y - mn) / buckets).toString();
        }

        return bin;
    }

    /**
     * From the values passed calculate a histogram of
     * values (used in createBucketSeries)
     * @param arr input array
     * @param numBins number of buckets
     * @returns data and labels in object
     */
    calculateHistogram(arr: number[], maxBucket: number, minBucket: number, binSize: number, dp: number): { labels: string[]; counts: number[]; } {
        const bins: number[] = [];
        const binLabels: string[] = [];
        let previousLabel = parseFloat(minBucket.toString()).toFixed(dp);
        let dataCopy = arr.sort((a, b) => a - b);

        bins.push(0); //lower catch all
        binLabels.push(`< ${minBucket}`);

        let numBins = Math.floor((maxBucket - minBucket) / binSize) + 1;
        //Initialize to 0 and labels
        for (let i = 0; i < numBins; i++) {
            bins.push(0);
            let upper = Math.min(minBucket + (i + 1) * binSize, maxBucket).toFixed(dp);
            binLabels.push(`${previousLabel} - ${upper}`);
            previousLabel = upper;
        }

        bins.push(0); //upper catch all
        binLabels.push(`> ${maxBucket}`);

        dataCopy.forEach((item) => {
            let binIndex = Math.floor((item - minBucket) / binSize);

            if (item < minBucket) {
                bins[0]++;
            } else if (item > maxBucket) {
                bins[bins.length - 1]++;
            } else {
                // for values that lie exactly on last bin we need to subtract one
                if (binIndex === numBins) {
                    binIndex--;
                }
                bins[binIndex + 1]++; //offset the <x bucket
            }
        });

        return { labels: binLabels, counts: bins };
    }
}
