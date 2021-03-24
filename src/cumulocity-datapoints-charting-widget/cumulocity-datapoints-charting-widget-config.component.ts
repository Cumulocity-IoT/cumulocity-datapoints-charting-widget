/** @format */

import { Component, ElementRef, Input, OnInit, ViewChild } from "@angular/core";
import { Observable, of } from "rxjs";
import { FetchClient, InventoryService } from "@c8y/ngx-components/api";
import { IResultList, IManagedObject, IdReference, IResult, IFetchResponse } from "@c8y/client";

import { ListItem, WidgetConfig } from "./widget-config";

import * as _ from "lodash";
import { WidgetHelper } from "./widget-helper";
import * as moment from "moment";

@Component({
    templateUrl: "cumulocity-datapoints-charting-widget-config.component.html",
    styleUrls: ["cumulocity-datapoints-charting-widget-config.component.css"],
})
export class CumulocityDataPointsChartingWidgetConfig implements OnInit {
    //
    // All chosen options reside in the config
    //
    @Input() config: any = {};
    @ViewChild("#seriesDiv", { static: true }) seriesDiv;

    public CONST_HELP_IMAGE_FILE =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAADdgAAA3YBfdWCzAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAATzSURBVGiB7VlrTBxVFP7usLu8kUeBLSAFipUqFg1Qq5EgaCU2/DAxpYqJCVExmNC0Km1jolmbxgSCKbWoITG+oq1Ba6M1mvQHqxJTEyS0aEBiSyvIY2F5dl32Mczxh1WZndmdubOoTeD7d88995zvzH2cM/cC61jH2gZbFSs2m2B1l5VIEMoYUArgFgBZAa5GARogRj0CE7ono77uhc0mhes6rAAyD9iz/MQamUCPgZDJOXwUhA9FUWqfOXrfmFEOhgLIPtSd5JXEwwCeAhBp1Pk1eMDQ4fXCNt9WMc87mDsA68GuGiLWDiCVd6wGHAR6Zqql8lOeQfoDqP/BnJ7oageonpsaB4jw+lQs9sFWIerR1xVAqs0eJyyxUyB6IDx6+kDAV0zy7Xa0Vv2upStoKeQ3fhkpuPHFf0UeABjwIATLmVttnRYtXc0AXFFRRwGUrwozPlQ4l1JbtJRCLqH0JvseMHy0epz4QaCHQ23soAFsOHA2I4JZBkGUoNcZY8CO3CRUF1lRdGM8Yi0mAIBPlHBx2o2uwWmc6XfAJ/LkLzYLybvV0Vo1pdZrCjYsAubDPOQTos048lAB7t6cpNqfEmfBnbmJqN2RiYOfDOLilOb+vAZKZoLlZQANar2qM2A9ZM8hCb8gRIArYRIYOh7fhqKsG3RRcrp8qOnoxeKSX5c+AH8EE/PHm3eOBHaobmJaxtPQSR4AqovSFeRFidBzZR7nhufg9i/L+jbEWVC7navyMC+TSTX/KAOw2U1gqOOxvqswTdb2ixLq37+Ahg/60XjiR9S8qfza5VuSeVwAYHXY3RkRKFUEkLYkbQeQzmM6LzVW1u4amkH/b4t/tycXPbAPzch0spKjeVwAoAxrbkpxoFQRACOhgtMyEmPMsvbo7JJCx+WVVwbE6wQAoOSmts5LeM2WHPlWU6d4k3yPXJ7WewqtAENpoEhtE9/Ebzk0HinNRIE1Xib7/LyD2w4RtgTKVAJgG7kth0B1UTr278yTyfpGFnC6b8KIOQU3tSUUZ8SyGmpKMtBUlQ+2Ittcdrrx3McDkIxtgvhAgcoM0Kr8J2/LSsDzVZtl5H+dcWPvyZ94Epgm1JbQ1dUw3HBvDoQV7CcWPHjyvQuYWPCEY1bBTW0GDC3OlYiLNOGObPmp8+JnQ5hzh/3lFdyUeYDh53C9bEqJgUn45+uPz3twfmQhXLOACjdFAEToC9dPQpQ841+adodrEgDACL2BMsUpREyyM9L8UQuJc8NzupIbPyR7oETBdCq6+3uAKcrW/x9seLKlsidQqlKN2iQQnQjHlUlgaCjPwbt1t+N47W3YulFxfBsAnQSYInuo/w+Yl9sAKCsyndhTmoknyrJRmJmAu/KS8NqjhYgxKyphHrgiltGm1qEawNQr9zuI8LZRb8U5ibJ2UowZeWmxQbR14a3xVyucah1Bd6voWXoBKueuHozNySdPlMh4AmMYW4b5pWDdQQOYPb5rEYT9Rny+890oBib+TJp+UULr2UuYcfmMmAIR7XW23BO0OtCse6xNXW8QY6o3AlrYEGfBVa8Ir9/gMwDDMUdzxb5QKpoH/uQVZyMYThvx73T5DJNnDKcc0d88q6mnx9j1fLm7Nq7XV+J6e+DgLnommys7IwXTzQDaAXh5x6vAA4ZjXh8KeMkDa/WRT4Hgz6x/3fTO/VvPrOtYx1rHHxm4yOkGvwZ0AAAAAElFTkSuQmCC";
    widgetHelper: WidgetHelper<WidgetConfig>;

    //
    // source data for config
    //
    devices: Observable<ListItem[]>;
    supportedSeries: ListItem[];

