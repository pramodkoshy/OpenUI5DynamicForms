sap.ui.define([
    "com/supabase/easyui5/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/m/Column",
    "sap/m/Text",
    "sap/m/Label"
], function(BaseController, JSONModel, Column, Text, Label) {
    "use strict";

    return BaseController.extend("com.supabase.easyui5.controller.EntityList", {
        
        /**
         * Lifecycle hook when the controller is initialized
         */
        onInit: function() {
            const oViewModel = new JSONModel({
                tableName: "",
                tableId: "",
                items: [],
                busy: false
            });
            
            this.setModel(oViewModel, "viewModel");
            
            // Register for route matched event
            this.getRouter().getRoute("entityList").attachPatternMatched(this._onRouteMatched, this);
        },
        
       /**
         * Toggle navigation panel - simplified direct access
         */
        onToggleNav: function() {
            try {
                // Get root component view
                const oComponentContainer = sap.ui.getCore().byId("content");
                let oSplitApp = null;
                
                // Try multiple ways to get the SplitApp
                // 1. Direct method via component
                if (this.getOwnerComponent() && this.getOwnerComponent().getSplitApp) {
                    oSplitApp = this.getOwnerComponent().getSplitApp();
                }
                
                // 2. Via component root control
                if (!oSplitApp && this.getOwnerComponent() && this.getOwnerComponent().getRootControl) {
                    const oRootControl = this.getOwnerComponent().getRootControl();
                    if (oRootControl) {
                        oSplitApp = oRootControl.byId("app");
                    }
                }
                
                // 3. Direct access via known ID
                if (!oSplitApp) {
                    oSplitApp = sap.ui.getCore().byId("__component0---app");
                    if (!oSplitApp) {
                        oSplitApp = sap.ui.getCore().byId("__xmlview0--app");
                    }
                }
                
                // 4. Find by type
                if (!oSplitApp) {
                    const aSplitApps = sap.ui.getCore().byFieldGroupId("").filter(function(oControl) {
                        return oControl instanceof sap.m.SplitApp;
                    });
                    
                    if (aSplitApps.length > 0) {
                        oSplitApp = aSplitApps[0];
                    }
                }
                
                if (!oSplitApp) {
                    console.error("SplitApp control not found!");
                    return;
                }
                
                // Get app view model
                const oAppViewModel = this.getOwnerComponent().getModel("appView");
                
                // If no model found, create one
                if (!oAppViewModel) {
                    console.error("AppView model not found!");
                    return;
                }
                
                // Get current expansion state
                const bExpanded = oAppViewModel.getProperty("/navExpanded");
                
                // Get toggle button
                const oToggleButton = this.getView().byId("navToggleButton");
                
                console.log("Entity List toggle nav button pressed. Current state:", bExpanded ? "expanded" : "collapsed");
                
                // Toggle state
                if (bExpanded) {
                    // For mobile, we need to use specific approach
                    if (sap.ui.Device.system.phone) {
                        // On phone, we're in popover mode, so just hide master
                        oSplitApp.hideMaster();
                    } else {
                        // On tablet/desktop, ensure we're in HideMode or ShowHideMode
                        const sCurrentMode = oSplitApp.getMode();
                        if (sCurrentMode !== "HideMode" && sCurrentMode !== "ShowHideMode") {
                            oSplitApp.setMode("ShowHideMode");
                        }
                        oSplitApp.hideMaster();
                    }
                    
                    // Update button if available
                    if (oToggleButton) {
                        oToggleButton.setIcon("sap-icon://menu2");
                        oToggleButton.setTooltip("Show Navigation");
                    }
                    
                    // Update model state
                    oAppViewModel.setProperty("/navExpanded", false);
                } else {
                    // For mobile, we need to use specific approach
                    if (sap.ui.Device.system.phone) {
                        // On phone, we're in popover mode, so show master
                        oSplitApp.showMaster();
                    } else {
                        // On tablet/desktop, ensure we're in ShowHideMode
                        oSplitApp.setMode("ShowHideMode");
                        oSplitApp.showMaster();
                    }
                    
                    // Update button if available
                    if (oToggleButton) {
                        oToggleButton.setIcon("sap-icon://navigation-left-arrow");
                        oToggleButton.setTooltip("Hide Navigation");
                    }
                    
                    // Update model state
                    oAppViewModel.setProperty("/navExpanded", true);
                }
            } catch (error) {
                console.error("Error in menu toggle:", error);
            }
        },
        /**
         * Route matched handler
         * @param {sap.ui.base.Event} oEvent The route matched event
         * @private
         */
        _onRouteMatched: function(oEvent) {
            const sTableId = oEvent.getParameter("arguments").table;
            console.log("EntityList route matched with table:", sTableId);
            
            // Store the table ID in the view model
            const oViewModel = this.getModel("viewModel");
            oViewModel.setProperty("/tableId", sTableId);
            
            // Set table name based on the ID (capitalize first letter)
            const sTableName = sTableId.charAt(0).toUpperCase() + sTableId.slice(1).replace(/_/g, " ");
            oViewModel.setProperty("/tableName", sTableName);
            
            // Set the page title
            this.getView().byId("entityListPage").setTitle(sTableName + " List");
            
            // Load metadata for the table
            this.getTableMetadata(sTableId).then((oMetadata) => {
                // Configure table columns based on metadata
                this._configureTable(oMetadata);
                
                // Load the data
                this._loadData(sTableId, oMetadata);
            }).catch(error => {
                console.error("Error loading metadata:", error);
            });
        },
        
        /**
         * Configure the table columns based on metadata
         * @param {Object} oMetadata The table metadata
         * @private
         */
        _configureTable: function(oMetadata) {
            const oTable = this.getView().byId("entityTable");
            
            // Clear existing columns
            oTable.removeAllColumns();
            
            // Retrieve the existing template or create a new one if it doesn't exist
            let oTemplate = oTable.getBindingInfo("items") && oTable.getBindingInfo("items").template;
            if (!oTemplate) {
                oTemplate = new sap.m.ColumnListItem({
                    type: "Navigation",
                    press: this.onItemPress.bind(this)
                });
            } else {
                // Clear existing cells if template exists
                oTemplate.removeAllCells();
            }
            
            // Track visible columns for reference
            this._visibleColumns = [];
            
            // Filter for visible columns and take only the first 5 (or fewer if there aren't 5)
            const aVisibleColumns = oMetadata.columns
                .filter(col => col.visible)
                .slice(0, 5);
            
            // Add columns and cells based on metadata
            aVisibleColumns.forEach((oColumnMetadata, index) => {
                // Store visible column
                this._visibleColumns.push(oColumnMetadata);
                
                // Set column width based on data type
                let sWidth;
                
                switch (oColumnMetadata.type) {
                    case "boolean":
                        sWidth = "8rem";
                        break;
                    case "date":
                        sWidth = "12rem";
                        break;
                    case "number":
                    case "integer":
                        sWidth = "10rem";
                        break;
                    case "email":
                    case "url":
                        sWidth = "18rem";
                        break;
                    case "relation":
                        sWidth = "15rem";
                        break;
                    default:
                        // For the first columns, give them more space
                        if (index === 0) {
                            sWidth = "18rem"; // Primary ID column
                        } else if (index === 1) {
                            sWidth = "20rem"; // Name/title column
                        } else if (index === 2) {
                            sWidth = "20rem"; // Description column
                        } else {
                            sWidth = "15rem"; // Other columns
                        }
                }
                
                // Create column with appropriate width
                const oColumn = new sap.m.Column({
                    header: new sap.m.Label({
                        text: oColumnMetadata.label,
                        design: "Bold"
                    }),
                    width: sWidth,
                    minScreenWidth: "Tablet",
                    demandPopin: true,
                    popinDisplay: "Inline",
                    hAlign: oColumnMetadata.type === "number" || oColumnMetadata.type === "integer" ? "End" : "Begin"
                });
                
                oTable.addColumn(oColumn);
                
                // Create cell
                let oCell;
                
                switch (oColumnMetadata.type) {
                    case "date":
                        oCell = new sap.m.Text({
                            text: {
                                path: "viewModel>" + oColumnMetadata.name,
                                formatter: function(value) {
                                    if (!value) {
                                        return "";
                                    }
                                    return new Date(value).toLocaleDateString();
                                }
                            },
                            wrapping: false
                        });
                        break;
                    case "boolean":
                        oCell = new sap.m.Text({
                            text: {
                                path: "viewModel>" + oColumnMetadata.name,
                                formatter: function(value) {
                                    return value ? "Yes" : "No";
                                }
                            },
                            wrapping: false
                        });
                        break;
                    case "relation":
                        oCell = new sap.m.Text({
                            text: {
                                path: "viewModel>" + oColumnMetadata.name + "_text"
                            },
                            wrapping: false
                        });
                        break;
                    case "number":
                        oCell = new sap.m.Text({
                            text: {
                                path: "viewModel>" + oColumnMetadata.name,
                                formatter: function(value) {
                                    if (value === undefined || value === null) return "";
                                    return parseFloat(value).toFixed(2);
                                }
                            },
                            wrapping: false
                        });
                        break;
                    default:
                        oCell = new sap.m.Text({
                            text: "{viewModel>" + oColumnMetadata.name + "}",
                            wrapping: false,
                            maxLines: 2
                        });
                }
                
                // Apply common styling to all cells
                oCell.addStyleClass("sapUiTinyMarginBeginEnd");
                
                oTemplate.addCell(oCell);
            });
            
            // Properly bind the table items
            oTable.bindItems({
                path: "viewModel>/items",
                template: oTemplate
            });
            
            // Make sure table has these settings for better display
            oTable.setFixedLayout(false);  // Allow the table to adjust column widths
            oTable.setAlternateRowColors(true);  // Improve readability with alternating row colors
            oTable.setPopinLayout("Block");  // Better layout for responsive design
            
            // Add CSS class to the table
            oTable.addStyleClass("sapUiResponsiveMargin");
        },
        
        /**
         * Load data from Supabase
         * @param {string} sTableId The table ID
         * @param {Object} oMetadata The table metadata
         * @private
         */
        _loadData: function(sTableId, oMetadata) {
            const oViewModel = this.getModel("viewModel");
            
            // Set busy state
            oViewModel.setProperty("/busy", true);
            
            console.log("Loading data from table:", sTableId);
            
            // Select all columns
            this.getSupabaseClient()
                .from(sTableId)
                .select('*')
                .then(async ({ data, error }) => {
                    if (error) {
                        console.error("Error loading data:", error);
                        this.showErrorMessage("Error loading data", error);
                        oViewModel.setProperty("/busy", false);
                        return;
                    }
                    
                    // Create a safe fallback if data is null or undefined
                    data = data || [];
                    console.log(`Loaded ${data.length} records`);
                    
                    // Process relation fields
                    for (let i = 0; i < data.length; i++) {
                        for (const oColumnMetadata of oMetadata.columns) {
                            if (oColumnMetadata.type === "relation" && data[i][oColumnMetadata.name]) {
                                const relatedId = data[i][oColumnMetadata.name];
                                const relatedTable = oColumnMetadata.relation;
                                
                                try {
                                    // Get related record
                                    const relatedMetadata = await this.getTableMetadata(relatedTable);
                                    const { data: relatedData, error: relatedError } = await this.getSupabaseClient()
                                        .from(relatedTable)
                                        .select('*')
                                        .eq(relatedMetadata.primaryKey, relatedId)
                                        .single();
                                    
                                    if (!relatedError && relatedData) {
                                        // Store related text
                                        data[i][oColumnMetadata.name + "_text"] = relatedData[relatedMetadata.titleField];
                                    }
                                } catch (e) {
                                    console.error("Error loading related data", e);
                                }
                            }
                        }
                    }
                    
                    // Update model with items
                    oViewModel.setProperty("/items", data);
                    oViewModel.setProperty("/busy", false);
                    
                    // Update count
                    const sCount = data.length + " " + (data.length === 1 ? "item" : "items");
                    this.getView().byId("tableCountText").setText(sCount);
                }).catch(error => {
                    console.error("Error in Supabase query:", error);
                    oViewModel.setProperty("/busy", false);
                });
        },
        
        /**
         * Handler for the item press (navigation to detail)
         * @param {sap.ui.base.Event} oEvent The item press event
         */
        onItemPress: function(oEvent) {
            // Get the item that was clicked
            const oItem = oEvent.getSource();
            const oBindingContext = oItem.getBindingContext("viewModel");
            
            if (!oBindingContext) {
                console.error("No binding context found");
                return;
            }
            
            // Get the data of the clicked item
            const oItemData = oBindingContext.getObject();
            const sTableId = this.getModel("viewModel").getProperty("/tableId");
            
            console.log("Item clicked:", oItemData);
            
            // Get the primary key from the metadata
            this.getTableMetadata(sTableId).then((oMetadata) => {
                const sPrimaryKey = oMetadata.primaryKey || `${sTableId}_id`;
                console.log("Primary key field:", sPrimaryKey);
                console.log("Item data keys:", Object.keys(oItemData));
                
                // Get the primary key value
                const sPrimaryKeyValue = oItemData[sPrimaryKey];
                
                if (sPrimaryKeyValue === undefined) {
                    console.error("Primary key value is undefined. Cannot navigate.");
                    return;
                }
                
                console.log("Navigating to detail with ID:", sPrimaryKeyValue);
                
                // Navigate to the detail view - ADD DEBUG HERE
                try {
                    const oRouter = this.getRouter();
                    console.log("Router object:", oRouter);
                    
                    // Log the route info
                    console.log("Route params:", {
                        routeName: "entityDetail", 
                        params: {table: sTableId, id: sPrimaryKeyValue}
                    });
                    
                    oRouter.navTo("entityDetail", {
                        table: sTableId,
                        id: sPrimaryKeyValue
                    }, false);  // Added false to prevent history manipulation issues
                    
                    console.log("Navigation call completed");
                } catch (oError) {
                    console.error("Navigation error:", oError);
                }
            }).catch(error => {
                console.error("Error getting metadata for navigation:", error);
            });
        },
        
        /**
         * Handler for the create button press
         */
        onCreatePress: function() {
            const sTableId = this.getModel("viewModel").getProperty("/tableId");
            
            this.getRouter().navTo("entityCreate", {
                table: sTableId
            });
        },
        
        /**
         * Handler for the refresh button press
         */
        onRefreshPress: function() {
            const sTableId = this.getModel("viewModel").getProperty("/tableId");
            
            // Load metadata for the table
            this.getTableMetadata(sTableId).then((oMetadata) => {
                // Load the data
                this._loadData(sTableId, oMetadata);
            });
        },
        
        /**
         * Handler for the search
         * @param {sap.ui.base.Event} oEvent The search event
         */
        onSearch: function(oEvent) {
            const sQuery = oEvent.getParameter("query").toLowerCase();
            const oViewModel = this.getModel("viewModel");
            const aAllItems = [...oViewModel.getProperty("/items")]; // Create a copy
            
            if (!sQuery) {
                // Load original data to reset the filter
                const sTableId = oViewModel.getProperty("/tableId");
                this.getTableMetadata(sTableId).then(oMetadata => {
                    this._loadData(sTableId, oMetadata);
                });
                return;
            }
            
            // Filter items
            const aFilteredItems = aAllItems.filter(item => {
                // Convert item to string and check if it includes the query
                return JSON.stringify(item).toLowerCase().includes(sQuery);
            });
            
            // Update model with filtered items
            oViewModel.setProperty("/items", aFilteredItems);
            
            // Update count
            const sCount = aFilteredItems.length + " " + (aFilteredItems.length === 1 ? "item" : "items") + " (filtered)";
            this.getView().byId("tableCountText").setText(sCount);
        },
        
        /**
         * Handler for the table update finished
         * @param {sap.ui.base.Event} oEvent The table update finished event
         */
        onTableUpdateFinished: function(oEvent) {
            const iTotalItems = oEvent.getParameter("total");
            
            // Update the count
            const sCount = iTotalItems + " " + (iTotalItems === 1 ? "item" : "items");
            this.getView().byId("tableCountText").setText(sCount);
        },
        
        /**
         * Navigation handler
         */
        onNavBack: function() {
            this.navBack();
        }
    });
});