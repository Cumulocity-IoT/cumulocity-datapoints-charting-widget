/**
 * /*
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
 *
 * @format
 */

import { CoreModule, HOOK_COMPONENTS } from "@c8y/ngx-components";
import { CumulocityDatapointsChartingWidgetConfig } from "./cumulocity-datapoints-charting-widget.config.component";
import { CumulocityDatapointsChartingWidget } from "./cumulocity-datapoints-charting-widget.component";
import { NgModule } from "@angular/core";
import { HttpClientModule } from "@angular/common/http";
import { NgSelectModule } from "@ng-select/ng-select";
import { ChartsModule } from "ng2-charts";

@NgModule({
    imports: [CoreModule, HttpClientModule, NgSelectModule, ChartsModule],
    declarations: [CumulocityDatapointsChartingWidget, CumulocityDatapointsChartingWidgetConfig],
    entryComponents: [CumulocityDatapointsChartingWidget, CumulocityDatapointsChartingWidgetConfig],
    providers: [
        {
            provide: HOOK_COMPONENTS,
            multi: true,
            useValue: {
                id: "global.presales.CumulocityDataPointsCharting.widget",
                label: "Data Points Charting",
                description: "Graph measurements and statistics about measurements",
                component: CumulocityDatapointsChartingWidget,
                configComponent: CumulocityDatapointsChartingWidgetConfig,
                previewImage: require("@widget-assets/img-preview.png"),
                data: {
                    ng1: {
                        options: { noDeviceTarget: true, noNewWidgets: false, deviceTargetNotRequired: true, groupsSelectable: true },
                    },
                },
            },
        },
    ],
})
export class CumulocityDatapointsChartingWidgetModule { }
