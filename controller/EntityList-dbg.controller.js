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
            
            // Add columns and cells based on metadata
            oMetadata.columns.forEach((oColumnMetadata) => {
                // Skip columns that are not visible in list
                if (!oColumnMetadata.visible) {
                    return;
                }
                
                // Store visible column
                this._visibleColumns.push(oColumnMetadata);
                
                // Create column
                const oColumn = new Column({
                    header: new Label({
                        text: oColumnMetadata.label
                    }),
                    width: oColumnMetadata.type === "date" ? "12rem" : undefined
                });
                
                oTable.addColumn(oColumn);
                
                // Create cell
                let oCell;
                
                switch (oColumnMetadata.type) {
                    case "date":
                        oCell = new Text({
                            text: {
                                path: "viewModel>" + oColumnMetadata.name,
                                formatter: function(value) {
                                    if (!value) {
                                        return "";
                                    }
                                    return new Date(value).toLocaleDateString();
                                }
                            }
                        });
                        break;
                    case "boolean":
                        oCell = new Text({
                            text: {
                                path: "viewModel>" + oColumnMetadata.name,
                                formatter: function(value) {
                                    return value ? "Yes" : "No";
                                }
                            }
                        });
                        break;
                    case "relation":
                        oCell = new Text({
                            text: {
                                path: "viewModel>" + oColumnMetadata.name + "_text"
                            }
                        });
                        break;
                    default:
                        oCell = new Text({
                            text: "{viewModel>" + oColumnMetadata.name + "}"
                        });
                }
                
                oTemplate.addCell(oCell);
            });
            
            // Properly bind the table items
            oTable.bindItems({
                path: "viewModel>/items",
                template: oTemplate
            });
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
                const sPrimaryKey = oMetadata.primaryKey;
                const sPrimaryKeyValue = oItemData[sPrimaryKey];
                
                console.log("Navigating to detail with ID:", sPrimaryKeyValue);
                
                // Navigate to the detail view
                this.getRouter().navTo("entityDetail", {
                    table: sTableId,
                    id: sPrimaryKeyValue
                });
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