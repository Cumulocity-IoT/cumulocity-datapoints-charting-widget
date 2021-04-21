/** @format */

import { NgModule } from "@angular/core";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { RouterModule as NgRouterModule } from "@angular/router";
import { UpgradeModule as NgUpgradeModule } from "@angular/upgrade/static";
import { CumulocityDatapointsChartingWidget } from "./src/cumulocity-datapoints-charting-widget/cumulocity-datapoints-charting-widget.component";
import { CumulocityDatapointsChartingWidgetConfig } from "./src/cumulocity-datapoints-charting-widget/cumulocity-datapoints-charting-widget.config.component";
import { CoreModule, HOOK_COMPONENTS, RouterModule } from "@c8y/ngx-components";
import { DashboardUpgradeModule, UpgradeModule, HybridAppModule, UPGRADE_ROUTES } from "@c8y/ngx-components/upgrade";
import { AssetsNavigatorModule } from "@c8y/ngx-components/assets-navigator";
import { CockpitDashboardModule } from "@c8y/ngx-components/context-dashboard";
import { ReportsModule } from "@c8y/ngx-components/reports";
import { SensorPhoneModule } from "@c8y/ngx-components/sensor-phone";
import { ProductExperienceModule } from "@c8y/ngx-components/product-experience";
import { BinaryFileDownloadModule } from "@c8y/ngx-components/binary-file-download";
import { NgMultiSelectDropDownModule } from "ng-multiselect-dropdown";
import { ChartsModule } from "ng2-charts";
import * as _ from "lodash";

@NgModule({
    declarations: [CumulocityDatapointsChartingWidget, CumulocityDatapointsChartingWidgetConfig], // 1.
    entryComponents: [CumulocityDatapointsChartingWidget, CumulocityDatapointsChartingWidgetConfig],
    providers: [
        {
            provide: HOOK_COMPONENTS, // 2.
            multi: true,
            useValue: [
                {
                    id: "global.presales.cumulocity.datapoints.charting.widget",
                    label: "CumulocityDatapointsCharting Widget",
                    description: "CumulocityDatapointsCharting Widget",
                    previewImage: require("./styles/previewImage.png"),
                    component: CumulocityDatapointsChartingWidget,
                    configComponent: CumulocityDatapointsChartingWidgetConfig,
                    data: {
                        ng1: {
                            options: { noDeviceTarget: false, noNewWidgets: false, deviceTargetNotRequired: false, groupsSelectable: true },
                        },
                    },
                },
            ],
        },
    ],
    imports: [
        // Upgrade module must be the first
        UpgradeModule,
        BrowserAnimationsModule,
        RouterModule.forRoot(),
        NgRouterModule.forRoot([...UPGRADE_ROUTES], { enableTracing: false, useHash: true }),
        CoreModule.forRoot(),
        AssetsNavigatorModule,
        ReportsModule,
        NgUpgradeModule,
        DashboardUpgradeModule,
        CockpitDashboardModule,
        SensorPhoneModule,
        ProductExperienceModule,
        BinaryFileDownloadModule,
        NgMultiSelectDropDownModule,
        ChartsModule,
    ],
})
export class AppModule extends HybridAppModule {
    constructor(protected upgrade: NgUpgradeModule) {
        super();
    }
}
