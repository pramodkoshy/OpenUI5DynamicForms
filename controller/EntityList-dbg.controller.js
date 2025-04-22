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
    "sap/m/Button"
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
    Button
) {
    "use strict";



    return BaseController.extend("com.supabase.easyui5.controller.EntityList", {
        // Add this property to your controller class
        _isAdjustingWidths: false,
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
            // Add event delegate to apply column widths after rendering
            this.getView().addEventDelegate({
                onAfterRendering: function() {
                    setTimeout(this._forceColumnWidths.bind(this), 500);
                }.bind(this)
            }, this);

        },
        
        /**
         * Called after the view has been rendered
         */
        onAfterRendering: function() {
            try {
             
                
                // Check if we need to apply horizontal scrolling
                var oTable = this.byId("entityTable");
                if (!oTable) {
                    return; // Exit if table isn't available yet
                }
                
                var oViewModel = this.getModel("viewModel");
                // Safety check - only proceed if model exists
                if (!oViewModel) {
                    console.log("View model not available yet in onAfterRendering");
                    return;
                }
                
                try {
                    var aVisibleColumns = oViewModel.getProperty("/visibleColumns") || [];
                    if (aVisibleColumns.length > 5) {
                        // If already initialized, reapply scrolling
                        // Apply column widths directly
                        this._createTopScrollContainer(aVisibleColumns.length);
                        // Apply column widths directly
                        setTimeout(this._forceColumnWidths.bind(this), 300);
                    }
                    var oDynamicPage = this.byId("dynamicPageId");
                    if (oDynamicPage) {
                        oDynamicPage.setHeaderExpanded(false);
                    }

                } catch (e) {
                    console.log("Could not access view model properties:", e);
                }
            } catch (e) {
                console.error("Error in onAfterRendering:", e);
            }
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
         * Route matched handler with debug logging
         * @param {sap.ui.base.Event} oEvent The route matched event
         * @private
         */
        _onRouteMatched: function(oEvent) {
            console.log("1. _onRouteMatched started");
            const sTableId = oEvent.getParameter("arguments").table;
            console.log("2. Table ID:", sTableId);
            
            // Store the table ID in the view model
            const oViewModel = this.getModel("viewModel");
            console.log("3. ViewModel:", oViewModel ? "available" : "not available");
            
            // Reset filter criteria and columns
            oViewModel.setProperty("/filterCriteria", {});
            oViewModel.setProperty("/visibleColumns", []);
            oViewModel.setProperty("/availableColumns", []);
            oViewModel.setProperty("/filterInfo", "");
            
            // Set table name based on the ID (capitalize first letter)
            const sTableName = sTableId.charAt(0).toUpperCase() + sTableId.slice(1).replace(/_/g, " ");
            oViewModel.setProperty("/tableName", sTableName);

            oViewModel.setProperty("/tableId", sTableId);
  
            // Set the page title
            this.getView().byId("entityListPage").setTitle(sTableName + " List");
            
            // Ensure the header is collapsed when navigating to a new list
            try {
                const oDynamicPage = this.getView().byId("dynamicPageId");
                if (oDynamicPage) {
                    oDynamicPage.setHeaderExpanded(false);
                }
            } catch (error) {
                console.error("Error setting header state:", error);
            }
            
            // Load metadata for the table
            console.log("4. About to call getTableMetadata");
            this.getTableMetadata(sTableId).then((oMetadata) => {
                console.log("5. Metadata received:", oMetadata);
                // Store metadata for later use
                this._tableMetadata = oMetadata;
                
                // Configure search form based on metadata
                this._configureSearchForm(oMetadata);
                
                // Configure table columns based on metadata
                this._configureTable(oMetadata);
                
                // Load the data
                console.log("6. About to call _loadData");
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
         * Configure table with fixed widths directly
         * @param {Object} oMetadata The table metadata
         * @private
         */
        _configureTable: function(oMetadata) {
            const oTable = this.getView().byId("entityTable");
            const oViewModel = this.getModel("viewModel");
            
            // Set table to fixed layout
            oTable.setFixedLayout(true);
            oTable.setSticky(["ColumnHeaders"]);
            
            // Clear existing columns
            oTable.removeAllColumns();
            
            // Filter for visible columns
            const aVisibleColumns = oMetadata.columns
                .filter(col => col.visible)
                .slice(0, 7); // Limit to 7 columns
            
            // Store visible columns in the model
            oViewModel.setProperty("/visibleColumns", aVisibleColumns);
            
            // Store all available columns for column selection
            const aAllColumns = oMetadata.columns.filter(col => col.visible);
            oViewModel.setProperty("/availableColumns", aAllColumns);
            
            // Add a custom CSS style for fixed headers if not already present
            if (!document.getElementById("fixedTableStyles")) {
                var styleEl = document.createElement("style");
                styleEl.id = "fixedTableStyles";
                styleEl.innerHTML = `
                    .sapMListTblHeader {
                        position: sticky !important;
                        top: 0 !important;
                        z-index: 100 !important;
                        background-color: #f7f7f7 !important;
                    }
                    
                    .fixedWidthTable {
                        overflow-x: auto !important;
                    }
                    
                    .fixedWidthTable table {
                        table-layout: fixed !important;
                    }
                    
                    .sapMListTblCell {
                        padding-left: 4px !important;
                        padding-right: 4px !important;
                    }
                `;
                document.head.appendChild(styleEl);
            }
            
            // Add class to table parent for scrolling
            setTimeout(function() {
                var tableParent = oTable.$().parent();
                if (tableParent.length) {
                    tableParent.addClass("fixedWidthTable");
                }
            }, 100);
            
            // Add columns based on metadata
            aVisibleColumns.forEach((oColumnMetadata, index) => {
                // Calculate optimal column width
                let sWidth = "8rem"; // Default
                
                switch (oColumnMetadata.type) {
                    case "boolean":
                        sWidth = "5rem";
                        break;
                    case "date":
                        sWidth = "8rem";
                        break;
                    case "number":
                        sWidth = "7rem";
                        break;
                    case "relation":
                        sWidth = "10rem";
                        break;
                    default:
                        if (index === 0) sWidth = "10rem";
                        else if (index === 1) sWidth = "12rem";
                        else sWidth = "9rem";
                }
                
                // Create column
                const oColumn = new sap.m.Column({
                    header: new sap.m.Label({
                        text: oColumnMetadata.label,
                        design: "Bold"
                    }),
                    width: sWidth,
                    hAlign: oColumnMetadata.type === "number" ? "End" : "Begin",
                    demandPopin: true,
                    minScreenWidth: "Tablet"
                });
                
                // Store column metadata
                oColumn.data("columnName", oColumnMetadata.name);
                oColumn.data("columnType", oColumnMetadata.type);
                
                oTable.addColumn(oColumn);
            });
            
            // Create a template for binding
            var oTemplate = new sap.m.ColumnListItem({
                type: "Navigation",
                press: this.onItemPress.bind(this)
            });
            
            // Add cells to template
            aVisibleColumns.forEach(function(oCol) {
                var oCell;
                
                switch (oCol.type) {
                    case "date":
                        oCell = new sap.m.Text({
                            text: {
                                path: "viewModel>" + oCol.name,
                                formatter: function(value) {
                                    if (!value) return "";
                                    return new Date(value).toLocaleDateString();
                                }
                            }
                        });
                        break;
                        
                    case "boolean":
                        oCell = new sap.m.Text({
                            text: {
                                path: "viewModel>" + oCol.name,
                                formatter: function(value) {
                                    return value ? "Yes" : "No";
                                }
                            }
                        });
                        break;
                        
                    case "relation":
                        oCell = new sap.m.Text({
                            text: {
                                path: "viewModel>" + oCol.name + "_text"
                            }
                        });
                        break;
                        
                    default:
                        oCell = new sap.m.Text({
                            text: "{viewModel>" + oCol.name + "}"
                        });
                }
                
                oTemplate.addCell(oCell);
            });
            
            // Bind items
            oTable.bindItems({
                path: "viewModel>/items",
                template: oTemplate,
                templateShareable: false
            });
        },
        
        /**
         * Helper method to populate a relation ComboBox with items
         * @param {sap.m.ComboBox} oComboBox The ComboBox control
         * @param {Array} aItems The relation items data
         * @param {string} sPrimaryKey The primary key field name
         * @param {string} sTitleField The title field name
         * @private
         */
        _populateRelationComboBox: function(oComboBox, aItems, sPrimaryKey, sTitleField) {
            if (!oComboBox) return;
            
            // Clear existing items
            oComboBox.removeAllItems();
            
            // Add empty option first
            oComboBox.addItem(new sap.ui.core.Item({
                key: "",
                text: "All"
            }));
            
            // Add options from data
            if (aItems && aItems.length > 0) {
                aItems.forEach(item => {
                    oComboBox.addItem(new sap.ui.core.Item({
                        key: item[sPrimaryKey],
                        text: item[sTitleField] || item[sPrimaryKey]
                    }));
                });
            }
        },

        /**
         * Overriding the method to use the relation cache instead of making new requests
         * @param {sap.m.ComboBox} oComboBox The ComboBox control
         * @param {string} sRelatedTable The related table name
         * @param {string} sFieldName The field name
         * @private
         */
        _loadRelationOptions: function(oComboBox, sRelatedTable, sFieldName) {
            // Check if we already have this relation cached
            if (this._relationCache && this._relationCache[sRelatedTable]) {
                const cache = this._relationCache[sRelatedTable];
                this._populateRelationComboBox(
                    oComboBox,
                    cache.items,
                    cache.metadata.primaryKey,
                    cache.metadata.titleField
                );
                return;
            }
            
            // If not cached, use the existing implementation but store in cache for later
            this.getTableMetadata(sRelatedTable).then((oRelatedMetadata) => {
                const sPrimaryKey = oRelatedMetadata.primaryKey;
                const sTitleField = oRelatedMetadata.titleField || sPrimaryKey;
                
                // Get the data from the related table
                this.getSupabaseClient()
                    .from(sRelatedTable)
                    .select(`${sPrimaryKey}, ${sTitleField}`)
                    .then(({ data, error }) => {
                        if (error) {
                            console.error(`Error loading relation options for ${sFieldName}:`, error);
                            return;
                        }
                        
                        // Store in cache for future use
                        if (!this._relationCache) {
                            this._relationCache = {};
                        }
                        
                        this._relationCache[sRelatedTable] = {
                            items: data,
                            metadata: oRelatedMetadata,
                            lookup: data.reduce((map, item) => {
                                map[item[sPrimaryKey]] = item[sTitleField];
                                return map;
                            }, {})
                        };
                        
                        // Populate the ComboBox
                        this._populateRelationComboBox(oComboBox, data, sPrimaryKey, sTitleField);
                    })
                    .catch(error => {
                        console.error(`Error in Supabase query for relation options:`, error);
                    });
            }).catch(error => {
                console.error(`Error getting metadata for relation ${sRelatedTable}:`, error);
            });
        },
        /**
         * Modified version of onColumnsButtonPress
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
                            
                            // Close dialog
                            this._oColumnDialog.close();
                            
                            // Apply direct DOM manipulation for column widths
                            // We do this multiple times to ensure it gets applied after rendering
                            setTimeout(this._forceColumnWidths.bind(this), 100);
                            setTimeout(this._forceColumnWidths.bind(this), 500);
                            setTimeout(this._forceColumnWidths.bind(this), 1000);
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
         * New method to reconfigure table with fixed widths
         * @param {Array} aSelectedColumns Array of selected column metadata
         * @private
         */
        _reconfigureTableWithFixedWidths: function(aSelectedColumns) {
            const oTable = this.getView().byId("entityTable");
            
            // Force table to a reasonable width first
            oTable.setWidth("100%");
            
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
            
            // Calculate total available width and distribute
            const iTableWidth = Math.max(jQuery(oTable.getDomRef()).width(), 800);
            const iAvgColumnWidth = Math.floor(iTableWidth / (aSelectedColumns.length || 1));
            const iMinColWidth = 80; // Minimum column width in pixels
            
            console.log("Table width:", iTableWidth, "Average column width:", iAvgColumnWidth);
            
            // Track allocated width
            let iTotalAllocatedRem = 0;
            
            // Add columns and cells based on selected columns
            aSelectedColumns.forEach((oColumnMetadata, index) => {
                // Set column width based on data type with fixed smaller widths
                let iColWidth;
                
                switch (oColumnMetadata.type) {
                    case "boolean":
                        iColWidth = 5;
                        break;
                    case "date":
                        iColWidth = 8;
                        break;
                    case "number":
                    case "integer":
                        iColWidth = 7;
                        break;
                    case "email":
                    case "url":
                        iColWidth = 10;
                        break;
                    case "relation":
                        iColWidth = 8;
                        break;
                    default:
                        // For the first columns, give them a bit more space
                        if (index === 0) {
                            iColWidth = 8; // Primary ID column
                        } else if (index === 1) {
                            iColWidth = 10; // Name/title column
                        } else if (index === 2) {
                            iColWidth = 10; // Description column
                        } else {
                            iColWidth = 7; // Other columns
                        }
                }
                
                // Special handling for specific column names
                if (oColumnMetadata.name) {
                    const lowerName = oColumnMetadata.name.toLowerCase();
                    if (lowerName.includes('id') && lowerName !== 'id') {
                        iColWidth = 6; // IDs except primary ID
                    } else if (lowerName === 'id') {
                        iColWidth = 5; // Primary ID if named simply 'id'
                    } else if (lowerName.includes('code') || lowerName.includes('status')) {
                        iColWidth = 6; // Code or status fields
                    }
                }
                
                // Calculate column width as a percentage of table width
                iTotalAllocatedRem += iColWidth;
                
                // Convert to rem string
                const sWidth = iColWidth + "rem";
                
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
                            maxLines: 1
                        });
                }
                
                // Apply common styling to all cells - remove margin to save space
                // oCell.addStyleClass("sapUiTinyMarginBeginEnd"); - removing this to save space
                
                oTemplate.addCell(oCell);
            });
            
            console.log("Total allocated width (rem):", iTotalAllocatedRem);
            
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
            
            // Apply horizontal scrolling right away with fixed values
            setTimeout(function() {
                this._createFixedWidthScrollContainer(iTotalAllocatedRem);
            }.bind(this), 100);
        },

        /**
         * Create a fixed horizontal scroll container
         * @param {number} totalWidth - Total width of all columns in rem
         * @private
         */
        _createFixedScrollContainer: function(totalWidth) {
            try {
                var oTable = this.byId("entityTable");
                if (!oTable) return;
                
                // Get the parent container
                var oTableParent = oTable.$().parent();
                if (!oTableParent.length) return;
                
                // Remove any existing scroll containers to avoid duplicates
                jQuery(".tableScrollContainer").remove();
                
                // Create a wrapper div for the scrollable area
                var scrollContainer = document.createElement("div");
                scrollContainer.className = "tableScrollContainer";
                scrollContainer.style.width = "100%";
                scrollContainer.style.overflowX = "auto";
                scrollContainer.style.position = "sticky";
                scrollContainer.style.top = "0";
                scrollContainer.style.zIndex = "99";
                scrollContainer.style.backgroundColor = "#fff";
                scrollContainer.style.borderBottom = "1px solid #e5e5e5";
                scrollContainer.style.padding = "4px 0";
                
                // Convert rem to pixels for content width
                var remInPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
                var contentWidth = Math.max(totalWidth * remInPx, oTableParent.width());
                
                // Create inner content div
                var contentDiv = document.createElement("div");
                contentDiv.style.width = contentWidth + "px";
                contentDiv.style.height = "16px";
                scrollContainer.appendChild(contentDiv);
                
                // Add scroll container before the table
                oTableParent.prepend(scrollContainer);
                
                // Set table to match scroll container width
                var tableElement = oTable.$().find("table");
                if (tableElement.length) {
                    tableElement.css({
                        "min-width": contentWidth + "px",
                        "width": contentWidth + "px",
                        "table-layout": "fixed"
                    });
                }
                
                // Add custom scroll styles 
                if (!document.getElementById("fixedScrollStyles")) {
                    var styleElement = document.createElement("style");
                    styleElement.id = "fixedScrollStyles";
                    styleElement.innerHTML = `
                        .tableScrollContainer::-webkit-scrollbar {
                            height: 8px;
                            background-color: #f5f5f5;
                        }
                        
                        .tableScrollContainer::-webkit-scrollbar-thumb {
                            border-radius: 4px;
                            background-color: #999;
                        }
                        
                        .tableScrollContainer::-webkit-scrollbar-thumb:hover {
                            background-color: #777;
                        }
                        
                        .tableScrollContainer {
                            scrollbar-width: thin;
                            scrollbar-color: #999 #f5f5f5;
                        }
                        
                        .sapMListTblHeader {
                            position: sticky !important;
                            top: 28px !important; 
                            z-index: 98 !important;
                        }
                    `;
                    document.head.appendChild(styleElement);
                }
                
                // Synchronize scrolling between the table and scroll container
                scrollContainer.addEventListener("scroll", function() {
                    var tableWrapper = oTable.$().find(".sapMListTblCnt");
                    if (tableWrapper.length) {
                        tableWrapper.scrollLeft(this.scrollLeft);
                    }
                });
                
                // Also sync scroll position when table is scrolled
                oTable.$().find(".sapMListTblCnt").on("scroll", function() {
                    scrollContainer.scrollLeft = this.scrollLeft;
                });
                
                console.log("Fixed scroll container created");
            } catch (e) {
                console.error("Error creating fixed scroll container:", e);
            }
        },
        /**
         * Reconfigure table with selected columns using optimized widths
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
                // Use the optimized column width helper function
                let sWidth = this._getOptimizedColumnWidth(
                    oColumnMetadata.type, 
                    index, 
                    oColumnMetadata.name
                );
                
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
            
            // Apply horizontal scrolling if needed
            if (aSelectedColumns.length > 5) {
                setTimeout(function() {
                    this._createTopScrollContainer(aSelectedColumns.length * 6); // Reduced from 12 to 6
                }.bind(this), 300);
            }
        },
                        
        /**
         * Handler for the search button in the header
         */
        onServerSearchPress: function() {
            try {
                var oDynamicPage = this.getView().byId("dynamicPageId");
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
            
            // Apply horizontal scrolling if needed
            const aVisibleColumns = oViewModel.getProperty("/visibleColumns") || [];
            if (aVisibleColumns.length > 5) {
                setTimeout(function() {
                    this._createTopScrollContainer(aVisibleColumns.length * 12);
                }.bind(this), 300);
            }
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
            
            // Apply horizontal scrolling if needed
            const aVisibleColumns = oViewModel.getProperty("/visibleColumns") || [];
            if (aVisibleColumns.length > 5) {
                setTimeout(function() {
                    this._createTopScrollContainer(aVisibleColumns.length * 12);
                }.bind(this), 300);
            }
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
            const oViewModel = this.getModel("viewModel");
            const sTableId = oViewModel.getProperty("/tableId");
            
            console.log("Item clicked:", oItemData);
            console.log("Table ID:", sTableId);
            
            // First check if tableId is properly set
            if (!sTableId) {
                console.error("Table ID is empty. Cannot navigate.");
                MessageToast.show("Navigation error: Cannot determine table");
                return;
            }
            
            // Get the primary key from the metadata
            this.getTableMetadata(sTableId).then((oMetadata) => {
                const sPrimaryKey = oMetadata.primaryKey || `${sTableId}_id`;
                console.log("Primary key field:", sPrimaryKey);
                console.log("Item data keys:", Object.keys(oItemData));
                
                // Get the primary key value
                const sPrimaryKeyValue = oItemData[sPrimaryKey];
                
                if (sPrimaryKeyValue === undefined) {
                    console.error("Primary key value is undefined. Cannot navigate.");
                    MessageToast.show("Navigation error: Record ID not found");
                    return;
                }
                
                console.log("Navigating to detail with ID:", sPrimaryKeyValue);
                
                // Navigate to the detail view
                try {
                    this.getRouter().navTo("entityDetail", {
                        table: sTableId,
                        id: sPrimaryKeyValue
                    }, false);
                    
                    console.log("Navigation call completed");
                } catch (oError) {
                    console.error("Navigation error:", oError);
                    MessageToast.show("Navigation error: " + oError.message);
                }
            }).catch(error => {
                console.error("Error getting metadata for navigation:", error);
                MessageToast.show("Navigation error: Could not retrieve table metadata");
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
        },

        /**
         * Create a horizontal scroll container at the TOP of the table
         * @param {number} totalWidth - Total width of all columns in rem
         * @private
         */
        _createTopScrollContainer: function(totalWidth) {
            // Track retry attempts
            if (!this._scrollRetryCount) {
                this._scrollRetryCount = 0;
            }
            
            // Guard against multiple calls or too many retries
            if (this._scrollContainerInProgress || this._scrollRetryCount > 5) {
                if (this._scrollRetryCount > 5) {
                    console.warn("Maximum scroll container retry attempts reached - giving up");
                    this._scrollRetryCount = 0; // Reset for future attempts
                }
                return;
            }
            
            this._scrollContainerInProgress = true;
            this._scrollRetryCount++;
            
            try {
                var oTable = this.byId("entityTable");
                if (!oTable) {
                    console.error("Table control not found");
                    this._scrollContainerInProgress = false;
                    return;
                }
                
                var tableDom = oTable.getDomRef();
                if (!tableDom) {
                    console.log("Table DOM not ready - scheduling retry #" + this._scrollRetryCount);
                    // Simple retry after a delay, but only if we haven't tried too many times
                    if (this._scrollRetryCount <= 5) {
                        setTimeout(function() {
                            this._scrollContainerInProgress = false;
                            this._createTopScrollContainer(totalWidth);
                        }.bind(this), 1000); // Longer delay between retries
                    } else {
                        console.warn("Maximum retry attempts reached - giving up");
                        this._scrollRetryCount = 0;
                        this._scrollContainerInProgress = false;
                    }
                    return;
                }
                
                // We found the table DOM, reset retry counter
                this._scrollRetryCount = 0;
                
                console.log("Creating horizontal scroll container");
                
                // Remove any existing containers
                jQuery(".horizontalScrollWrapper").remove();
                
                // Create scroll container
                var scrollDiv = document.createElement("div");
                scrollDiv.className = "horizontalScrollWrapper";
                scrollDiv.style.width = "100%";
                scrollDiv.style.overflowX = "auto";
                scrollDiv.style.position = "sticky";
                scrollDiv.style.top = "0";
                scrollDiv.style.zIndex = "100";
                scrollDiv.style.height = "16px";
                scrollDiv.style.background = "#f5f5f5";
                scrollDiv.style.borderRadius = "4px";
                scrollDiv.style.border = "1px solid #e5e5e5";
                
                // Content div to create scrollable width
                var remToPixel = parseInt(getComputedStyle(document.documentElement).fontSize) || 16;
                var scrollWidth = totalWidth * remToPixel;
                
                var contentDiv = document.createElement("div");
                contentDiv.style.width = scrollWidth + "px";
                contentDiv.style.height = "1px";
                scrollDiv.appendChild(contentDiv);
                
                // Insert before table
                tableDom.parentNode.insertBefore(scrollDiv, tableDom);
                
                // Configure table for scrolling
                var tableElement = oTable.$().find(".sapMListTbl");
                if (tableElement.length) {
                    tableElement.css({
                        "min-width": scrollWidth + "px",
                        "table-layout": "fixed"
                    });
                }
                
                // Ensure table container allows horizontal scrolling
                jQuery(tableDom).css({
                    "overflow-x": "hidden",
                    "min-width": "100%"
                });
                
                // Sync scroll events
                scrollDiv.addEventListener("scroll", function() {
                    var tableWrapper = jQuery(tableDom).find(".sapMListTbl");
                    if (tableWrapper.length) {
                        tableWrapper.css("margin-left", -this.scrollLeft + "px");
                    }
                });
                
                console.log("Scroll container created successfully");
            } catch (e) {
                console.error("Error creating scroll container:", e);
            } finally {
                setTimeout(function() {
                    this._scrollContainerInProgress = false;
                }.bind(this), 300);
            }
        },
       /** 
         * Helper function to get optimized column width based on column type and index
         * @param {string} sType Column data type
         * @param {number} index Column index
         * @param {string} sName Column name
         * @returns {string} Optimized column width
         * @private
         */
        _getOptimizedColumnWidth: function(sType, index, sName) {
            // Set column width based on data type with optimized smaller widths
            let sWidth;
            
            switch (sType) {
                case "boolean":
                    sWidth = "5rem"; // Reduced from 8rem
                    break;
                case "date":
                    sWidth = "8rem"; // Reduced from 12rem
                    break;
                case "number":
                case "integer":
                    sWidth = "7rem"; // Reduced from 10rem
                    break;
                case "email":
                case "url":
                    sWidth = "12rem"; // Reduced from 18rem
                    break;
                case "relation":
                    sWidth = "10rem"; // Reduced from 15rem
                    break;
                default:
                    // For the first columns, still give them reasonable space but reduced
                    if (index === 0) {
                        sWidth = "10rem"; // Primary ID column (reduced from 18rem)
                    } else if (index === 1) {
                        sWidth = "12rem"; // Name/title column (reduced from 20rem)
                    } else if (index === 2) {
                        sWidth = "12rem"; // Description column (reduced from 20rem)
                    } else {
                        sWidth = "9rem"; // Other columns (reduced from 15rem)
                    }
            }
            
            // Special handling for specific column names
            if (sName) {
                const lowerName = sName.toLowerCase();
                if (lowerName.includes('id') && lowerName !== 'id') {
                    sWidth = "6rem"; // IDs except primary ID
                } else if (lowerName === 'id') {
                    sWidth = "5rem"; // Primary ID if named simply 'id'
                } else if (lowerName.includes('code') || lowerName.includes('status')) {
                    sWidth = "6rem"; // Code or status fields
                }
            }
            
            return sWidth;
        },

        /**
         * Force strict column widths after any table update
         * @private
         */
        _forceColumnWidths: function() {
            // Guard against recursive calls
            if (this._isAdjustingWidths) {
                console.log("Width adjustment already in progress, skipping");
                return;
            }
            
            try {
                this._isAdjustingWidths = true;
                
                var oTable = this.byId("entityTable");
                if (!oTable) return;
                
                // Get the columns directly from the table
                var aColumns = oTable.getColumns();
                if (!aColumns || aColumns.length === 0) return;
                
                console.log("Forcing strict column widths for", aColumns.length, "columns");
                
                // Create strict width styles directly in the DOM
                var styleContent = "";
                
                // Base styles for the table and cells
                styleContent += `
                    #${oTable.getId()} table {
                        table-layout: fixed !important;
                        width: auto !important;
                    }
                    
                    #${oTable.getId()} .sapMListTblCell {
                        padding-left: 4px !important;
                        padding-right: 4px !important;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }
                `;
                
                // Add specific width styles for each column
                aColumns.forEach(function(oColumn, index) {
                    var sColumnId = oColumn.getId();
                    var sColumnType = oColumn.data("columnType") || "string";
                    var sColumnName = oColumn.data("columnName") || "";
                    
                    // Determine the width based on column type and index
                    var sWidth;
                    switch (sColumnType) {
                        case "boolean":
                            sWidth = "50px";
                            break;
                        case "date":
                            sWidth = "80px";
                            break;
                        case "number":
                        case "integer":
                            sWidth = "70px";
                            break;
                        case "relation":
                            sWidth = "100px";
                            break;
                        default:
                            // First column is often ID
                            if (index === 0) {
                                sWidth = "80px";
                            } else if (index === 1) {
                                sWidth = "100px"; // Typically name or title
                            } else {
                                sWidth = "90px";
                            }
                    }
                    
                    // Special handling for known column patterns
                    if (sColumnName) {
                        var lowerName = sColumnName.toLowerCase();
                        if (lowerName.includes('id') && lowerName !== 'id') {
                            sWidth = "60px"; // Foreign key columns
                        } else if (lowerName === 'id') {
                            sWidth = "50px"; // Primary key
                        }
                    }
                    
                    // Add column-specific width styles
                    styleContent += `
                        #${sColumnId} {
                            width: ${sWidth} !important;
                            max-width: ${sWidth} !important;
                            min-width: 0 !important;
                        }
                    `;
                });
                
                // Create or update the style element
                var styleId = "entityTableColumnStyles";
                var styleElement = document.getElementById(styleId);
                
                if (!styleElement) {
                    styleElement = document.createElement("style");
                    styleElement.id = styleId;
                    document.head.appendChild(styleElement);
                }
                
                styleElement.innerHTML = styleContent;
                
                // Ensure inner table has fixed layout, but don't invalidate
                jQuery("#" + oTable.getId())
                    .find(".sapMListTbl")
                    .css({
                        "table-layout": "fixed",
                        "width": "auto"
                    });
                    
                console.log("Column width styles applied directly to DOM");
            } catch (e) {
                console.error("Error forcing column widths:", e);
            } finally {
                // Always reset the flag when done
                this._isAdjustingWidths = false;
            }
        },


        /**
         * Load data from cache or server
         * @param {string} sTableId The table ID
         * @param {Object} oMetadata The table metadata
         * @param {boolean} bForceServerFetch Whether to force a server fetch
         * @private
         */
        _loadData: function(sTableId, oMetadata, bForceServerFetch) {
            console.log("_loadData started for table:", sTableId);
            const oViewModel = this.getModel("viewModel");
            
            // Set busy state
            oViewModel.setProperty("/busy", true);
            
            // Get cache manager instance
            const oCacheManager = this.getOwnerComponent().getEntityCacheManager();
            
            // Prepare cache parameters
            const mCacheParams = {
                ignoreCache: bForceServerFetch === true // Only bypass cache if explicitly requested
            };
            
            // Get the data from cache or server
            oCacheManager.getEntityData(
                sTableId, 
                mCacheParams,
                // This callback will only be executed if data is not cached or cache is bypassed
                () => {
                    console.log("Loading fresh data from server for:", sTableId);
                    // Create and return a Promise that loads data from the server
                    return new Promise((resolve, reject) => {
                        const supabaseClient = this.getSupabaseClient();
                        
                        supabaseClient
                            .from(sTableId)
                            .select('*')
                            .then(async ({ data, error }) => {
                                if (error) {
                                    console.error("Error loading data:", error);
                                    reject(error);
                                    return;
                                }
                                
                                // Create a safe fallback if data is null or undefined
                                data = data || [];
                                console.log(`Loaded ${data.length} records from server`);
                                
                                // Process relation fields if needed
                                if (oMetadata && oMetadata.columns) {
                                    const relationColumns = oMetadata.columns.filter(col => col.type === "relation");
                                    
                                    if (relationColumns.length > 0) {
                                        // Load relations using optimized batch approach
                                        // (Your existing relation handling code)
                                    }
                                }
                                
                                // Resolve with the processed data
                                resolve(data);
                            })
                            .catch(error => {
                                console.error("Error in Supabase query:", error);
                                reject(error);
                            });
                    });
                }
            )
            .then(data => {
                // Update model with items
                oViewModel.setProperty("/items", data);
                oViewModel.setProperty("/allItems", [...data]); // Store a copy of all items
                
                // Update count
                const sCount = data.length + " " + (data.length === 1 ? "item" : "items");
                this.getView().byId("tableCountText").setText(sCount);
                
                // Get the table
                var oTable = this.byId("entityTable");
                if (oTable) {
                    // If the table has binding, refresh it
                    var oBinding = oTable.getBinding("items");
                    if (oBinding) {
                        console.log("Refreshing existing table binding");
                        oBinding.refresh(true);
                    } else {
                        console.log("No binding found, table may need configuration");
                        // Add columns and create binding if needed
                        var aVisibleColumns = oViewModel.getProperty("/visibleColumns") || [];
                        if (aVisibleColumns.length > 0) {
                            // Only reconfigure if we have columns defined but no binding
                            // This ensures configuration happens only when necessary
                            this._configureTable(oMetadata);
                        }
                    }
                }
            })
            .catch(error => {
                console.error("Error loading data:", error);
                this.showErrorMessage("Error loading data", error);
            })
            .finally(() => {
                // Set busy state to false regardless of outcome
                oViewModel.setProperty("/busy", false);
            });
        },

        /**
         * Execute advanced search against Supabase and update cache
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
                
                // Process relation fields if needed
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
                
                // Update cache with the filtered data
                const oCacheManager = this.getOwnerComponent().getEntityCacheManager();
                
                // We DON'T update the main entity cache for filtered results
                // Only store the filtered results in the view model
                
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
                
                // Apply horizontal scrolling if needed
                const aVisibleColumns = oViewModel.getProperty("/visibleColumns") || [];
                if (aVisibleColumns.length > 5) {
                    setTimeout(() => {
                        this._createTopScrollContainer(aVisibleColumns.length * 6);
                    }, 300);
                }
            }).catch(error => {
                console.error("Error in Supabase query:", error);
                oViewModel.setProperty("/busy", false);
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
            
            // Clear entity cache and load fresh data from server
            const oCacheManager = this.getOwnerComponent().getEntityCacheManager();
            oCacheManager.clearEntityCache(sTableId);
            
            // Load fresh data with server fetch flag set to true
            this.getTableMetadata(sTableId).then((oMetadata) => {
                this._loadData(sTableId, oMetadata, true); // true = force server fetch
            });
            
            MessageToast.show("Refreshing data from server...");
        },
        /**
         * Handler for the advanced search button
         */
        onAdvancedSearch: function() {
            console.log("Starting advanced search...");
            const oSearchForm = this.getView().byId("searchForm");
            const oViewModel = this.getModel("viewModel");
            const sTableId = oViewModel.getProperty("/tableId");
            
            console.log("Current table ID:", sTableId);
            
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
                    console.log(`Added filter: ${sColumnName} = ${sValue} (${sColumnType})`);
                }
            }
            
            // IMPORTANT: First step - always clear the cache for this entity
            const oCacheManager = this.getOwnerComponent().getEntityCacheManager();
            if (oCacheManager) {
                console.log(`Explicitly clearing cache for ${sTableId} before search`);
                oCacheManager.clearEntityCache(sTableId);
                
                // Verify cache was cleared
                if (oCacheManager.isCached(sTableId)) {
                    console.error(`WARNING: Cache for ${sTableId} was not properly cleared!`);
                } else {
                    console.log(`Confirmed: Cache for ${sTableId} is now cleared`);
                }
            } else {
                console.error("Cache manager not available!");
            }
            
            // If no filters, just reload all data from server
            if (!bHasFilters) {
                console.log("No search criteria specified, loading all data from server");
                
                // Set busy state
                oViewModel.setProperty("/busy", true);
                
                // Load fresh data directly from server
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
                        
                        // Process the results
                        data = data || [];
                        console.log(`Loaded ${data.length} records directly from server`);
                        
                        // Update the entity cache with the new data
                        if (oCacheManager) {
                            console.log(`Explicitly updating cache for ${sTableId} with ${data.length} records`);
                            oCacheManager.setEntityCache(sTableId, data);
                            
                            // Verify cache was updated
                            if (oCacheManager.isCached(sTableId)) {
                                console.log(`Confirmed: Cache for ${sTableId} has been updated`);
                            } else {
                                console.error(`WARNING: Cache for ${sTableId} was not properly updated!`);
                            }
                        }
                        
                        // Update model with fresh data
                        oViewModel.setProperty("/items", data);
                        oViewModel.setProperty("/allItems", [...data]);
                        oViewModel.setProperty("/filterInfo", "");
                        
                        // Update count
                        const sCount = data.length + " " + (data.length === 1 ? "item" : "items");
                        this.getView().byId("tableCountText").setText(sCount);
                        
                        // Set busy state
                        oViewModel.setProperty("/busy", false);
                        
                        MessageToast.show("Loaded all records from server");
                    })
                    .catch(error => {
                        console.error("Error loading data:", error);
                        oViewModel.setProperty("/busy", false);
                    });
                
                return;
            }
            
            // Store filter criteria in view model
            oViewModel.setProperty("/filterCriteria", oFilterCriteria);
            
            // Execute server search
            console.log("Executing server search with filters:", Object.keys(oFilterCriteria).length);
            this._executeAdvancedSearch(sTableId, oFilterCriteria);
        },

        /**
         * Execute advanced search against Supabase
         * @param {string} sTableId The table ID
         * @param {Object} oFilterCriteria The filter criteria
         * @private
         */
        _executeAdvancedSearch: function(sTableId, oFilterCriteria) {
            console.log("Starting server search execution for", sTableId);
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
            
            console.log("Executing Supabase query with filters:", aFilterTerms);
            
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
                console.log(`Search returned ${data.length} records from server`);
                
                // Process relation fields if needed (similar to your existing code)
                // ...
                
                // CRITICAL: Update the entity cache with the server data
                const oCacheManager = this.getOwnerComponent().getEntityCacheManager();
                if (oCacheManager) {
                    console.log(`Explicitly updating cache for ${sTableId} with ${data.length} records from search`);
                    
                    // Double check that the cache was cleared
                    if (oCacheManager.isCached(sTableId)) {
                        console.warn(`Cache for ${sTableId} was not cleared properly. Clearing now.`);
                        oCacheManager.clearEntityCache(sTableId);
                    }
                    
                    // Update the cache with server data
                    oCacheManager.setEntityCache(sTableId, data);
                    
                    // Verify the cache was updated successfully
                    if (oCacheManager.isCached(sTableId)) {
                        console.log(`Confirmed: Cache for ${sTableId} has been updated with search results`);
                    } else {
                        console.error(`WARNING: Failed to update cache for ${sTableId}!`);
                    }
                } else {
                    console.error("Cache manager not available during search results processing!");
                }
                
                // Update model with search results
                oViewModel.setProperty("/items", data);
                oViewModel.setProperty("/allItems", [...data]); // Store a copy of all items
                
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
                
                MessageToast.show(`Search complete: Found ${data.length} records`);
                
                // Apply scrolling with protection against multiple calls
                if (this._scrollTimerId) {
                    clearTimeout(this._scrollTimerId);
                }
                
                this._scrollTimerId = setTimeout(() => {
                    var aVisibleColumns = oViewModel.getProperty("/visibleColumns") || [];
                    if (aVisibleColumns.length > 5) {
                        this._createTopScrollContainer(aVisibleColumns.length * 6);
                    }
                    delete this._scrollTimerId;
                }, 500);
            }).catch(error => {
                console.error("Error in Supabase query:", error);
                oViewModel.setProperty("/busy", false);
            });
        }


   
    });
});