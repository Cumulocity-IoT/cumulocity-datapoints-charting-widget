/** @format */

import { Component, Input, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { WidgetConfig } from "./widget-config";
import * as _ from "lodash";
import {
  ChartDataSets,
  ChartOptions,
  ChartTooltipItem,
  PositionType,
} from "chart.js";
import { ThemeService, BaseChartDirective, Label } from "ng2-charts";
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
import "chartjs-plugin-labels";

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
   * and the measurments
   */
  widgetHelper: WidgetHelper<WidgetConfig>;
  measurementHelper: MeasurementHelper;

  /**
   * This charts data, retrieved initially in init, and then
   * updated as measurments are recieved. Realtime data is
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
      //     console.log("TOOLTIP", tooltipItem);
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
   * @returns true if we have devices and measurments selected
   */
  verifyConfig(): boolean {
    return (
      this.widgetHelper.getWidgetConfig() !== undefined &&
      this.widgetHelper.getWidgetConfig().selectedDevices.length > 0 &&
      this.widgetHelper.getWidgetConfig().selectedMeasurements.length > 0
    );
  }

  /**
   * Initialise the Measurement service, Realtime service and date pipe.
   * Sets the widgetHelper up and points it at config - initialises seriesData
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
    for (const sub in this.subscription) {
      if (Object.prototype.hasOwnProperty.call(this.subscription, sub)) {
        const tbd = this.subscription[sub];
        this.realtimeService.unsubscribe(tbd);
      }
    }
  }

  /**
   * As we process required series we create subscriptions to measuements.
   * This method is the generic call back for these measurements as they
   * arrive.
   *
   * @param data
   * @param key
   * @param options
   */
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

        let datum = {
          x: measurementDate,
          y: measurementValue,
        };

        if (
          this.widgetHelper.getChartConfig().type == "pie" ||
          this.widgetHelper.getChartConfig().type == "doughnut"
        ) {
          this.seriesData[key].valtimes.push(datum);

          if (this.widgetHelper.getChartConfig().aggregation == 0) {
            let mapped = this.measurementHelper.categorize(options, datum);

            let index = -1;
            this.seriesData[key].labels.some((v, i) => {
              if (v === mapped) {
                index = i;
                return true;
              }
              return false;
            });

            if (index === -1) {
              this.seriesData[key].labels.push(mapped);
              this.seriesData[key].bucket.push(1);
            } else {
              this.seriesData[key].bucket[index] =
                this.seriesData[key].bucket[index] + 1;
            }

            console.log(this.seriesData[key].bucket);
          } else {
            let vals = this.seriesData[key].valtimes.map((val) => val.y);
            let hist = this.measurementHelper.calculateHistogram(vals, 5);
            //
            // In this case we want to replace the data
            //
            this.seriesData[key].labels.length = 0;
            this.seriesData[key].bucket.length = 0;
            this.seriesData[key].labels.push(...hist.labels);
            this.seriesData[key].bucket.push(...hist.counts);
            console.log(this.seriesData[key].labels);
            console.log(this.seriesData[key].bucket);
          }
        } else if (this.widgetHelper.getChartConfig().type == "horizontalBar") {
          datum = {
            y: measurementDate,
            x: measurementValue,
          };
          //Adjust series
          this.seriesData[key].valtimes.push(datum);
        } else {
          //Adjust series
          this.seriesData[key].valtimes.push(datum);

          //Only take the last N values to create the average
          if (options.avgPeriod > 0) {
            let source = this.seriesData[key].valtimes.slice(
              Math.max(
                this.seriesData[key].valtimes.length - options.avgPeriod,
                0
              )
            );

            //just the values
            source = source.map((val) => val.y);
            // let a = sma(source, options.avgPeriod, 3);
            let avper =
              options.avgPeriod > source.length
                ? source.length
                : options.avgPeriod;
            let a = boll(source, avper, 2);

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
      }
      if (this.chartElement) {
        //range required...
        let { from, to } = this.getDateRange();

        //
        // Line has the bollinger bands
        //
        if (this.widgetHelper.getChartConfig().type === "line") {
          while (
            moment(this.seriesData[key].aggregate[0].x).isBefore(moment(from))
          ) {
            this.seriesData[key].upper.shift();
            this.seriesData[key].aggregate.shift();
            this.seriesData[key].lower.shift();
          }
        }

        if (
          this.widgetHelper.getChartConfig().type === "pie" ||
          this.widgetHelper.getChartConfig().type === "doughnut"
        ) {
          //all graph types
          // console.log(
          //     `checking ${this.seriesData[key].labels[0]} (${moment(
          //         this.seriesData[key].labels[0],
          //         this.widgetHelper.getChartConfig().rangeDisplay[
          //             this.widgetHelper.getChartConfig()
          //                 .aggregationFreq.text
          //         ] //time format
          //     ).format()} | ${moment(from).format()})`
          // );
          //only remove data when we deal with times...
          if (this.widgetHelper.getChartConfig().aggregation == 0) {
            let aggUnit = this.widgetHelper.getChartConfig().rangeUnits[
              this.widgetHelper.getChartConfig().aggTimeFormatType
            ].text;
            let aggFormat = this.widgetHelper.getChartConfig().rangeDisplay[
              aggUnit
            ];
            console.log("AGG3", aggUnit, aggFormat);

            while (
              moment(this.seriesData[key].labels[0], aggFormat).isBefore(from)
            ) {
              this.seriesData[key].bucket.shift();
              this.seriesData[key].labels.shift();
            }
          }
        }

        if (
          this.widgetHelper.getChartConfig().type === "line" ||
          this.widgetHelper.getChartConfig().type === "bar"
        ) {
          //all graph types
          while (
            moment(this.seriesData[key].valtimes[0].x).isBefore(moment(from))
          ) {
            this.seriesData[key].valtimes.shift();
          }
        }

        if (this.widgetHelper.getChartConfig().type === "horizontalBar") {
          while (
            moment(this.seriesData[key].valtimes[0].y).isBefore(moment(from))
          ) {
            this.seriesData[key].valtimes.shift();
          }
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

    //Clean up
    this.chartData = [];

    let seriesKeys = Object.keys(this.widgetHelper.getChartConfig().series);
    for (const subKey in this.subscription) {
      if (Object.prototype.hasOwnProperty.call(this.subscription, subKey)) {
        const sub = this.subscription[subKey];
        if (!(subKey in seriesKeys)) {
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
      console.log("getting independent variables");
      //for each fragment/series to be plotted
      //ChartSeries has most of the config for the series
      //the MeasurementList contains the data (and its independent)
      for (let key of Object.keys(this.widgetHelper.getChartConfig().series)) {
        if (
          Object.prototype.hasOwnProperty.call(
            this.widgetHelper.getChartConfig().series,
            key
          )
        ) {
          const measurement = this.widgetHelper.getChartConfig().series[key];

          //each series (aggregates and functions of raw data too) gets this
          let options: MeasurementOptions = new MeasurementOptions(
            measurement.id.split(".")[0],
            measurement.name,
            measurement.id.split(".")[1],
            measurement.id.split(".")[2],
            this.widgetHelper.getChartConfig().series[key].avgPeriod,
            this.widgetHelper.getChartConfig().type
          );

          //a period of time where quantity is the # of units,
          // and type(unit) has the # of seconds per unit in the id field
          let { from, to } = this.getDateRange();
          if (from.getTime() == to.getTime()) {
            from = new Date(new Date(to).setFullYear(to.getFullYear() - 1));
          }
          let measurementLimit =
            this.widgetHelper.getChartConfig().rangeType > 0
              ? 0
              : this.widgetHelper.getChartConfig().rangeValue;

          let unitIndex = this.widgetHelper.getChartConfig().timeFormatType;
          if (
            this.widgetHelper.getChartConfig().type == "pie" ||
            (this.widgetHelper.getChartConfig().type == "doughnut" &&
              this.widgetHelper.getChartConfig().aggregation == 0)
          ) {
            unitIndex = this.widgetHelper.getChartConfig().aggTimeFormatType;
          }

          let aggUnit = this.widgetHelper.getChartConfig().rangeUnits[unitIndex]
            .text;
          let aggFormat = this.widgetHelper.getChartConfig().rangeDisplay[
            aggUnit
          ];
          console.log("AGG2", aggUnit, aggFormat);

          //
          // WorkHorse Functionality - retrieve and calculate derived numbers
          //
          this.seriesData[key] = await this.measurementHelper.getMeasurements(
            this.measurementService,
            options,
            from,
            to,
            null,
            this.widgetHelper.getChartConfig().type,
            this.widgetHelper.getChartConfig().aggregation == 0, //count = true
            aggUnit, //period of count (time)
            aggFormat, //time format
            measurementLimit
          );

          if (
            options.targetGraphType == "pie" ||
            options.targetGraphType == "doughnut"
          ) {
            //different to line/bar type plots - potentially lots of colours req
            //if lots of points added. If they run out you get grey...
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

            this.chartLegend =
              this.widgetHelper.getChartConfig().position !== "none";
            this.chartLabels = this.seriesData[key].labels;
            thisSeries.data = this.seriesData[key].bucket;
            localChartData.push(thisSeries);

            //Update series as measurments come in.
            if (this.widgetHelper.getChartConfig().series[key].realTime) {
              //console.log(`Subscribing to ${options.name}`);
              if (!this.subscription[key]) {
                this.subscription[
                  key
                ] = this.realtimeService.subscribe(
                  "/measurements/" + options.deviceId,
                  (data) => this.handleRealtime(data, key, options)
                );
              }
            }
          } else {
            //Normal plot
            if (
              this.widgetHelper.getChartConfig().series[key]
                .hideMeasurements !== true
            ) {
              let thisSeries: ChartDataSets = this.createSeries(
                key,
                this.widgetHelper.getChartConfig().series[key].name,
                this.widgetHelper.getWidgetConfig().chart.series[key].color
              );
              thisSeries.data = this.seriesData[key].valtimes;
              thisSeries.barPercentage = 0.9;
              thisSeries.categoryPercentage = 0.9;
              localChartData.push(thisSeries);
              console.log(thisSeries);
            }

            //If average or other function then add series for that
            if (
              this.widgetHelper.getChartConfig().series[key].avgType !== "None"
            ) {
              if (
                this.widgetHelper
                  .getChartConfig()
                  .series[key].avgType.indexOf("Moving Average") > -1
              ) {
                let aggregateSeries: ChartDataSets = this.createSeries(
                  key,
                  `${options.name} - ${
                    this.widgetHelper.getChartConfig().series[key].avgPeriod
                  } period`,
                  this.widgetHelper.getWidgetConfig().chart.series[key].avgColor
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

            //Update series as measurments come in.
            if (this.widgetHelper.getChartConfig().series[key].realTime) {
              //console.log(`Subscribing to ${options.name}`);
              if (!this.subscription[key]) {
                this.subscription[
                  key
                ] = this.realtimeService.subscribe(
                  "/measurements/" + options.deviceId,
                  (data) => this.handleRealtime(data, key, options)
                );
              }
            }
          }
        }
      }
    } else {
      /**
       *  handle dependent series (x,y|x,y,r).
       *
       *
       *
       */
      console.log("generating composite series from sources");
      console.log(
        `for a chart of type ${this.widgetHelper.getChartConfig().type}`
      );
      let seriesList: { [id: string]: string } = {};
      let assigned: number = 0;
      //
      // Get the data - there will be 1-3 series that will get
      // compressed into a single with x,y,r values
      //
      for (let key of Object.keys(this.widgetHelper.getChartConfig().series)) {
        if (
          Object.prototype.hasOwnProperty.call(
            this.widgetHelper.getChartConfig().series,
            key
          )
        ) {
          //For each variable retrieve the measurements
          //we need to match up measurements to get the
          //graph - omit gaps - real time?
          const measurement = this.widgetHelper.getChartConfig().series[key];
          const v = this.widgetHelper.getChartConfig().series[key].variable;

          //store variable x, y, r with key
          if (v !== "Assign variable") {
            seriesList[v] = key;
            assigned++;
          }

          //each series (aggregates and functions of raw data too) gets this
          let options: MeasurementOptions = new MeasurementOptions(
            measurement.id.split(".")[0],
            measurement.name,
            measurement.id.split(".")[1],
            measurement.id.split(".")[2],
            this.widgetHelper.getChartConfig().series[key].avgPeriod,
            this.widgetHelper.getChartConfig().type
          );

          // a period of time where quantity is the # of units,
          // and type(unit) has the # of seconds per unit in the id field
          // *OR* we need # measurements => large date range short circuited
          // once we have the right number
          let { from, to } = this.getDateRange();
          let measurementLimit =
            this.widgetHelper.getChartConfig().rangeType > 0
              ? 0
              : this.widgetHelper.getChartConfig().rangeValue;

          let unitIndex = this.widgetHelper.getChartConfig().timeFormatType;
          let aggUnit = this.widgetHelper.getChartConfig().rangeUnits[unitIndex]
            .text;
          let aggFormat = this.widgetHelper.getChartConfig().rangeDisplay[
            aggUnit
          ];
          console.log("AGG", aggUnit, aggFormat);
          //
          // WorkHorse Functionality - retrieve and calculate derived numbers
          //
          this.seriesData[key] = await this.measurementHelper.getMeasurements(
            this.measurementService,
            options,
            from,
            to,
            null,
            this.widgetHelper.getChartConfig().type,
            this.widgetHelper.getChartConfig().aggregation == 0, //count = true
            aggUnit, //period of count (time)
            aggFormat, //time format
            measurementLimit
          );
        }
      }

      if (assigned < 2) {
        //do something sensible - warn not assigned
      } else {
        let seriesName = this.widgetHelper.getChartConfig().series[
          seriesList["x"]
        ].name;
        if ("y" in seriesList) {
          seriesName =
            seriesName +
            ` vs ${
              this.widgetHelper.getChartConfig().series[seriesList["y"]].name
            }`;
        }
        if ("r" in seriesList) {
          seriesName =
            seriesName +
            ` vs ${
              this.widgetHelper.getChartConfig().series[seriesList["r"]].name
            }`;
        }

        //
        // We have all the data, now we create the actual displayed data
        //
        let thisSeries: ChartDataSets = this.createSeries(
          seriesList["x"],
          seriesName,
          this.widgetHelper.getChartConfig().multivariateColor
        );

        //x/y series (!!Date Order!!) - make sure x/y values match timestamps
        let result: { x: number; y: number; r?: number }[] = [];
        for (
          let index = 0;
          index < this.seriesData[seriesList["x"]].valtimes.length;
          index++
        ) {
          let xval = this.seriesData[seriesList["x"]].valtimes[index];
          let yval = this.seriesData[seriesList["y"]].valtimes.filter((val) => {
            return (
              //Match dates within a tolerence
              Math.abs(val.x.getTime() - xval.x.getTime()) <
              this.widgetHelper.getChartConfig().multivariateplotTolerence *
                1000
            );
          });
          let zval = undefined;
          if ("r" in seriesList) {
            zval = this.seriesData[seriesList["r"]].valtimes.filter((val) => {
              return (
                //Match dates within a tolerence
                Math.abs(val.x.getTime() - xval.x.getTime()) <
                this.widgetHelper.getChartConfig().multivariateplotTolerence *
                  1000
              );
            });
            //console.log(zval);
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
        result = result.sort((a, b) => a.x - b.x);

        if (
          this.widgetHelper.getChartConfig().type == "radar" ||
          this.widgetHelper.getChartConfig().type == "polarArea" //not handled yet
        ) {
          //we need separate labels and values here
          thisSeries.data = result.map((v) => v.y);
          this.chartLabels = result.map((v) => v.x.toString());
        } else {
          thisSeries.data = result;
          thisSeries.pointRadius = this.widgetHelper.getChartConfig().showPoints;
        }
        localChartData.push(thisSeries);
        this.setAxesLabels(seriesList["x"], seriesList["y"]);
      }
    }
    this.chartData = localChartData; //replace
    this.dataLoaded = true; //update
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
      this.widgetHelper.getChartConfig().rangeType
        ? this.widgetHelper.getChartConfig().rangeType
        : 4
    ].id;

    let from = new Date(
      to - this.widgetHelper.getChartConfig().rangeValue * timeUnitVal * 1000
    );
    //console.log(`range: ${from} ${new Date(to)}`);
    return { from, to: new Date(to) };
  }

  /**
   * Create the axes and set options
   * begin at zero either starts the y axis at zero or nearer the range of values
   * the x axis is a time axis for measurmeents so se this appropriately
   */
  private setAxes() {
    //Legend
    this.chartOptions.legend.display =
      this.widgetHelper.getChartConfig().position !== "None";
    if (this.chartOptions.legend.display) {
      this.chartOptions.legend.position = <PositionType>(
        this.widgetHelper.getChartConfig().position
      );
    }
    if (this.widgetHelper.getChartConfig().type === "horizontalBar") {
      //swapped x & y
      const timeUnitType = this.widgetHelper.getChartConfig().rangeUnits[
        this.widgetHelper.getChartConfig().rangeType
          ? this.widgetHelper.getChartConfig().rangeType
          : 1
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
      this.widgetHelper.getChartConfig().type == "pie" ||
      this.widgetHelper.getChartConfig().type == "doughnut" ||
      this.widgetHelper.getChartConfig().type == "radar" ||
      this.widgetHelper.getChartConfig().type == "polarArea"
    ) {
      this.chartOptions.scales.yAxes.length = 0; //reset axes
      this.chartOptions.scales.yAxes.push({
        display: false,
      });

      //Y axis
      this.chartOptions.scales.xAxes.length = 0; //reset axes
      this.chartOptions.scales.xAxes.push({
        display: false,
      });
    } else {
      //X axis
      this.chartOptions.scales.xAxes.length = 0; //reset axes
      if (this.widgetHelper.getChartConfig().multivariateplot) {
        if (
          this.widgetHelper.getChartConfig().type == "line" ||
          this.widgetHelper.getChartConfig().type == "scatter" ||
          this.widgetHelper.getChartConfig().type == "bubble"
        ) {
          this.chartOptions.scales.yAxes.length = 0; //reset axes
          this.chartOptions.scales.xAxes.length = 0; //reset axes

          if (
            this.widgetHelper.getChartConfig().type == "scatter" ||
            this.widgetHelper.getChartConfig().type == "bubble"
          ) {
            this.widgetHelper.getChartConfig().fitAxis = true; //always fit data
          }

          this.chartOptions.scales.xAxes.push({
            display: this.widgetHelper.getChartConfig().showx,
            stacked: this.widgetHelper.getChartConfig().stackSeries,
            type: "linear",
            ticks: {
              beginAtZero: !this.widgetHelper.getChartConfig().fitAxis,
              callback: function (value: number) {
                return value.toPrecision(2);
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
          this.widgetHelper.getChartConfig().rangeType
            ? this.widgetHelper.getChartConfig().rangeType
            : 1
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

      //Y axis
      this.chartOptions.scales.yAxes.length = 0; //reset axes
      this.chartOptions.scales.yAxes.push({
        display: this.widgetHelper.getChartConfig().showy,
        stacked: this.widgetHelper.getChartConfig().stackSeries,
        ticks: {
          beginAtZero: !this.widgetHelper.getChartConfig().fitAxis,
          callback: function (value: number) {
            return value.toPrecision(2);
          },
        },
      });
    }

    //labels affect the plot greatly so allow the chart to naturally do that it's self.
    //console.log(`Chart Axes Set :`, this.chartOptions.scales);
  }
}
