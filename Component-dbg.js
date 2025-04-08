// In your Component.js
sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/Device",
    "./model/models"
], function(UIComponent, Device, models) {
    "use strict";

    // Disable all flex-related settings before component is created
    window["sap-ui-config"] = window["sap-ui-config"] || {};
    window["sap-ui-config"].flexibilityServices = false;

    return UIComponent.extend("com.supabase.easyui5.Component", {
        metadata: {
            manifest: "json"
        },

        /**
         * The component is initialized by UI5 automatically during the startup of the app and calls the init method once.
         * @public
         * @override
         */
        // Modified init method for Component.js

        /**
         * The component is initialized by UI5 automatically during the startup of the app and calls the init method once.
         * @public
         * @override
         */
        // Modified init method for Component.js

        init: function() {
            // call the base component's init function
            UIComponent.prototype.init.apply(this, arguments);

            // create the device model
            this.setModel(models.createDeviceModel(), "device");
            
            // Initialize theme
            this.initTheme();

            // Initialize Supabase client
            this.initSupabase();
            
            // create the views based on the url/hash
            this.getRouter().initialize();
        },

        /**
         * Initialize Supabase client
         * @private
         */
        initSupabase: function() {
            // Create Supabase client and store it in the component
            const supabaseUrl = 'https://lqoiklybmvslmkitllyp.supabase.co';
            const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxxb2lrbHlibXZzbG1raXRsbHlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE0NTI3MDMsImV4cCI6MjA1NzAyODcwM30.407lGtQeSNQ6RUarDOIpFnfh0E9sqz0SHXgd1ug3ffA';
            
            // Load Supabase client from CDN
            const script = document.createElement('script');
            script.type = 'module';
            script.onload = () => {
                // After script is loaded, create and expose Supabase client
                // Fix for 'supabase' is not defined by using window.supabase
                window.supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
                
                // Create a model with Supabase tables metadata
                const tablesModel = new sap.ui.model.json.JSONModel({
                    tables: [
                        { id: "suppliers", title: "Suppliers", icon: "sap-icon://supplier" },
                        { id: "products", title: "Products", icon: "sap-icon://product" },
                        { id: "customers", title: "Customers", icon: "sap-icon://customer" },
                        { id: "orders", title: "Orders", icon: "sap-icon://sales-order" },
                        { id: "order_items", title: "Order Items", icon: "sap-icon://list" }
                    ]
                });
                this.setModel(tablesModel, "tables");
            };
            
            script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
            document.head.appendChild(script);
        },

        /**
         * This method can be called to determine whether the sapUiSizeCompact or sapUiSizeCozy
         * design mode class should be set, which influences the size appearance of some controls.
         * @public
         * @returns {string} css class, either 'sapUiSizeCompact' or 'sapUiSizeCozy' - or an empty string if no css class should be set
         */
        getContentDensityClass: function() {
            if (this.contentDensityClass === undefined) {
                // check whether FLP has already set the content density class; do nothing in this case
                if (document.body.classList.contains("sapUiSizeCozy") || document.body.classList.contains("sapUiSizeCompact")) {
                    this.contentDensityClass = "";
                } else if (!Device.support.touch) {
                    // apply "compact" mode if touch is not supported
                    this.contentDensityClass = "sapUiSizeCompact";
                } else {
                    // "cozy" in case of touch support; default for most sap.m controls, but needed for desktop-first controls like sap.ui.table.Table
                    this.contentDensityClass = "sapUiSizeCozy";
                }
            }
            return this.contentDensityClass;
        },

        // In Component.js, add a method to retrieve the SplitApp control

        /**
         * Get the SplitApp control
         * @returns {sap.m.SplitApp} The SplitApp control
         * @public
         */
        getSplitApp: function() {
            // Return the SplitApp instance
            return this.getRootControl().byId("app");
        },

        // Add this code to the Component.js file in the init method, 
        // after creating the device model but before initializing the router

        /**
         * Initialize theme from saved preference
         * @private
         */
        initTheme: function() {
            // Get theme from local storage
            let sTheme;
            try {
                sTheme = localStorage.getItem("preferredTheme");
            } catch (e) {
                console.error("Error reading theme preference:", e);
            }
            
            // If no theme is stored or the stored theme is invalid, use default
            const aValidThemes = [
                "sap_horizon",
                "sap_horizon_dark", 
                "sap_horizon_hcb", 
                "sap_horizon_hcw"
            ];
            
            if (!sTheme || aValidThemes.indexOf(sTheme) === -1) {
                sTheme = "sap_horizon"; // Default theme
            }
            
            // Apply the theme
            sap.ui.getCore().applyTheme(sTheme);
            
            // Create settings model
            const oSettingsModel = new sap.ui.model.json.JSONModel({
                theme: sTheme
            });
            this.setModel(oSettingsModel, "settings");
            
            console.log("Theme initialized:", sTheme);
        }


        
    });
});