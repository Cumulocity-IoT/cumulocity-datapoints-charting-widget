import { ChartPoint } from 'chart.js';
import { aggregationType, IManagedObject, IMeasurement, ISeriesFilter } from '@c8y/client';
import { MeasurementService } from '@c8y/ngx-components/api';
import * as _ from 'lodash';
import { formatDate } from '@angular/common';


//Helper class for getting the data points in Chartjs format
export class CumulocityHelper {


    private queryDateFormat: string = "yyyy-MM-ddTHH:mm:ssZ";
    private locale: string = "en";

    constructor() {

    }

    getContextItems(filter: any): Promise<IManagedObject[]> {
        return Promise.resolve([]);
    }

    /**
     * Get the ChartPoint[] ready to plot from cumulocity.
     * 
     * 
     * 
     * @param measurementService 
     * @param deviceId 
     * @param fragment 
     * @param series 
     * @param startDate 
     * @param endDate 
     * @param intervals 
     * @returns 
     */
    public async getData(measurementService: MeasurementService,
        deviceId: string,
        fragment: string,
        series: string,
        startDate: Date,
        endDate: Date,
        maxPoints: number = 2000): Promise<ChartPoint[]> {

        let filter = {};
        _.set(filter, "source", deviceId);
        _.set(filter, "valueFragmentType", fragment);
        _.set(filter, "valueFragmentSeries", series);
        _.set(filter, "pageSize", 2000);
        _.set(filter, "revert", true);
        _.set(filter, "withTotalPages", true);
        console.log(formatDate(startDate, this.queryDateFormat, this.locale), formatDate(endDate, this.queryDateFormat, this.locale));

        if (startDate) {
            _.set(filter, "dateFrom", formatDate(startDate, this.queryDateFormat, this.locale));
        }

        if (endDate) {
            _.set(filter, "dateTo", formatDate(endDate, this.queryDateFormat, this.locale));
        }

        console.log(`getting data for filter=`, filter);
        let rawPoints = await this.getRawMeasurements(filter, measurementService, maxPoints);
        console.log(`got=`, rawPoints);

        return Promise.resolve(this.transform(rawPoints, fragment, series, 2));
    }



    public async getAggregateData(measurementService: MeasurementService,
        deviceId: string,
        fragment: string,
        series: string,
        startDate: Date,
        endDate: Date,
        aggregation: aggregationType): Promise<ChartPoint[]> {

        let filter: ISeriesFilter = {
            aggregationType: aggregation,
            source: deviceId,
            dateFrom: formatDate(startDate, this.queryDateFormat, this.locale),
            dateTo: formatDate(endDate, this.queryDateFormat, this.locale),
            series: [`${fragment}.${series}`]
        };
        console.log(`getting aggregate data for filter=`, filter);
        let rawPoints = await this.getRawAggregateMeasurements(filter, measurementService);
        console.log(`got=`, rawPoints);

        return Promise.resolve(this.transform(rawPoints, fragment, series, 2));
    }


    /**
     * Internal method to get the raw data from cumulocity.
     * 
     * @param filter 
     * @param measurementService 
     * @param maxMeasurements 
     * @returns 
     */
    private async getRawMeasurements(filter: Object,
        measurementService: MeasurementService,
        maxMeasurements: number): Promise<IMeasurement[]> {
        let page = 1;
        _.set(filter, "currentPage", page);
        let result = [];
        let { data, res, paging } = await measurementService.list(filter);
        if (res.status >= 200 && res.status < 300) {
            result = [...data];
            page = paging.nextPage;
            while (page != null && (maxMeasurements == 0 || data.length < maxMeasurements)) {
                //console.log(`requesting page ${page}`);
                // Need to handle errors here and also could there be
                // other status codes to handle?
                let { data, res } = await paging.next();
                if (res.status >= 200 && res.status < 300) {
                    //add next range of stuff...
                    result = [...result, ...data];
                }

                page = paging.nextPage;
            }

            if (maxMeasurements > 0 && data.length > maxMeasurements) {
                data.length = maxMeasurements;
            }
            console.log(`total of ${data.length} points`);
        }
        return Promise.resolve(result);
    }


    /**
     * Internal method to get the raw data from cumulocity.
     * 
     * @param filter 
     * @param measurementService 
     * @param maxMeasurements 
     * @returns 
     */
    private async getRawAggregateMeasurements(filter: ISeriesFilter,
        measurementService: MeasurementService): Promise<IMeasurement[]> {
        let result = [];
        let { data, res } = await measurementService.listSeries(filter);
        console.log(data);
        console.log(res);
        if (res.status >= 200 && res.status < 300) {
            let { series, truncated, values } = data;
            //transform the data into a format that chart.js can use
            result = this.transformSeriesData(values, 2).reverse();
        }
        return Promise.resolve(result);
    }



    /**
     * Internal method for simplifying raw data. Reduce the
     * data received into plotable points.
     *
     * @param data 
     * @param fragment 
     * @param series 
     * @param numdp
     * @param swapAxes
     * @returns
     */
    private transform(data: IMeasurement[],
        fragment: string,
        series: string,
        numdp: number,
        swapAxes: boolean = false) {
        let result: ChartPoint[] = data.reduce((chartPoints, row) => {
            let cp: ChartPoint = {
                x: new Date(row.time),
                y: 0
            };

            //need the fragment, series
            if (_.has(row, fragment)) {
                let frag = _.get(row, fragment);
                if (_.has(frag, series)) {
                    let ser = _.get(frag, series);
                    //if there is a group by we need to either sum or average the
                    //value for the current set of measurements
                    cp.y = parseFloat(parseFloat(ser.value).toFixed(numdp));
                }
            }

            //horizontal bar graph
            if (swapAxes) {
                cp = {
                    x: cp.y,
                    y: cp.x
                };
            }

            chartPoints.push(cp);
            return chartPoints;
        }, []);

        console.log("result", result);
        return result.reverse();
    }


    private transformSeriesData(data: {
        [date: string]: Array<{
            min: number;
            max: number;
        }>;
    }, numdp, swapAxes: boolean = false) {

        let result: ChartPoint[] = [];
        _.forOwn(data, (value, key) => {
            console.log("V=", value[0], "K=", key);
            let cp: ChartPoint = {
                x: Date.parse(key),
                y: parseFloat((value[0].min).toFixed(numdp))
            };
            if (swapAxes) {
                cp = {
                    x: cp.y,
                    y: cp.x
                };
            }
            result.push(cp);
        });



        console.log("result", result);
        return result.reverse();
    }

}

