/** @format */

import { CoreModule, HOOK_COMPONENTS } from "@c8y/ngx-components";
import { CumulocityDataPointsChartingWidgetConfig as CumulocityDataPointsChartingWidgetConfig } from "./cumulocity-datapoints-charting-widget-config.component";
import { CumulocityDataPointsChartingWidget as CumulocityDataPointsChartingWidget } from "./cumulocity-datapoints-charting-widget.component";
import { NgModule } from "@angular/core";
import { NgMultiSelectDropDownModule } from "ng-multiselect-dropdown";
import { ColorPickerModule } from "ngx-color-picker";
import { ChartsModule } from "ng2-charts";
//import { HttpClientModule } from "@angular/common/http";

// This will import css from the styles folder (Note: will be applied globally, not scoped to the module/components)
import "~styles/index.css";

// You can also import css from a module
// import 'some-module/styles.css'

@NgModule({
    imports: [CoreModule, NgMultiSelectDropDownModule, ColorPickerModule, ChartsModule],
    declarations: [CumulocityDataPointsChartingWidget, CumulocityDataPointsChartingWidgetConfig],
    entryComponents: [CumulocityDataPointsChartingWidget, CumulocityDataPointsChartingWidgetConfig],
    providers: [
        // Connect the widget to Cumulocity via the HOOK_COMPONENT injection token
        {
            provide: HOOK_COMPONENTS,
            multi: true,
            useValue: {
                id: "global.presales.CumulocityDataPointsCharting.widget",
                label: "Data Points Charting",
                description: "Graph measurements and statistics about measurements",
                component: CumulocityDataPointsChartingWidget,
                configComponent: CumulocityDataPointsChartingWidgetConfig,
                previewImage: require("~styles/previewImage.png"),
                data: {
                    settings: {
                        noDeviceTarget: true,
                    },
                },
            },
        },
    ],
})
export class CumulocityDataPointsChartingWidgetModule {}
