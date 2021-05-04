/** @format */

import { Component, Input, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { WidgetConfig } from "./widget-config";
import * as _ from "lodash";
import { ChartDataSets, ChartOptions, ChartPoint, ChartTooltipItem, PositionType } from "chart.js";
import { ThemeService, BaseChartDirective, Label } from "ng2-charts";
import { DatePipe } from "@angular/common";
import { MeasurementList, MeasurementOptions, MeasurementHelper } from "./widget-measurements";
import { MeasurementService, Realtime } from "@c8y/ngx-components/api";
import { WidgetHelper } from "./widget-helper";
import * as moment from "moment";
import boll from "bollinger-bands";
import "chartjs-plugin-labels";
import { openDB } from "idb";
//import { openDB } from "idb";

interface DataObject {
    data: any;
    key: string;
    options: MeasurementOptions;
}

@Component({
    templateUrl: "./cumulocity-datapoints-charting-widget.component.html",
    styleUrls: ["./cumulocity-datapoints-charting-widget.component.css"],
    providers: [DatePipe, ThemeService],
})
export class CumulocityDataPointsChartingWidget implements OnInit, OnDestroy {
    /**
     * Standard config element, access this via the widgetHelper
     * rather than directly.
     */
    @Input() config;

    /**
     * Gain access to chart object so we can call update
     * under certain circumstance
     */
    @ViewChild(BaseChartDirective, { static: false })
    chartElement: BaseChartDirective;

    /**
     * Finished loading?
     */
    dataLoaded: boolean = false;

    /**
     * These are the main interfaces to the config
     * and the measurements
     */
    widgetHelper: WidgetHelper<WidgetConfig>;
    measurementHelper: MeasurementHelper;

    /**
     * This charts data, retrieved initially in init, and then
     * updated as measurements are received. Realtime data is
     * subscribed and so must be released on destroy
     */
    seriesData: { [key: string]: MeasurementList };
    subscription: { [key: string]: Object } = {}; //record per device subscriptions

    /**
     * ng2-charts data members referenced by the element
     */
    chartData: ChartDataSets[];
    chartLabels: Label[];
    chartLegend: boolean;

    //chart js options
    chartOptions: ChartOptions = {
        maintainAspectRatio: false,
        legend: {
            display: false,
        },
        elements: {
            line: {
                borderWidth: 1,
            },
            point: {
                radius: 0,
            },
        },
        tooltips: {
            enabled: true,
            // callbacks: {
            //   label: (tooltipItem: ChartTooltipItem, data) => {
            //     let label = data.labels[tooltipItem.index];
            //     let value =
            //       data.datasets[tooltipItem.datasetIndex].data[tooltipItem.index];
            //     return " " + label + ": " + value + " %";
            //   },
            // },
        },
        responsive: true,
        scales: {
            xAxes: [],
            yAxes: [],
        },
    };

    /**
     * Used on the page
     *
     * @returns true if we have devices and measurements selected
     */
    verifyConfig(): boolean {
        //optimism
        this.widgetHelper.getChartConfig().enabled = this.widgetHelper.getWidgetConfig() !== undefined;
        this.widgetHelper.getChartConfig().message = "Loading Data...";
        if (this.widgetHelper.getChartConfig().enabled) {
            if (!this.widgetHelper.getWidgetConfig().selectedDevices.length || !this.widgetHelper.getWidgetConfig().selectedMeasurements.length) {
                //1: do we have devices
                this.widgetHelper.getChartConfig().enabled = false;
                this.widgetHelper.getChartConfig().message = "You must choose at least one device and fragment to plot a chart.";
            } else if (this.widgetHelper.getChartConfig().multivariateplot) {
                let checks = this.checkMultivariateChart();
                //console.log(this.widgetHelper.getChartConfig().getChartType(), checks);
                if (this.widgetHelper.getChartConfig().getChartType() == "bubble") {
                    if (checks.series != 3 || !checks.x || !checks.y || !checks.r) {
                        this.widgetHelper.getChartConfig().enabled = false;
                        this.widgetHelper.getChartConfig().message = "You must choose exactly 3 fragments and assign x,y, and r.";
                    }
                } else if (checks.series != 2) {
                    this.widgetHelper.getChartConfig().enabled = false;
                    this.widgetHelper.getChartConfig().message = "You must choose exactly 2 fragments and assign x,y.";
                } else if (!checks.x || !checks.y) {
                    this.widgetHelper.getChartConfig().enabled = false;
                    this.widgetHelper.getChartConfig().message = "You must assign x,y.";
                } else {
                    //just in case
                    this.widgetHelper.getChartConfig().enabled = true;
                }
            } else if (!this.chartData.length && this.dataLoaded) {
                this.widgetHelper.getChartConfig().enabled = false;
                this.widgetHelper.getChartConfig().message = "There appears to be no data selected to plot a chart (check series).";
            } else if (!this.dataLoaded) {
                this.widgetHelper.getChartConfig().enabled = false;
                this.widgetHelper.getChartConfig().message = "Loading Data...";
            }
        }

        return this.widgetHelper.getChartConfig().enabled;
    }

    /**
     * Initialize the Measurement service, Realtime service and date pipe.
     * Sets the widgetHelper up and points it at config - initializes seriesData
     * as empty.
     *
     * @param measurementService
     * @param datepipe
     * @param realtimeService
     */
    constructor(
        //        private http: HttpClient,
        private measurementService: MeasurementService,
        public datepipe: DatePipe,
        private realtimeService: Realtime
    ) {
        this.widgetHelper = new WidgetHelper(this.config, WidgetConfig); //default access through here
        this.measurementHelper = new MeasurementHelper();
        this.seriesData = {};
    }

    /**
     * Remove subs
     */
    ngOnDestroy(): void {
        //this.rtData$.unsubscribe();

        for (const sub in this.subscription) {
            if (Object.prototype.hasOwnProperty.call(this.subscription, sub)) {
                const tbd = this.subscription[sub];
                if (sub == "timer") {
                    clearTimeout(<number>tbd);
                } else {
                    this.realtimeService.unsubscribe(tbd);
                }
            }
        }
    }

    /**
     * As we process required series we create subscriptions to measurements.
     * This method is the generic call back for these measurements as they
     * arrive.
     *
     * @param data
     * @param key
     * @param options
     */
    async handleRealtime(dataObject: DataObject): Promise<void> {
        let measurementDate = new Date(dataObject.data.data.data.time);
        if (dataObject.options.groupby === true) {
            switch (dataObject.options.bucketPeriod) {
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

        let measurementValue = 0; //default
        let measurementUnit = undefined; //default
        //need the fragment, series
        if (_.has(dataObject.data.data.data, dataObject.options.fragment)) {
            let frag = _.get(dataObject.data.data.data, dataObject.options.fragment);
            if (_.has(frag, dataObject.options.series)) {
                let ser = _.get(frag, dataObject.options.series);
                measurementValue = parseFloat(parseFloat(ser.value).toFixed(dataObject.options.numdp));
                if (_.has(ser, "unit")) {
                    measurementUnit = ser.unit;
                }

                //The current point
                let datum: Chart.ChartPoint = {
                    x: measurementDate,
                    y: measurementValue,
                };
                if (this.widgetHelper.getChartConfig().getChartType() == "horizontalBar") {
                    datum = {
                        y: measurementDate,
                        x: measurementValue,
                    };
                }

                //What bucket should it be in?
                let newPointBucket = this.measurementHelper.categorize(dataObject.options, datum);
                let lastPointBucket = "";
                if (this.seriesData[dataObject.key].valtimes.length - 1 >= 0) {
                    let lastPoint = this.seriesData[dataObject.key].valtimes[this.seriesData[dataObject.key].valtimes.length - 1];
                    lastPointBucket = this.measurementHelper.categorize(dataObject.options, lastPoint);
                }

                //console.log("BUCKET", newPointBucket, lastPointBucket);
                // need to add to current data point - Note that we test for the bucket we should be putting this in
                // and tally up the count of the actual values in the current average (valcount)
                //if we are not grouping, OR if we are adding a new bucket we set valcount to 1
                this.updateSeriesData(dataObject, newPointBucket, lastPointBucket, datum);

                //handle group series
                this.updateGroupData(dataObject.options, datum);

                //console.log("point", this.seriesData[key].valtimes[this.seriesData[key].valtimes.length - 1]);

                // Pie/Doughnut differ from other types
                if (this.widgetHelper.getChartConfig().getChartType() == "pie" || this.widgetHelper.getChartConfig().getChartType() == "doughnut") {
                    this.seriesData[dataObject.key].valtimes.push(datum);

                    //aggregating by time buckets
                    if (this.widgetHelper.getChartConfig().aggregation == 0) {
                        let index = -1;
                        this.seriesData[dataObject.key].labels.some((v, i) => {
                            if (v === newPointBucket) {
                                index = i;
                                return true;
                            }
                            return false;
                        });

                        if (index === -1) {
                            this.seriesData[dataObject.key].labels.push(newPointBucket);
                            this.seriesData[dataObject.key].bucket.push(1);
                        } else {
                            this.seriesData[dataObject.key].bucket[index] = this.seriesData[dataObject.key].bucket[index] + 1;
                        }
                    } else {
                        //By Value buckets
                        let vals = this.seriesData[dataObject.key].valtimes.map((val) => <number>val.y);
                        let hist = this.measurementHelper.calculateHistogram(
                            vals,
                            this.widgetHelper.getChartConfig().maxBucket,
                            this.widgetHelper.getChartConfig().minBucket,
                            this.widgetHelper.getChartConfig().sizeBuckets,
                            this.widgetHelper.getChartConfig().numdp
                        );
                        //
                        // In this case we want to replace the data
                        //
                        this.seriesData[dataObject.key].labels.length = 0;
                        this.seriesData[dataObject.key].bucket.length = 0;
                        this.seriesData[dataObject.key].labels.push(...hist.labels);
                        this.seriesData[dataObject.key].bucket.push(...hist.counts);
                    }
                } else {
                    //Only take the last N values to create the average
                    if (dataObject.options.avgPeriod > 0) {
                        //just the values
                        let source = this.seriesData[dataObject.key].valtimes
                            .slice(Math.max(this.seriesData[dataObject.key].valtimes.length - dataObject.options.avgPeriod, 0))
                            .map((val) => (dataObject.options.targetGraphType !== "horizontalBar" ? val.y : val.x));

                        // let a = sma(source, options.avgPeriod, 3);
                        let avper = dataObject.options.avgPeriod > source.length ? source.length : dataObject.options.avgPeriod;
                        let a = boll(source, avper, 2);

                        //aggregate needs x and y coordinates but we use only the last
                        this.seriesData[dataObject.key].upper.push({
                            x: measurementDate,
                            y: a.upper[a.upper.length - 1],
                        });
                        this.seriesData[dataObject.key].aggregate.push({
                            x: measurementDate,
                            y: a.mid[a.mid.length - 1],
                        });
                        this.seriesData[dataObject.key].lower.push({
                            x: measurementDate,
                            y: a.lower[a.lower.length - 1],
                        });
                    }
                }

                if (this.chartElement) {
                    //range required...
                    let { from, to } = this.getDateRange();

                    //
                    // Line has the bollinger bands
                    //
                    if (
                        this.widgetHelper.getChartConfig().getChartType() === "line" ||
                        this.widgetHelper.getChartConfig().getChartType() === "spline"
                    ) {
                        while (moment(this.seriesData[dataObject.key].aggregate[0].x).isBefore(moment(from))) {
                            this.seriesData[dataObject.key].upper.shift();
                            this.seriesData[dataObject.key].aggregate.shift();
                            this.seriesData[dataObject.key].lower.shift();
                        }
                    }

                    if (
                        this.widgetHelper.getChartConfig().getChartType() === "pie" ||
                        this.widgetHelper.getChartConfig().getChartType() === "doughnut"
                    ) {
                        //all graph types
                        //only remove data when we deal with times...
                        if (this.widgetHelper.getChartConfig().aggregation == 0) {
                            let aggUnit = this.widgetHelper.getChartConfig().rangeUnits[this.widgetHelper.getChartConfig().aggTimeFormatType].text;
                            let aggFormat = this.widgetHelper.getChartConfig().rangeDisplay[aggUnit];

                            if (this.widgetHelper.getChartConfig().customFormat) {
                                aggFormat = this.widgetHelper.getChartConfig().customFormatString;
                            }

                            while (moment(this.seriesData[dataObject.key].labels[0], aggFormat).isBefore(from)) {
                                this.seriesData[dataObject.key].bucket.shift();
                                this.seriesData[dataObject.key].labels.shift();
                            }
                        }
                    }

                    if (
                        this.widgetHelper.getChartConfig().getChartType() === "line" ||
                        this.widgetHelper.getChartConfig().getChartType() === "spline" ||
                        (!this.widgetHelper.getChartConfig().multivariateplot && this.widgetHelper.getChartConfig().getChartType() === "scatter") ||
                        this.widgetHelper.getChartConfig().getChartType() === "bar"
                    ) {
                        //all graph types
                        while (moment(this.seriesData[dataObject.key].valtimes[0].x).isBefore(moment(from))) {
                            this.seriesData[dataObject.key].valtimes.shift();
                        }
                        while (moment(this.seriesData[dataObject.options.group].valtimes[0].x).isBefore(moment(from))) {
                            this.seriesData[dataObject.options.group].valtimes.shift();
                        }
                    }

                    if (this.widgetHelper.getChartConfig().getChartType() === "horizontalBar") {
                        while (moment(this.seriesData[dataObject.key].valtimes[0].y).isBefore(moment(from))) {
                            this.seriesData[dataObject.key].valtimes.shift();
                        }
                        while (moment(this.seriesData[dataObject.options.group].valtimes[0].y).isBefore(moment(from))) {
                            this.seriesData[dataObject.options.group].valtimes.shift();
                        }
                    }

                    this.setAxes();
                    this.chartElement.update();
                }
                let dbName = "cumulocity-datapoints-charting-widget-db";
                let storeName = `datasets`;
                let key = `${this.widgetHelper.getUniqueID()}-${dataObject.key}`;
                const db = await openDB(dbName);
                const tx = db.transaction(storeName, "readwrite");
                const store = await tx.objectStore(storeName);
                const _value = await store.put(JSON.stringify(this.seriesData[dataObject.key]), key);
                await tx.done;
            }
        }
    }

    private updateSeriesData(dataObject: DataObject, newPointBucket: string, lastPointBucket: string, datum: ChartPoint) {
        if (dataObject.options.groupby && newPointBucket === lastPointBucket) {
            this.seriesData[dataObject.key].valCount += 1;
            if (this.widgetHelper.getChartConfig().getChartType() == "horizontalBar") {
                let v: any = this.seriesData[dataObject.key].valtimes[this.seriesData[dataObject.key].valtimes.length - 1].x;
                this.seriesData[dataObject.key].valtimes[this.seriesData[dataObject.key].valtimes.length - 1].x =
                    (<number>datum.x + v * (this.seriesData[dataObject.key].valCount - 1)) / this.seriesData[dataObject.key].valCount;
                this.seriesData[dataObject.key].valtimes[this.seriesData[dataObject.key].valtimes.length - 1].x = parseFloat(
                    (<number>this.seriesData[dataObject.key].valtimes[this.seriesData[dataObject.key].valtimes.length - 1].x).toFixed(
                        dataObject.options.numdp
                    )
                );
            } else {
                let v: any = this.seriesData[dataObject.key].valtimes[this.seriesData[dataObject.key].valtimes.length - 1].y;
                this.seriesData[dataObject.key].valtimes[this.seriesData[dataObject.key].valtimes.length - 1].y =
                    (<number>datum.y + v * (this.seriesData[dataObject.key].valCount - 1)) / this.seriesData[dataObject.key].valCount;
                this.seriesData[dataObject.key].valtimes[this.seriesData[dataObject.key].valtimes.length - 1].y = parseFloat(
                    (<number>this.seriesData[dataObject.key].valtimes[this.seriesData[dataObject.key].valtimes.length - 1].y).toFixed(
                        dataObject.options.numdp
                    )
                );
            }
        } else {
            this.seriesData[dataObject.key].valCount = 1;
            this.seriesData[dataObject.key].valtimes.push({ ...datum });
        }
    }

    private updateGroupData(options: MeasurementOptions, datum: ChartPoint) {
        if (options.group !== "default") {
            let lastElement: ChartPoint = this.seriesData[options.group].valtimes[this.seriesData[options.group].valtimes.length - 1];
            let nextTime = moment(datum.x).format(options.labelDateFormat);
            let lastTime = moment(lastElement.x).format(options.labelDateFormat);
            //console.log("updateGroupData ", options.group, datum, options, lastElement);

            if (lastTime !== nextTime) {
                //console.log("CREATE");
                this.seriesData[options.group].valCount = 1;
                this.seriesData[options.group].valtimes.push({ ...datum });
            } else {
                //console.log("ADDING");
                this.seriesData[options.group].valCount += 1;
                if (this.widgetHelper.getChartConfig().getChartType() == "horizontalBar") {
                    let v: any = this.seriesData[options.group].valtimes[this.seriesData[options.group].valtimes.length - 1].x;
                    this.seriesData[options.group].valtimes[this.seriesData[options.group].valtimes.length - 1].x =
                        (<number>datum.x + v * (this.seriesData[options.group].valCount - 1)) / this.seriesData[options.group].valCount;
                    this.seriesData[options.group].valtimes[this.seriesData[options.group].valtimes.length - 1].x = parseFloat(
                        (<number>this.seriesData[options.group].valtimes[this.seriesData[options.group].valtimes.length - 1].x).toFixed(options.numdp)
                    );
                } else {
                    let v: any = this.seriesData[options.group].valtimes[this.seriesData[options.group].valtimes.length - 1].y;
                    this.seriesData[options.group].valtimes[this.seriesData[options.group].valtimes.length - 1].y =
                        (<number>datum.y + v * (this.seriesData[options.group].valCount - 1)) / this.seriesData[options.group].valCount;
                    this.seriesData[options.group].valtimes[this.seriesData[options.group].valtimes.length - 1].y = parseFloat(
                        (<number>this.seriesData[options.group].valtimes[this.seriesData[options.group].valtimes.length - 1].y).toFixed(options.numdp)
                    );
                }
            }
        }
    }

    /**
     * Lifecycle
     */
    async ngOnInit(): Promise<void> {
        this.widgetHelper = new WidgetHelper(this.config, WidgetConfig); //use config

        //Clean up
        this.chartData = [];

        let seriesKeys = Object.keys(this.widgetHelper.getChartConfig().series);
        for (const subKey in this.subscription) {
            if (Object.prototype.hasOwnProperty.call(this.subscription, subKey)) {
                const sub = this.subscription[subKey];
                if (!(subKey in seriesKeys) && sub !== "timer") {
                    this.realtimeService.unsubscribe(sub);
                    delete this.subscription[subKey];
                }
            }
        }

        //
        // Display Legend or not - needs logic for certain conditions
        // lhs display can cause issues if widget size is too small
        //
        this.setAxes();

        let localChartData = []; //build list locally because empty dataset is added by framework

        /**
         *  handle independent series.
         *
         *
         *
         */
        if (!this.widgetHelper.getChartConfig().multivariateplot) {
            //console.log("getting independent variables");
            //for each fragment/series to be plotted
            //ChartSeries has most of the config for the series
            //the MeasurementList contains the data (and its independent)
            let groups = [];

            for (let seriesName of Object.keys(this.widgetHelper.getChartConfig().series)) {
                if (Object.prototype.hasOwnProperty.call(this.widgetHelper.getChartConfig().series, seriesName)) {
                    const seriesConfig = this.widgetHelper.getChartConfig().series[seriesName];

                    if (!seriesConfig.isParent) {
                        //each series (aggregates and functions of raw data too) gets this
                        let options: MeasurementOptions = new MeasurementOptions(
                            this.widgetHelper.getChartConfig().series[seriesName].avgPeriod,
                            this.widgetHelper.getChartConfig().getChartType(),
                            this.widgetHelper.getChartConfig().numdp,
                            this.widgetHelper.getChartConfig().sizeBuckets,
                            this.widgetHelper.getChartConfig().minBucket,
                            this.widgetHelper.getChartConfig().maxBucket,
                            this.widgetHelper.getChartConfig().groupby,
                            this.widgetHelper.getChartConfig().cumulative,
                            seriesConfig.memberOf
                        );
                        //a period of time where quantity is the # of units,
                        // and type(unit) has the # of seconds per unit in the id field
                        let { from, to } = this.getDateRange();
                        //console.log("MEMBER", seriesConfig.name, seriesConfig.idList);
                        for (let index = 0; index < seriesConfig.idList.length; index++) {
                            const seriesId = seriesConfig.idList[index];
                            await this.getBaseMeasurements(
                                seriesConfig.idList.length > 1,
                                seriesId.split(".")[0],
                                seriesConfig.name,
                                seriesId.split(".")[1],
                                seriesId.split(".")[2],
                                from,
                                to,
                                seriesConfig.idList.length > 1 ? seriesId : seriesName,
                                options
                            );
                        }

                        if (options.targetGraphType == "pie" || options.targetGraphType == "doughnut") {
                            //different to line/bar type plots - potentially lots of colours req
                            //if lots of points added. If they run out you get grey...
                            this.createPieChart(seriesConfig.idList.length > 1 ? seriesConfig.idList[0] : seriesName, localChartData, options);
                        } else {
                            //Normal plot
                            this.createNormalChart(seriesConfig.idList.length > 1 ? seriesConfig.idList[0] : seriesName, localChartData, options);
                        }
                    } else {
                        groups.push(seriesName);
                    }
                }
            }

            //now add the group series (we should have data at this point.)
            for (let index = 0; index < groups.length; index++) {
                const seriesName = groups[index];
                const seriesConfig = this.widgetHelper.getChartConfig().series[seriesName];
                //each series (aggregates and functions of raw data too) gets this
                let options: MeasurementOptions = new MeasurementOptions(
                    this.widgetHelper.getChartConfig().series[seriesName].avgPeriod,
                    this.widgetHelper.getChartConfig().getChartType(),
                    this.widgetHelper.getChartConfig().numdp,
                    this.widgetHelper.getChartConfig().sizeBuckets,
                    this.widgetHelper.getChartConfig().minBucket,
                    this.widgetHelper.getChartConfig().maxBucket,
                    this.widgetHelper.getChartConfig().groupby,
                    this.widgetHelper.getChartConfig().cumulative,
                    seriesName
                );

                let { from, to } = this.getDateRange();

                //TODO : tidy up these unused params
                await this.getBaseMeasurements(
                    seriesConfig.idList.length > 1, //should be true
                    seriesConfig.name,
                    seriesConfig.name,
                    seriesConfig.name,
                    seriesConfig.name,
                    from,
                    to,
                    seriesName,
                    options
                );

                //do something here with the parent group.
                if (options.targetGraphType == "pie" || options.targetGraphType == "doughnut") {
                    //different to line/bar type plots - potentially lots of colours req
                    //if lots of points added. If they run out you get grey...
                    this.createPieChart(seriesName, localChartData, options);
                } else {
                    //Normal plot
                    this.createNormalChart(seriesName, localChartData, options);
                }
            }
        } else {
            await this.retrieveAndPlotMultivariateChart(localChartData);
        }
        //console.log("DATA", localChartData);

        this.chartData = localChartData; //replace
        this.dataLoaded = true; //update
        this.widgetHelper.getWidgetConfig().changed = false;
    }

    private async retrieveAndPlotMultivariateChart(localChartData: any[]) {
        //console.log("generating composite series from sources");
        //console.log(`for a chart of type ${this.widgetHelper.getChartConfig().getChartType()}`);
        let seriesList: { [id: string]: string } = {};
        let assigned: number = 0;
        //
        // Get the data - there will be 1-3 series that will get
        // compressed into a single with x,y,r values
        //
        for (let seriesName of Object.keys(this.widgetHelper.getChartConfig().series)) {
            if (Object.prototype.hasOwnProperty.call(this.widgetHelper.getChartConfig().series, seriesName)) {
                //For each variable retrieve the measurements
                //we need to match up measurements to get the
                //graph - omit gaps - real time?
                const seriesConfig = this.widgetHelper.getChartConfig().series[seriesName];
                const v = this.widgetHelper.getChartConfig().series[seriesName].variable;

                //store variable x, y, r with key
                if (v !== "Assign variable") {
                    seriesList[v] = seriesName;
                    assigned++;
                }

                //each series (aggregates and functions of raw data too) gets this
                let options: MeasurementOptions = new MeasurementOptions(
                    this.widgetHelper.getChartConfig().series[seriesName].avgPeriod,
                    this.widgetHelper.getChartConfig().getChartType(),
                    this.widgetHelper.getChartConfig().numdp,
                    this.widgetHelper.getChartConfig().sizeBuckets,
                    this.widgetHelper.getChartConfig().minBucket,
                    this.widgetHelper.getChartConfig().maxBucket,
                    this.widgetHelper.getChartConfig().groupby,
                    this.widgetHelper.getChartConfig().cumulative
                );

                let { from, to } = this.getDateRange();
                for (let index = 0; index < seriesConfig.idList.length; index++) {
                    const seriesId = seriesConfig.idList[index];
                    await this.getBaseMeasurements(
                        seriesConfig.idList.length > 1,
                        seriesId.split(".")[0],
                        seriesConfig.name,
                        seriesId.split(".")[1],
                        seriesId.split(".")[2],
                        from,
                        to,
                        seriesConfig.idList.length > 1 ? seriesId : seriesName,
                        options
                    );
                }
            }
        }

        if (assigned < 2) {
            //do something sensible - warn not assigned
        } else {
            this.createMultivariateChart(seriesList, localChartData);
        }
    }

    private checkMultivariateChart(): {
        series: number;
        x: boolean;
        y: boolean;
        r: boolean;
    } {
        let rval = { series: 0, x: false, y: false, r: false };
        //
        // Get the data - there will be 1-3 series that will get
        // compressed into a single with x,y,r values
        //
        for (let key of Object.keys(this.widgetHelper.getChartConfig().series)) {
            if (Object.prototype.hasOwnProperty.call(this.widgetHelper.getChartConfig().series, key)) {
                const measurement = this.widgetHelper.getChartConfig().series[key];
                const v = this.widgetHelper.getChartConfig().series[key].variable;
                rval.series++;
                switch (v) {
                    case "x":
                        rval.x = true;
                        break;
                    case "y":
                        rval.y = true;
                        break;
                    case "r":
                        rval.r = true;
                        break;
                }
            }
        }
        return rval;
    }

    /**
     * generate a chart that displays data plotted against another series => E.G. y = mx+c (y is proportional to x)
     * @param seriesList list of series with specific variable assignments
     * @param localChartData output
     */
    private createMultivariateChart(seriesList: { [id: string]: string }, localChartData: any[]) {
        let seriesName = this.widgetHelper.getChartConfig().series[seriesList["x"]].name;
        if ("y" in seriesList) {
            seriesName = seriesName + ` vs ${this.widgetHelper.getChartConfig().series[seriesList["y"]].name}`;
        }
        if ("r" in seriesList) {
            seriesName = seriesName + ` vs ${this.widgetHelper.getChartConfig().series[seriesList["r"]].name}`;
        }

        //
        // We have all the data, now we create the actual displayed data
        //
        let thisSeries: ChartDataSets = this.createSeries(seriesList["x"], seriesName, this.widgetHelper.getChartConfig().multivariateColor);

        //x/y series (!!Date Order!!) - make sure x/y values match timestamps
        let result: ChartPoint[] = [];
        for (let index = 0; index < this.seriesData[seriesList["x"]].valtimes.length; index++) {
            let xval = this.seriesData[seriesList["x"]].valtimes[index];
            //console.log("Matching", xval);
            let yval = this.seriesData[seriesList["y"]].valtimes.filter((val) => {
                return (
                    //Match dates within a Tolerance
                    Math.abs((<Date>xval.x).getTime() - (<Date>val.x).getTime()) < this.widgetHelper.getChartConfig().multivariateplotTolerance * 1000
                );
            });
            //console.log(yval);
            let zval = undefined;
            if ("r" in seriesList) {
                zval = this.seriesData[seriesList["r"]].valtimes.filter((val) => {
                    return (
                        //Match dates within a Tolerance
                        Math.abs((<Date>xval.x).getTime() - (<Date>val.x).getTime()) <
                        this.widgetHelper.getChartConfig().multivariateplotTolerance * 1000
                    );
                });
            }
            if (0 in yval && zval && 0 in zval) {
                result.push({ x: xval.y, y: yval[0].y, r: zval[0].y });
            } else if (0 in yval) {
                result.push({ x: xval.y, y: yval[0].y });
            } else {
                result.push({ x: index, y: xval.y }); //sensible default
            }
        }

        //x increasing - assume  y(,r) function of x
        result = result.sort((a, b) => <number>a.x - <number>b.x);

        if (
            this.widgetHelper.getChartConfig().getChartType() == "radar" ||
            this.widgetHelper.getChartConfig().getChartType() == "polarArea" //not handled yet
        ) {
            //we need separate labels and values here
            thisSeries.data = result.map((v) => <number>v.y);
            this.chartLabels = result.map((v) => v.x.toString());
        } else {
            thisSeries.data = result;
            thisSeries.pointRadius = this.widgetHelper.getChartConfig().showPoints;
        }

        //need raw type
        if (this.widgetHelper.getChartConfig().type == "spline") {
            thisSeries.lineTension = 0.4;
        } else {
            thisSeries.lineTension = 0;
        }

        localChartData.push(thisSeries);
        //console.log("MULTIVARIATE", thisSeries);
        this.setAxesLabels(seriesList["x"], seriesList["y"]);

        //Update series as measurements come in.
        //Set up timer to redraw this graph.
        if (!("timer" in this.subscription)) {
            //console.log(`Setting timer`);
            this.subscription["timer"] = setInterval(this.handleTimer, this.widgetHelper.getChartConfig().timerDelay * 1000, this);
        }
    }

    /**
     * Retrieve measurements and set SeriesData
     *
     * @param from the oldest measurement required
     * @param to usually now
     * @param key the series key
     * @param options options for the series
     */
    private async getBaseMeasurements(
        isGroup: boolean,
        deviceId: string,
        name: string,
        fragment: string,
        series: string,
        from: Date,
        to: Date,
        key: string,
        options: MeasurementOptions
    ) {
        if (from.getTime() == to.getTime()) {
            from = new Date(new Date(to).setFullYear(to.getFullYear() - 1));
        }
        let measurementLimit = this.widgetHelper.getChartConfig().rangeType > 0 ? 0 : this.widgetHelper.getChartConfig().rangeValue;

        let unitIndex = this.widgetHelper.getChartConfig().timeFormatType;
        if (
            this.widgetHelper.getChartConfig().getChartType() == "pie" ||
            (this.widgetHelper.getChartConfig().getChartType() == "doughnut" && this.widgetHelper.getChartConfig().aggregation == 0)
        ) {
            unitIndex = this.widgetHelper.getChartConfig().aggTimeFormatType;
        }

        let aggUnit = this.widgetHelper.getChartConfig().rangeUnits[unitIndex].text;
        let aggFormat = this.widgetHelper.getChartConfig().rangeDisplay[aggUnit];

        if (this.widgetHelper.getChartConfig().customFormat) {
            aggFormat = this.widgetHelper.getChartConfig().customFormatString;
        }

        if (!isGroup) {
            //
            // WorkHorse Functionality - retrieve and calculate derived numbers
            //
            this.seriesData[key] = await this.measurementHelper.getMeasurements(
                this.widgetHelper.getUniqueID(),
                deviceId,
                name,
                fragment,
                series,
                this.measurementService,
                options,
                from,
                to,
                null,
                this.widgetHelper.getChartConfig().getChartType(),
                this.widgetHelper.getChartConfig().aggregation == 0,
                aggUnit,
                aggFormat,
                measurementLimit
            );
        } else {
            //console.log("GROUP", key, this.widgetHelper.getChartConfig().series[key].idList);

            //take the individual series and aggregate them into a composite
            this.seriesData[key] = await this.measurementHelper.createAggregate(
                this.seriesData,
                this.widgetHelper.getChartConfig().series[key].idList,
                options
            );
        }
    }

    /**
     * Create the series for display
     *
     * @param key series key
     * @param localChartData output
     * @param options options for series
     */
    private createPieChart(key: string, localChartData: any[], options: MeasurementOptions) {
        let thisSeries: ChartDataSets = {
            data: [],
            backgroundColor: [
                ...this.widgetHelper.getChartConfig().colorList,
                ...this.widgetHelper.getChartConfig().colorList,
                ...this.widgetHelper.getChartConfig().colorList,
                ...this.widgetHelper.getChartConfig().colorList,
                ...this.widgetHelper.getChartConfig().colorList,
                ...this.widgetHelper.getChartConfig().colorList,
            ], //repeated so we can avoid having to update
        };

        this.chartLegend = this.widgetHelper.getChartConfig().position !== "none";
        this.chartLabels = this.seriesData[key].labels;
        thisSeries.data = this.seriesData[key].bucket;
        localChartData.push(thisSeries);

        //Update series as measurements come in.
        if (!this.subscription[key]) {
            this.subscription[key] = this.realtimeService.subscribe("/measurements/" + options.deviceId, (data) =>
                this.handleRealtime({ data, key, options })
            );
        }
    }

    /**
     * Create a "standard" chart and subscribe to the measurements for that device/series
     *
     * @param key series key
     * @param localChartData output for chart
     * @param options options for chart
     */
    private createNormalChart(key: string, localChartData: any[], options: MeasurementOptions) {
        //console.log("KEY", key);
        if (
            this.widgetHelper.getChartConfig().getChartType() === "bar" &&
            this.widgetHelper.getChartConfig().getChartType() === "horizontalBar" &&
            this.widgetHelper.getChartConfig().getChartType() === "scatter" &&
            this.widgetHelper.getChartConfig().getChartType() === "bubble" &&
            this.widgetHelper.getChartConfig().getChartType() === "pie" &&
            this.widgetHelper.getChartConfig().getChartType() === "radar" &&
            this.widgetHelper.getChartConfig().getChartType() === "doughnut"
        ) {
            this.widgetHelper.getChartConfig().series[key].hideMeasurements = false;
            this.widgetHelper.getChartConfig().series[key].avgType = "None";
        }

        //console.log("SERIES", key, this.widgetHelper.getChartConfig().series, this.seriesData);
        if (this.widgetHelper.getChartConfig().series[key].hideMeasurements !== true) {
            //console.log("CREATE SERIES", key);
            let thisSeries: ChartDataSets = this.createSeries(
                key,
                this.widgetHelper.getChartConfig().series[key].name,
                this.widgetHelper.getWidgetConfig().chart.series[key].color
            );
            thisSeries.data = this.seriesData[key].valtimes;
            //console.log("DATA", thisSeries.data);
            thisSeries.barPercentage = 0.9;
            thisSeries.categoryPercentage = 0.9;
            //need raw type
            if (this.widgetHelper.getChartConfig().type == "spline") {
                thisSeries.lineTension = 0.4;
            } else {
                thisSeries.lineTension = 0;
            }

            localChartData.push(thisSeries);
            //console.log("NORMAL PLOT", thisSeries);
        }

        //If average or other function then add series for that
        if (this.widgetHelper.getChartConfig().series[key].avgType !== "None") {
            if (this.widgetHelper.getChartConfig().series[key].avgType.indexOf("Moving Average") > -1) {
                let aggregateSeries: ChartDataSets = this.createSeries(
                    key,
                    `${options.name} - ${this.widgetHelper.getChartConfig().series[key].avgPeriod} period`,
                    this.widgetHelper.getWidgetConfig().chart.series[key].avgColor
                );
                //Need to apply the correct function in the series calculations
                aggregateSeries.data = this.seriesData[key].aggregate;
                localChartData.push(aggregateSeries);
            }

            if (this.widgetHelper.getChartConfig().series[key].avgType.indexOf("Bollinger Bands") > -1) {
                let upperBoll: ChartDataSets = this.createSeries(
                    key,
                    `${options.name} - upper Bollinger Band`,
                    this.widgetHelper.getWidgetConfig().chart.series[key].avgColor
                );

                //Need to apply the correct function in the series calculations
                upperBoll.data = this.seriesData[key].upper;
                localChartData.push(upperBoll);

                let lowerBoll: ChartDataSets = this.createSeries(
                    key,
                    `${options.name} - lower Bollinger Band`,
                    this.widgetHelper.getWidgetConfig().chart.series[key].avgColor
                );

                //Need to apply the correct function in the series calculations
                lowerBoll.data = this.seriesData[key].lower;
                localChartData.push(lowerBoll);
            }
        }

        //realtime
        if (!this.subscription[key] && !this.widgetHelper.getChartConfig().series[key].isParent) {
            this.subscription[key] = this.realtimeService.subscribe("/measurements/" + options.deviceId, (data) =>
                this.handleRealtime({ data, key, options })
            );
        }
    }

    async handleTimer(parent: CumulocityDataPointsChartingWidget) {
        let localChartData = []; //build list locally because empty dataset is added by framework
        parent.retrieveAndPlotMultivariateChart(localChartData);
        parent.chartData = localChartData;
    }

    // helper
    private setAxesLabels(xLabelKey: string, yLabelKey: string) {
        if (this.chartOptions.scales.xAxes.length > 0) {
            this.chartOptions.scales.xAxes[0].scaleLabel = {
                display: this.widgetHelper.getChartConfig().showAxesLabels,
                labelString: this.widgetHelper.getChartConfig().series[xLabelKey].name,
            };
        }
        if (this.chartOptions.scales.yAxes.length > 0) {
            this.chartOptions.scales.yAxes[0].scaleLabel = {
                display: this.widgetHelper.getChartConfig().showAxesLabels,
                labelString: this.widgetHelper.getChartConfig().series[yLabelKey].name,
            };
        }
    }

    /**
     * This method returns a default line/bar dataset which can then have
     * data added - no labels are set on this as a default so that they are retrieved
     * from the data points themselves. data is co-ordinate pair {x,y}
     * @param key
     * @param label
     * @param col
     * @returns
     */
    createSeries(key: string, label: string, col: string): ChartDataSets {
        let series: ChartDataSets = {
            data: [],
            label: label,
            fill: this.widgetHelper.getChartConfig().fillArea,
            spanGaps: true,
            backgroundColor: col,
            borderColor: col,
            pointBackgroundColor: col,
            barThickness: "flex",
            pointRadius: this.widgetHelper.getChartConfig().showPoints,
        };
        return series;
    }

    /**
     *
     * @returns Pair of dates representing the from and to dates the range extends over
     */
    private getDateRange(): { from: Date; to: Date } {
        let to = Date.now();
        //here default to a large type so we try to get a reasonable amount of data
        const timeUnitVal: number = this.widgetHelper.getChartConfig().rangeUnits[
            this.widgetHelper.getChartConfig().rangeType ? this.widgetHelper.getChartConfig().rangeType : 4
        ].id;

        let from = new Date(to - this.widgetHelper.getChartConfig().rangeValue * timeUnitVal * 1000);
        return { from, to: new Date(to) };
    }

    /**
     * Create the axes and set options
     * begin at zero either starts the y axis at zero or nearer the range of values
     * the x axis is a time axis for measurements so se this appropriately
     */
    private setAxes() {
        //Legend
        this.chartOptions.legend.display = this.widgetHelper.getChartConfig().position !== "None";
        if (this.chartOptions.legend.display) {
            this.chartOptions.legend.position = <PositionType>this.widgetHelper.getChartConfig().position;
        }
        if (this.widgetHelper.getChartConfig().getChartType() === "horizontalBar") {
            //swapped x & y
            const timeUnitType = this.widgetHelper.getChartConfig().rangeUnits[
                this.widgetHelper.getChartConfig().rangeType ? this.widgetHelper.getChartConfig().rangeType : 2
            ].text;

            this.chartOptions.scales.yAxes.length = 0; //reset axes
            this.chartOptions.scales.yAxes.push({
                display: this.widgetHelper.getChartConfig().showx,
                stacked: this.widgetHelper.getChartConfig().stackSeries,
                type: "time",
                time: {
                    displayFormats: this.widgetHelper.getChartConfig().rangeDisplay,
                    unit: timeUnitType,
                },
            });

            //X axis
            this.chartOptions.scales.xAxes.length = 0; //reset axes
            this.chartOptions.scales.xAxes.push({
                display: this.widgetHelper.getChartConfig().showy,
                stacked: this.widgetHelper.getChartConfig().stackSeries,
                ticks: {
                    beginAtZero: !this.widgetHelper.getChartConfig().fitAxis,
                },
            });

            this.chartOptions.plugins = {
                labels: [],
            };
        } else if (
            this.widgetHelper.getChartConfig().getChartType() == "pie" ||
            this.widgetHelper.getChartConfig().getChartType() == "doughnut" ||
            this.widgetHelper.getChartConfig().getChartType() == "radar" ||
            this.widgetHelper.getChartConfig().getChartType() == "polarArea"
        ) {
            let dp = this.widgetHelper.getChartConfig().numdp ? this.widgetHelper.getChartConfig().numdp : 2;
            this.chartOptions.animation = { duration: 0 };
            this.chartOptions.scales.yAxes.length = 0; //reset axes
            this.chartOptions.scales.yAxes.push({
                display: false,
                type: "linear",
                ticks: {
                    beginAtZero: !this.widgetHelper.getChartConfig().fitAxis,
                    callback: function (value: number) {
                        return value.toFixed(dp);
                    },
                },
            });

            //Y axis
            this.chartOptions.scales.xAxes.length = 0; //reset axes
            this.chartOptions.scales.xAxes.push({
                display: false,
                type: "linear",
                ticks: {
                    beginAtZero: !this.widgetHelper.getChartConfig().fitAxis,
                    callback: function (value: number) {
                        return value.toFixed(dp);
                    },
                },
            });
        } else {
            //X axis
            this.chartOptions.scales.xAxes.length = 0; //reset axes
            if (this.widgetHelper.getChartConfig().multivariateplot) {
                if (
                    this.widgetHelper.getChartConfig().getChartType() == "line" ||
                    this.widgetHelper.getChartConfig().getChartType() === "spline" ||
                    this.widgetHelper.getChartConfig().getChartType() == "scatter" ||
                    this.widgetHelper.getChartConfig().getChartType() == "bubble"
                ) {
                    this.chartOptions.scales.yAxes.length = 0; //reset axes
                    this.chartOptions.scales.xAxes.length = 0; //reset axes

                    let dp = this.widgetHelper.getChartConfig().numdp ? this.widgetHelper.getChartConfig().numdp : 2;
                    this.chartOptions.scales.xAxes.push({
                        display: this.widgetHelper.getChartConfig().showx,
                        stacked: this.widgetHelper.getChartConfig().stackSeries,
                        type: "linear",
                        ticks: {
                            beginAtZero: !this.widgetHelper.getChartConfig().fitAxis,
                            callback: function (value: number) {
                                return value.toFixed(dp);
                            },
                        },
                    });
                } else {
                    this.chartOptions.scales.xAxes.push({
                        display: this.widgetHelper.getChartConfig().showx,
                    });
                }
            } else {
                //default timeUnit to minutes if we pick measurements
                const timeUnitType = this.widgetHelper.getChartConfig().rangeUnits[
                    this.widgetHelper.getChartConfig().rangeType ? this.widgetHelper.getChartConfig().rangeType : 1
                ].text;
                this.chartOptions.scales.xAxes.push({
                    display: this.widgetHelper.getChartConfig().showx,
                    stacked: this.widgetHelper.getChartConfig().stackSeries,
                    type: "time",
                    time: {
                        displayFormats: this.widgetHelper.getChartConfig().rangeDisplay,
                        unit: timeUnitType,
                    },
                });
                this.chartOptions.plugins = {
                    labels: [],
                };
            }
            let dp = this.widgetHelper.getChartConfig().numdp ? this.widgetHelper.getChartConfig().numdp : 2;

            //Y axis
            this.chartOptions.scales.yAxes.length = 0; //reset axes
            this.chartOptions.scales.yAxes.push({
                display: this.widgetHelper.getChartConfig().showy,
                stacked: this.widgetHelper.getChartConfig().stackSeries,
                ticks: {
                    beginAtZero: !this.widgetHelper.getChartConfig().fitAxis,
                    callback: function (value: number) {
                        return value.toFixed(dp);
                    },
                },
            });
        }
    }
}
