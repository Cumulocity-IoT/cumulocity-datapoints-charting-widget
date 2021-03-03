/** @format */

import { Component, ElementRef, Input, OnInit, ViewChild } from "@angular/core";
import { WidgetConfig } from "./widget-config";
import * as _ from "lodash";
import { ChartDataSets, ChartOptions, PositionType } from "chart.js";
import { ThemeService, BaseChartDirective } from "ng2-charts";
import { DatePipe } from "@angular/common";
import {
    MeasurementList,
    MeasurementOptions,
    MeasurementHelper,
} from "./widget-measurements";
import { MeasurementService, Realtime } from "@c8y/ngx-components/api";
import { WidgetHelper } from "./widget-helper";
import * as moment from "moment";
import boll from "bollinger-bands";

@Component({
    templateUrl: "./cumulocity-measurement-chart-widget.component.html",
    styleUrls: ["./cumulocity-measurement-chart-widget.component.css"],
    providers: [DatePipe, ThemeService],
})
export class CumulocityMeasurementChartWidget implements OnInit {
    @Input() config;
    @ViewChild(BaseChartDirective, { static: false })
    chartElement: BaseChartDirective;

    dataLoaded: boolean = false;
    widgetHelper: WidgetHelper<WidgetConfig>;
    measurementHelper: MeasurementHelper;
    seriesData: { [key: string]: MeasurementList };
    subscription: { [key: string]: Object } = {}; //record per device subscriptions

