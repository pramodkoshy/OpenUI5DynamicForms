sap.ui.define([], function() {
    "use strict";
    
    // Override the FlexConfiguration module to return false for flexibility services
    sap.ui.require.predefine("sap/ui/fl/FlexConfiguration", ["sap/ui/fl/registry/Settings"], 
        function(Settings) {
            return {
                getFlexibilityServices: function() {
                    return false;
                },
                isFlexibilityAdaptationEnabled: function() {
                    return false;
                },
                isFlexibilityEnabled: function() {
                    return false;
                }
            };
        }
    );
    
    return {};
});