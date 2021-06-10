<!-- @format -->

## Fixes

-   1.1.3 Fixed firefox specific issue with chart selection.
-   1.1.2 Fixed verbose console logging and error when realtime group not enabled
-   1.1 release Added enhanced device list, caching of measurewments to help large volumes of data and the ability to select groups.
-   Initial 1.0 release

## Changelog

-   Initial Release.

## Known Issues

-   If the legend is on the right side, resizing to the smallest box causes the chart/axis to “invert” and then disappear. If you have the legend in any other position it seems to resize okay.
-   Legend Position -> "Chart Area" and "fill area under chart" will be hiding the text. Might need to consider a solid background colour for the legend.
-   In multilevel groups structures, you cannot yet aggregate all child groups and devices. It ONLY works on the children directly of the group. The widget currently doesn't hide top level groups and so if selected it will not show measurements for these. 
-   If you are using a simulator (browser based) it is possible that no data is show when starting the chart after a period of being logged out. 