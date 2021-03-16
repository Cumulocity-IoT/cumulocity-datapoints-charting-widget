<!-- @format -->

## Fixed

- Package name should be “<name*of_widget>\_widget*<version>.zip” (e.g. “measurements_chart_widget_v1.0.0.zip”
- Avoid “Cumulocity” in the ACTUAL widget name (it’s already in Cumulocity after all), but the projected name in Github should be “cumulocity-<name of widget>-widget”
- Legend display shows the DeviceID, should show the name of the series added (ideally editable, see comments below)
- Grouping of configuration options -> Should use bounding boxes for groups (e.g. silo widget)
- Add device -> Not clear which measurements are for which device (e.g. Add “TestSim#1” and “TestSim#2”, “T.temperature” is there for both)
- Can only add 4 measurements, the configuration doesn't allow you more.
  - After adding 5/6, the widget crashes and needs to be deleted from the dashboard ☹ (Uncaught (in promise): TypeError: Cannot set property 'name' of undefined. TypeError: Cannot set property 'name' of undefined!"
- Would be nice if you can edit the Series name for display (especially to make the Legend easier to read)
- Colours -> ideally selected a different colour automagically so I dont have to choose it every time I add a widget
- "is Measurement Label" -> Spelling error.
- See Nigel for the list of tags to use on the Github project too
- Widget Thumbnail -> might be good to have 2 or 3 chart types shown in the thumbnail square. Right now the graph is quite wide but short in the picture, so adding a pie and radar chart above it would fill it more.
- Delete a device -> Measurements still persist in the list (Subscriptions stopped now)
- Missing option for how much data to show? I don’t think we need to worry about making this available from the “display” side, but it should be configurable.
  - (time period + max measurements) Should this be defined as a time period, num data points, or either?
  - (No) Do we also get the “truncated data” error that the Cumulocity data points graph has if defining a large number of points?
- (Removed) "Date Format" en_US -> What effect does this have, I tried "en_GB" and noticed no difference?
- "Date Format" has two titles - Should have option that are associated with it side by side
- (Changed to MA/Bollinger...) "Show function of measurements" -> Maybe change to "Plot function from measurements"
- (Added) "Bollinger Band" Function -> Capital B on Bollinger (its his name after all), and it only shows a single graph line.
- (removed) Fix selection of other moving average types
- (done) Fix function so (for example moving average doesn’t shoot up from zero)
- (done) "Truncate Y range" -> rename "Truncate Y Axis", and switch with "Show Legend" so that the legend and the position are together.
- (Bug - fixed) Changing from a "Bar Chart" to "Pie/Radar" for a data set with lots of points ("Wind Direction Monitor" either measurements) causes crash "Uncaught (in promise): TypeError: Cannot read property 'vals' of undefined"
- (Done) Alias for each series name
- Date format live preview beside format, plus dropdown of common

## Todo

- **Update readme doc**.
- Colours: Would be nice if they were selectable from a predefined palette
- If the legend is on the right side, resizing to the smallest box causes the chart/axis to “invert” and then disappear. If you have the legend in any other position it seems to resize okay.
- Legend Position -> "Chart Area" and "fill area under chart" will be hiding the text. Might need to consider a solid background colour for the legend.
- "Scatterplot" - What was the "R"? weighting? relationship? probably a help/note is useful here.
- Would be nice to have some context help/tooltips for the options (e.g. Silo Widget)
- More hiding of the config based on current selections (If pie chart hide averages etc)
- Use “Title case” for configuration option names.

UI:

## Discuss

- Love the ability to click and hide the measurement, that was something Matt was asking for! Might need to make that more obvious, but not sure how (but not tick boxes, I think that would make it messy).
