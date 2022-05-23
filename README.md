# Data points charting widget [<img width="35" src="https://user-images.githubusercontent.com/67993842/97668428-f360cc80-1aa7-11eb-8801-da578bda4334.png"/>](https://github.com/SoftwareAG/cumulocity-datapoints-charting-widget/releases/download/v1.1.19/cumulocity-datapoints-chart-widget-1.1.19.zip)

The Data Points Charting Widget allows you to create real time graphs showing customizable amounts of data from one or more devices.

![Charts](/src/cumulocity-datapoints-charting-widget/assets/img-preview.png)

## Features

### Chart Types

The widget currently supports the following chart types

-   line and spline
    -   ![line and spline](/images/line_vs_spline.png)
    -   supporting multiple plots on the same graph
-   bar & horizontal bar
    -   supporting stacked
    -   ![horizontal and vertical stacked bars](/images/horz_vs_vertbar.png)
-   pie & doughnut
    -   aggregated by time or value range buckets
    -   ![bucket types](/images/buckets.png)
-   radar
-   scatter and bubble

_There will be more added in the future depending on demand (E.G histogram)_

### Customization

-   Selected data ranges configurable (# of measurements, time range)
-   precision of data configurable
-   Choose which Axes are displayed and scaled
-   Show Aggregate data (Moving average, Bollinger Bands, or both)
-   Choose colours for plotted data, data point visibility
-   configurable legend
-   show and hide data by clicking legend items, tool tips
-   configurable label format for times

![Options](/images/options.png)

## Installation

### Runtime Widget Deployment?

-   This widget supports runtime deployment. Download the [Runtime Binary](https://github.com/SoftwareAG/cumulocity-datapoints-charting-widget/releases/download/v1.1.19/cumulocity-datapoints-chart-widget-1.1.19.zip) and follow runtime deployment instructions from [here](https://github.com/SoftwareAG/cumulocity-runtime-widget-loader).

## User guide

This guide will teach you how to add the widget in your existing or new dashboard.

NOTE: This guide assumes that you have followed the [installation](https://github.com/SoftwareAG/cumulocity-runtime-widget-loader) instructions

1. Open the Application Builder application from the app switcher (Next to your username in the top right)
2. Add a new dashboard or navigate to an existing dashboard
3. Click `Add Widget`
4. Search for `Data Points Charting` ![devices and measurements](/images/add_widget.png)
5. See below for the configuration options

The widget configuration page contains a number of configuration attributes.

-   **Title** : Enter the title which will display at the top of your widget

**Device and Measurement Configuration** section

-   **Device** : Select one or more devices, once you do you will then be able to select measurements. Deselect options in the dropdown or click the 'x' to remove them.
    -   The list contains devices, as well as groups defined in the cumulocity application.
    -   When choosing a group (Such as Laboratory in the picture below) The measurements will be labeled to indicate that they are part of that group.

![devices and measurements](/images/devandmeas.png)

-   You will now be able to choose to plot an extra series for the group by checking a box shown at the top of the list in the config

![devices and measurements](/images/groupseries.png)

-   **Measurement** : Select the measurement fragment and series from the dropdown. You can deselect them in a similar way to the devices.

    -   define the range of data points to use by changing the Amount, Unit
    -   define the accuracy and display of data values by changing the number of decimal points to show.

-   **Group measurements within time unit**: This allows you to show raw data, or average or sum measurements them when received within the unit of the range you chose (E.G average values by minute).

    -   The time unit you chose for the range will determine how the measurements are grouped. The _sum measurements in group_ checkbox will change from the default of averaging to summing the values.
    -   This can be disabled in certain circumstances (See 'Plotting one series against another below')

-   **Clear Measurement Cache**: We store data for charts within the browser so that if you choose a large volume of historic data we can avoid the delay of retrieving it every time you load the chart. This button will clear **ALL** data for all the charts.

-   **Global Chart Options** : Here you can choose things like chart type and display options for axes and the legend. _Note_ the global section will only appear once you have selected the devices and measurements.

![devices and measurements](/images/global.gif)

**NOTE**: Once the **Target Assets or Devices** and **Measurement** information has been populated, you can click the 'Save' button to configure the widget with the default settings

-   **Series Settings** : Below the global settings you will see a row for each measurement series you selected. By clicking on the row you will expand options that can be set per series. Depending on the chart type there may be further options which can be exposed by clicking the show advanced options checkbox.

![series](/images/series.gif)

-   Change the series display name (reflected in the legend)
-   Change the series plot colour.
-   Currently the line chart has advanced options

![series](/images/advanced.gif)

-   hide measurements will hide the plot of the source data
-   choose an option from the _display aggregate_ drop down to show the colour and averaging period (number of measurements)
-   display aggregate allows you to choose to plot a moving average and/or Bollinger Bands

### Pie & Doughnut Charts

When plotting a single series you have the option of choosing a _pie_ or _doughnut_ chart. If you do then you need to aggregate or
bucket the data to allow it to be displayed.

-   After choosing your series, change the chart type to _pie_ or _doughnut_
-   The Amount of data chosen and it's unit will determine the time buckets (categories) in the chart.
-   The following is a pie chart showing counts of measurements within time periods

![series](/images/pie.gif)

-   We can also create a chart showing the number of measurements within value ranges
    -   These are defined in the config
-   The number of buckets will determine the bucket ranges when aggregating by value.

![series](/images/value_buckets.png)

### Plotting one series against another

The example shown here is a plot of the PH measured against a measure of PO4 (Phosphate) in a boiler. The relationship in this made up example is linear and so we should see a straight line when they are plotted against each other.

It is important to make sure that the data you wish to plot is related in some way, and that the measurements will arrive approximately at the same time.

-   After choosing your series, check the _Plot data points from one series against another_
-   This will change the display so you can choose the x and y of the chart.
-   Select the color and tolerance of what time stamps should match.

When you choose the 2 series and decide to plot them against each other the configuration will automatically switch on the "group measurements" option.

![series](/images/group.png)

It will be disabled so that it cannot be turned off.

![series](/images/multivariate.gif)

The above chart is a basic line chart, but you can use the ability to plot data against another series in other types:

-   radar
    ![series](/images/radar.png)

-   scatter
    ![series](/images/scatter.png)

-   bubble (x,y,r) r = diameter of plotted point
    ![series](/images/bubble.png)

---

These tools are provided as-is and without warranty or support. They do not constitute part of the Software AG product suite. Users are free to use, fork and modify them, subject to the license agreement. While Software AG welcomes contributions, we cannot guarantee to include every contribution in the master project.

---

For more information you can Ask a Question in the [Tech Community Forums](https://tech.forums.softwareag.com/tags/c/forum/1/Cumulocity-IoT).

You can find additional information in the [Software AG Tech Community](https://techcommunity.softwareag.com/en_en/cumulocity-iot.html).
