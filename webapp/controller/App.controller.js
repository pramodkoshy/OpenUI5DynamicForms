sap.ui.define([
    "com/supabase/easyui5/controller/BaseController"
], function(BaseController) {
    "use strict";

    return BaseController.extend("com.supabase.easyui5.controller.App", {
        onInit: function() {
            // Apply content density mode
            this.getView().addStyleClass(this.getOwnerComponent().getContentDensityClass());
        }
    });
});