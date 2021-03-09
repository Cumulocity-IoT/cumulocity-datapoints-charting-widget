/** @format */
import { ListItem } from "./widget-config";
import * as _ from "lodash";
import { TimeDisplayFormat } from "chart.js";

export interface Aggregation {
    type: string;
    interval: string;
    count: number;
}

export class ChartSeries {
    id: string = ""; //series id
    name: string = ""; //series name
    variable: string = "Not Assigned"; //part of composite co-ordinate (0 = no order, 1 = x, 2 = y...)
    color: string = "#4ABBF0"; //display colour default just in case
    showAdvanced: boolean = false;
    hideMeasurements: boolean = false;
    avgType: string = "None";
    avgPeriod: number = 10;
    avgColor: string = "#4ABBF0"; //display colour
    realTime: boolean = true;
    constructor(k: string, n: string, c: string, a: string) {
        this.id = k;
        this.name = n;
        this.color = c;
        this.avgColor = a;
    }
}

export class ChartConfig {
    /**
     * Chart JS chart types
     */
    public chartTypes: ListItem[] = [
        { id: 0, text: "line" },
        { id: 1, text: "bar" },
        { id: 2, text: "horizontalBar" },
        // { id: 3, text: "radar" },
        { id: 4, text: "doughnut" },
        // { id: 5, text: "polarArea" },
        // { id: 6, text: "bubble" },
        { id: 7, text: "pie" },
        // { id: 8, text: "scatter" },
        { id: 9, text: "histogram" },
    ];

    public chartPositions: ListItem[] = [
        { id: 0, text: "None" },
        { id: 1, text: "left" },
        { id: 2, text: "right" },
        { id: 3, text: "top" },
        { id: 4, text: "bottom" },
        { id: 5, text: "chartArea" },
    ];

    public vars: ListItem[] = [
        { id: 0, text: "-" },
        { id: 1, text: "x" },
        { id: 2, text: "y" },
        { id: 3, text: "z" },
    ];

    public aggregationType: ListItem[] = [
        { id: 0, text: "count" },
        { id: 1, text: "average" },
    ];

    public rangeUnits: ListItem[] = [
        // { id: -1, text: "Dates" },
        // { id: 0, text: "Measurements" },
        { id: 1, text: "second" },
        { id: 60, text: "minute" },
        { id: 3600, text: "hour" },
        { id: 86400, text: "day" },
        { id: 604800, text: "week" },
        { id: 2592000, text: "month" },
        { id: 7776000, text: "quarter" },
        { id: 31536000, text: "year" },
    ];

    public rangeDisplayTemplate: TimeDisplayFormat = {
        millisecond: "h:mm:ss.SSS a",
        second: "h:mm:ss a",
        minute: "h:mm a",
        hour: "hA",
        day: "MMM D",
        week: "ll",
        month: "MMM YYYY",
        quarter: "[Q]Q - YYYY",
        year: "YYYY",
    };

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
    type: string = "line";
    multivariateplot: boolean = false;
    rangeType: ListItem = this.rangeUnits[1];
    rangeValue: number = 10;
    rangeDisplay: TimeDisplayFormat = { ...this.rangeDisplayTemplate };
    position: string = "None";
    height: number = 100;
    aggregation: ListItem = this.aggregationType[0];
    aggregationFreq: ListItem = this.rangeUnits[1];

    dateExample: string = "yyyy-MM-dd hh:mm";
    showx: boolean = true;
    showy: boolean = true;
    showAdvanced: boolean = false;
    fitAxis: boolean = false;
    stackSeries: boolean = false;
    fillArea: boolean = false;

    series: { [key: string]: ChartSeries } = {};

    /**
     * legend positions
     */
    constructor() {}

    hasSeries() {
        return Object.keys(this.series).length > 0;
    }

    clearSeries(l: ListItem[]) {
        if (Object.keys(this.series).length > 0) {
            let temp = this.series;
            this.series = {};
            l.forEach((selected) => {
                if (temp[selected.id])
                    this.series[selected.id] = temp[selected.id];
            });
        }
    }

    seriesKeys(): Array<string> {
        return Object.keys(this.series);
    }

    addSeries(
        key: string,
        seriesName: string,
        seriesColor: string,
        altColor: string
    ) {
        if (!_.has(this.series, key)) {
            this.series[key] = new ChartSeries(
                key,
                seriesName,
                seriesColor,
                altColor
            );
        }
    }
}
