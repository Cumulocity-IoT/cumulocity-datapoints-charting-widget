/** @format */

import { formatDate } from "@angular/common";
import _ from "lodash";
import boll from "bollinger-bands";
import { IMeasurement, MeasurementService } from "@c8y/client";
import * as moment from "moment";
import * as computeIQR from "compute-iqr";

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

  constructor(
    deviceId: string,
    name: string,
    fragment: string,
    series: string,
    averagePeriod: number,
    targetGraphType: string
  ) {
    this.deviceId = deviceId;
    this.name = name;
    this.fragment = fragment;
    this.series = series;
    this.pageSize = 50;
    this.queryDateFormat = "yyyy-MM-ddTHH:mm:ssZ";
    this.locale = "en";
    this.avgPeriod = averagePeriod;
    this.targetGraphType = targetGraphType;
    this.timeBucket = false;
    this.bucketPeriod = "minute";
    this.labelDateFormat = "HH:mm";
  }

  public setFilter(
    from: Date,
    to: Date,
    count: number,
    targetGraphType: string,
    timeBucket: boolean,
    bucketPeriod: string,
    labelDateFormat: string
  ) {
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
      _.set(
        filter,
        "dateFrom",
        formatDate(_.get(this, "dateFrom"), this.queryDateFormat, this.locale)
      );
    }

    //this should always be "now" for the moment it can't be entered manually
    if (_.has(this, "dateTo")) {
      _.set(
        filter,
        "dateTo",
        formatDate(_.get(this, "dateTo"), this.queryDateFormat, this.locale)
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
  upper: { x: Date; y: any }[]; // can be empty
  aggregate: { x: Date; y: any }[]; // can be empty
  lower: { x: Date; y: any }[]; // can be empty
  valtimes: { x: Date; y: any }[]; // this will contain the raw data
  bucket: number[];
  labels: string[];
  mx: Number;
  mn: Number;
  sm: Number;
  av: Number;

  constructor(
    options: MeasurementOptions,
    upper: { x: Date; y: any }[],
    aggregate: { x: Date; y: any }[],
    lower: { x: Date; y: any }[],
    valtimes: { x: Date; y: any }[],
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
      this.bucket = bucket;
      this.labels = labels;
      this.av = sm / valtimes.length;
      this.mx = mx;
      this.mn = mn;
    } else {
      this.sourceCriteria = new MeasurementOptions("", "", "", "", 30, "line");
      this.aggregate = [];
      this.valtimes = [];
      this.bucket = [];
      this.labels = [];
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
    dateFrom: Date,
    dateTo: Date,
    count: number,
    targetGraphType: string,
    timeBucket: boolean,
    bucketPeriod: string,
    labelDateFormat: string,
    maxMeasurements: number
  ): Promise<MeasurementList> {
    options.setFilter(
      dateFrom,
      dateTo,
      count,
      targetGraphType,
      timeBucket,
      bucketPeriod,
      labelDateFormat
    );

    console.log(timeBucket, bucketPeriod, labelDateFormat);

    let filter = options.filter();

    //get the first page
    _.set(filter, "currentPage", 1);
    let data = [];
    let page = 1;
    console.log(filter);
    let resp = await measurementService.list(filter);
    console.log(resp);
    if (resp.res.status == 200) {
      data = [...resp.data];
      page = resp.paging.nextPage;
      while (page != null && data.length < maxMeasurements) {
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
      if (maxMeasurements > 0 && data.length > maxMeasurements) {
        data.length = maxMeasurements;
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
    //get the data.
    let rawData = this.retrieveData(data, options);

    //display the data in reverse (earlier on left)
    rawData.vl = rawData.vl.reverse();

    //Create aggregate function from data (decompose and recompose {x,y}[])
    let upper = [];
    let aggseries = [];
    let lower = [];

    //only line graphs need this (Checked internally - noop if other)
    this.createAggregateSeries(options, rawData, upper, aggseries, lower);

    //only pie/doughnut/histogram graphs need this (Checked internally - noop if other)
    //histogram will be special type - need to add in handling for bucketing by value (stddev etc)
    console.log(options, rawData.mn, rawData.mx);
    let rawBucketData = this.createBucketSeries(options, rawData);

    //instance of data for use
    let measurementList: MeasurementList = new MeasurementList(
      options,
      upper,
      aggseries,
      lower,
      rawData.vl,
      rawBucketData.data,
      rawBucketData.labels,
      rawData.mx,
      rawData.mn,
      rawData.sm
    );
    ////console.log(measurementList);
    return measurementList;
  }

  private retrieveData(data: IMeasurement[], options: MeasurementOptions) {
    return data.reduce(
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

        //swap axes if horizontal
        if (options.targetGraphType == "horizontalBar") {
          newArr.vl.push({
            y: measurementDate,
            x: measurementValue,
          });
        } else {
          newArr.vl.push({
            x: measurementDate,
            y: measurementValue,
          });
        }

        return newArr;
      },
      { vl: [], mx: 0, mn: Number.MAX_VALUE, sm: 0 }
    );
  }

  private createAggregateSeries(
    options: MeasurementOptions,
    rawData: { vl: any[]; mx: number; mn: number; sm: number },
    upper: any[],
    aggseries: any[],
    lower: any[]
  ) {
    if (options.targetGraphType == "line") {
      if (options.avgPeriod && options.avgPeriod > 0) {
        //just the values
        let source = rawData.vl.map((val) => val.y);
        //average and bollinger bands
        let avper =
          options.avgPeriod > source.length ? source.length : options.avgPeriod;
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

  private createBucketSeries(
    options: MeasurementOptions,
    rawData: { vl: any[]; mx: number; mn: number; sm: number }
  ): { labels: string[]; data: number[] } {
    // Now we can turn this into the buckets and counts.
    let result: { [id: string]: number } = {};
    if (
      options.targetGraphType == "pie" ||
      options.targetGraphType == "doughnut" ||
      options.targetGraphType == "histogram"
    ) {
      if (options.timeBucket) {
        //just the counts over time
        rawData.vl.map((val) => {
          //we want to categorize and return the data
          // same size as the input - but as labels
          // simple 1 dim array
          let mapped = this.categorize(options, val);
          if (_.has(result, mapped)) {
            result[mapped] = result[mapped] + 1;
          } else {
            result[mapped] = 1;
          }
        });
      } else {
        //values buckets
        let vals = rawData.vl.map((val) => val.y);
        let hist = this.calculateHistogram(vals, 5);
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

  public categorize(
    options: MeasurementOptions,
    val: { x: Date; y: number },
    mn?: number,
    mx?: number,
    buckets?: number
  ): string {
    if (options.timeBucket) {
      return moment(val.x).format(options.labelDateFormat);
    }

    //histogram
    let bin = Math.floor((val.y - mn) / buckets);
    console.log(`BIN: ${bin}`);
    return bin.toString();
  }

  calculateHistogram(
    arr,
    numBins,
    trimTailPercentage = 0.0
  ): { labels: string[]; counts: number[] } {
    const bins: number[] = [];
    const binLabels: string[] = [];

    let dataCopy = arr.sort((a, b) => a - b);

    // if (trimTailPercentage !== 0.0) {
    //     const rightPercentile =
    //         dataCopy[
    //             Math.floor((1.0 - trimTailPercentage) * dataCopy.length - 1)
    //         ];
    //     const leftPercentile =
    //         dataCopy[Math.ceil(trimTailPercentage * dataCopy.length - 1)];
    //     dataCopy = dataCopy.filter(
    //         (x) => x <= rightPercentile && x >= leftPercentile
    //     );
    // }

    const min = dataCopy[0];
    const max = dataCopy[dataCopy.length - 1];

    // if (numBins === 0) {
    //     const sturges = Math.ceil(Math.log2(dataCopy.length)) + 1;
    //     const iqr = computeIQR(dataCopy);
    //     // If IQR is 0, fd returns 1 bin. This is as per the NumPy implementation:
    //     //   https://github.com/numpy/numpy/blob/master/numpy/lib/histograms.py#L138
    //     let fdbins = 1;
    //     if (iqr !== 0.0) {
    //         const fd = 2.0 * (iqr / Math.pow(dataCopy.length, 1.0 / 3.0));
    //         fdbins = Math.ceil((max - min) / fd);
    //     }
    //     numBins = Math.max(sturges, fdbins);
    // }

    const binSize = (max - min) / numBins === 0 ? 1 : (max - min) / numBins;

    //initialise to 0 and labels
    let previousLabel = "0.00";
    for (let i = 0; i < numBins; i++) {
      bins.push(0);
      let upper = (i * binSize).toFixed(2);
      binLabels.push(`${previousLabel} - ${upper}`);
      previousLabel = upper;
    }

    dataCopy.forEach((item) => {
      let binIndex = Math.floor((item - min) / binSize);
      // for values that lie exactly on last bin we need to subtract one
      if (binIndex === numBins) {
        binIndex--;
      }
      bins[binIndex]++;
    });

    return { labels: binLabels, counts: bins };
  }
}
