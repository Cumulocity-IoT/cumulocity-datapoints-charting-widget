/** @format */
import { ListItem } from "./widget-config";
import * as _ from "lodash";
import { TimeDisplayFormat } from "chart.js";

export interface Aggregation {
    type: string;
    interval: string;
    count: number;
}

/**
 * Each series chosen can have different properties
 * This class represents the values and options
 * chosen by the user. (and sensible defaults)
 */
export class ChartSeries {
    id: string = ""; //series id
    name: string = ""; //series name
    variable: string = "Assign variable"; //part of composite co-ordinate (0 = no order, 1 = x, 2 = y...)
    color: string = "#4ABBF0"; //display colour default just in case
    showAdvanced: boolean = false;
    hideMeasurements: boolean = false;
    avgType: string = "None";
    avgPeriod: number = 10;
    avgColor: string = "#4ABBF0"; //display colour
    realTime: string = "realtime";
    timerDelay: number = 30;
    constructor(k: string, n: string, c: string, a: string) {
        this.id = k;
        this.name = n;
        this.color = c;
        this.avgColor = a;
    }
}

/**
 * The ChartConfig class is the Main interface into the
 * chart js settings
 */
export class ChartConfig {
    /**
     *  Legend position
     */
    public chartPositions: ListItem[] = [
        { id: 0, text: "None" },
        { id: 1, text: "left" },
        { id: 2, text: "right" },
        { id: 3, text: "top" },
        { id: 4, text: "bottom" },
        { id: 5, text: "chartArea" },
    ];

    /**
     * Types of aggregation for the single series (Pie/Doughnut and later Histogram)
     */
    public aggregationType: ListItem[] = [
        { id: 0, text: "By Time" },
        { id: 1, text: "Value Buckets" },
    ];

    /**
     * This structure is for selects and mapping of the
     * values into our widget code
     *
     * Chart JS uses seconds-year as a way of getting
     * formatting for the axes labels when they are time
     * these are the defaults - we keep copies per chart
     * so we can independently change them.
     */
    public rangeUnits: ListItem[] = [
        // { id: -1, text: "Dates" },
        { id: 0, text: "measurements", format: "h:mm:ss.SSS a" },
        { id: 1, text: "second", format: "h:mm:ss a" },
        { id: 60, text: "minute", format: "h:mm a" },
        { id: 3600, text: "hour", format: "hA" },
        { id: 86400, text: "day", format: "MMM D" },
        { id: 604800, text: "week", format: "week ll" },
        { id: 2592000, text: "month", format: "MMM YYYY" },
        { id: 7776000, text: "quarter", format: "[Q]Q - YYYY" },
        { id: 31536000, text: "year", format: "YYYY" },
    ];

    /**
     * This structure is the default options and formats
     * for the chart js options - depending on the choice
     * of units chosen for the axes it will pick the format.
     */
    public rangeDisplayTemplate: TimeDisplayFormat = {
        millisecond: "h:mm:ss a",
        second: "h:mm:ss a",
        minute: "h:mm a",
        hour: "hA",
        day: "MMM D",
        week: "ll",
        month: "MMM YYYY",
        quarter: "[Q]Q - YYYY",
        year: "YYYY",
    };

    /**
     * Default colours so we have a set of main
     * and aggregate colors.
     */
    colorList: string[] = [
        "#FF0000",
        "#00FF00",
        "#0000FF",
        "#FF00FF",
        "#00FFFF",
        "#808000",
        "#800000",
        "#008000",
        "#008080",
        "#800080",
        "#808080",
        "#FFFF00",
    ];
    avgColorList: string[] = [
        "#800000",
        "#008000",
        "#008080",
        "#800080",
        "#808080",
        "#FFFF00",
        "#FF0000",
        "#00FF00",
        "#0000FF",
        "#FF00FF",
        "#00FFFF",
        "#808000",
    ];

    //Global properties
    enabled: boolean = true;

