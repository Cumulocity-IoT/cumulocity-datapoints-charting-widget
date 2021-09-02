/**
 * WidgetHelper is a utility class that will provide useful function to
 * authors when creating new widgets for Cumulocity.
 *
 * The main hook is to create an instance of the class in your widget
 * and then use whatever functionality you need.
 *
 * Widgets have config in cumulocity which gets updated when you
 * invoke the config page for the widget. This class wraps that
 * and provides useful common functionally on top.
 *
 * @format
 */

import * as _ from "lodash";
import { v4 as uuidv4 } from "uuid";
import { ChartConfig } from "./widget-charts";
import { MeasurementHelper } from "./widget-measurements";

/**
 * The C8Y process has a standard member "config". This member has
 * the data from the config screen in it along with standard data
 * that might be set. We create a member of the config option containing
 * our set of configuration data.
 *
 * typically each widget class that accesses the config data (to set or retrieve)
 * will have an instance of this class. It will be created in the constructor
 * to default the config and ngInit to make sure it is up to date.
 *
 * The CONFIGTYPE generic is the class of WidgetConfig (or extended type TBD)
 */
export class WidgetHelper<CONFIGTYPE> {
    /**
     * The following 2 members are for checking types
     * do not store data in these!!!!
     */
    private reference: CONFIGTYPE;
    private chartRef: ChartConfig;

    /**
     *  member that holds the actual data
     */
    private config: CONFIGTYPE;
    private measurements: MeasurementHelper;
    private rawConfig: any;

    /**
     *
     * E.G. let h = new WidgetHelper(config, MyConfigType); // type argument inference
     *
     * @param c is the configuration member supplied by default
     * @param ConfigCreator The type of the Custom Widget Class
     */
    constructor(c: Object, ConfigCreator: new () => CONFIGTYPE) {
        this.rawConfig = c;
        this.reference = new ConfigCreator(); //template
        this.chartRef = new ChartConfig(); //NOT for data

        // only set if it doesn't exist
        if (!_.has(c, "customwidgetdata")) {
            this.config = new ConfigCreator();
            console.log("Create new config", this.config);
        } else {
            // because this is stored and retrieved from mongo db
            // reset the prototype and leave the data
            console.log("Exists", c);
            this.config = _.get(c, "customwidgetdata");
            if (Object.getPrototypeOf(this.config) !== Object.getPrototypeOf(this.reference)) {
                Object.setPrototypeOf(this.config, Object.getPrototypeOf(this.reference));
            }
        }
    }

    getDeviceTarget(): string | undefined {
        if (_.has(this.rawConfig, "device")) {
            //console.log("DEVICE");
            return this.rawConfig["device"].id;
        } else if (_.has(this.rawConfig, "settings")) {
            //console.log("SETTINGS");
            if (_.has(this.rawConfig["settings"], "context")) {
                //console.log("CONTEXT");
                return this.rawConfig["settings"]["context"].id;
            }
        }
        return undefined;
    }

    /**
     * Use this member when accessing the configuration data
     *
     * @returns a reference to the widgets configuration with class methods
     */
    getWidgetConfig(): CONFIGTYPE {
        return this.config;
    }

    /**
     * Set the customwidgetdata member with the current config
     * typically call this when updating the config in a form
     *
     * @param c config member from the custom widget
     */
    setWidgetConfig(c: any) {
        _.set(c, "customwidgetdata", this.config);
    }

    getUniqueID(): string {
        if (!_.has(this.config, "uuid")) {
            _.set(this.config, "uuid", uuidv4());
        }
        //console.log(this.config);
        return _.get(this.config, "uuid");
    }

    /**
 * If an object exists it will be returned with the correct prototype
 * If it doesn't it will be created and a default returned.
 *
 * @returns Chart config object attached to the general configuration
 */
    getChartConfig(): ChartConfig {
        let chartConfig: ChartConfig;
        if (_.has(this.config, "chart")) {
            chartConfig = _.get(this.config, "chart");
            if (Object.getPrototypeOf(chartConfig) !== Object.getPrototypeOf(this.chartRef)) {
                Object.setPrototypeOf(chartConfig, Object.getPrototypeOf(this.chartRef));
            }
        } else {
            //add new ? or perhaps throw if we get more serious
            chartConfig = _.set(this.config, "chart", new ChartConfig());
        }
        return chartConfig;
    }

    getMeasurements(): MeasurementHelper {
        if (!this.measurements) {
            this.measurements = new MeasurementHelper();
        }
        return this.measurements;
    }
}