    chartData: ChartDataSets[];
    //chartLabels: Label[];
    chartOptions: ChartOptions = {
        maintainAspectRatio: false,
        events: ["click"],
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
        },
        responsive: true,
        scales: {
            xAxes: [],
            yAxes: [],
        },
    };

    verifyConfig(): boolean {
        return (
            this.widgetHelper.getWidgetConfig() !== undefined &&
            this.widgetHelper.getWidgetConfig().selectedDevices.length > 0 &&
            this.widgetHelper.getWidgetConfig().selectedMeasurements.length > 0
        );
    }

    constructor(
        //        private http: HttpClient,
        private measurementService: MeasurementService,
        public datepipe: DatePipe,
        private realtimeService: Realtime
    ) {
        this.widgetHelper = new WidgetHelper(this.config, WidgetConfig); //default
        this.measurementHelper = new MeasurementHelper();
        this.seriesData = {};
    }

    handleRealtime(data: any, key: string, options: MeasurementOptions): void {
        //get the values
        let measurementDate = data.data.data.time;
        let measurementValue = 0; //default
        let measurementUnit = undefined; //default
        //need the fragment, series
        if (_.has(data.data.data, options.fragment)) {
            // console.log(`RAW ${key}`);
            // console.log(data.data.data);
            // console.log(`---------------`);
            let frag = _.get(data.data.data, options.fragment);
            if (_.has(frag, options.series)) {
                let ser = _.get(frag, options.series);
                measurementValue = ser.value;
                if (_.has(ser, "unit")) {
                    measurementUnit = ser.unit;
                }

                //Adjust series
                this.seriesData[key].valtimes.push({
                    x: measurementDate,
                    y: measurementValue,
                });

                //Only take the last N values to create the average
                if (options.avgPeriod > 0) {
                    let source = this.seriesData[key].valtimes.slice(
                        Math.max(
                            this.seriesData[key].valtimes.length -
                                options.avgPeriod,
                            0
                        )
                    );

                    //just the values
                    source = source.map((val) => val.y);
                    // let a = sma(source, options.avgPeriod, 3);
                    let a = boll(source, options.avgPeriod, 3);

                    //aggregate needs x and y coordinates but we use only the last
                    this.seriesData[key].upper.push({
                        x: measurementDate,
                        y: a.upper[a.upper.length - 1],
                    });
                    this.seriesData[key].aggregate.push({
                        x: measurementDate,
                        y: a.mid[a.mid.length - 1],
                    });
                    this.seriesData[key].lower.push({
                        x: measurementDate,
                        y: a.lower[a.lower.length - 1],
                    });
                }
            }
            if (this.chartElement) {
                //range required...
                let { from, to } = this.getDateRange();
                //the series are empty at the beginning
                let first = 0;

                while (
                    moment(this.seriesData[key].aggregate[0].x).isBefore(
                        moment(from)
                    )
                ) {
                    this.seriesData[key].upper.shift();
                    this.seriesData[key].aggregate.shift();
                    this.seriesData[key].lower.shift();
                }
                while (
                    moment(this.seriesData[key].valtimes[0].x).isBefore(
                        moment(from)
                    )
                ) {
                    this.seriesData[key].valtimes.shift();
                }
                this.setAxes();
                this.chartElement.update();
            }
        }
    }

    /**
     * Lifecycle
     */
    async ngOnInit(): Promise<void> {
        this.widgetHelper = new WidgetHelper(this.config, WidgetConfig); //use config

        //temporary until below is done
        this.chartData = [];

        //
        // Display Legend or not - needs logic for certain conditions
        // lhs display can cause issues if widget size is too small
        //
        this.setAxes();

        let localChartData = []; //build list locally because empty dataset is added by framework
        //for each fragment/series to be plotted
        //ChartSeries has most of the config for the series
        //the MeasurementList contains the data (and its independent)
        for (let key of Object.keys(
            this.widgetHelper.getChartConfig().series
        )) {
            const measurement = this.widgetHelper.getChartConfig().series[key];

            //each series (aggregates and functions of raw data too) gets this
            let options: MeasurementOptions = new MeasurementOptions(
                measurement.id.split(".")[0],
                measurement.name,
                measurement.id.split(".")[1],
                measurement.id.split(".")[2],
                this.widgetHelper.getChartConfig().series[key].avgPeriod
            );

            //a period of time where quantity is the # of units,
            // and type(unit) has the # of seconds per unit in the id field
            let { from, to } = this.getDateRange();

            //
            // WorkHorse Functionality - retrieve and calculate derived numbers
            //
            this.seriesData[key] = await this.measurementHelper.getMeasurements(
                this.measurementService,
                options,
                from,
                to,
                null
            );

            //Normal plot
            if (
                this.widgetHelper.getChartConfig().series[key]
                    .hideMeasurements !== true
            ) {
                let thisSeries = {
                    data: [],
                    label: this.widgetHelper.getChartConfig().series[key].name,
                    fill: this.widgetHelper.getChartConfig().fillArea,
                    spanGaps: true,
                    backgroundColor: this.widgetHelper.getWidgetConfig().chart
                        .series[key].color,
                    borderColor: this.widgetHelper.getWidgetConfig().chart
                        .series[key].color,
                };

                thisSeries.data = this.seriesData[key].valtimes;
                localChartData.push(thisSeries);
            }

            //If average or other function then add series for that
            if (
                this.widgetHelper.getChartConfig().series[key].avgType !==
                "None"
            ) {
                if (
                    this.widgetHelper
                        .getChartConfig()
                        .series[key].avgType.indexOf("Moving Average") > -1
                ) {
                    let aggregateSeries: ChartDataSets = this.createSeries(
                        key,
                        `${options.name} - ${
                            this.widgetHelper.getChartConfig().series[key]
                                .avgPeriod
                        } period`
                    );
                    //Need to apply the correct function in the series calculations
                    aggregateSeries.data = this.seriesData[key].aggregate;
                    localChartData.push(aggregateSeries);
                }

                if (
                    this.widgetHelper
                        .getChartConfig()
                        .series[key].avgType.indexOf("Bollinger Bands") > -1
                ) {
                    let upperBoll: ChartDataSets = this.createSeries(
                        key,
                        `${options.name} - upper Bollinger Band`
                    );

                    //Need to apply the correct function in the series calculations
                    upperBoll.data = this.seriesData[key].upper;
                    localChartData.push(upperBoll);

                    let lowerBoll: ChartDataSets = this.createSeries(
                        key,
                        `${options.name} - lower Bollinger Band`
                    );

                    //Need to apply the correct function in the series calculations
                    lowerBoll.data = this.seriesData[key].lower;
                    localChartData.push(lowerBoll);
                }
            }

            //Update series as measurments come in.
            if (this.widgetHelper.getChartConfig().series[key].realTime) {
                //console.log(`Subscribing to ${options.name}`);
                if (!this.subscription[key]) {
                    this.subscription[
                        options.deviceId
                    ] = this.realtimeService.subscribe(
                        "/measurements/" + options.deviceId,
                        (data) => this.handleRealtime(data, key, options)
                    );
                }
            }
        }
        this.chartData = localChartData; //replace
        this.dataLoaded = true;
    }

    createSeries(key: string, label: string): ChartDataSets {
        let series = {
            data: [],
            label: label,
            fill: this.widgetHelper.getChartConfig().fillArea,
            spanGaps: true,
            backgroundColor: this.widgetHelper.getWidgetConfig().chart.series[
                key
            ].avgColor,
            borderColor: this.widgetHelper.getWidgetConfig().chart.series[key]
                .avgColor,
        };
        return series;
    }

    private getDateRange(): { from: Date; to: Date } {
        let to = Date.now();
        let from = new Date(
            to -
                this.widgetHelper.getChartConfig().rangeValue *
                    this.widgetHelper.getChartConfig().rangeType.id *
                    1000
        );
        return { from, to: new Date(to) };
    }

    private setAxes() {
        //
        // Create the axes and set options
        // begin at zero either starts the y axis at zero or nearer the range of values
        // the x axis is a time axis for measurmeents so se this appropriately
        //

        //Legend
        this.chartOptions.legend.display =
            this.widgetHelper.getChartConfig().position !== "None";
        if (this.chartOptions.legend.display) {
            this.chartOptions.legend.position = <PositionType>(
                this.widgetHelper.getChartConfig().position
            );
        }

        //X axis
        this.chartOptions.scales.xAxes.length = 0; //reset axes
        this.chartOptions.scales.xAxes.push({
            display: this.widgetHelper.getChartConfig().showx,
            stacked: this.widgetHelper.getChartConfig().stackSeries,
            type: "time",
            time: {
                displayFormats: this.widgetHelper.getChartConfig().rangeDisplay,
                unit: this.widgetHelper.getChartConfig().rangeType.text,
            },
        });

        //Y axis
        this.chartOptions.scales.yAxes.length = 0; //reset axes
        this.chartOptions.scales.yAxes.push({
            display: this.widgetHelper.getChartConfig().showy,
            stacked: this.widgetHelper.getChartConfig().stackSeries,
            ticks: {
                beginAtZero: !this.widgetHelper.getChartConfig().fitAxis,
            },
        });

        //labels affect the plot greatly so allow the chart to naturally do that it's self.
        //console.log(`Chart Axes Set :`, this.chartOptions.scales);
    }
}
