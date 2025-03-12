sap.ui.define([
    "com/supabase/easyui5/controller/BaseController",
    "sap/ui/model/json/JSONModel"
], function(BaseController, JSONModel) {
    "use strict";

    return BaseController.extend("com.supabase.easyui5.controller.Home", {
        
        onInit: function() {
            // For debugging, create a local model if the tables model isn't available
            if (!this.getOwnerComponent().getModel("tables")) {
                var oTablesModel = new JSONModel({
                    tables: [
                        { id: "suppliers", title: "Suppliers", icon: "sap-icon://supplier" },
                        { id: "products", title: "Products", icon: "sap-icon://product" },
                        { id: "customers", title: "Customers", icon: "sap-icon://customer" },
                        { id: "orders", title: "Orders", icon: "sap-icon://sales-order" },
                        { id: "order_items", title: "Order Items", icon: "sap-icon://list" }
                    ]
                });
                this.getOwnerComponent().setModel(oTablesModel, "tables");
                console.log("Created fallback tables model");
            }
        },
        
        /**
         * Handler for list item press
         * @param {sap.ui.base.Event} oEvent The list item press event
         */
        onListItemPress: function(oEvent) {
            // Get the binding context of the pressed item
            var oItem = oEvent.getSource();
            var oContext = oItem.getBindingContext("tables");
            
            if (oContext) {
                // Get the table ID directly from the binding context
                var sTableId = oContext.getProperty("id");
                console.log("Navigating to table: " + sTableId);
                
                // Navigate to the entity list
                this.getRouter().navTo("entityList", {
                    table: sTableId
                });
            } else {
                // Alternative approach using custom data
                var oCustomData = oItem.getCustomData();
                if (oCustomData && oCustomData.length > 0) {
                    for (var i = 0; i < oCustomData.length; i++) {
                        if (oCustomData[i].getKey() === "table") {
                            var sTableId = oCustomData[i].getValue();
                            console.log("Navigating to table (from custom data): " + sTableId);
                            
                            // Navigate to the entity list
                            this.getRouter().navTo("entityList", {
                                table: sTableId
                            });
                            return;
                        }
                    }
                }
                
                console.error("Could not find table ID in binding context or custom data");
            }
        },
        
        /**
         * Navigate back to home
         */
        onNavHome: function() {
            this.getRouter().navTo("home");
        }
    });
});