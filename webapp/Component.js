sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/Device",
    "./model/models",
    "./model/EntityCacheManager" // Import already added
], function(UIComponent, Device, models, EntityCacheManager) {
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

            // Create the entity cache manager
            this._entityCacheManager = new EntityCacheManager();
            
            // Delay split app initialization
            setTimeout(this._initSplitApp.bind(this), 100);
        },

        /**
         * Get the Entity Cache Manager instance
         * @returns {com.supabase.easyui5.model.EntityCacheManager} The entity cache manager
         */
        getEntityCacheManager: function() {
            return this._entityCacheManager;
        },

        /**
         * Get the Supabase client instance
         * @returns {Object} The Supabase client
         */
        getSupabaseClient: function() {
            return window.supabaseClient;
        },

        initSupabase: function() {
            const supabaseUrl = 'https://lqoiklybmvslmkitllyp.supabase.co';
            const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxxb2lrbHlibXZzbG1raXRsbHlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE0NTI3MDMsImV4cCI6MjA1NzAyODcwM30.407lGtQeSNQ6RUarDOIpFnfh0E9sqz0SHXgd1ug3ffA';
            
            const script = document.createElement('script');
            script.type = 'module';
            script.onload = () => {
                window.supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
                
                const tablesModel = new sap.ui.model.json.JSONModel({
                    tables : [
                        // Primary business entities - most important tables first
                        { id: "customers", title: "Customers", icon: "sap-icon://customer" },
                        { id: "lead", title: "Leads", icon: "sap-icon://opportunity" },
                        { id: "lead_status", title: "Lead Status", icon: "sap-icon://status-in-process" },
                        { id: "contacts", title: "Contacts", icon: "sap-icon://contacts" },
                        { id: "products", title: "Products", icon: "sap-icon://product" },
                        { id: "orders", title: "Orders", icon: "sap-icon://sales-order" },
                        { id: "order_items", title: "Order Items", icon: "sap-icon://list" },
                        
                        // Supporting business processes
                        { id: "activities", title: "Activities", icon: "sap-icon://activity-items" },
                        { id: "campaigns", title: "Campaigns", icon: "sap-icon://marketing-campaign" },
                        
                        // Structural/system tables
                        { id: "entities", title: "Entities", icon: "sap-icon://database" },
                        { id: "notes", title: "Notes", icon: "sap-icon://notes" }
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
            // Check if we have it in the EntityCacheManager cache first
            const sCacheKey = `metadata_${sTableId}`;
            
            // Try to get from cache manager
            if (this._entityCacheManager) {
                // Check if cached before proceeding with default logic
                if (this._entityCacheManager.isCached(sCacheKey)) {
                    return this._entityCacheManager.getEntityData(sCacheKey, {}, () => {
                        // This should never execute since we checked isCached above
                        return Promise.resolve(this._getDefaultTableMetadata(sTableId));
                    });
                }
            }
            
            // Fall back to regular metadata retrieval
            return Promise.resolve(this._getDefaultTableMetadata(sTableId));
        },
        
        /**
         * Get default table metadata (extracted from original getTableMetadata method)
         * @private
         */
        _getDefaultTableMetadata: function(sTableId) {
            // Cache for table metadata
            this._tableMetadataCache = this._tableMetadataCache || {};
            
            // Return from cache if available
            if (this._tableMetadataCache[sTableId]) {
                return this._tableMetadataCache[sTableId];
            }
            
            // Define default metadata for tables
           
            const oDefaultMetadata = {
                // Base entity table for polymorphic relationships
                entities: {
                    primaryKey: "entity_id",
                    titleField: "name",
                    subtitleField: "entity_type",
                    columns: [
                        { name: "entity_id", label: "Entity ID", type: "string", visible: true, editable: false, required: false },
                        { name: "entity_type", label: "Entity Type", type: "string", visible: true, editable: true, required: true },
                        { name: "name", label: "Name", type: "string", visible: true, editable: true, required: true },
                        { name: "description", label: "Description", type: "text", visible: true, editable: true, required: false },
                        { name: "created_at", label: "Created At", type: "date", visible: true, editable: false, required: false },
                        { name: "updated_at", label: "Updated At", type: "date", visible: true, editable: false, required: false }
                    ],
                    relations: [
                        { table: "customers", foreignKey: "entity_id", condition: { entity_type: "customer" } },
                        { table: "products", foreignKey: "entity_id", condition: { entity_type: "product" } },
                        { table: "lead", foreignKey: "entity_id", condition: { entity_type: "lead" } },
                        { table: "campaigns", foreignKey: "entity_id", condition: { entity_type: "campaign" } },
                        { table: "contacts", foreignKey: "entity_id", condition: { entity_type: "contact" } },
                        { table: "activities", foreignKey: "entity_id", condition: { entity_type: "activity" } },
                        { table: "notes", foreignKey: "entity_id" },
                        { table: "files", foreignKey: "entity_id" },
                        { table: "entity_tags", foreignKey: "entity_id" }
                    ]
                },
            
                // Main business entities
                customers: {
                    primaryKey: "customer_id",
                    titleField: "name",
                    subtitleField: "email",
                    columns: [
                        { name: "customer_id", label: "Customer ID", type: "string", visible: true, editable: false, required: false },
                        { name: "entity_id", label: "Entity ID", type: "string", visible: false, editable: false, required: false },
                        { name: "name", label: "Customer Name", type: "string", visible: true, editable: true, required: true },
                        { name: "email", label: "Email", type: "email", visible: true, editable: true, required: false },
                        { name: "phone", label: "Phone", type: "string", visible: true, editable: true, required: false },
                        { name: "address", label: "Address", type: "text", visible: true, editable: true, required: false },
                        { name: "city", label: "City", type: "string", visible: true, editable: true, required: false },
                        { name: "country", label: "Country", type: "string", visible: true, editable: true, required: false },
                        { name: "customer_type", label: "Customer Type", type: "string", visible: true, editable: true, required: false },
                        { name: "created_at", label: "Created At", type: "date", visible: true, editable: false, required: false },
                        { name: "updated_at", label: "Updated At", type: "date", visible: true, editable: false, required: false }
                    ],
                    relations: [
                        { table: "orders", foreignKey: "customer_id" },
                        { table: "contacts", foreignKey: "customer_id" },
                        { table: "lead", foreignKey: "customer_id" },
                        { table: "activities", foreignKey: "customer_id" },
                        { table: "entities", foreignKey: "entity_id", condition: { entity_type: "customer" } },
                        { table: "notes", foreignKey: "entity_id", condition: { entity_type: "customer" } },
                        { table: "files", foreignKey: "entity_id", condition: { entity_type: "customer" } },
                        { table: "entity_tags", foreignKey: "entity_id", condition: { entity_type: "customer" } }
                    ]
                },
            
                products: {
                    primaryKey: "product_id",
                    titleField: "product_name",
                    subtitleField: "category",
                    columns: [
                        { name: "product_id", label: "Product ID", type: "string", visible: true, editable: false, required: false },
                        { name: "entity_id", label: "Entity ID", type: "string", visible: false, editable: false, required: false },
                        { name: "product_name", label: "Product Name", type: "string", visible: true, editable: true, required: true },
                        { name: "description", label: "Description", type: "text", visible: true, editable: true, required: false },
                        { name: "unit_price", label: "Unit Price", type: "number", visible: true, editable: true, required: false },
                        { name: "category", label: "Category", type: "string", visible: true, editable: true, required: false },
                        { name: "features", label: "Features", type: "text", visible: true, editable: true, required: false },
                        { name: "stock_level", label: "Stock Level", type: "number", visible: true, editable: true, required: false },
                        { name: "created_at", label: "Created At", type: "date", visible: true, editable: false, required: false },
                        { name: "updated_at", label: "Updated At", type: "date", visible: true, editable: false, required: false }
                    ],
                    relations: [
                        { table: "order_items", foreignKey: "product_id" },
                        { table: "campaigns", foreignKey: "product_id" },
                        { table: "entities", foreignKey: "entity_id", condition: { entity_type: "product" } },
                        { table: "notes", foreignKey: "entity_id", condition: { entity_type: "product" } },
                        { table: "files", foreignKey: "entity_id", condition: { entity_type: "product" } },
                        { table: "entity_tags", foreignKey: "entity_id", condition: { entity_type: "product" } }
                    ]
                },
            
                orders: {
                    primaryKey: "order_id",
                    titleField: "order_id",
                    subtitleField: "status",
                    columns: [
                        { name: "order_id", label: "Order ID", type: "string", visible: true, editable: false, required: false },
                        { name: "customer_id", label: "Customer", type: "relation", relation: "customers", visible: true, editable: true, required: true },
                        { name: "order_date", label: "Order Date", type: "date", visible: true, editable: true, required: true },
                        { name: "total_amount", label: "Total Amount", type: "number", visible: true, editable: true, required: true },
                        { name: "status", label: "Status", type: "string", visible: true, editable: true, required: true },
                        { name: "payment_method", label: "Payment Method", type: "string", visible: true, editable: true, required: false },
                        { name: "created_at", label: "Created At", type: "date", visible: true, editable: false, required: false },
                        { name: "updated_at", label: "Updated At", type: "date", visible: true, editable: false, required: false }
                    ],
                    relations: [
                        { table: "order_items", foreignKey: "order_id" },
                        { table: "customers", foreignKey: "customer_id" }
                    ]
                },
            
                order_items: {
                    primaryKey: "order_item_id",
                    titleField: "order_item_id",
                    subtitleField: "quantity",
                    columns: [
                        { name: "order_item_id", label: "Item ID", type: "string", visible: true, editable: false, required: false },
                        { name: "order_id", label: "Order", type: "relation", relation: "orders", visible: true, editable: true, required: true },
                        { name: "product_id", label: "Product", type: "relation", relation: "products", visible: true, editable: true, required: true },
                        { name: "quantity", label: "Quantity", type: "number", visible: true, editable: true, required: true },
                        { name: "unit_price", label: "Unit Price", type: "number", visible: true, editable: true, required: true },
                        { name: "discount", label: "Discount %", type: "number", visible: true, editable: true, required: false },
                        { name: "created_at", label: "Created At", type: "date", visible: true, editable: false, required: false },
                        { name: "updated_at", label: "Updated At", type: "date", visible: true, editable: false, required: false }
                    ],
                    relations: [
                        { table: "orders", foreignKey: "order_id" },
                        { table: "products", foreignKey: "product_id" }
                    ]
                },
            
                lead: {
                    primaryKey: "lead_id",
                    titleField: "company_name",
                    subtitleField: "contact_name",
                    columns: [
                        { name: "lead_id", label: "Lead ID", type: "string", visible: true, editable: false, required: false },
                        { name: "entity_id", label: "Entity ID", type: "string", visible: false, editable: false, required: false },
                        { name: "company_name", label: "Company Name", type: "string", visible: true, editable: true, required: true },
                        { name: "contact_name", label: "Contact Name", type: "string", visible: true, editable: true, required: true },
                        { name: "email", label: "Email", type: "email", visible: true, editable: true, required: true },
                        { name: "phone", label: "Phone", type: "string", visible: true, editable: true, required: false },
                        { name: "status_id", label: "Status", type: "relation", relation: "lead_status", visible: true, editable: true, required: true },
                        { name: "source", label: "Lead Source", type: "string", visible: true, editable: true, required: false },
                        { name: "customer_id", label: "Converted Customer", type: "relation", relation: "customers", visible: true, editable: true, required: false },
                        { name: "created_at", label: "Created At", type: "date", visible: true, editable: false, required: false },
                        { name: "updated_at", label: "Updated At", type: "date", visible: true, editable: false, required: false }
                    ],
                    relations: [
                        { table: "activities", foreignKey: "lead_id" },
                        { table: "customers", foreignKey: "customer_id" },
                        { table: "lead_status", foreignKey: "status_id" },
                        { table: "entities", foreignKey: "entity_id", condition: { entity_type: "lead" } },
                        { table: "notes", foreignKey: "entity_id", condition: { entity_type: "lead" } },
                        { table: "files", foreignKey: "entity_id", condition: { entity_type: "lead" } },
                        { table: "entity_tags", foreignKey: "entity_id", condition: { entity_type: "lead" } }
                    ]
                },
            
                lead_status: {
                    primaryKey: "status_id",
                    titleField: "label",
                    subtitleField: "description",
                    columns: [
                        { name: "status_id", label: "Status ID", type: "string", visible: true, editable: false, required: false },
                        { name: "label", label: "Status Label", type: "string", visible: true, editable: true, required: true },
                        { name: "description", label: "Description", type: "text", visible: true, editable: true, required: false },
                        { name: "color", label: "Color", type: "string", visible: true, editable: true, required: false },
                        { name: "position", label: "Position", type: "number", visible: true, editable: true, required: false }
                    ],
                    relations: [
                        { table: "lead", foreignKey: "status_id" }
                    ]
                },
            
                contacts: {
                    primaryKey: "contact_id",
                    titleField: "name",
                    subtitleField: "title",
                    columns: [
                        { name: "contact_id", label: "Contact ID", type: "string", visible: true, editable: false, required: false },
                        { name: "customer_id", label: "Customer", type: "relation", relation: "customers", visible: true, editable: true, required: true },
                        { name: "entity_id", label: "Entity ID", type: "string", visible: false, editable: false, required: false },
                        { name: "name", label: "Contact Name", type: "string", visible: true, editable: true, required: true },
                        { name: "title", label: "Job Title", type: "string", visible: true, editable: true, required: false },
                        { name: "email", label: "Email", type: "email", visible: true, editable: true, required: true },
                        { name: "phone", label: "Phone", type: "string", visible: true, editable: true, required: false },
                        { name: "is_primary", label: "Primary Contact", type: "boolean", visible: true, editable: true, required: false },
                        { name: "created_at", label: "Created At", type: "date", visible: true, editable: false, required: false },
                        { name: "updated_at", label: "Updated At", type: "date", visible: true, editable: false, required: false }
                    ],
                    relations: [
                        { table: "activities", foreignKey: "contact_id" },
                        { table: "customers", foreignKey: "customer_id" },
                        { table: "entities", foreignKey: "entity_id", condition: { entity_type: "contact" } },
                        { table: "notes", foreignKey: "entity_id", condition: { entity_type: "contact" } },
                        { table: "files", foreignKey: "entity_id", condition: { entity_type: "contact" } },
                        { table: "entity_tags", foreignKey: "entity_id", condition: { entity_type: "contact" } }
                    ]
                },
            
                activities: {
                    primaryKey: "activity_id",
                    titleField: "subject",
                    subtitleField: "type",
                    columns: [
                        { name: "activity_id", label: "Activity ID", type: "string", visible: true, editable: false, required: false },
                        { name: "entity_id", label: "Entity ID", type: "string", visible: false, editable: false, required: false },
                        { name: "type", label: "Activity Type", type: "string", visible: true, editable: true, required: true },
                        { name: "subject", label: "Subject", type: "string", visible: true, editable: true, required: true },
                        { name: "description", label: "Description", type: "text", visible: true, editable: true, required: false },
                        { name: "customer_id", label: "Customer", type: "relation", relation: "customers", visible: true, editable: true, required: false },
                        { name: "contact_id", label: "Contact", type: "relation", relation: "contacts", visible: true, editable: true, required: false },
                        { name: "lead_id", label: "Lead", type: "relation", relation: "lead", visible: true, editable: true, required: false },
                        { name: "due_date", label: "Due Date", type: "date", visible: true, editable: true, required: false },
                        { name: "status", label: "Status", type: "string", visible: true, editable: true, required: true },
                        { name: "created_at", label: "Created At", type: "date", visible: true, editable: false, required: false },
                        { name: "updated_at", label: "Updated At", type: "date", visible: true, editable: false, required: false }
                    ],
                    relations: [
                        { table: "customers", foreignKey: "customer_id" },
                        { table: "contacts", foreignKey: "contact_id" },
                        { table: "lead", foreignKey: "lead_id" },
                        { table: "entities", foreignKey: "entity_id", condition: { entity_type: "activity" } },
                        { table: "notes", foreignKey: "entity_id", condition: { entity_type: "activity" } },
                        { table: "files", foreignKey: "entity_id", condition: { entity_type: "activity" } }
                    ]
                },
            
                campaigns: {
                    primaryKey: "campaign_id",
                    titleField: "name",
                    subtitleField: "status",
                    columns: [
                        { name: "campaign_id", label: "Campaign ID", type: "string", visible: true, editable: false, required: false },
                        { name: "entity_id", label: "Entity ID", type: "string", visible: false, editable: false, required: false },
                        { name: "name", label: "Campaign Name", type: "string", visible: true, editable: true, required: true },
                        { name: "description", label: "Description", type: "text", visible: true, editable: true, required: false },
                        { name: "product_id", label: "Product", type: "relation", relation: "products", visible: true, editable: true, required: false },
                        { name: "start_date", label: "Start Date", type: "date", visible: true, editable: true, required: true },
                        { name: "end_date", label: "End Date", type: "date", visible: true, editable: true, required: false },
                        { name: "budget", label: "Budget", type: "number", visible: true, editable: true, required: false },
                        { name: "status", label: "Status", type: "string", visible: true, editable: true, required: true },
                        { name: "target_audience", label: "Target Audience", type: "text", visible: true, editable: true, required: false },
                        { name: "created_at", label: "Created At", type: "date", visible: true, editable: false, required: false },
                        { name: "updated_at", label: "Updated At", type: "date", visible: true, editable: false, required: false }
                    ],
                    relations: [
                        { table: "products", foreignKey: "product_id" },
                        { table: "entities", foreignKey: "entity_id", condition: { entity_type: "campaign" } },
                        { table: "notes", foreignKey: "entity_id", condition: { entity_type: "campaign" } },
                        { table: "files", foreignKey: "entity_id", condition: { entity_type: "campaign" } },
                        { table: "entity_tags", foreignKey: "entity_id", condition: { entity_type: "campaign" } }
                    ]
                },
            
                // Polymorphic support tables
                notes: {
                    primaryKey: "note_id",
                    titleField: "title",
                    subtitleField: "entity_type",
                    columns: [
                        { name: "note_id", label: "Note ID", type: "string", visible: true, editable: false, required: false },
                        { name: "entity_id", label: "Entity ID", type: "string", visible: true, editable: true, required: true },
                        { name: "entity_type", label: "Entity Type", type: "string", visible: true, editable: true, required: true },
                        { name: "title", label: "Note Title", type: "string", visible: true, editable: true, required: true },
                        { name: "note", label: "Note Content", type: "text", visible: true, editable: true, required: true },
                        { name: "category", label: "Category", type: "string", visible: true, editable: true, required: false },
                        { name: "is_private", label: "Private", type: "boolean", visible: true, editable: true, required: false },
                        { name: "created_by", label: "Created By", type: "string", visible: true, editable: false, required: false },
                        { name: "created_at", label: "Created At", type: "date", visible: true, editable: false, required: false },
                        { name: "updated_at", label: "Updated At", type: "date", visible: true, editable: false, required: false }
                    ],
                    relations: [
                        { table: "entities", foreignKey: "entity_id" },
                        { table: "customers", foreignKey: "entity_id", condition: { entity_type: "customer" } },
                        { table: "products", foreignKey: "entity_id", condition: { entity_type: "product" } },
                        { table: "lead", foreignKey: "entity_id", condition: { entity_type: "lead" } },
                        { table: "campaigns", foreignKey: "entity_id", condition: { entity_type: "campaign" } },
                        { table: "contacts", foreignKey: "entity_id", condition: { entity_type: "contact" } },
                        { table: "activities", foreignKey: "entity_id", condition: { entity_type: "activity" } }
                    ]
                },
            
                files: {
                    primaryKey: "file_id",
                    titleField: "file_name",
                    subtitleField: "file_type",
                    columns: [
                        { name: "file_id", label: "File ID", type: "string", visible: true, editable: false, required: false },
                        { name: "entity_id", label: "Entity ID", type: "string", visible: true, editable: true, required: true },
                        { name: "entity_type", label: "Entity Type", type: "string", visible: true, editable: true, required: true },
                        { name: "file_name", label: "File Name", type: "string", visible: true, editable: true, required: true },
                        { name: "original_name", label: "Original Name", type: "string", visible: true, editable: false, required: true },
                        { name: "file_type", label: "File Type", type: "string", visible: true, editable: false, required: true },
                        { name: "file_size", label: "File Size (KB)", type: "number", visible: true, editable: false, required: false },
                        { name: "mime_type", label: "MIME Type", type: "string", visible: true, editable: false, required: false },
                        { name: "storage_path", label: "Storage Path", type: "string", visible: false, editable: false, required: true },
                        { name: "public_url", label: "Public URL", type: "url", visible: true, editable: false, required: false },
                        { name: "description", label: "Description", type: "text", visible: true, editable: true, required: false },
                        { name: "category", label: "Category", type: "string", visible: true, editable: true, required: false },
                        { name: "is_private", label: "Private", type: "boolean", visible: true, editable: true, required: false },
                        { name: "uploaded_by", label: "Uploaded By", type: "string", visible: true, editable: false, required: false },
                        { name: "created_at", label: "Uploaded At", type: "date", visible: true, editable: false, required: false },
                        { name: "updated_at", label: "Updated At", type: "date", visible: true, editable: false, required: false }
                    ],
                    relations: [
                        { table: "entities", foreignKey: "entity_id" },
                        { table: "customers", foreignKey: "entity_id", condition: { entity_type: "customer" } },
                        { table: "products", foreignKey: "entity_id", condition: { entity_type: "product" } },
                        { table: "lead", foreignKey: "entity_id", condition: { entity_type: "lead" } },
                        { table: "campaigns", foreignKey: "entity_id", condition: { entity_type: "campaign" } },
                        { table: "contacts", foreignKey: "entity_id", condition: { entity_type: "contact" } },
                        { table: "activities", foreignKey: "entity_id", condition: { entity_type: "activity" } }
                    ]
                },
            
                tags: {
                    primaryKey: "tag_id",
                    titleField: "name",
                    subtitleField: "category",
                    columns: [
                        { name: "tag_id", label: "Tag ID", type: "string", visible: true, editable: false, required: false },
                        { name: "name", label: "Tag Name", type: "string", visible: true, editable: true, required: true },
                        { name: "category", label: "Category", type: "string", visible: true, editable: true, required: false },
                        { name: "color", label: "Color", type: "string", visible: true, editable: true, required: false },
                        { name: "created_at", label: "Created At", type: "date", visible: true, editable: false, required: false },
                        { name: "updated_at", label: "Updated At", type: "date", visible: true, editable: false, required: false }
                    ],
                    relations: [
                        { table: "entity_tags", foreignKey: "tag_id" }
                    ]
                },
            
                entity_tags: {
                    primaryKey: "entity_tag_id",
                    titleField: "entity_tag_id",
                    subtitleField: "entity_type",
                    columns: [
                        { name: "entity_tag_id", label: "ID", type: "string", visible: true, editable: false, required: false },
                        { name: "entity_id", label: "Entity", type: "relation", relation: "entities", visible: true, editable: true, required: true },
                        { name: "entity_type", label: "Entity Type", type: "string", visible: true, editable: true, required: true },
                        { name: "tag_id", label: "Tag", type: "relation", relation: "tags", visible: true, editable: true, required: true },
                        { name: "created_at", label: "Created At", type: "date", visible: true, editable: false, required: false }
                    ],
                    relations: [
                        { table: "entities", foreignKey: "entity_id" },
                        { table: "tags", foreignKey: "tag_id" },
                        { table: "customers", foreignKey: "entity_id", condition: { entity_type: "customer" } },
                        { table: "products", foreignKey: "entity_id", condition: { entity_type: "product" } },
                        { table: "lead", foreignKey: "entity_id", condition: { entity_type: "lead" } },
                        { table: "campaigns", foreignKey: "entity_id", condition: { entity_type: "campaign" } },
                        { table: "contacts", foreignKey: "entity_id", condition: { entity_type: "contact" } }
                    ]
                }
            };            
            // Check if we have default metadata
            if (oDefaultMetadata[sTableId]) {
                // Store in cache
                this._tableMetadataCache[sTableId] = oDefaultMetadata[sTableId];
                
                // Also store in entity cache manager if available
                if (this._entityCacheManager) {
                    const sCacheKey = `metadata_${sTableId}`;
                    this._entityCacheManager.setEntityCache(sCacheKey, oDefaultMetadata[sTableId]);
                }
                
                return oDefaultMetadata[sTableId];
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
            
            // Also store in entity cache manager if available
            if (this._entityCacheManager) {
                const sCacheKey = `metadata_${sTableId}`;
                this._entityCacheManager.setEntityCache(sCacheKey, oGenericMetadata);
            }
            
            return oGenericMetadata;
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