    /**
     * Most processing and chartjs uses these.
     */
    type: string = "line";
    position: string = "None"; //legend
    showx: boolean = true;
    showy: boolean = true;
    showAxesLabels: boolean = true;
    showAdvanced: boolean = false;
    fitAxis: boolean = false;
    stackSeries: boolean = false;
    fillArea: boolean = false;
    showPoints: number = 0; //default radius = 0 == no show
    numdp: number = 2; //2 decimal points numeric by default, can be set in config
    numBuckets: number = 5; //Make default 5 buckets for value agg
    groupby: boolean = false; // default no grouping
    cumulative: boolean = false; // not cumulative
    realtime: string = "realtime"; // type of update
    timerDelay: number = 30; // seconds delay if timer (default 30)

    customFormat: boolean = false;
    customFormatString: string = "yyyy-MM-DD HH:mm";
    dateExample: string = ""; //config display field only

    /**
     * Scatter, Bubble, line and certain other charts are plotted
     * using 2 or more series. This flag indicates that the user
     * has chosen that
     */
    multivariateplot: boolean = false;
    multivariateplotTolerance: number = 0.5; //seconds - match timestamps within Tolerance
    multivariateColor: string = this.colorList[0];

    /**
     * The extraction of measurements can be done using a time period
     * or the number of measurements. Time based query underlies all
     * measurement retrieval however.
     *
     * N.B. the time and agg format types may be different and reflect
     * that the format of axes and bucket parameters can differ
     */
    rangeType: number = 2; //default minutes (index into rangeUnits)
    timeFormatType: number = 2; //default minutes (index into rangeUnits)
    aggregation: number = this.aggregationType[0].id; // conditionally applied default to time base counts
    aggTimeFormatType: number = 2; //default minutes (index into rangeUnits)
    rangeValue: number = 10;

    /**
     * Local copy of the options - values can be changed per chart
     */
    rangeDisplay: TimeDisplayFormat = { ...this.rangeDisplayTemplate };

    /**
     * The individual settings for each data point set
     */
    series: { [key: string]: ChartSeries } = {};

    constructor() {}

    getChartType() {
        if (this.type == "spline chart") {
            return "line";
        }
        if (this.type == "histogram") {
            return "bar";
        }
        return this.type;
    }

    getChartTypes(): ListItem[] {
        return [
            { id: 0, text: "line" },
            { id: 5, text: "spline chart" },
            { id: 1, text: "bar" },
            { id: 2, text: "horizontalBar" },
            { id: 4, text: "doughnut" },
            { id: 7, text: "pie" },
            { id: 3, text: "radar" },
            //{ id: 5, text: "polarArea" },
            { id: 8, text: "scatter" },
            { id: 6, text: "bubble" },
            // { id: 9, text: "histogram" },
        ];
    }
    /**
     *
     * @returns true if series exist
     */
    hasSeries() {
        return Object.keys(this.series).length > 0;
    }

    /**
     * Checks to see if series held are still valid,
     * or if new series need to be added.
     *
     * @param l is the current list of series held
     */
    clearSeries(l: ListItem[]) {
        if (Object.keys(this.series).length > 0) {
            let temp = this.series;
            this.series = {};
            l.forEach((selected) => {
                if (temp[selected.id]) this.series[selected.id] = temp[selected.id];
            });
        }
    }

    /**
     * Used in the config form to display the
     * series settings and allow them to be changed.
     *
     * @returns the series held for display
     */
    seriesKeys(): Array<string> {
        return Object.keys(this.series);
    }

    /**
     * Add a new series to the list held.
     *
     * @param key is a composite of device, series and fragment
     * @param seriesName is the display name
     * @param seriesColor is the main color
     * @param altColor is the aggregate color
     */
    addSeries(key: string, seriesName: string, seriesColor: string, altColor: string) {
        if (!_.has(this.series, key)) {
            this.series[key] = new ChartSeries(key, seriesName, seriesColor, altColor);
        }
    }
}
