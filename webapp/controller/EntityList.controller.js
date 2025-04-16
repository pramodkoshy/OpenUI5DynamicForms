sap.ui.define([
    "com/supabase/easyui5/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/m/Column",
    "sap/m/Text",
    "sap/m/Label",
    "sap/m/Input",
    "sap/m/DatePicker",
    "sap/m/CheckBox",
    "sap/m/ComboBox",
    "sap/m/Token",
    "sap/m/Dialog",
    "sap/m/List",
    "sap/m/StandardListItem",
    "sap/ui/core/Item",
    "sap/ui/layout/form/SimpleForm",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/m/Button" // Added Button control to fix the error
], function(
    BaseController, 
    JSONModel, 
    Column, 
    Text, 
    Label,
    Input,
    DatePicker,
    CheckBox,
    ComboBox,
    Token,
    Dialog,
    List,
    StandardListItem,
    Item,
    SimpleForm,
    MessageToast,
    MessageBox,
    Button // Added Button to function parameters
) {
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
                allItems: [], // Store unfiltered items
                busy: false,
                visibleColumns: [],
                availableColumns: [],
                filterCriteria: {},
                filterInfo: ""
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
            
            // Reset filter criteria and columns
            oViewModel.setProperty("/filterCriteria", {});
            oViewModel.setProperty("/visibleColumns", []);
            oViewModel.setProperty("/availableColumns", []);
            oViewModel.setProperty("/filterInfo", "");
            
            // Set table name based on the ID (capitalize first letter)
            const sTableName = sTableId.charAt(0).toUpperCase() + sTableId.slice(1).replace(/_/g, " ");
            oViewModel.setProperty("/tableName", sTableName);
            
            // Set the page title
            this.getView().byId("entityListPage").setTitle(sTableName + " List");
            
            // Ensure the header is collapsed when navigating to a new list
            try {
                const oDynamicPage = this.getView().byId("entityListPage").getContent()[0];
                if (oDynamicPage && oDynamicPage.setHeaderExpanded) {
                    oDynamicPage.setHeaderExpanded(false);
                }
            } catch (error) {
                console.error("Error setting header state:", error);
            }
            
            // Load metadata for the table
            this.getTableMetadata(sTableId).then((oMetadata) => {
                // Store metadata for later use
                this._tableMetadata = oMetadata;
                
                // Configure search form based on metadata
                this._configureSearchForm(oMetadata);
                
                // Configure table columns based on metadata
                this._configureTable(oMetadata);
                
                // Load the data
                this._loadData(sTableId, oMetadata);
            }).catch(error => {
                console.error("Error loading metadata:", error);
                MessageBox.error("Failed to load table metadata: " + error.message);
            });
        },
        
        /**
         * Configure search form based on metadata
         * @param {Object} oMetadata The table metadata
         * @private
         */
        _configureSearchForm: function(oMetadata) {
            const oSearchForm = this.getView().byId("searchForm");
            
            // Clear existing content
            oSearchForm.removeAllContent();
            
            // Add search fields based on metadata columns
            oMetadata.columns.forEach((oColumnMetadata) => {
                // Skip hidden columns or system fields
                if (!oColumnMetadata.visible || 
                    oColumnMetadata.name === 'created_at' || 
                    oColumnMetadata.name === 'updated_at') {
                    return;
                }
                
                // Add label first
                oSearchForm.addContent(new Label({
                    text: oColumnMetadata.label,
                    tooltip: "Search by " + oColumnMetadata.label
                }));
                
                // Create appropriate search field based on column type
                let oSearchField;
                
                switch (oColumnMetadata.type) {
                    case "date":
                        oSearchField = new DatePicker({
                            valueFormat: "yyyy-MM-dd",
                            displayFormat: "medium",
                            width: "100%"
                        });
                        break;
                        
                    case "boolean":
                        oSearchField = new ComboBox({
                            width: "100%",
                            items: [
                                new Item({key: "", text: "All"}),
                                new Item({key: "true", text: "Yes"}),
                                new Item({key: "false", text: "No"})
                            ]
                        });
                        break;
                        
                    case "relation":
                        oSearchField = new ComboBox({
                            width: "100%", 
                            showSecondaryValues: true
                        });
                        
                        // Load relation options
                        this._loadRelationOptions(
                            oSearchField, 
                            oColumnMetadata.relation, 
                            oColumnMetadata.name
                        );
                        break;
                        
                    default:
                        oSearchField = new Input({
                            width: "100%"
                        });
                }
                
                // Set common properties
                oSearchField.data("columnName", oColumnMetadata.name);
                oSearchField.data("columnType", oColumnMetadata.type);
                
                // Add field to form
                oSearchForm.addContent(oSearchField);
            });
        },
        
        /**
         * Configure the table columns based on metadata
         * @param {Object} oMetadata The table metadata
         * @private
         */
        _configureTable: function(oMetadata) {
            const oTable = this.getView().byId("entityTable");
            const oViewModel = this.getModel("viewModel");
            
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
            
            // Filter for visible columns and take only the first 7 (or fewer if there aren't 7)
            const aVisibleColumns = oMetadata.columns
                .filter(col => col.visible)
                .slice(0, 7);
            
            // Store all available columns for column selection
            const aAllColumns = oMetadata.columns.filter(col => col.visible);
            oViewModel.setProperty("/availableColumns", aAllColumns);
            oViewModel.setProperty("/visibleColumns", aVisibleColumns);
            
            // Add columns and cells based on metadata
            aVisibleColumns.forEach((oColumnMetadata, index) => {
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
                const oColumn = new Column({
                    header: new Label({
                        text: oColumnMetadata.label,
                        design: "Bold"
                    }),
                    width: sWidth,
                    minScreenWidth: "Tablet",
                    demandPopin: true,
                    popinDisplay: "Inline",
                    hAlign: oColumnMetadata.type === "number" || oColumnMetadata.type === "integer" ? "End" : "Begin"
                });
                
                // Store column metadata for reference
                oColumn.data("columnName", oColumnMetadata.name);
                oColumn.data("columnType", oColumnMetadata.type);
                
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
                            },
                            wrapping: false
                        });
                        break;
                    case "boolean":
                        oCell = new Text({
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
                        oCell = new Text({
                            text: {
                                path: "viewModel>" + oColumnMetadata.name + "_text"
                            },
                            wrapping: false
                        });
                        break;
                    case "number":
                        oCell = new Text({
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
                        oCell = new Text({
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
                    oViewModel.setProperty("/allItems", [...data]); // Store a copy of all items
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
         * Load relation options for advanced search ComboBox
         * @param {sap.m.ComboBox} oComboBox The ComboBox control
         * @param {string} sRelatedTable The related table name
         * @param {string} sFieldName The field name
         * @private
         */
        _loadRelationOptions: function(oComboBox, sRelatedTable, sFieldName) {
            // First get metadata for the related table
            this.getTableMetadata(sRelatedTable).then((oRelatedMetadata) => {
                const sPrimaryKey = oRelatedMetadata.primaryKey;
                const sTitleField = oRelatedMetadata.titleField || sPrimaryKey;
                
                // Get the data from the related table
                this.getSupabaseClient()
                    .from(sRelatedTable)
                    .select('*')
                    .then(({ data, error }) => {
                        if (error) {
                            console.error(`Error loading relation options for ${sFieldName}:`, error);
                            return;
                        }
                        
                        // Clear existing items
                        oComboBox.removeAllItems();
                        
                        // Add empty option first
                        oComboBox.addItem(new Item({
                            key: "",
                            text: "All"
                        }));
                        
                        // Add options from data
                        if (data && data.length > 0) {
                            data.forEach(item => {
                                oComboBox.addItem(new Item({
                                    key: item[sPrimaryKey],
                                    text: item[sTitleField] || item[sPrimaryKey]
                                }));
                            });
                        }
                    })
                    .catch(error => {
                        console.error(`Error in Supabase query for relation options:`, error);
                    });
            }).catch(error => {
                console.error(`Error getting metadata for relation ${sRelatedTable}:`, error);
            });
        },
        
        /**
         * Handler for the Columns button press (Column selection)
         */
        onColumnsButtonPress: function() {
            const oViewModel = this.getModel("viewModel");
            const aAvailableColumns = oViewModel.getProperty("/availableColumns");
            const aVisibleColumns = oViewModel.getProperty("/visibleColumns");
            
            // Create dialog for column selection
            if (!this._oColumnDialog) {
                this._oColumnDialog = new Dialog({
                    title: "Select Columns",
                    contentWidth: "400px",
                    content: new List({
                        mode: "MultiSelect",
                        includeItemInSelection: true,
                        items: {
                            path: "columns>/",
                            template: new StandardListItem({
                                title: "{columns>label}",
                                description: "{columns>name}",
                                type: "Active",
                                selected: {
                                    path: "columns>visible",
                                    formatter: function(bVisible) {
                                        return bVisible === true;
                                    }
                                }
                            })
                        }
                    }),
                    beginButton: new Button({
                        text: "Apply",
                        type: "Emphasized",
                        press: function() {
                            // Get selected columns
                            const oList = this._oColumnDialog.getContent()[0];
                            const aSelectedItems = oList.getSelectedItems();
                            const aSelectedColumns = aSelectedItems.map(item => {
                                const sPath = item.getBindingContext("columns").getPath();
                                return this._oColumnDialog.getModel("columns").getProperty(sPath);
                            });
                            
                            // Update visible columns
                            oViewModel.setProperty("/visibleColumns", aSelectedColumns);
                            
                            // Reconfigure table with selected columns
                            this._reconfigureTable(aSelectedColumns);
                            
                            this._oColumnDialog.close();
                        }.bind(this)
                    }),
                    endButton: new Button({
                        text: "Cancel",
                        press: function() {
                            this._oColumnDialog.close();
                        }.bind(this)
                    })
                });
                
                this.getView().addDependent(this._oColumnDialog);
            }
            
            // Prepare column selection data
            const aColumns = aAvailableColumns.map(column => {
                return {
                    name: column.name,
                    label: column.label,
                    type: column.type,
                    visible: aVisibleColumns.some(c => c.name === column.name)
                };
            });
            
            // Set model with column data
            this._oColumnDialog.setModel(new JSONModel(aColumns), "columns");
            
            // Open dialog
            this._oColumnDialog.open();
        },
        
        /**
         * Reconfigure table with selected columns
         * @param {Array} aSelectedColumns Array of selected column metadata
         * @private
         */
        _reconfigureTable: function(aSelectedColumns) {
            const oTable = this.getView().byId("entityTable");
            
            // Clear existing columns
            oTable.removeAllColumns();
            
            // Retrieve the existing template
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
            
            // Add columns and cells based on selected columns
            aSelectedColumns.forEach((oColumnMetadata, index) => {
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
                const oColumn = new Column({
                    header: new Label({
                        text: oColumnMetadata.label,
                        design: "Bold"
                    }),
                    width: sWidth,
                    minScreenWidth: "Tablet",
                    demandPopin: true,
                    popinDisplay: "Inline",
                    hAlign: oColumnMetadata.type === "number" || oColumnMetadata.type === "integer" ? "End" : "Begin"
                });
                
                // Store column metadata for reference
                oColumn.data("columnName", oColumnMetadata.name);
                oColumn.data("columnType", oColumnMetadata.type);
                
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
                            },
                            wrapping: false
                        });
                        break;
                    case "boolean":
                        oCell = new Text({
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
                        oCell = new Text({
                            text: {
                                path: "viewModel>" + oColumnMetadata.name + "_text"
                            },
                            wrapping: false
                        });
                        break;
                    case "number":
                        oCell = new Text({
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
                        oCell = new Text({
                            text: "{viewModel>" + oColumnMetadata.name + "}",
                            wrapping: false,
                            maxLines: 2
                        });
                }
                
                // Apply common styling to all cells
                oCell.addStyleClass("sapUiTinyMarginBeginEnd");
                
                oTemplate.addCell(oCell);
            });
            
            // Update the table template
            const oBinding = oTable.getBinding("items");
            if (oBinding) {
                oBinding.getTemplate = function() {
                    return oTemplate;
                };
                oTable.invalidate();
            } else {
                // Properly bind the table items if not already bound
                oTable.bindItems({
                    path: "viewModel>/items",
                    template: oTemplate
                });
            }
        },
        
        /**
         * Handler for the search button in the header
         */
        onServerSearchPress: function() {
            try {
                var oDynamicPage = this.getView().byId("entityListPage").getContent()[0];
                if (oDynamicPage) {
                    // Always expand the header when server search is clicked
                    oDynamicPage.setHeaderExpanded(true);
                    
                    // Show a message to indicate server search is active
                    MessageToast.show("Server search activated - use form to search database");
                }
            } catch (error) {
                console.error("Error in server search button handler:", error);
                MessageToast.show("Could not activate server search form");
            }
        },
        
        /**
         * Handler for the advanced search button
         */
        onAdvancedSearch: function() {
            const oSearchForm = this.getView().byId("searchForm");
            const oViewModel = this.getModel("viewModel");
            const sTableId = oViewModel.getProperty("/tableId");
            
            // Collect search criteria from form
            const oFilterCriteria = {};
            let bHasFilters = false;
            
            // Get all input fields from search form
            const aFormContent = oSearchForm.getContent();
            for (let i = 0; i < aFormContent.length; i++) {
                const oControl = aFormContent[i];
                
                // Skip labels
                if (oControl instanceof Label) {
                    continue;
                }
                
                // Get column name and value from control
                const sColumnName = oControl.data("columnName");
                const sColumnType = oControl.data("columnType");
                let sValue;
                
                // Get value based on control type
                if (oControl instanceof ComboBox) {
                    sValue = oControl.getSelectedKey();
                } else if (oControl instanceof CheckBox) {
                    sValue = oControl.getSelected() ? "true" : "false";
                } else if (oControl instanceof DatePicker) {
                    sValue = oControl.getValue();
                } else {
                    sValue = oControl.getValue();
                }
                
                // Only add non-empty values to criteria
                if (sValue && sValue.trim() !== "") {
                    oFilterCriteria[sColumnName] = {
                        value: sValue,
                        type: sColumnType
                    };
                    bHasFilters = true;
                }
            }
            
            // If no filters, show all data
            if (!bHasFilters) {
                oViewModel.setProperty("/items", oViewModel.getProperty("/allItems"));
                oViewModel.setProperty("/filterInfo", "");
                
                // Update count
                const aItems = oViewModel.getProperty("/items");
                const sCount = aItems.length + " " + (aItems.length === 1 ? "item" : "items");
                this.getView().byId("tableCountText").setText(sCount);
                
                MessageToast.show("No search criteria specified. Showing all records.");
                return;
            }
            
            // Store filter criteria in view model
            oViewModel.setProperty("/filterCriteria", oFilterCriteria);
            
            // Search directly on Supabase
            this._executeAdvancedSearch(sTableId, oFilterCriteria);
        },
        
        /**
         * Execute advanced search against Supabase
         * @param {string} sTableId The table ID
         * @param {Object} oFilterCriteria The filter criteria
         * @private
         */
        _executeAdvancedSearch: function(sTableId, oFilterCriteria) {
            const oViewModel = this.getModel("viewModel");
            
            // Set busy state
            oViewModel.setProperty("/busy", true);
            
            // Build query
            let query = this.getSupabaseClient()
                .from(sTableId)
                .select('*');
            
            // Add filters to query
            const aFilterTerms = [];
            Object.keys(oFilterCriteria).forEach(sColumnName => {
                const oFilter = oFilterCriteria[sColumnName];
                const sValue = oFilter.value;
                const sType = oFilter.type;
                
                // Apply different filtering based on column type
                if (sType === "relation" || sType === "number" || sType === "boolean") {
                    // Exact match for these types
                    query = query.eq(sColumnName, sValue);
                    aFilterTerms.push(`${sColumnName} = ${sValue}`);
                } else if (sType === "date") {
                    // Exact date match
                    query = query.eq(sColumnName, sValue);
                    aFilterTerms.push(`${sColumnName} = ${sValue}`);
                } else {
                    // Text search (case insensitive, partial match)
                    query = query.ilike(sColumnName, `%${sValue}%`);
                    aFilterTerms.push(`${sColumnName} contains "${sValue}"`);
                }
            });
            
            // Execute query
            query.then(async ({ data, error }) => {
                if (error) {
                    console.error("Error executing search:", error);
                    this.showErrorMessage("Error executing search", error);
                    oViewModel.setProperty("/busy", false);
                    return;
                }
                
                // Process the results
                data = data || [];
                console.log(`Search returned ${data.length} records`);
                
                // Process relation fields
                for (let i = 0; i < data.length; i++) {
                    for (const oColumnMetadata of this._tableMetadata.columns) {
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
                
                // Update model with search results
                oViewModel.setProperty("/items", data);
                
                // Set filter info text
                const sFilterInfo = aFilterTerms.length > 0 
                    ? "Filtered by: " + aFilterTerms.join(", ")
                    : "";
                oViewModel.setProperty("/filterInfo", sFilterInfo);
                
                // Update count
                const sCount = data.length + " " + (data.length === 1 ? "item" : "items") + 
                               (aFilterTerms.length > 0 ? " (filtered)" : "");
                this.getView().byId("tableCountText").setText(sCount);
                
                // Set busy state
                oViewModel.setProperty("/busy", false);
            }).catch(error => {
                console.error("Error in Supabase query:", error);
                oViewModel.setProperty("/busy", false);
            });
        },
        
        /**
         * Reset search form and show all data
         */
        onResetSearch: function() {
            // Reset search form
            const oSearchForm = this.getView().byId("searchForm");
            const aFormContent = oSearchForm.getContent();
            
            // Reset all input controls
            for (let i = 0; i < aFormContent.length; i++) {
                const oControl = aFormContent[i];
                
                // Skip labels
                if (oControl instanceof Label) {
                    continue;
                }
                
                // Reset value based on control type
                if (oControl instanceof ComboBox) {
                    oControl.setSelectedKey("");
                } else if (oControl instanceof CheckBox) {
                    oControl.setSelected(false);
                } else if (oControl instanceof DatePicker) {
                    oControl.setValue("");
                } else {
                    oControl.setValue("");
                }
            }
            
            // Clear filter criteria
            const oViewModel = this.getModel("viewModel");
            oViewModel.setProperty("/filterCriteria", {});
            oViewModel.setProperty("/filterInfo", "");
            
            // Reset table data to show all items
            oViewModel.setProperty("/items", oViewModel.getProperty("/allItems"));
            
            // Update count
            const aItems = oViewModel.getProperty("/items");
            const sCount = aItems.length + " " + (aItems.length === 1 ? "item" : "items");
            this.getView().byId("tableCountText").setText(sCount);
            
            MessageToast.show("Search criteria reset. Showing all records.");
        },
        
        /**
         * Quick search handler for the search field below the header
         * @param {sap.ui.base.Event} oEvent The search event
         */
        onQuickSearch: function(oEvent) {
            const sQuery = oEvent.getParameter("query").toLowerCase();
            const oViewModel = this.getModel("viewModel");
            const aAllItems = [...oViewModel.getProperty("/allItems")]; // Create a copy
            
            if (!sQuery) {
                // Load original data to reset the filter
                oViewModel.setProperty("/items", aAllItems);
                oViewModel.setProperty("/filterInfo", "");
                
                // Update count
                const sCount = aAllItems.length + " " + (aAllItems.length === 1 ? "item" : "items");
                this.getView().byId("tableCountText").setText(sCount);
                return;
            }
            
            // Filter items locally (client-side filtering)
            const aFilteredItems = aAllItems.filter(item => {
                // Convert item to string and check if it includes the query
                return JSON.stringify(item).toLowerCase().includes(sQuery);
            });
            
            // Update model with filtered items
            oViewModel.setProperty("/items", aFilteredItems);
            
            // Set filter info
            oViewModel.setProperty("/filterInfo", "Quick search for: " + sQuery);
            
            // Update count
            const sCount = aFilteredItems.length + " " + 
                          (aFilteredItems.length === 1 ? "item" : "items") + 
                          " (filtered)";
            this.getView().byId("tableCountText").setText(sCount);
        },
        
        /**
         * Search handler for the table search field
         * @param {sap.ui.base.Event} oEvent The search event
         */
        onSearch: function(oEvent) {
            const sQuery = oEvent.getParameter("query").toLowerCase();
            const oViewModel = this.getModel("viewModel");
            const aAllItems = [...oViewModel.getProperty("/allItems")]; // Create a copy
            
            if (!sQuery) {
                // Load original data to reset the filter
                oViewModel.setProperty("/items", aAllItems);
                oViewModel.setProperty("/filterInfo", "");
                
                // Update count
                const sCount = aAllItems.length + " " + (aAllItems.length === 1 ? "item" : "items");
                this.getView().byId("tableCountText").setText(sCount);
                return;
            }
            
            // Filter items locally (client-side filtering)
            const aFilteredItems = aAllItems.filter(item => {
                // Convert item to string and check if it includes the query
                return JSON.stringify(item).toLowerCase().includes(sQuery);
            });
            
            // Update model with filtered items
            oViewModel.setProperty("/items", aFilteredItems);
            
            // Set filter info
            oViewModel.setProperty("/filterInfo", "Table search for: " + sQuery);
            
            // Update count
            const sCount = aFilteredItems.length + " " + 
                          (aFilteredItems.length === 1 ? "item" : "items") + 
                          " (filtered)";
            this.getView().byId("tableCountText").setText(sCount);
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
                
                // Navigate to the detail view
                try {
                    this.getRouter().navTo("entityDetail", {
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
            
            // Reset filter criteria and info
            const oViewModel = this.getModel("viewModel");
            oViewModel.setProperty("/filterCriteria", {});
            oViewModel.setProperty("/filterInfo", "");
            
            // Reset search fields
            const oSearchForm = this.getView().byId("searchForm");
            const aFormContent = oSearchForm.getContent();
            
            for (let i = 0; i < aFormContent.length; i++) {
                const oControl = aFormContent[i];
                
                // Skip labels
                if (oControl instanceof Label) {
                    continue;
                }
                
                // Reset value based on control type
                if (oControl instanceof ComboBox) {
                    oControl.setSelectedKey("");
                } else if (oControl instanceof CheckBox) {
                    oControl.setSelected(false);
                } else if (oControl instanceof DatePicker) {
                    oControl.setValue("");
                } else {
                    oControl.setValue("");
                }
            }
            
            // Reset quick search
            const oQuickSearch = this.getView().byId("quickSearch");
            if (oQuickSearch) {
                oQuickSearch.setValue("");
            }
            
            // Reset table search
            const oTableSearch = this.getView().byId("tableSearch");
            if (oTableSearch) {
                oTableSearch.setValue("");
            }
            
            // Load metadata for the table
            this.getTableMetadata(sTableId).then((oMetadata) => {
                // Load the data
                this._loadData(sTableId, oMetadata);
            });
        },
        
        /**
         * Handler for export button press
         */
        onExportPress: function() {
            const oViewModel = this.getModel("viewModel");
            const aItems = oViewModel.getProperty("/items");
            const sTableName = oViewModel.getProperty("/tableName");
            
            if (!aItems || aItems.length === 0) {
                MessageToast.show("No data to export");
                return;
            }
            
            // Convert data to CSV
            const aVisibleColumns = oViewModel.getProperty("/visibleColumns");
            const aHeaders = aVisibleColumns.map(col => col.label);
            const aHeaderFields = aVisibleColumns.map(col => col.name);
            
            // Create CSV header
            let sCSV = aHeaders.join(",") + "\n";
            
            // Add data rows
            aItems.forEach(item => {
                const aRow = aHeaderFields.map(field => {
                    // Handle different data types
                    const value = item[field] === undefined ? "" : item[field];
                    
                    // For strings, escape commas and quotes
                    if (typeof value === "string") {
                        return `"${value.replace(/"/g, '""')}"`;
                    } else if (value === null) {
                        return "";
                    } else {
                        return value;
                    }
                });
                
                sCSV += aRow.join(",") + "\n";
            });
            
            // Create download link
            const oBlob = new Blob([sCSV], { type: "text/csv;charset=utf-8" });
            const sFileName = `${sTableName}_Export_${new Date().toISOString().split("T")[0]}.csv`;
            
            if (window.navigator.msSaveOrOpenBlob) {
                // For IE
                window.navigator.msSaveBlob(oBlob, sFileName);
            } else {
                // For modern browsers
                const oLink = document.createElement("a");
                oLink.href = URL.createObjectURL(oBlob);
                oLink.download = sFileName;
                document.body.appendChild(oLink);
                oLink.click();
                document.body.removeChild(oLink);
            }
            
            MessageToast.show(`Exported ${aItems.length} records to ${sFileName}`);
        },
        
        /**
         * Navigation handler
         */
        onNavBack: function() {
            this.navBack();
        }
    });
});