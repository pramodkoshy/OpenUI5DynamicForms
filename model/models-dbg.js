sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/Device"
], function(JSONModel, Device) {
    "use strict";

    return {
        /**
         * Creates a device model that can be used to check the current device properties
         * @returns {sap.ui.model.json.JSONModel} The device model
         */
        createDeviceModel: function() {
            const oModel = new JSONModel(Device);
            oModel.setDefaultBindingMode("OneWay");
            return oModel;
        }
    };
});