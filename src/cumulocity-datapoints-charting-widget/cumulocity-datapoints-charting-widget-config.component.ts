/** @format */

import { Component, ElementRef, Input, OnInit, ViewChild } from "@angular/core";
import { Observable, of } from "rxjs";
import { FetchClient, InventoryService } from "@c8y/ngx-components/api";
import {
  IResultList,
  IManagedObject,
  IdReference,
  IResult,
  IFetchResponse,
} from "@c8y/client";

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
    //    //console.log(`getting devices`);
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
    let resp: IFetchResponse = await this.fetchclient.fetch(
      "/inventory/managedObjects/" + id + "/supportedSeries"
    );
    let body = await resp.json();
    return body.c8y_SupportedSeries;
  }

  /**
   * Constructs config object and injects inventory/fetch
   * services so we can get objects and make api calls
   * @param inventory
   * @param fetchclient
   */
  constructor(
    private inventory: InventoryService,
    private fetchclient: FetchClient
  ) {
    this.widgetHelper = new WidgetHelper(this.config, WidgetConfig); //default
  }

  /**
   * Setup config, create the list of devices and populate
   * data for controls
   */
  async ngOnInit(): Promise<void> {
    this.widgetHelper = new WidgetHelper(this.config, WidgetConfig); //use config
    //console.log(`Config :`, this.widgetHelper.getWidgetConfig());

    //set the devices obsevable for the config form
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
    //console.log("Get Supported series", devices);
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
    // //console.log(local);
    return local;
  }

  /**
   * respond to changes in options, record in config
   */
  async updateSelectedMeasurements() {
    //console.log("Updating...Measurements");

    this.widgetHelper
      .getChartConfig()
      .clearSeries(this.widgetHelper.getWidgetConfig().selectedMeasurements);
    this.widgetHelper.getWidgetConfig().selectedMeasurements.forEach((v, i) => {
      this.widgetHelper
        .getChartConfig()
        .addSeries(
          v.id,
          v.text,
          this.widgetHelper.getChartConfig().colorList[i],
          this.widgetHelper.getChartConfig().avgColorList[i]
        );
    });
  }

  showSection(id) {
    if (this.selectedSeries === id) {
      this.selectedSeries = "";
    } else {
      this.selectedSeries = id;
    }

    //console.log(id);
  }

  /**
   * respond to changes in options, record in config
   */
  async updateConfig() {
    //console.log("Updating...");

    let conf = this.widgetHelper.getWidgetConfig();
    let chart = this.widgetHelper.getChartConfig();
    if (chart && conf.selectedDevices && conf.selectedDevices.length > 0) {
      let checklist = new Set([]);
      for (let index = 0; index < conf.selectedDevices.length; index++) {
        checklist.add(conf.selectedDevices[index].id);
      }
      //console.log(checklist);
      //console.log(conf.selectedMeasurements);
      let newSelected: ListItem[] = [];
      if (conf.selectedMeasurements && conf.selectedMeasurements.length > 0) {
        for (let index = 0; index < conf.selectedMeasurements.length; index++) {
          if (checklist.has(conf.selectedMeasurements[index].id.split(".")[0]))
            newSelected.push(conf.selectedMeasurements[index]);
        }
      }
      conf.selectedMeasurements = newSelected;

      this.supportedSeries = await this.getSupportedSeries(
        conf.selectedDevices
      );
    }

    console.log(
      `range type: ${this.widgetHelper.getChartConfig().timeFormatType}`,
      this.widgetHelper.getChartConfig().timeFormatType
    );

    this.widgetHelper.getChartConfig().dateExample = moment().format(
      this.widgetHelper.getChartConfig().rangeDisplay[
        this.widgetHelper.getChartConfig().rangeUnits[
          this.widgetHelper.getChartConfig().timeFormatType
        ].text
      ]
    );

    this.widgetHelper.setWidgetConfig(this.config);
  }
}