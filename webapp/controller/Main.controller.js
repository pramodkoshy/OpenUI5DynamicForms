sap.ui.define([
    "com/supabase/easyui5/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/m/Button",
    "sap/m/Text",
    "sap/m/VBox",
    "sap/m/HBox",
    "sap/m/Title",
    "sap/ui/core/Icon",
    "sap/m/Panel",
    "sap/ui/core/CustomData"
], function(
    BaseController, 
    JSONModel, 
    Filter, 
    FilterOperator, 
    MessageToast, 
    Button, 
    Text, 
    VBox,
    HBox,
    Title,
    Icon,
    Panel,
    CustomData
) {
    "use strict";

    return BaseController.extend("com.supabase.easyui5.controller.Home", {
        
        onInit: function() {
            // For debugging, create a local model if the tables model isn't available
            if (!this.getOwnerComponent().getModel("tables")) {
                const oTablesModel = new JSONModel({
                    tables: [
                        { id: "suppliers", title: "Suppliers", icon: "sap-icon://supplier", count: 0 },
                        { id: "products", title: "Products", icon: "sap-icon://product", count: 0 },
                        { id: "customers", title: "Customers", icon: "sap-icon://customer", count: 0 },
                        { id: "orders", title: "Orders", icon: "sap-icon://sales-order", count: 0 },
                        { id: "order_items", title: "Order Items", icon: "sap-icon://list", count: 0 }
                    ]
                });
                this.getOwnerComponent().setModel(oTablesModel, "tables");
                console.log("Created fallback tables model");
            }
            
            // Create settings model
            const oSettingsModel = new JSONModel({
                selectedTab: "all",
                theme: "sap_horizon",
                compactDensity: true
            });
            this.getView().setModel(oSettingsModel, "settings");
            
            // Set up icon tab bar
            this.getView().byId("idIconTabBar").setSelectedKey("all");
            
            // Load table counts when Supabase is available
            this._loadTableCounts();
            
            // Create category cards
            this._createCategoryCards();
        },
        
        /**
         * Toggle navigation panel
         */
        onToggleNav: function() {
            const oSplitApp = this.getOwnerComponent().byId("app");
            const oAppViewModel = this.getOwnerComponent().getView().getModel("appView");
            
            if (oSplitApp) {
                // Get current state
                const bExpanded = oAppViewModel ? oAppViewModel.getProperty("/navExpanded") : true;
                
                // Toggle the panel
                if (bExpanded) {
                    oSplitApp.hideMaster();
                } else {
                    oSplitApp.showMaster();
                }
                
                // Update model if available
                if (oAppViewModel) {
                    oAppViewModel.setProperty("/navExpanded", !bExpanded);
                }
            }
        },
        
        /**
         * Create category cards for the Grid layout
         * @private
         */
        _createCategoryCards: function() {
            const oGrid = this.getView().byId("categoryGrid");
            const oTablesModel = this.getOwnerComponent().getModel("tables");
            const aTables = oTablesModel.getProperty("/tables");
            
            // Clear existing content
            oGrid.removeAllContent();
            
            // Create cards for each table
            aTables.forEach(oTable => {
                // Create a Panel for each category
                const oPanel = new Panel({
                    expandable: false,
                    expanded: true,
                    backgroundDesign: "Solid"
                });
                oPanel.addStyleClass("sapUiSmallMargin");
                oPanel.addStyleClass("categoryCard");
                
                // Header with icon and title
                const oHeader = new HBox();
                oHeader.addStyleClass("sapUiSmallMargin");
                oHeader.setAlignItems("Center");
                
                // Add icon
                const oIcon = new Icon({
                    src: oTable.icon,
                    size: "2rem",
                    color: "#0854A0"
                });
                oIcon.addStyleClass("sapUiSmallMarginEnd");
                oHeader.addItem(oIcon);
                
                // Add title
                const oTitle = new Title({
                    text: oTable.title,
                    level: "H3"
                });
                oHeader.addItem(oTitle);
                
                // Set the panel header text (not custom header)
                oPanel.setHeaderText(oTable.title);
                
                // Content
                const oContent = new VBox();
                oContent.addStyleClass("sapUiSmallMargin");
                
                // Description
                const oDesc1 = new Text({
                    text: "Manage your " + oTable.title + " data with full CRUD operations"
                });
                oDesc1.addStyleClass("sapUiTinyMarginBottom");
                oContent.addItem(oDesc1);
                
                const oDesc2 = new Text({
                    text: "Search, filter, and edit records easily"
                });
                oDesc2.addStyleClass("sapUiTinyMarginBottom");
                oContent.addItem(oDesc2);
                
                // Add count text if available
                if (oTable.count > 0) {
                    const oCount = new Text({
                        text: "Total records: " + oTable.count
                    });
                    oCount.addStyleClass("sapUiTinyMarginTop");
                    oContent.addItem(oCount);
                }
                
                // Button container
                const oButtonContainer = new HBox();
                oButtonContainer.addStyleClass("sapUiSmallMarginTop");
                oButtonContainer.setJustifyContent("End");
                oButtonContainer.setAlignItems("Center");
                
                // Add action button
                const oButton = new Button({
                    text: "Open " + oTable.title,
                    type: "Emphasized",
                    press: this.onCategoryPress.bind(this)
                });
                
                // Add custom data instead of data-* attributes
                oButton.addCustomData(new CustomData({
                    key: "table",
                    value: oTable.id,
                    writeToDom: true
                }));
                
                oButtonContainer.addItem(oButton);
                
                // Add content to panel
                oContent.addItem(oButtonContainer);
                oPanel.addContent(oContent);
                
                // Add panel to grid
                oGrid.addContent(oPanel);
            });
        },
        
        /**
         * Load record counts for each table
         * @private
         */
        _loadTableCounts: function() {
            // Wait for Supabase client to be ready
            const iCheckInterval = setInterval(() => {
                if (this.getSupabaseClient()) {
                    clearInterval(iCheckInterval);
                    this._updateTableCounts();
                }
            }, 500);
            
            // Clear interval after 10 seconds if Supabase client is not available
            setTimeout(() => {
                clearInterval(iCheckInterval);
            }, 10000);
        },
        
        /**
         * Update table counts from Supabase
         * @private
         */
        _updateTableCounts: function() {
            const oTablesModel = this.getOwnerComponent().getModel("tables");
            const aTables = oTablesModel.getProperty("/tables");
            
            // Load counts for each table
            aTables.forEach(oTable => {
                this.getSupabaseClient()
                    .from(oTable.id)
                    .select("*", { count: "exact", head: true })
                    .then(({ count, error }) => {
                        if (!error) {
                            // Update table count
                            const iTableIndex = aTables.findIndex(t => t.id === oTable.id);
                            if (iTableIndex !== -1) {
                                const sPath = "/tables/" + iTableIndex + "/count";
                                oTablesModel.setProperty(sPath, count || 0);
                            }
                        }
                    })
                    .catch(error => {
                        console.error("Error getting count for table " + oTable.id, error);
                    });
            });
            
            // Recreate category cards with updated counts
            setTimeout(() => {
                this._createCategoryCards();
            }, 1000);
        },
        
        /**
         * Handler for category press from tab panel
         * @param {sap.ui.base.Event} oEvent The button press event 
         */
        onCategoryPress: function(oEvent) {
            const oSource = oEvent.getSource();
            
            // Get table ID from custom data
            let sTableId = "";
            const aCustomData = oSource.getCustomData();
            
            for (let i = 0; i < aCustomData.length; i++) {
                if (aCustomData[i].getKey() === "table") {
                    sTableId = aCustomData[i].getValue();
                    break;
                }
            }
            
            if (sTableId) {
                // Navigate to the entity list
                this.getRouter().navTo("entityList", {
                    table: sTableId
                });
            } else {
                MessageToast.show("Could not determine which table to open");
            }
        },
        
        /**
         * Handler for tab select
         * @param {sap.ui.base.Event} oEvent The tab select event
         */
        onTabSelect: function(oEvent) {
            const sKey = oEvent.getParameter("key");
            const oSettingsModel = this.getView().getModel("settings");
            
            // Store selected tab in settings model
            oSettingsModel.setProperty("/selectedTab", sKey);
            
            // If a specific table category is selected, we can navigate directly
            if (sKey !== "all") {
                // Get tables from the model
                const oTablesModel = this.getOwnerComponent().getModel("tables");
                const aTables = oTablesModel.getProperty("/tables");
                
                // Find the table with matching key
                const oTable = aTables.find(t => t.id === sKey);
                
                if (oTable) {
                    // Show info about table
                    MessageToast.show("Selected " + oTable.title + " category");
                }
            }
        },
        
        /**
         * Handler for search
         * @param {sap.ui.base.Event} oEvent The search event
         */
        onSearch: function(oEvent) {
            // Get the search query
            const sQuery = oEvent.getParameter("query") || "";
            
            // Apply filtering to the grid
            if (sQuery.length > 0) {
                // Get tables
                const oTablesModel = this.getOwnerComponent().getModel("tables");
                const aTables = oTablesModel.getProperty("/tables");
                
                // Filter tables
                const aFilteredTables = aTables.filter(oTable => {
                    return oTable.title.toLowerCase().includes(sQuery.toLowerCase()) ||
                           oTable.id.toLowerCase().includes(sQuery.toLowerCase());
                });
                
                // Clear grid
                const oGrid = this.getView().byId("categoryGrid");
                oGrid.removeAllContent();
                
                // Create cards for filtered tables
                aFilteredTables.forEach(oTable => {
                    // Create panel for each table (similar to _createCategoryCards)
                    const oPanel = new Panel({
                        expandable: false,
                        expanded: true,
                        backgroundDesign: "Solid"
                    });
                    oPanel.addStyleClass("sapUiSmallMargin");
                    oPanel.addStyleClass("categoryCard");
                    
                    // Header with icon and title
                    const oHeader = new HBox();
                    oHeader.addStyleClass("sapUiSmallMargin");
                    oHeader.setAlignItems("Center");
                    
                    // Add icon
                    const oIcon = new Icon({
                        src: oTable.icon,
                        size: "2rem",
                        color: "#0854A0"
                    });
                    oIcon.addStyleClass("sapUiSmallMarginEnd");
                    oHeader.addItem(oIcon);
                    
                    // Add title
                    const oTitle = new Title({
                        text: oTable.title,
                        level: "H3"
                    });
                    oHeader.addItem(oTitle);
                    
                    // Set the panel header text
                    oPanel.setHeaderText(oTable.title);
                    
                    // Content
                    const oContent = new VBox();
                    oContent.addStyleClass("sapUiSmallMargin");
                    
                    // Description
                    const oDesc1 = new Text({
                        text: "Manage your " + oTable.title + " data with full CRUD operations"
                    });
                    oDesc1.addStyleClass("sapUiTinyMarginBottom");
                    oContent.addItem(oDesc1);
                    
                    const oDesc2 = new Text({
                        text: "Search, filter, and edit records easily"
                    });
                    oDesc2.addStyleClass("sapUiTinyMarginBottom");
                    oContent.addItem(oDesc2);
                    
                    // Add count text if available
                    if (oTable.count > 0) {
                        const oCount = new Text({
                            text: "Total records: " + oTable.count
                        });
                        oCount.addStyleClass("sapUiTinyMarginTop");
                        oContent.addItem(oCount);
                    }
                    
                    // Button container
                    const oButtonContainer = new HBox();
                    oButtonContainer.addStyleClass("sapUiSmallMarginTop");
                    oButtonContainer.setJustifyContent("End");
                    oButtonContainer.setAlignItems("Center");
                    
                    // Add action button with custom data
                    const oButton = new Button({
                        text: "Open " + oTable.title,
                        type: "Emphasized",
                        press: this.onCategoryPress.bind(this)
                    });
                    
                    oButton.addCustomData(new CustomData({
                        key: "table",
                        value: oTable.id,
                        writeToDom: true
                    }));
                    
                    oButtonContainer.addItem(oButton);
                    
                    // Add content to panel
                    oContent.addItem(oButtonContainer);
                    oPanel.addContent(oContent);
                    
                    // Add panel to grid
                    oGrid.addContent(oPanel);
                });
                
                // Show message if no results
                if (aFilteredTables.length === 0) {
                    MessageToast.show("No tables found matching: " + sQuery);
                } else {
                    MessageToast.show("Found " + aFilteredTables.length + " matching tables");
                }
            } else {
                // Reset to show all tables
                this._createCategoryCards();
            }
        }