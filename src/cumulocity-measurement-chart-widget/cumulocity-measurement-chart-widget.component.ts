/** @format */

import { Component, Input, OnInit } from "@angular/core";
import { WidgetConfig } from "./widget-config";
import * as _ from "lodash";
import { ChartDataSets, ChartOptions, PositionType } from "chart.js";
import { Label, ThemeService } from "ng2-charts";
import { DatePipe, formatDate } from "@angular/common";
import {
    MeasurementList,
    MeasurementOptions,
    MeasurementHelper,
} from "./widget-measurements";
import { MeasurementService, Realtime } from "@c8y/ngx-components/api";
import { WidgetHelper } from "./widget-helper";
//import { HttpClient } from "@angular/common/http";
import { sma } from "moving-averages";
import { getDate } from "ngx-bootstrap/chronos/utils/date-getters";

@Component({
    templateUrl: "./cumulocity-measurement-chart-widget.component.html",
    styleUrls: ["./cumulocity-measurement-chart-widget.component.css"],
    providers: [DatePipe, ThemeService],
})
export class CumulocityMeasurementChartWidget implements OnInit {
    @Input() config;
    dataLoaded: boolean = false;
    widgetHelper: WidgetHelper<WidgetConfig>;
    measurementHelper: MeasurementHelper;
    seriesData: { [key: string]: MeasurementList };
    subscription: { [key: string]: Object } = {}; //record per device subscriptions

