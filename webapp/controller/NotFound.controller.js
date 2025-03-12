sap.ui.define([
    "com/supabase/easyui5/controller/BaseController"
], function(BaseController) {
    "use strict";

    return BaseController.extend("com.supabase.easyui5.controller.NotFound", {
        /**
         * Handler for the back button press
         */
        onNavBack: function() {
            this.getRouter().navTo("home");
        }
    });
});