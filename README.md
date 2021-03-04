<!-- @format -->

# Measurement Chart Widget[<img width="35" src="https://user-images.githubusercontent.com/67993842/97668428-f360cc80-1aa7-11eb-8801-da578bda4334.png"/>](https://github.com/SoftwareAG/cumulocity-measurment-chart-widget/releases/download/1.0.0/measurement-chart-widget-v1.0.0.zip)

The Measurement Chart Widget allows you to create real time graphs showing customizable amounts of data from one or more devices.

![Line Graph](/images/linegraph.gif)

## Features

### Chart Types

The widget currently supports the following chart types

-   line
-   bar
-   horizontal bar

_There will be more added in the future (pie, doughnut, radar, scatter and bubble are planned)_

### Customization

-   Choose which Axes are displayed
-   Show Aggregate data (Moving avearge, Bollinger Bands, or both)
-   Choose colours for plotted data
-   configurable legend
-   show and hide data by clicking legend items
-   configurable label format for times

![Options](/images/options.png)

## Installation

### Runtime Widget Deployment?

-   This widget supports runtime deployment. Download the [Runtime Binary](https://github.com/SoftwareAG/cumulocity-silo-capacity-widget/releases/download/1.0.2/silo-capacity-widget_v1.0.2.zip) and follow runtime deployment instructions from [here](https://github.com/SoftwareAG/cumulocity-runtime-widget-loader).

## Userguide

This guide will teach you how to add the widget in your existing or new dashboard.

NOTE: This guide assumes that you have followed the [installation](https://github.com/SoftwareAG/cumulocity-runtime-widget-loader) instructions

1. Open the Application Builder application from the app switcher (Next to your username in the top right)
2. Add a new dashboard or navigate to an existing dashboard
3. Click `Add Widget`
4. Search for `Measurement Chart`
5. See below for the configuration options

The widget configuration page contains a number of configuration attributes.

-   **Title** : Enter the title which will display at the top of your widget

**Device and Measurement Configuration** section

-   **Device** : Select one or more devices, once you do you will then be able to select measurements. Deselect options in the dropdown or click the 'x' to remove them.

![devices and measurements](/images/devandmeas.png)

-   **Measurement** : Select the measurement fragment and series from the dropdown. You can deselect them in a similar way to the devices.
-   **Global Chart Options** : Here you can choose things like chart type and display options for axes and the legend. _Note_ the global section will only appear once you have selected the devices and measurments.

![devices and measurements](/images/global.png)

-   **Series Settings** : Below the global settings you will see a row for each measurment series you selected. By clicking on the row you will expand options that can be set per series. Depending on the chart type there may be further options which can be exposed by clicking the

![series](/images/series.png)

**NOTE**: Once the **Target Assets or Devices** and **Measurement** information has been populated, you can click the 'Save' button to configure the widget with the default settings

---

These tools are provided as-is and without warranty or support. They do not constitute part of the Software AG product suite. Users are free to use, fork and modify them, subject to the license agreement. While Software AG welcomes contributions, we cannot guarantee to include every contribution in the master project.

---

For more information you can Ask a Question in the [TECHcommunity Forums](http://tech.forums.softwareag.com/techjforum/forums/list.page?product=cumulocity).

You can find additional information in the [Software AG TECHcommunity](http://techcommunity.softwareag.com/home/-/product/name/cumulocity).
