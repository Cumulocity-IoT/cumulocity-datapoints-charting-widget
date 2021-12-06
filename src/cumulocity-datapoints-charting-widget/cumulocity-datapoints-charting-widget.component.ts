/**
 * /*
 * Copyright (c) 2019 Software AG, Darmstadt, Germany and/or its licensors
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @format
 */

import { Component, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Realtime } from "@c8y/client";
import { WidgetHelper } from "./widget-helper";
import { DataObject, MeasurementOptions, WidgetConfig } from "./widget-config";
import { BaseChartDirective, Label, ThemeService } from 'ng2-charts';
import { MeasurementHelper, MeasurementList } from './widget-measurements';
import { ChartDataSets, ChartOptions, ChartPoint, PositionType } from 'chart.js';
import { MeasurementService } from '@c8y/ngx-components/api';
import { DatePipe } from '@angular/common';
import { get, has } from "lodash";
import boll from "bollinger-bands";
import * as moment from "moment";

@Component({
    selector: "lib-cumulocity-datapoints-charting-widget",
    templateUrl: "./cumulocity-datapoints-charting-widget.component.html",
    styleUrls: ["./cumulocity-datapoints-charting-widget.component.css"],
    providers: [DatePipe, ThemeService]
})
export class CumulocityDatapointsChartingWidget implements OnDestroy, OnInit {

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
     * This charts data, retrieved initially in init, and then
     * updated as measurements are received. Realtime data is
     * subscribed and so must be released on destroy
     */
    seriesData: { [key: string]: MeasurementList; };
    subscription: { [key: string]: Object; } = {}; //record per device subscriptions

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
            enabled: true
        },
        responsive: true,
        scales: {
            xAxes: [],
            yAxes: [],
        },
    };


    /**
     * These are the main interfaces to the config
     * and the measurements
     */
    widgetHelper: WidgetHelper<WidgetConfig>;
    measurementHelper: MeasurementHelper;
    @Input() config: WidgetConfig;

    constructor(
        private measurementService: MeasurementService,
        public datepipe: DatePipe,
        private realtimeService: Realtime
    ) {
        this.widgetHelper = new WidgetHelper(this.config, WidgetConfig); //default access through here
        this.measurementHelper = new MeasurementHelper();
        this.seriesData = {};
    }

    /**
     * Lifecycle
     */
    async ngOnInit(): Promise<void> {
        this.widgetHelper = new WidgetHelper(this.config, WidgetConfig); //use config

        //Clean up
        this.chartData = [];
        const config = this.widgetHelper.getChartConfig();
        let seriesKeys = Object.keys(config.series);
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

        let localChartData: ChartDataSets[] = []; //build list locally because empty dataset is added by framework

        /**
         *  handle independent series.
         */
        if (!config.multivariateplot) {
            //for each fragment/series to be plotted
            //ChartSeries has most of the config for the series
            //the MeasurementList contains the data (and its independent)
            let groups = [];

            for (let seriesName of Object.keys(config.series)) {
                if (Object.prototype.hasOwnProperty.call(config.series, seriesName)) {
                    const seriesConfig = config.series[seriesName];

                    if (!seriesConfig.isParent) {
                        //each series (aggregates and functions of raw data too) gets this
                        let options: MeasurementOptions = new MeasurementOptions(
                            config.series[seriesName].avgPeriod,
                            config.getChartType(),
                            config.numdp,
                            config.sizeBuckets,
                            config.minBucket,
                            config.maxBucket,
                            config.groupby,
                            config.cumulative,
                            seriesConfig.memberOf
                        );
                        //a period of time where quantity is the # of units,
                        // and type(unit) has the # of seconds per unit in the id field
                        let { from, to } = this.getDateRange();
                        for (let index = 0; index < seriesConfig.idList.length; index++) {
                            let deviceId = this.widgetHelper.getDeviceTarget();
                            let splitSeriesId = seriesConfig.idList[index].split(".");
                            if (deviceId === undefined) {
                                deviceId = splitSeriesId[0];
                            }

                            await this.getBaseMeasurements(
                                seriesConfig.idList.length > 1,
                                deviceId,
                                seriesConfig.name,
                                splitSeriesId[1],
                                splitSeriesId[2],
                                from,
                                to,
                                seriesConfig.idList.length > 1 ? seriesConfig.idList[index] : seriesName,
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
                const seriesConfig = config.series[seriesName];
                //each series (aggregates and functions of raw data too) gets this
                let options: MeasurementOptions = new MeasurementOptions(
                    config.series[seriesName].avgPeriod,
                    config.getChartType(),
                    config.numdp,
                    config.sizeBuckets,
                    config.minBucket,
                    config.maxBucket,
                    config.groupby,
                    config.cumulative,
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

        this.chartData = localChartData; //replace
        this.dataLoaded = true; //update
        this.widgetHelper.getWidgetConfig().changed = false;
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
        const config = this.widgetHelper.getChartConfig();
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
        //need the fragment, series
        if (has(dataObject.data.data.data, dataObject.options.fragment)) {
            let frag = get(dataObject.data.data.data, dataObject.options.fragment);
            if (has(frag, dataObject.options.series)) {
                let ser = get(frag, dataObject.options.series);
                measurementValue = parseFloat(parseFloat(ser.value).toFixed(dataObject.options.numdp));

                //The current point
                let datum: Chart.ChartPoint = {
                    x: measurementDate,
                    y: measurementValue,
                };
                if (config.getChartType() == "horizontalBar") {
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

                // need to add to current data point - Note that we test for the bucket we should be putting this in
                // and tally up the count of the actual values in the current average (valcount)
                //if we are not grouping, OR if we are adding a new bucket we set valcount to 1
                this.updateSeriesData(dataObject, newPointBucket, lastPointBucket, datum);

                //handle group series
                this.updateGroupData(dataObject.options, datum);


                // Pie/Doughnut differ from other types
                if (config.getChartType() == "pie" || config.getChartType() == "doughnut") {
                    this.seriesData[dataObject.key].valtimes.push(datum);

                    //aggregating by time buckets
                    if (config.aggregation == 0) {
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
                            config.maxBucket,
                            config.minBucket,
                            config.sizeBuckets,
                            config.numdp
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
                    let { from } = this.getDateRange();

                    //
                    // Line has the bollinger bands
                    //
                    if (
                        config.getChartType() === "line" ||
                        config.getChartType() === "spline"
                    ) {
                        while (moment(this.seriesData[dataObject.key].aggregate[0].x).isBefore(moment(from))) {
                            this.seriesData[dataObject.key].upper.shift();
                            this.seriesData[dataObject.key].aggregate.shift();
                            this.seriesData[dataObject.key].lower.shift();
                        }
                    }

                    if (
                        config.getChartType() === "pie" ||
                        config.getChartType() === "doughnut"
                    ) {
                        //all graph types
                        //only remove data when we deal with times...
                        if (config.aggregation == 0) {
                            let aggUnit = config.rangeUnits[config.aggTimeFormatType].text;
                            let aggFormat = get(config.rangeDisplay, aggUnit);

                            if (config.customFormat) {
                                aggFormat = config.customFormatString;
                            }

                            while (moment(this.seriesData[dataObject.key].labels[0], aggFormat).isBefore(from)) {
                                this.seriesData[dataObject.key].bucket.shift();
                                this.seriesData[dataObject.key].labels.shift();
                            }
                        }
                    }

                    if (
                        config.getChartType() === "line" ||
                        config.getChartType() === "spline" ||
                        (!config.multivariateplot && config.getChartType() === "scatter") ||
                        config.getChartType() === "bar"
                    ) {
                        //all graph types
                        while (
                            (dataObject.key in this.seriesData) &&
                            this.seriesData[dataObject.key].valtimes &&
                            moment(this.seriesData[dataObject.key].valtimes[0].x).isBefore(moment(from))
                        ) {
                            this.seriesData[dataObject.key].valtimes.shift();
                        }
                        while (
                            (dataObject.options.group in this.seriesData) &&
                            this.seriesData[dataObject.options.group].valtimes &&
                            moment(this.seriesData[dataObject.options.group].valtimes[0].x).isBefore(moment(from))
                        ) {
                            this.seriesData[dataObject.options.group].valtimes.shift();
                        }
                    }

                    if (config.getChartType() === "horizontalBar") {
                        while (
                            (dataObject.key in this.seriesData) &&
                            this.seriesData[dataObject.key].valtimes &&
                            moment(this.seriesData[dataObject.key].valtimes[0].y).isBefore(moment(from))
                        ) {
                            this.seriesData[dataObject.key].valtimes.shift();
                        }
                        while (
                            (dataObject.options.group in this.seriesData) &&
                            this.seriesData[dataObject.options.group].valtimes &&
                            moment(this.seriesData[dataObject.options.group].valtimes[0].y).isBefore(moment(from))
                        ) {
                            this.seriesData[dataObject.options.group].valtimes.shift();
                        }
                    }

                    this.setAxes();
                    this.chartElement.update();
                }
            }
        }
    }

    private updateSeriesData(dataObject: DataObject, newPointBucket: string, lastPointBucket: string, datum: ChartPoint) {
        const config = this.widgetHelper.getChartConfig();
        if (dataObject.options.groupby && newPointBucket === lastPointBucket) {
            this.seriesData[dataObject.key].valCount += 1;
            if (config.getChartType() == "horizontalBar") {
                const { valtimes, valCount } = this.seriesData[dataObject.key];
                let v = valtimes[valtimes.length - 1].x as number;
                valtimes[valtimes.length - 1].x =
                    (<number>datum.x + v * (valCount - 1)) / valCount;
                valtimes[valtimes.length - 1].x = parseFloat(
                    (<number>valtimes[valtimes.length - 1].x).toFixed(
                        dataObject.options.numdp
                    )
                );
            } else {
                const { valtimes, valCount } = this.seriesData[dataObject.key];
                let v = valtimes[valtimes.length - 1].y as number;
                valtimes[valtimes.length - 1].y =
                    (<number>datum.y + v * (valCount - 1)) / valCount;
                valtimes[valtimes.length - 1].y = parseFloat(
                    (<number>valtimes[valtimes.length - 1].y).toFixed(
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
        const config = this.widgetHelper.getChartConfig();
        if (options.group !== "default" && config.groupbyGroup) {
            let lastElement: ChartPoint = this.seriesData[options.group].valtimes[this.seriesData[options.group].valtimes.length - 1];
            let nextTime = moment(datum.x).format(options.labelDateFormat);
            let lastTime = lastElement ? moment(lastElement.x).format(options.labelDateFormat) : undefined;

            if (lastTime !== nextTime) {
                this.seriesData[options.group].valCount = 1;
                this.seriesData[options.group].valtimes.push({ ...datum });
            } else {
                this.seriesData[options.group].valCount += 1;

                const { valtimes, valCount } = this.seriesData[options.group];
                if (!config.groupCumulative) {
                    //we need to account for the averaging

                    if (config.getChartType() == "horizontalBar") {
                        let v = valtimes[valtimes.length - 1].x;
                        valtimes[valtimes.length - 1].x =
                            (<number>datum.x + <number>v * (valCount - 1)) / valCount;
                        valtimes[valtimes.length - 1].x = parseFloat(
                            (<number>valtimes[valtimes.length - 1].x).toFixed(options.numdp)
                        );
                    } else {
                        let v = valtimes[valtimes.length - 1].y;
                        valtimes[valtimes.length - 1].y =
                            (<number>datum.y + <number>v * (valCount - 1)) / valCount;
                        valtimes[valtimes.length - 1].y = parseFloat(
                            (<number>valtimes[valtimes.length - 1].y).toFixed(options.numdp)
                        );
                    }

                } else {
                    //just sum
                    if (config.getChartType() == "horizontalBar") {
                        let v = valtimes[valtimes.length - 1].x;
                        valtimes[valtimes.length - 1].x = <number>datum.x + <number>v;
                        valtimes[valtimes.length - 1].x = parseFloat(
                            (<number>valtimes[valtimes.length - 1].x).toFixed(options.numdp)
                        );
                    } else {
                        let v = valtimes[valtimes.length - 1].y;
                        valtimes[valtimes.length - 1].y = <number>datum.y + <number>v;
                        valtimes[valtimes.length - 1].y = parseFloat(
                            (<number>valtimes[valtimes.length - 1].y).toFixed(options.numdp)
                        );
                    }

                }

            }
        }
    }



    /**
     * Used on the page
     *
     * @returns true if we have devices and measurements selected
     */
    verifyConfig(): boolean {
        //optimism
        const config = this.widgetHelper.getChartConfig();
        config.enabled = this.widgetHelper.getWidgetConfig() !== undefined;
        config.message = "Loading Data...";
        if (config.enabled) {
            if (!this.widgetHelper.getWidgetConfig().selectedDevices.length || !this.widgetHelper.getWidgetConfig().selectedMeasurements.length) {
                //1: do we have devices
                config.enabled = false;
                config.message = "You must choose at least one device and fragment to plot a chart.";
            } else if (config.multivariateplot) {
                let checks = this.checkMultivariateChart();
                if (config.getChartType() == "bubble") {
                    if (checks.series != 3 || !checks.x || !checks.y || !checks.r) {
                        config.enabled = false;
                        config.message = "You must choose exactly 3 fragments and assign x,y, and r.";
                    }
                } else if (checks.series != 2) {
                    config.enabled = false;
                    config.message = "You must choose exactly 2 fragments and assign x,y.";
                } else if (!checks.x || !checks.y) {
                    config.enabled = false;
                    config.message = "You must assign x,y.";
                } else {
                    //just in case
                    config.enabled = true;
                }
            } else if (!this.chartData.length && this.dataLoaded) {
                config.enabled = false;
                config.message = "There appears to be no data selected to plot a chart (check series).";
            } else if (!this.dataLoaded) {
                config.enabled = false;
                config.message = "Loading Data...";
            }
        }

        return config.enabled;
    }



    private async retrieveAndPlotMultivariateChart(localChartData: ChartDataSets[]) {
        let seriesList: { [id: string]: string; } = {};
        let assigned = 0;
        const config = this.widgetHelper.getChartConfig();
        //
        // Get the data - there will be 1-3 series that will get
        // compressed into a single with x,y,r values
        //
        for (let seriesName of Object.keys(config.series)) {
            if (Object.prototype.hasOwnProperty.call(config.series, seriesName)) {
                //For each variable retrieve the measurements
                //we need to match up measurements to get the
                //graph - omit gaps - real time?
                const seriesConfig = config.series[seriesName];
                const v = config.series[seriesName].variable;

                //store variable x, y, r with key
                if (v !== "Assign variable") {
                    seriesList[v] = seriesName;
                    assigned++;
                }

                //each series (aggregates and functions of raw data too) gets this
                let options: MeasurementOptions = new MeasurementOptions(
                    config.series[seriesName].avgPeriod,
                    config.getChartType(),
                    config.numdp,
                    config.sizeBuckets,
                    config.minBucket,
                    config.maxBucket,
                    config.groupby,
                    config.cumulative
                );

                let { from, to } = this.getDateRange();
                for (let index = 0; index < seriesConfig.idList.length; index++) {
                    const seriesId = seriesConfig.idList[index];
                    let deviceId = this.widgetHelper.getDeviceTarget();
                    let splitSeriesId = seriesConfig.idList[index].split(".");
                    if (deviceId === undefined) {
                        deviceId = splitSeriesId[0];
                    }

                    await this.getBaseMeasurements(
                        seriesConfig.idList.length > 1,
                        deviceId,
                        seriesConfig.name,
                        splitSeriesId[1],
                        splitSeriesId[2],
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
        const config = this.widgetHelper.getChartConfig();
        for (let key of Object.keys(config.series)) {
            if (Object.prototype.hasOwnProperty.call(config.series, key)) {
                const v = config.series[key].variable;
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
    private createMultivariateChart(seriesList: { [id: string]: string; }, localChartData: ChartDataSets[]) {
        const config = this.widgetHelper.getChartConfig();
        let seriesName = config.series[seriesList["x"]].name;
        if ("y" in seriesList) {
            seriesName = seriesName + ` vs ${config.series[seriesList["y"]].name}`;
        }
        if ("r" in seriesList) {
            seriesName = seriesName + ` vs ${config.series[seriesList["r"]].name}`;
        }

        //
        // We have all the data, now we create the actual displayed data
        //
        let thisSeries: ChartDataSets = this.createSeries(seriesList["x"], seriesName, config.multivariateColor);

        //x/y series (!!Date Order!!) - make sure x/y values match timestamps
        let result: ChartPoint[] = [];
        for (let index = 0; index < this.seriesData[seriesList["x"]].valtimes.length; index++) {
            let xval = this.seriesData[seriesList["x"]].valtimes[index];
            let yval = this.seriesData[seriesList["y"]].valtimes.filter((val) => {
                return (
                    //Match dates within a Tolerance
                    Math.abs((<Date>xval.x).getTime() - (<Date>val.x).getTime()) < config.multivariateplotTolerance * 1000
                );
            });
            let zval = undefined;
            if ("r" in seriesList) {
                zval = this.seriesData[seriesList["r"]].valtimes.filter((val) => {
                    return (
                        //Match dates within a Tolerance
                        Math.abs((<Date>xval.x).getTime() - (<Date>val.x).getTime()) <
                        config.multivariateplotTolerance * 1000
                    );
                });
            }
            if (0 in yval && zval && 0 in zval) {
                result.push({ x: xval.y, y: yval[0].y, r: zval[0].y as number });
            } else if (0 in yval) {
                result.push({ x: xval.y, y: yval[0].y });
            }
        }

        //x increasing - assume  y(,r) function of x
        result = result.sort((a, b) => <number>a.x - <number>b.x);

        if (
            config.getChartType() == "radar" ||
            config.getChartType() == "polarArea" //not handled yet
        ) {
            //we need separate labels and values here
            thisSeries.data = result.map((v) => <number>v.y);
            this.chartLabels = result.map((v) => v.x.toString());
        } else {
            thisSeries.data = result;
            thisSeries.pointRadius = config.showPoints;
        }

        //need raw type
        if (config.type == "spline") {
            thisSeries.lineTension = 0.4;
        } else {
            thisSeries.lineTension = 0;
        }

        localChartData.push(thisSeries);
        this.setAxesLabels(seriesList["x"], seriesList["y"]);

        //Update series as measurements come in.
        //Set up timer to redraw this graph.
        if (!("timer" in this.subscription)) {
            this.subscription["timer"] = setInterval(this.handleTimer, config.timerDelay * 1000, this);
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
        const config = this.widgetHelper.getChartConfig();
        let measurementLimit = config.rangeType > 0 ? 0 : config.rangeValue;

        let unitIndex = config.timeFormatType;
        if (
            config.getChartType() == "pie" ||
            (config.getChartType() == "doughnut" && config.aggregation == 0)
        ) {
            unitIndex = config.aggTimeFormatType;
        }

        let aggUnit = config.rangeUnits[unitIndex].text;
        let aggFormat = get(config.rangeDisplay, aggUnit);

        if (config.customFormat) {
            aggFormat = config.customFormatString;
        }

        if (!isGroup) {

            //WorkHorse Functionality - retrieve and calculate derived numbers
            //we need to plug in the dashboard supplied device id if it is there.

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
                config.getChartType(),
                config.aggregation == 0,
                aggUnit,
                aggFormat,
                measurementLimit,
                true, //config.useCache
            );

        } else {
            if (config.groupbyGroup) {
                //take the individual series and aggregate them into a composite
                this.seriesData[key] = await this.measurementHelper.createAggregate(
                    this.seriesData,
                    config.series[key].idList,
                    options,
                    config.groupCumulative
                );
            }
        }
    }

    /**
     * Create the series for display
     *
     * @param key series key
     * @param localChartData output
     * @param options options for series
     */
    private createPieChart(key: string, localChartData: ChartDataSets[], options: MeasurementOptions) {
        const config = this.widgetHelper.getChartConfig();
        const colorList = config.colorList;
        const thisSeries: ChartDataSets = {
            data: [],
            backgroundColor: [
                ...colorList,
                ...colorList,
                ...colorList,
                ...colorList,
                ...colorList,
                ...colorList,
            ], //repeated so we can avoid having to update
        };

        this.chartLegend = config.position !== "none";
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
    private createNormalChart(key: string, localChartData: ChartDataSets[], options: MeasurementOptions) {
        const config = this.widgetHelper.getChartConfig();
        // const chartType = config.getChartType();        
        if (
            config.getChartType() === "bar" &&
            config.getChartType() === "horizontalBar" &&
            config.getChartType() === "scatter" &&
            config.getChartType() === "bubble" &&
            config.getChartType() === "pie" &&
            config.getChartType() === "radar" &&
            config.getChartType() === "doughnut"
        ) {
            // FIXME: this code will never be run as chart type can only have one value and not them all
            config.series[key].hideMeasurements = false;
            config.series[key].avgType = "None";
        }

        if (!config.series[key].isParent || config.groupbyGroup) {
            if (config.series[key].hideMeasurements !== true) {
                let thisSeries: ChartDataSets = this.createSeries(
                    key,
                    config.series[key].name,
                    this.widgetHelper.getWidgetConfig().chart.series[key].color
                );
                thisSeries.data = this.seriesData[key].valtimes;
                thisSeries.barPercentage = 0.9;
                thisSeries.categoryPercentage = 0.9;
                //need raw type
                if (config.type == "spline") {
                    thisSeries.lineTension = 0.4;
                } else {
                    thisSeries.lineTension = 0;
                }

                localChartData.push(thisSeries);
            }

            //If average or other function then add series for that
            if (config.series[key].avgType !== "None") {
                if (config.series[key].avgType.indexOf("Moving Average") > -1) {
                    let aggregateSeries: ChartDataSets = this.createSeries(
                        key,
                        `${options.name} - ${config.series[key].avgPeriod} period`,
                        this.widgetHelper.getWidgetConfig().chart.series[key].avgColor
                    );
                    //Need to apply the correct function in the series calculations
                    aggregateSeries.data = this.seriesData[key].aggregate;
                    localChartData.push(aggregateSeries);
                }

                if (config.series[key].avgType.indexOf("Bollinger Bands") > -1) {
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
            if (!this.subscription[key] && !config.series[key].isParent) {
                this.subscription[key] = this.realtimeService.subscribe("/measurements/" + options.deviceId, (data) =>
                    this.handleRealtime({ data, key, options })
                );
            }

        }
    }

    async handleTimer(parent: CumulocityDatapointsChartingWidget) {
        let localChartData: ChartDataSets[] = []; //build list locally because empty dataset is added by framework
        parent.retrieveAndPlotMultivariateChart(localChartData);
        parent.chartData = localChartData;
    }

    async refresh() {
        let localChartData: ChartDataSets[] = []; //build list locally because empty dataset is added by framework
        const config = this.widgetHelper.getChartConfig();
        /**
         *  handle independent series.
         */
        if (!config.multivariateplot) {
            //for each fragment/series to be plotted
            //ChartSeries has most of the config for the series
            //the MeasurementList contains the data (and its independent)
            let groups = [];

            for (let seriesName of Object.keys(config.series)) {
                if (Object.prototype.hasOwnProperty.call(config.series, seriesName)) {
                    const seriesConfig = config.series[seriesName];

                    if (!seriesConfig.isParent) {
                        //each series (aggregates and functions of raw data too) gets this
                        let options: MeasurementOptions = new MeasurementOptions(
                            config.series[seriesName].avgPeriod,
                            config.getChartType(),
                            config.numdp,
                            config.sizeBuckets,
                            config.minBucket,
                            config.maxBucket,
                            config.groupby,
                            config.cumulative,
                            seriesConfig.memberOf
                        );
                        //a period of time where quantity is the # of units,
                        // and type(unit) has the # of seconds per unit in the id field
                        let { from, to } = this.getDateRange();
                        for (let index = 0; index < seriesConfig.idList.length; index++) {

                            const seriesId = seriesConfig.idList[index];

                            let deviceId = this.widgetHelper.getDeviceTarget();
                            let splitSeriesId = seriesId.split(".");
                            if (deviceId === undefined) {
                                deviceId = splitSeriesId[0];
                            }

                            await this.getBaseMeasurements(
                                seriesConfig.idList.length > 1,
                                splitSeriesId[0],
                                seriesConfig.name,
                                splitSeriesId[1],
                                splitSeriesId[2],
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
                const seriesConfig = config.series[seriesName];
                //each series (aggregates and functions of raw data too) gets this
                let options: MeasurementOptions = new MeasurementOptions(
                    config.series[seriesName].avgPeriod,
                    config.getChartType(),
                    config.numdp,
                    config.sizeBuckets,
                    config.minBucket,
                    config.maxBucket,
                    config.groupby,
                    config.cumulative,
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
        }

        this.chartData = localChartData; //replace
    }

    // helper
    private setAxesLabels(xLabelKey: string, yLabelKey: string) {
        const config = this.widgetHelper.getChartConfig();
        if (this.chartOptions.scales.xAxes.length > 0) {
            this.chartOptions.scales.xAxes[0].scaleLabel = {
                display: config.showAxesLabels,
                labelString: config.series[xLabelKey].name,
            };
        }
        if (this.chartOptions.scales.yAxes.length > 0) {
            this.chartOptions.scales.yAxes[0].scaleLabel = {
                display: config.showAxesLabels,
                labelString: config.series[yLabelKey].name,
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
        const config = this.widgetHelper.getChartConfig();
        let series: ChartDataSets = {
            data: [],
            label: label,
            fill: config.fillArea,
            spanGaps: true,
            backgroundColor: col,
            borderColor: col,
            pointBackgroundColor: col,
            barThickness: "flex",
            pointRadius: config.showPoints,
        };
        return series;
    }

    /**
     *
     * @returns Pair of dates representing the from and to dates the range extends over
     */
    private getDateRange(): { from: Date; to: Date; } {
        const to = Date.now();
        const config = this.widgetHelper.getChartConfig();
        //here default to a large type so we try to get a reasonable amount of data
        const timeUnitVal: number = config.rangeUnits[
            config.rangeType ? config.rangeType : 4
        ].id;

        let from = new Date(to - config.rangeValue * timeUnitVal * 1000);
        return { from, to: new Date(to) };
    }

    /**
     * Create the axes and set options
     * begin at zero either starts the y axis at zero or nearer the range of values
     * the x axis is a time axis for measurements so se this appropriately
     */
    private setAxes() {
        //Legend
        const config = this.widgetHelper.getChartConfig();
        this.chartOptions.legend.display = config.position !== "None";
        if (this.chartOptions.legend.display) {
            this.chartOptions.legend.position = <PositionType>config.position;
        }
        if (config.getChartType() === "horizontalBar") {
            //swapped x & y
            const timeUnitType = config.rangeUnits[
                config.rangeType ? config.rangeType : 2
            ].text as Chart.TimeUnit;

            this.chartOptions.scales.yAxes.length = 0; //reset axes
            this.chartOptions.scales.yAxes.push({
                display: config.showx,
                stacked: config.stackSeries,
                type: "time",
                time: {
                    displayFormats: config.rangeDisplay,
                    unit: timeUnitType,
                },
            });

            //X axis
            this.chartOptions.scales.xAxes.length = 0; //reset axes
            this.chartOptions.scales.xAxes.push({
                display: config.showy,
                stacked: config.stackSeries,
                ticks: {
                    beginAtZero: !config.fitAxis,
                },
            });

            this.chartOptions.plugins = {
                labels: [],
            };
        } else if (
            config.getChartType() == "pie" ||
            config.getChartType() == "doughnut" ||
            config.getChartType() == "radar" ||
            config.getChartType() == "polarArea"
        ) {
            let dp = config.numdp ? config.numdp : 2;
            this.chartOptions.animation = { duration: 0 };
            this.chartOptions.scales.yAxes.length = 0; //reset axes
            this.chartOptions.scales.yAxes.push({
                display: false,
                type: "linear",
                ticks: {
                    beginAtZero: !config.fitAxis,
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
                    beginAtZero: !config.fitAxis,
                    callback: function (value: number) {
                        return value.toFixed(dp);
                    },
                },
            });
        } else {
            //X axis
            this.chartOptions.scales.xAxes.length = 0; //reset axes
            if (config.multivariateplot) {
                if (
                    config.getChartType() == "line" ||
                    config.getChartType() === "spline" ||
                    config.getChartType() == "scatter" ||
                    config.getChartType() == "bubble"
                ) {
                    this.chartOptions.scales.yAxes.length = 0; //reset axes
                    this.chartOptions.scales.xAxes.length = 0; //reset axes

                    let dp = config.numdp ? config.numdp : 2;
                    this.chartOptions.scales.xAxes.push({
                        display: config.showx,
                        stacked: config.stackSeries,
                        type: "linear",
                        ticks: {
                            beginAtZero: !config.fitAxis,
                            callback: function (value: number) {
                                return value.toFixed(dp);
                            },
                        },
                    });
                } else {
                    this.chartOptions.scales.xAxes.push({
                        display: config.showx,
                    });
                }
            } else {
                //default timeUnit to minutes if we pick measurements
                const timeUnitType = config.rangeUnits[
                    config.rangeType ? config.rangeType : 1
                ].text as Chart.TimeUnit;
                this.chartOptions.scales.xAxes.push({
                    display: config.showx,
                    stacked: config.stackSeries,
                    type: "time",
                    time: {
                        displayFormats: config.rangeDisplay,
                        unit: timeUnitType,
                    },
                });
                this.chartOptions.plugins = {
                    labels: [],
                };
            }
            let dp = config.numdp ? config.numdp : 2;

            //Y axis
            this.chartOptions.scales.yAxes.length = 0; //reset axes
            this.chartOptions.scales.yAxes.push({
                display: config.showy,
                stacked: config.stackSeries,
                ticks: {
                    beginAtZero: !config.fitAxis,
                    callback: function (value: number) {
                        return value.toFixed(dp);
                    },
                },
            });
        }
    }
}