    chartData: ChartDataSets[];
    chartLabels: Label[];
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
            ////console.log(data.data.data);
            let frag = _.get(data.data.data, options.fragment);
            if (_.has(frag, options.series)) {
                let ser = _.get(frag, options.series);
                measurementValue = ser.value;
                if (_.has(ser, "unit")) {
                    measurementUnit = ser.unit;
                }

                //console.log("BEFORE");
                //console.log(this.seriesData[key].vals);
                //Adjust series
                let d = formatDate(
                    measurementDate,
                    this.widgetHelper.getChartConfig().dateFormat,
                    options.locale
                );
                this.seriesData[key].vals.push(measurementValue);
                this.seriesData[key].times.push(measurementDate);
                this.seriesData[key].valtimes.push({
                    x: d,
                    y: measurementValue,
                });

                //log it
                console.log(
                    `Realtime ${options.name} - ${d} : ${measurementValue}`
                );

                if (options.avgPeriod > 0) {
                    let source = this.seriesData[key].vals.slice(
                        Math.max(
                            this.seriesData[key].vals.length -
                                options.avgPeriod,
                            0
                        )
                    );

                    let a = sma(source, options.avgPeriod, 3);

                    //aggregate needs x and y coordinates
                    this.seriesData[key].aggregate.push({
                        x: d,
                        y: a[a.length - 1],
                    });

                    if (
                        this.chartLabels.length >
                        this.seriesData[key].valtimes.length
                    ) {
                        this.chartLabels.shift(); //lose the first
                    }
                }

                let to = Date.now();
                let from = new Date(
                    to -
                        this.widgetHelper.getChartConfig().rangeValue.quantity *
                            this.widgetHelper.getChartConfig().rangeType.id *
                            1000
                );

                //if the time difference > specied else let it grow
                let diff =
                    from.getDate() -
                    new Date(this.seriesData[key].times[0]).getDate();
                console.log(
                    `${this.seriesData[key].times[0]} -  ${from} = ${diff}`
                );
                if (diff <= 0) {
                    this.seriesData[key].vals.shift();
                    this.seriesData[key].valtimes.shift();
                    this.seriesData[key].times.shift();
                    this.seriesData[key].aggregate.shift();
                    this.chartLabels.shift();
                }

                //only remove the first if we are longer than the source array.
                // if (
                //     this.seriesData[key].aggregate.length >
                //     this.seriesData[key].valtimes.length + 1
                // ) {
                //     this.seriesData[key].aggregate.shift();
                // }

                //make sure we get unique labels
                this.chartLabels = [...new Set(this.chartLabels.concat([d]))];

                // this.chartLabels = this.seriesData[key].times.map((d) => {
                //     return formatDate(
                //         d,
                //         this.widgetHelper.getChartConfig().dateFormat,
                //         this.widgetHelper.getChartConfig().locale
                //     );
                // });
            }
        }
    }

    /**
     * Lifecycle
     */
    async ngOnInit(): Promise<void> {
        this.widgetHelper = new WidgetHelper(this.config, WidgetConfig); //use config
        //console.log(`Config :`, this.widgetHelper.getWidgetConfig());

        //temporary until below is implemented
        this.chartData = [];

        //
        // Display Legend or not - needs logic for certain conditions
        // lhs display can cause issues if widget size is too small
        //
        this.chartOptions.legend.display =
            this.widgetHelper.getChartConfig().position !== "None";
        if (this.chartOptions.legend.display) {
            this.chartOptions.legend.position = <PositionType>(
                this.widgetHelper.getChartConfig().position
            );
        }

        //
        // Create the axes and set options
        // begin at zero either starts the y axis at zero or nearer the range of values
        //
        this.chartOptions.scales.xAxes.push({
            display: this.widgetHelper.getChartConfig().showx,
            stacked: this.widgetHelper.getChartConfig().stackSeries,
        });

        this.chartOptions.scales.yAxes.push({
            display: this.widgetHelper.getChartConfig().showy,
            stacked: this.widgetHelper.getChartConfig().stackSeries,
            ticks: {
                beginAtZero: !this.widgetHelper.getChartConfig().fitAxis,
            },
        });

        let localChartData = []; //build list locally because empty dataset is added by framework
        let compositeLabels = [];
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
                this.widgetHelper.getChartConfig().dateFormat,
                measurement.id.split(".")[1],
                measurement.id.split(".")[2],
                30
            );

            // now we can use the values from the options screen
            if (this.widgetHelper.getChartConfig().rangeType.id == -1) {
                //Date
                let to = Date.now();
                let from = this.widgetHelper.getChartConfig().rangeValue.from;
                //console.log(`Getting ${from} -> ${new Date(to)}`);
                // Get historic measurements to show on the chart
                this.seriesData[
                    key
                ] = await this.measurementHelper.getMeasurements(
                    this.measurementService,
                    options,
                    from,
                    new Date(to),
                    10000
                );
            } else if (this.widgetHelper.getChartConfig().rangeType.id == 0) {
                //console.log(
                //     `Getting ${
                //         this.widgetHelper.getChartConfig().rangeValue.quantity
                //     } measurements`
                // );
                this.seriesData[
                    key
                ] = await this.measurementHelper.getMeasurements(
                    this.measurementService,
                    options,
                    null,
                    null,
                    this.widgetHelper.getChartConfig().rangeValue.quantity
                );
            } else {
                //a period of time where quantity is the # of units,
                // and type(unit) has the # of seconds per unit in the id field
                let to = Date.now();
                let from = new Date(
                    to -
                        this.widgetHelper.getChartConfig().rangeValue.quantity *
                            this.widgetHelper.getChartConfig().rangeType.id *
                            1000
                );
                //console.log(
                //     `Date ${from} = ${to} ${
                //         this.widgetHelper.getChartConfig().rangeValue.quantity
                //     } ${this.widgetHelper.getChartConfig().rangeType.id}`
                // );
                this.seriesData[
                    key
                ] = await this.measurementHelper.getMeasurements(
                    this.measurementService,
                    options,
                    from,
                    new Date(to),
                    null
                );
            }

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

                //Update series as measurments come in.
                if (this.widgetHelper.getChartConfig().series[key].realTime) {
                    //console.log(`Subscribing to ${options.name}`);
                    if (!this.subscription[options.deviceId]) {
                        this.subscription[
                            options.deviceId
                        ] = this.realtimeService.subscribe(
                            "/measurements/" + options.deviceId,
                            (data) => this.handleRealtime(data, key, options)
                        );
                    }
                }
                localChartData.push(thisSeries);
            }

            //If average or other function then add series for that
            if (
                this.widgetHelper.getChartConfig().series[key].avgType !==
                "None"
            ) {
                let thisSeries2 = {
                    data: [],
                    label: `${options.name} - ${
                        this.widgetHelper.getChartConfig().series[key].avgPeriod
                    } ${
                        this.widgetHelper.getChartConfig().series[key].avgType
                    }`,
                    fill: this.widgetHelper.getChartConfig().fillArea,
                    spanGaps: true,
                    backgroundColor: this.widgetHelper.getWidgetConfig().chart
                        .series[key].avgColor,
                    borderColor: this.widgetHelper.getWidgetConfig().chart
                        .series[key].avgColor,
                };
                ////console.log("Adding average");
                ////console.log(this.seriesData[key].aggregate);
                //Need to apply the correct function here
                thisSeries2.data = this.seriesData[key].aggregate;
                localChartData.push(thisSeries2);
            }

            // Add labels to the points
            compositeLabels = [
                ...new Set(compositeLabels.concat(this.seriesData[key].times)),
            ];
            // this.chartLabels = this.seriesData[key].times.map((d) => {
            //     return formatDate(
            //         d,
            //         this.widgetHelper.getChartConfig().dateFormat,
            //         this.widgetHelper.getChartConfig().locale
            //     );
            // });
        }
        this.chartLabels = compositeLabels;
        this.chartData = localChartData; //replace
        this.dataLoaded = true;
    }
}