    selectedSeries: string;
    getSelectedSeries(): string {
        return this.selectedSeries;
    }
    //
    // Helper methods
    //
    async getDeviceList(): Promise<IResultList<IManagedObject>> {
        let devs = this.inventory.list({
            pageSize: 100,
            fragmentType: "c8y_IsDevice",
        });
        return devs;
    }

    async getDeviceDetail(id: IdReference): Promise<IResult<IManagedObject>> {
        return this.inventory.detail(id);
    }

    async fetchSeries(id): Promise<string[]> {
        let resp: IFetchResponse = await this.fetchclient.fetch("/inventory/managedObjects/" + id + "/supportedSeries");
        let body = await resp.json();
        return body.c8y_SupportedSeries;
    }

    /**
     * Constructs config object and injects inventory/fetch
     * services so we can get objects and make api calls
     * @param inventory
     * @param fetchclient
     */
    constructor(private inventory: InventoryService, private fetchclient: FetchClient) {
        this.widgetHelper = new WidgetHelper(this.config, WidgetConfig); //default
    }

    /**
     * Setup config, create the list of devices and populate
     * data for controls
     */
    async ngOnInit(): Promise<void> {
        this.widgetHelper = new WidgetHelper(this.config, WidgetConfig); //use config

        //set the devices observable for the config form
        let deviceList = await this.getDeviceList();
        this.devices = of(
            deviceList.data
                .map((item) => {
                    return { id: item.id, text: item.name };
                })
                .filter((item) => {
                    return item.text !== undefined;
                })
        );

        //this.updateSelectedMeasurements();
        this.updateConfig();
    }

    /**
     * In response to the device selection get the
     * possible selections for the measurements
     * @param devices
     * @returns
     */
    async getSupportedSeries(devices: ListItem[]): Promise<ListItem[]> {
        let local: ListItem[] = [];
        if (devices) {
            for (let index = 0; index < devices.length; index++) {
                const dev = devices[index];
                let current: ListItem[] = (await this.fetchSeries(dev.id)).map((m) => {
                    return {
                        id: dev.id + "." + m,
                        text: `${m}(${dev.text})`,
                    };
                });
                local = [...local, ...current];
            }
        }
        return local;
    }

    /**
     * respond to changes in options, record in config
     */
    async updateSelectedMeasurements() {
        this.widgetHelper.getChartConfig().clearSeries(this.widgetHelper.getWidgetConfig().selectedMeasurements);
        this.widgetHelper.getWidgetConfig().selectedMeasurements.forEach((v, i) => {
            this.widgetHelper
                .getChartConfig()
                .addSeries(v.id, v.text, this.widgetHelper.getChartConfig().colorList[i], this.widgetHelper.getChartConfig().avgColorList[i]);
        });
    }

    showSection(id) {
        if (this.selectedSeries === id) {
            this.selectedSeries = "";
        } else {
            this.selectedSeries = id;
        }
    }

    /**
     * respond to changes in options, record in config
     */
    async updateConfig() {
        let conf = this.widgetHelper.getWidgetConfig();
        let chart = this.widgetHelper.getChartConfig();
        if (chart && conf.selectedDevices && conf.selectedDevices.length > 0) {
            let checklist = new Set([]);
            for (let index = 0; index < conf.selectedDevices.length; index++) {
                checklist.add(conf.selectedDevices[index].id);
            }
            let newSelected: ListItem[] = [];
            if (conf.selectedMeasurements && conf.selectedMeasurements.length > 0) {
                for (let index = 0; index < conf.selectedMeasurements.length; index++) {
                    if (checklist.has(conf.selectedMeasurements[index].id.split(".")[0])) newSelected.push(conf.selectedMeasurements[index]);
                }
            }
            conf.selectedMeasurements = newSelected;

            this.supportedSeries = await this.getSupportedSeries(conf.selectedDevices);
        }

        let fmt = this.widgetHelper.getChartConfig().rangeDisplay[
            this.widgetHelper.getChartConfig().rangeUnits[this.widgetHelper.getChartConfig().timeFormatType].text
        ];

        if (this.widgetHelper.getChartConfig().customFormat) {
            fmt = this.widgetHelper.getChartConfig().customFormatString;

            this.widgetHelper.getChartConfig().rangeDisplay[
                this.widgetHelper.getChartConfig().rangeUnits[this.widgetHelper.getChartConfig().timeFormatType].text
            ] = fmt; //store custom in list
        }
        this.widgetHelper.getChartConfig().dateExample = moment().format(fmt);

        //Some charts need certain defaults
        if (this.widgetHelper.getChartConfig().multivariateplot === true && this.widgetHelper.getChartConfig().getChartType() !== "radar") {
            this.widgetHelper.getChartConfig().groupby = true;
        }

        //Some charts need certain defaults
        if (
            (this.widgetHelper.getChartConfig().getChartType() === "scatter" || this.widgetHelper.getChartConfig().getChartType() === "bubble") &&
            this.widgetHelper.getChartConfig().showPoints == 0
        ) {
            this.widgetHelper.getChartConfig().showPoints = 4;
        }

        //Bar and Doughnut should be time based
        if (this.widgetHelper.getChartConfig().getChartType() === "bar" || this.widgetHelper.getChartConfig().getChartType() === "horizontalBar") {
            this.widgetHelper.getChartConfig().multivariateplot = false;
        }
        this.widgetHelper.setWidgetConfig(this.config);
    }
}
