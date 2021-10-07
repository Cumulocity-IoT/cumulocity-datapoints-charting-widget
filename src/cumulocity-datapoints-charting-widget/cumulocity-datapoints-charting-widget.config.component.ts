/*
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
 */
import { Component, Input, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { WidgetHelper } from "./widget-helper";
import { RawListItem, WidgetConfig } from "./widget-config";
import { IResultList, IManagedObject, IdReference, IResult, IFetchResponse } from "@c8y/client";
import { FetchClient, InventoryService } from '@c8y/ngx-components/api';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { deleteDB } from 'idb';
import * as _ from 'lodash';
import * as moment from "moment";
import { AlertService } from '@c8y/ngx-components';


@Component({
    selector: "cumulocity-datapoints-charting-widget-config-component",
    templateUrl: "./cumulocity-datapoints-charting-widget.config.component.html",
    styleUrls: ["./cumulocity-datapoints-charting-widget.config.component.css"]
})
export class CumulocityDatapointsChartingWidgetConfig implements OnInit, OnDestroy {
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
    public rawDevices: BehaviorSubject<RawListItem[]>;
    public supportedSeries: BehaviorSubject<RawListItem[]>;

    //rawDevices: RawListItem[];
    //supportedSeries: RawListItem[];

    selectedSeries: string;

    /**
     * Constructs config object and injects inventory/fetch
     * services so we can get objects and make api calls
     * @param inventory
     * @param fetchclient
     */
    constructor(private inventory: InventoryService, private fetchclient: FetchClient, public alertService: AlertService) {
        this.widgetHelper = new WidgetHelper(this.config, WidgetConfig); //default
        this.rawDevices = new BehaviorSubject<RawListItem[]>([]);
        this.supportedSeries = new BehaviorSubject<RawListItem[]>([]);
    }

    /**
     * Setup config, create the list of devices and populate
     * data for controls
     */
    async ngOnInit(): Promise<void> {
        this.widgetHelper = new WidgetHelper(this.config, WidgetConfig); //use config

        if (this.widgetHelper.getDeviceTarget()) {
            let { data, res } = await this.getDeviceDetail(this.widgetHelper.getDeviceTarget());
            if (res.status >= 200 && res.status < 300) {
                let v: RawListItem = { id: data.id, text: data.name, isGroup: false };
                this.widgetHelper.getWidgetConfig().selectedDevices = [v];
            } else {
                this.alertService.danger(`There was an issue getting device details, please refresh the page.`);
                return;
            }
        } else {
            //set the devices observable for the config form
            let deviceList = await this.getDevicesAndGroups();
            this.rawDevices.next(deviceList
                .map((item) => {
                    let v: RawListItem = { id: item.id, text: item.name, isGroup: item.isGroup };
                    return v;
                })
                .filter((item) => {
                    return item.text !== undefined;
                }));
        }

        this.updateConfig();
    }

    ngOnDestroy(): void {
        //unsubscribe from observables here
    }


    onConfigChanged(): void {
        //console.log("CONFIG-CHANGED");
        //console.log(this.config);
        this.widgetHelper.setWidgetConfig(this.config); //propgate changes 
    }


    getSelectedSeries(): string {
        return this.selectedSeries;
    }
    //
    // Helper methods
    //
    async getDeviceList(): Promise<IResultList<IManagedObject>> {
        const filter: object = {
            pageSize: 2000,
            withTotalPages: true,
        };

        const query = {
            name: "*",
        };

        //const { data, res, paging } = await
        return this.inventory.listQueryDevices(query, filter);
    }

    async getDevicesAndGroups(): Promise<IManagedObject[]> {
        let retrieved: IManagedObject[] = [];

        const filter2: object = {
            pageSize: 2000,
            withTotalPages: true,
            query: "((not(has(c8y_IsDynamicGroup.invisible))) and ((type eq 'c8y_DeviceGroup') or (type eq 'c8y_DynamicGroup') or has( c8y_IsDeviceGroup ) or has(c8y_Connection) ))",
        };

        let result = await this.inventory.list(filter2);
        if (result.res.status === 200) {
            do {
                result.data.forEach((mo) => {
                    _.set(mo, "isGroup", true);
                    retrieved.push(mo);
                });

                if (result.paging.nextPage) {
                    result = await result.paging.next();
                }
            } while (result.paging && result.paging.nextPage);
        }

        result = await this.getDeviceList();
        if (result.res.status === 200) {
            do {
                result.data.forEach((mo) => {
                    _.set(mo, "isGroup", false);
                    retrieved.push(mo);
                });

                if (result.paging.nextPage) {
                    result = await result.paging.next();
                }
            } while (result.paging && result.paging.nextPage);
        }
        return retrieved;
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
 * map the raw devices to a list of index/name for the dropdown.
 *
 * @returns observable for the devices/groups we have retrieved
 */
    getDeviceDropdownList$(): Observable<RawListItem[]> {
        // let ddList = [];
        // if (this.rawDevices && this.rawDevices.length > 0) {
        //     ddList = this.rawDevices.map((item, index) => {
        //         return { id: index, text: item.text };
        //     });
        // }
        return this.rawDevices;
    }

    getSupportedSeries$(): Observable<RawListItem[]> {
        // let ddList = [];
        // if (this.rawDevices && this.rawDevices.length > 0) {
        //     ddList = this.rawDevices.map((item, index) => {
        //         return { id: index, text: item.text };
        //     });
        // }
        return this.supportedSeries;
    }

    async getDevicesForGroup(id: string): Promise<IManagedObject[]> {
        let retrieved: IManagedObject[] = []; //could be empty.

        //get the 3 types of children for the node at id.
        const childFilter: object = {
            pageSize: 2000,
            withTotalPages: true,
            query: "(not(has(c8y_Dashboard)))",
        };

        //get the additions
        let result: IResultList<IManagedObject> = await this.inventory.childAdditionsList(id, childFilter);

        if (result.res.status === 200) {
            do {
                result.data.forEach((mo) => {
                    if (_.has(mo, "c8y_IsDevice")) {
                        retrieved.push(mo);
                    }
                });

                if (result.paging.nextPage) {
                    result = await result.paging.next();
                }
            } while (result.paging && result.paging.nextPage);
        }

        //get the assets
        result = await this.inventory.childAssetsList(id, childFilter);

        if (result.res.status === 200) {
            do {
                result.data.forEach((mo) => {
                    if (_.has(mo, "c8y_IsDevice")) {
                        retrieved.push(mo);
                    }
                });
                if (result.paging.nextPage) {
                    result = await result.paging.next();
                }
            } while (result.paging && result.paging.nextPage);
        }

        //get the assets
        result = await this.inventory.childDevicesList(id, childFilter);

        if (result.res.status === 200) {
            do {
                result.data.forEach((mo) => {
                    retrieved.push(mo);
                });

                if (result.paging.nextPage) {
                    result = await result.paging.next();
                }
            } while (result.paging && result.paging.nextPage);
        }
        return Promise.resolve(retrieved);
    }

    /**
     * In response to the device selection get the
     * possible selections for the measurements
     * @param devices
     * @returns
     */
    async getSupportedSeries(devices: RawListItem[]): Promise<RawListItem[]> {
        let local: RawListItem[] = [];
        if (devices) {
            for (let index = 0; index < devices.length; index++) {
                const dev: RawListItem = devices[index];
                //is it a group
                if (dev.isGroup) {
                    //get the child devices and generate the list of ids to process
                    let actualDevices = await this.getDevicesForGroup(dev.id);

                    for (let index = 0; index < actualDevices.length; index++) {
                        const device = actualDevices[index];
                        let current: RawListItem[] = (await this.fetchSeries(device.id)).map((m) => {
                            return {
                                id: device.id + "." + m,
                                text: `${m}(${dev.text}/${device.name})`,
                                isGroup: true,
                                groupname: dev.text,
                            };
                        });
                        local = [...local, ...current];
                    }
                } else {
                    let current: RawListItem[] = (await this.fetchSeries(dev.id)).map((m) => {
                        return {
                            id: dev.id + "." + m,
                            text: `${m}(${dev.text})`,
                            isGroup: false,
                            groupname: "default",
                        };
                    });
                    local = [...local, ...current];
                }
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
            //console.log("CURRENT SELECTED = ", v);
            this.widgetHelper
                .getChartConfig()
                .addSeries(
                    [v.id],
                    v.text,
                    this.widgetHelper.getChartConfig().colorList[i],
                    this.widgetHelper.getChartConfig().avgColorList[i],
                    v.groupname
                );
            //add a series for the group - this will be controlled via a flag as well...
            if (v.isGroup && !(v.groupname in this.widgetHelper.getChartConfig().series)) {
                //console.log("CREATING ", v.groupname);

                this.widgetHelper.getChartConfig().addSeries(
                    [v.id], //create and add the source device
                    v.groupname,
                    this.widgetHelper.getChartConfig().colorList[i],
                    this.widgetHelper.getChartConfig().avgColorList[i],
                    v.groupname,
                    true
                );
            } else if (v.isGroup && v.groupname in this.widgetHelper.getChartConfig().series) {
                //add this device if
                //console.log("ADDING device to ", v.groupname);
                this.widgetHelper.getChartConfig().series[v.groupname].idList.push(v.id);
            }
        });
    }

    showSection(id) {
        if (this.selectedSeries === id) {
            this.selectedSeries = "";
        } else {
            this.selectedSeries = id;
        }
    }

    async clearCache() {
        let dbName = "cumulocity-datapoints-charting-widget-db";
        await deleteDB(dbName, { blocked: () =>console.log(`Waiting to Removing DB ${dbName}`) });
    }

    /**
     * respond to changes in options, record in config
     */
    async updateConfig() {
        let conf = this.widgetHelper.getWidgetConfig();
        let chart = this.widgetHelper.getChartConfig();
        conf.changed = true;
        // get the list of possible fragments
        if (chart && conf.selectedDevices && conf.selectedDevices.length > 0) {
            let checklist = new Set([]);

            for (let index = 0; index < conf.selectedDevices.length; index++) {
                checklist.add(conf.selectedDevices[index].id);
            }

            let newSelected: RawListItem[] = [];
            if (conf.selectedMeasurements && conf.selectedMeasurements.length > 0) {
                for (let index = 0; index < conf.selectedMeasurements.length; index++) {
                    if (checklist.has(conf.selectedMeasurements[index].id.split(".")[0])) {
                        newSelected.push(conf.selectedMeasurements[index]);
                    }
                }
            }

            this.supportedSeries.next(await this.getSupportedSeries(conf.selectedDevices));
        }

        //Formats
        let fmt =
            this.widgetHelper.getChartConfig().rangeDisplay[
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
        if (this.widgetHelper.getChartConfig().multivariateplot === true) {
            if (this.widgetHelper.getChartConfig().getChartType() !== "radar") {
                this.widgetHelper.getChartConfig().groupby = true;
            }
            this.widgetHelper.getChartConfig().realtime = "timer";
        } else {
            this.widgetHelper.getChartConfig().realtime = "realtime";
        }

        //Some charts need certain defaults
        if (
            (this.widgetHelper.getChartConfig().getChartType() === "scatter" || this.widgetHelper.getChartConfig().getChartType() === "bubble") &&
            this.widgetHelper.getChartConfig().showPoints == 0
        ) {
            this.widgetHelper.getChartConfig().showPoints = 4;
        }

        //Bar and horizontalBar should be time based
        if (
            this.widgetHelper.getChartConfig().getChartType() === "bar" ||
            this.widgetHelper.getChartConfig().getChartType() === "horizontalBar" ||
            this.widgetHelper.getChartConfig().getChartType() === "pie" ||
            this.widgetHelper.getChartConfig().getChartType() === "doughnut"
        ) {
            this.widgetHelper.getChartConfig().multivariateplot = false;
        }
        this.widgetHelper.setWidgetConfig(this.config);
    }


}