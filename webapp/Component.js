sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/Device",
    "./model/models"
], function(UIComponent, Device, models) {
    "use strict";

    // Disable flexibility services before component creation
    window["sap-ui-config"] = window["sap-ui-config"] || {};
    window["sap-ui-config"].flexibilityServices = false;

    return UIComponent.extend("com.supabase.easyui5.Component", {
        metadata: {
            manifest: "json",
            interfaces: ["sap.ui.core.IAsyncContentCreation"]
        },

        init: function() {
            // Call the base component's init function
            UIComponent.prototype.init.apply(this, arguments);
        
            // Create device model immediately to make sure it's available
            const oDeviceModel = new sap.ui.model.json.JSONModel(sap.ui.Device);
            oDeviceModel.setDefaultBindingMode("OneWay");
            this.setModel(oDeviceModel, "device");
            
            // Initialize app view model 
            const oAppViewModel = new sap.ui.model.json.JSONModel({
                navExpanded: !sap.ui.Device.system.phone
            });
            this.setModel(oAppViewModel, "appView");
            
            // Initialize theme and Supabase client
            this.initTheme();
            this.initSupabase();
            
            // Initialize router
            this.getRouter().initialize();
            
            // Delay split app initialization
            setTimeout(this._initSplitApp.bind(this), 100);
        },

        initSupabase: function() {
            const supabaseUrl = 'https://lqoiklybmvslmkitllyp.supabase.co';
            const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxxb2lrbHlibXZzbG1raXRsbHlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE0NTI3MDMsImV4cCI6MjA1NzAyODcwM30.407lGtQeSNQ6RUarDOIpFnfh0E9sqz0SHXgd1ug3ffA';
            
            const script = document.createElement('script');
            script.type = 'module';
            script.onload = () => {
                window.supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
                
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
                console.log("Tables model initialized with tables:", tablesModel.getProperty("/tables").length);
                
                // Initialize the navigation list after model is set
                this._initAppControllers();
            };
            
            script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
            document.head.appendChild(script);
        },


        initTheme: function() {
            const validThemes = [
                "sap_horizon",
                "sap_horizon_dark", 
                "sap_horizon_hcb", 
                "sap_horizon_hcw"
            ];
            
            let storedTheme = localStorage.getItem("preferredTheme");
            
            if (!storedTheme || !validThemes.includes(storedTheme)) {
                storedTheme = "sap_horizon";
            }
            
            sap.ui.getCore().applyTheme(storedTheme);
            
            const settingsModel = new sap.ui.model.json.JSONModel({
                theme: storedTheme
            });
            this.setModel(settingsModel, "settings");
        },

        _initSplitApp: function() {
            try {
                const oSplitApp = this.getSplitApp();
                if (!oSplitApp) {
                    console.error("SplitApp not found");
                    // Try again in a second
                    setTimeout(this._initSplitApp.bind(this), 1000);
                    return;
                }
                
                if (sap.ui.Device.system.phone) {
                    oSplitApp.setMode("PopoverMode");
                    const oAppViewModel = this.getModel("appView");
                    if (oAppViewModel) {
                        oAppViewModel.setProperty("/navExpanded", false);
                    }
                } else if (sap.ui.Device.system.tablet) {
                    oSplitApp.setMode("ShowHideMode");
                    
                    // Default to hidden in portrait
                    if (window.innerHeight > window.innerWidth) {
                        oSplitApp.hideMaster();
                    }
                } else {
                    oSplitApp.setMode("ShowHideMode");
                    oSplitApp.showMaster();
                }
            } catch (error) {
                console.error("Error initializing SplitApp:", error);
            }
        },

        getSplitApp: function() {
            try {
                const oRootControl = this.getRootControl();
                if (!oRootControl) {
                    console.warn("Root control not found");
                    return null;
                }
                
                // Try to find by ID first
                const oSplitApp = oRootControl.byId("app");
                if (oSplitApp) {
                    console.log("SplitApp found by ID");
                    return oSplitApp;
                }
                
                // If not found by ID, look through all children recursively
                const findSplitApp = function(oControl) {
                    // Check if this control is a SplitApp
                    if (oControl instanceof sap.m.SplitApp) {
                        return oControl;
                    }
                    
                    // Check all aggregations
                    const aAggregationNames = oControl.getMetadata().getAllAggregations();
                    for (let sAggName in aAggregationNames) {
                        const aAggregation = oControl.getAggregation(sAggName);
                        if (!aAggregation) {
                            continue;
                        }
                        
                        // Handle both arrays and single objects
                        const aControls = Array.isArray(aAggregation) ? aAggregation : [aAggregation];
                        
                        for (let i = 0; i < aControls.length; i++) {
                            const oResult = findSplitApp(aControls[i]);
                            if (oResult) {
                                return oResult;
                            }
                        }
                    }
                    
                    return null;
                };
                
                // Try to find SplitApp in the control tree
                const oFoundSplitApp = findSplitApp(oRootControl);
                if (oFoundSplitApp) {
                    console.log("SplitApp found through control tree search");
                    return oFoundSplitApp;
                }
                
                console.warn("SplitApp not found in control tree");
                return null;
            } catch (error) {
                console.error("Error in getSplitApp:", error);
                return null;
            }
        },
        
        getContentDensityClass: function() {
            if (!this._sContentDensityClass) {
                // Check whether FLP has already set the content density class
                if (document.body.classList.contains("sapUiSizeCozy") || document.body.classList.contains("sapUiSizeCompact")) {
                    this._sContentDensityClass = "";
                } else if (!sap.ui.Device.support.touch) {
                    // Apply "compact" mode if touch is not supported
                    this._sContentDensityClass = "sapUiSizeCompact";
                } else {
                    // "cozy" in case of touch support; default for most sap.m controls
                    this._sContentDensityClass = "sapUiSizeCozy";
                }
            }
            return this._sContentDensityClass;
        },
        
        // Metadata provider implementation
        getTableMetadata: function(sTableId) {
            // Cache for table metadata
            this._tableMetadataCache = this._tableMetadataCache || {};
            
            // Return from cache if available
            if (this._tableMetadataCache[sTableId]) {
                return Promise.resolve(this._tableMetadataCache[sTableId]);
            }
            
            // Define default metadata for tables
            const oDefaultMetadata = {
                suppliers: {
                    primaryKey: "supplier_id",
                    titleField: "company_name",
                    subtitleField: "contact_name",
                    columns: [
                        { name: "supplier_id", label: "ID", type: "string", visible: true, editable: false, required: false },
                        { name: "company_name", label: "Company", type: "string", visible: true, editable: true, required: true }, // Changed from "name" to "company_name"
                        { name: "contact_name", label: "Contact Name", type: "string", visible: true, editable: true, required: false },
                        { name: "email", label: "Contact Email", type: "email", visible: true, editable: true, required: false },
                        { name: "phone", label: "Phone", type: "string", visible: true, editable: true, required: false },
                        { name: "address", label: "Address", type: "text", visible: true, editable: true, required: false },
                        { name: "city", label: "City", type: "string", visible: true, editable: true, required: false },
                        { name: "country", label: "Country", type: "string", visible: true, editable: true, required: false },
                        { name: "created_at", label: "Created At", type: "date", visible: true, editable: false, required: false },
                        { name: "updated_at", label: "Updated At", type: "date", visible: true, editable: false, required: false }
                    ],
                    relations: [
                        { table: "products", foreignKey: "supplier_id" }
                    ]
                },
                products: {
                    primaryKey: "product_id",
                    titleField: "product_name", // Changed from "name" to "product_name" 
                    subtitleField: "description",
                    columns: [
                        { name: "product_id", label: "ID", type: "string", visible: true, editable: false, required: false },
                        { name: "product_name", label: "Name", type: "string", visible: true, editable: true, required: true }, // Changed from "name" to "product_name"
                        { name: "description", label: "Description", type: "text", visible: true, editable: true, required: false },
                        { name: "unit_price", label: "Price", type: "number", visible: true, editable: true, required: true }, // Changed from "price" to "unit_price"
                        { name: "category", label: "Category", type: "string", visible: true, editable: true, required: false },
                   //     { name: "in_stock", label: "In Stock", type: "boolean", visible: true, editable: true, required: false },
                        { name: "supplier_id", label: "Supplier", type: "relation", relation: "suppliers", visible: true, editable: true, required: true },
                        { name: "created_at", label: "Created At", type: "date", visible: true, editable: false, required: false },
                        { name: "updated_at", label: "Updated At", type: "date", visible: true, editable: false, required: false }
                    ],
                    relations: [
                        { table: "order_items", foreignKey: "product_id" }
                    ]
                },
                customers: {
                    primaryKey: "customer_id", // Changed from "id" to "customer_id"
                    titleField: "name",
                    subtitleField: "email",
                    columns: [
                        { name: "customer_id", label: "ID", type: "string", visible: true, editable: false, required: false }, // Changed from "id" to "customer_id"
                        { name: "name", label: "Name", type: "string", visible: true, editable: true, required: true },
                        { name: "email", label: "Email", type: "email", visible: true, editable: true, required: true },
                        { name: "phone", label: "Phone", type: "string", visible: true, editable: true, required: false },
                        { name: "address", label: "Address", type: "text", visible: true, editable: true, required: false },
                        { name: "city", label: "City", type: "string", visible: true, editable: true, required: false },
                        { name: "country", label: "Country", type: "string", visible: true, editable: true, required: false },
                        { name: "created_at", label: "Created At", type: "date", visible: true, editable: false, required: false },
                        { name: "updated_at", label: "Updated At", type: "date", visible: true, editable: false, required: false }
                    ],
                    relations: [
                        { table: "orders", foreignKey: "customer_id" }
                    ]
                },
                orders: {
                    primaryKey: "order_id", // Changed from "id" to "order_id"
                    titleField: "id",
                    subtitleField: "status",
                    columns: [
                        { name: "order_id", label: "ID", type: "string", visible: true, editable: false, required: false }, // Changed from "id" to "order_id"
                        { name: "customer_id", label: "Customer", type: "relation", relation: "customers", visible: true, editable: true, required: true },
                        { name: "order_date", label: "Order Date", type: "date", visible: true, editable: true, required: true },
                    
                        { name: "total_amount", label: "Total Amount", type: "number", visible: true, editable: true, required: true },
            
                        { name: "created_at", label: "Created At", type: "date", visible: true, editable: false, required: false },
                        { name: "updated_at", label: "Updated At", type: "date", visible: true, editable: false, required: false }
                    ],
                    relations: [
                        { table: "order_items", foreignKey: "order_id" }
                    ]
                },
                order_items: {
                    primaryKey: "order_item_id", // Changed from "id" to "order_item_id"
                    titleField: "id",
                    subtitleField: "quantity",
                    columns: [
                        { name: "order_item_id", label: "ID", type: "string", visible: true, editable: false, required: false }, // Changed from "id" to "order_item_id"
                        { name: "order_id", label: "Order", type: "relation", relation: "orders", visible: true, editable: true, required: true },
                        { name: "product_id", label: "Product", type: "relation", relation: "products", visible: true, editable: true, required: true },
                        { name: "quantity", label: "Quantity", type: "number", visible: true, editable: true, required: true },
                        { name: "unit_price", label: "Unit Price", type: "number", visible: true, editable: true, required: true },
                        { name: "created_at", label: "Created At", type: "date", visible: true, editable: false, required: false },
                        { name: "updated_at", label: "Updated At", type: "date", visible: true, editable: false, required: false }
                    ],
                    relations: []
                }
            };
            
            // Check if we have default metadata
            if (oDefaultMetadata[sTableId]) {
                // Store in cache
                this._tableMetadataCache[sTableId] = oDefaultMetadata[sTableId];
                return Promise.resolve(oDefaultMetadata[sTableId]);
            }
            
            // Fall back to generic structure
            const oGenericMetadata = {
                primaryKey: "id",
                titleField: "name",
                subtitleField: "description",
                columns: [
                    { name: "id", label: "ID", type: "string", visible: true, editable: false, required: false },
                    { name: "name", label: "Name", type: "string", visible: true, editable: true, required: true },
                    { name: "description", label: "Description", type: "text", visible: true, editable: true, required: false },
                    { name: "created_at", label: "Created At", type: "date", visible: true, editable: false, required: false },
                    { name: "updated_at", label: "Updated At", type: "date", visible: true, editable: false, required: false }
                ],
                relations: []
            };
            
            // Store in cache
            this._tableMetadataCache[sTableId] = oGenericMetadata;
            return Promise.resolve(oGenericMetadata);
        },

        /**
         * Make sure all models are properly set on controller initialization
         * @param {sap.ui.core.mvc.Controller} oController The controller
         */
        propagateModels: function(oController) {
            if (!oController) return;
            
            const oView = oController.getView();
            if (!oView) return;
            
            // Make sure device model is set
            const oDeviceModel = this.getModel("device");
            if (oDeviceModel && !oView.getModel("device")) {
                oView.setModel(oDeviceModel, "device");
            }
            
            // Make sure appView model is set
            const oAppViewModel = this.getModel("appView");
            if (oAppViewModel && !oView.getModel("appView")) {
                oView.setModel(oAppViewModel, "appView");
            }
            
            // Make sure tables model is set
            const oTablesModel = this.getModel("tables");
            if (oTablesModel && !oView.getModel("tables")) {
                oView.setModel(oTablesModel, "tables");
            }
        },

        createContent: function() {
            const oApp = UIComponent.prototype.createContent.apply(this, arguments);
            
            // Hook into controller initialization
            const fnOrigCreateView = sap.ui.view;
            const that = this;
            
            sap.ui.view = function() {
                const oView = fnOrigCreateView.apply(this, arguments);
                
                // When view is created, ensure models are set
                const oController = oView.getController();
                if (oController) {
                    that.propagateModels(oController);
                }
                
                return oView;
            };
            
            return oApp;
        },

        _initAppControllers: function() {
            // Get the root control
            const oRootControl = this.getRootControl();
            if (!oRootControl) return;
            
            // Get the App controller
            const oAppController = oRootControl.getController();
            if (!oAppController) return;
            
            // Initialize navigation list
            if (typeof oAppController._initializeNavigationList === "function") {
                setTimeout(function() {
                    oAppController._initializeNavigationList();
                }, 500);
            }
        }
    });
});