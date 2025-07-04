// EntityDetail.controller.js extensions for Notes and Files management

sap.ui.define([
    "com/supabase/easyui5/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/Text",
    "sap/m/Input",
    "sap/m/TextArea",
    "sap/m/Select",
    "sap/m/CheckBox",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/m/Table",
    "sap/m/Column",
    "sap/m/ColumnListItem",
    "sap/m/Label",
    "sap/m/HBox",
    "sap/m/VBox",
    "sap/m/Panel",
    "sap/ui/core/Item",
    "sap/ui/unified/FileUploader"
], function(
    BaseController, JSONModel, Dialog, Button, Text, Input, TextArea, Select, CheckBox, 
    MessageBox, MessageToast, Table, Column, ColumnListItem, Label, HBox, VBox, Panel, Item, FileUploader
) {
    "use strict";

    return BaseController.extend("com.supabase.easyui5.controller.EntityDetail", {  
        /**
         * Formatter methods for the view
         */
        formatter: {
            formatDate: function(dateString) {
                if (!dateString) {
                    return "";
                }
                return new Date(dateString).toLocaleDateString();
            },
            
            formatBoolean: function(bValue) {
                return bValue ? "Yes" : "No";
            },
            
            formatNumber: function(nValue) {
                if (nValue === undefined || nValue === null) {
                    return "";
                }
                return parseFloat(nValue).toFixed(2);
            }
        },
        

        /**
         * Lifecycle hook when the controller is initialized with improved parent info handling
         */
        onInit: function() {
            console.log("EntityDetail controller initialized");
            
            // Create view model
            const oViewModel = new JSONModel({
                tableName: "",
                tableId: "",
                entityId: "",
                entityTitle: "",
                entitySubtitle: "",
                entity: {},
                originalEntity: {}, // Store original data for cancel functionality
                relatedItems: [],
                filteredRelatedItems: [],
                editMode: false,
                busy: false,
                delay: 0,
                validationErrors: {},
                parentInfo: null    // Store parent info for navigation after save
            });
            
            // Set the model on the view
            this.setModel(oViewModel, "viewModel");
            
            // Register for route matched event
            this.getRouter().getRoute("entityDetail").attachPatternMatched(this._onRouteMatched, this);
            
            // Check for parent info in session storage (for related items edit flow)
            this._loadParentInfoForEdit();
            
            // Register extensions
            try {
                this._registerExtensions();
            } catch (error) {
                console.error("Could not register extensions:", error);
            }
        },


        /**
         * Enhanced loadParentInfoForEdit with better error handling
         * @private
         */
        _loadParentInfoForEdit: function() {
            try {
                const sParentInfo = sessionStorage.getItem("parentEntityInfo");
                console.log("Checking for parent info in detail view:", sParentInfo);
                
                if (sParentInfo) {
                    const oParentInfo = JSON.parse(sParentInfo);
                    console.log("Found parent info:", JSON.stringify(oParentInfo, null, 2));
                    
                    // Check if the parent info is recent (within last 5 minutes)
                    const bFresh = oParentInfo.timestamp && 
                                (new Date().getTime() - oParentInfo.timestamp < 5 * 60 * 1000);
                    
                    // Store the parent info regardless of flags - we'll use it for back navigation
                    const oViewModel = this.getModel("viewModel");
                    oViewModel.setProperty("/parentInfo", oParentInfo);
                    
                    // Create a backup as well
                    this._parentInfoBackup = JSON.parse(JSON.stringify(oParentInfo));
                    
                    console.log("Parent info stored in view model and backup created");
                    
                    // Log detailed state
                    console.log("Parent entity:", oParentInfo.parentTable, oParentInfo.parentId);
                    console.log("Is editing:", oParentInfo.isEditing);
                    console.log("Foreign key:", oParentInfo.foreignKey);
                    console.log("Info freshness:", bFresh ? "Fresh" : "Stale");
                } else {
                    console.log("No parent info found in session storage");
                }
            } catch (e) {
                console.error("Error parsing parent entity info:", e);
            }
        },
                                                
                /**
         * Try to register controller extensions
         * @private
         */
        _registerExtensions: function() {
            console.log("Registering controller extensions");
            
            try {
                // Load extensions asynchronously
                sap.ui.require(["com/supabase/easyui5/controller/EntityDetailExtensions.controller"], function(getExtensions) {
                    if (getExtensions) {
                        const extensions = getExtensions();
                        console.log("Extensions loaded successfully");
                        
                        // Map extension methods to controller
                        if (extensions.form && extensions.form._configureForm) {
                            this._configureForm = extensions.form._configureForm.bind(this);
                        }
                        
                        if (extensions.relatedItems && extensions.relatedItems._loadRelatedItems) {
                            this._loadRelatedItems = extensions.relatedItems._loadRelatedItems.bind(this);
                        }
                        
                        if (extensions.actions) {
                            if (extensions.actions.onSavePress) {
                                this.onSavePress = extensions.actions.onSavePress.bind(this);
                            }
                            if (extensions.actions.onCancelPress) {
                                this.onCancelPress = extensions.actions.onCancelPress.bind(this);
                            }
                            if (extensions.actions.onEditPress) {
                                this.onEditPress = extensions.actions.onEditPress.bind(this);
                            }
                        }
                    }
                }.bind(this));
            } catch (error) {
                console.error("Error registering extensions:", error);
            }
        },

        /**
         * Route matched handler with enhanced debugging
         * @param {sap.ui.base.Event} oEvent The route matched event
         * @private
         */
        _onRouteMatched: function(oEvent) {
            console.log("🔍 ROUTE DEBUG: EntityDetail route matched event fired");
            
            try {
                const sTableId = oEvent.getParameter("arguments").table;
                const sEntityId = oEvent.getParameter("arguments").id;
                
                console.log("🔍 ROUTE DEBUG: Parameters - Table ID:", sTableId, "Entity ID:", sEntityId);
                
                // Verify view is available
                console.log("🔍 ROUTE DEBUG: View available?", !!this.getView());
                
                // Store the table ID and entity ID in the view model
                const oViewModel = this.getModel("viewModel");
                
                if (!oViewModel) {
                    console.error("🔍 ROUTE DEBUG: viewModel not found! Creating a new one.");
                    const oNewViewModel = new sap.ui.model.json.JSONModel({
                        tableName: "",
                        tableId: "",
                        entityId: "",
                        entityTitle: "",
                        entitySubtitle: "",
                        entity: {},
                        originalEntity: {},
                        relatedItems: [],
                        filteredRelatedItems: [],
                        editMode: false,
                        busy: false,
                        delay: 0,
                        validationErrors: {}
                    });
                    this.setModel(oNewViewModel, "viewModel");
                }
                
                // Try again with new or existing model
                const oViewModelFinal = this.getModel("viewModel");
                console.log("🔍 ROUTE DEBUG: Setting properties in viewModel");
                
                oViewModelFinal.setProperty("/tableId", sTableId);
                oViewModelFinal.setProperty("/entityId", sEntityId);
                
                // Set table name based on the ID (capitalize first letter)
                const sTableName = sTableId.charAt(0).toUpperCase() + sTableId.slice(1).replace(/_/g, " ");
                oViewModelFinal.setProperty("/tableName", sTableName);
                
                // Reset validation errors
                oViewModelFinal.setProperty("/validationErrors", {});
                
                // Reset edit mode
                oViewModelFinal.setProperty("/editMode", false);
                
                // Set busy state while loading
                oViewModelFinal.setProperty("/busy", true);
                
                // Initialize related items arrays immediately (empty)
                oViewModelFinal.setProperty("/relatedItems", []);
                oViewModelFinal.setProperty("/filteredRelatedItems", []);

                console.log("🔍 ROUTE DEBUG: Checking for relatedItemsTable in view");
                const oTable = this.getView().byId("relatedItemsTable");
                console.log("🔍 ROUTE DEBUG: Table found?", !!oTable);
                
                if (oTable) {
                    // Check current binding state
                    console.log("🔍 ROUTE DEBUG: Current table binding:", 
                                oTable.isBound("items") ? "Bound" : "Not bound");
                                
                    if (oTable.isBound("items")) {
                        const oBinding = oTable.getBinding("items");
                        console.log("🔍 ROUTE DEBUG: Current binding path:", 
                                    oBinding ? oBinding.getPath() : "unknown");
                    }

                    // Initialize table with empty template immediately
                    console.log("🔍 ROUTE DEBUG: Pre-initializing table with empty template");
                    try {
                        // Only do this if the table doesn't already have a template
                        if (!oTable.getBindingInfo("items") || !oTable.getBindingInfo("items").template) {
                            const oTempTemplate = new sap.m.ColumnListItem();
                            oTable.bindItems({
                                path: "viewModel>/filteredRelatedItems",
                                template: oTempTemplate
                            });
                            console.log("🔍 ROUTE DEBUG: Applied temporary binding with empty template");
                        }
                    } catch (tempBindingError) {
                        console.error("🔍 ROUTE DEBUG: Error applying temporary binding:", tempBindingError);
                    }
                }
                
                // Configure related items table right away (with empty data)
                console.log("🔍 ROUTE DEBUG: Pre-initializing related items table");
                this._configureRelatedItemsTable(sTableId);
                
                // Load metadata and then entity data
                console.log("🔍 ROUTE DEBUG: Getting table metadata");
                this.getTableMetadata(sTableId)
                    .then((oMetadata) => {
                        console.log("🔍 ROUTE DEBUG: Metadata loaded successfully");
                        
                        // Store metadata for later use
                        this._oTableMetadata = oMetadata;
                        
                        // Load the data
                        console.log("🔍 ROUTE DEBUG: Now loading entity data");
                        this._loadEntity(sTableId, sEntityId);
                        this._loadNotesAndFiles(sTableId, sEntityId);
                    })
                    .catch(error => {
                        console.error("🔍 ROUTE DEBUG: Error loading metadata:", error);
                        console.error("🔍 ROUTE DEBUG: Error stack:", error.stack);
                        oViewModelFinal.setProperty("/busy", false);
                    });
            } catch (e) {
                console.error("🔍 ROUTE DEBUG: Critical error in _onRouteMatched:", e);
                console.error("🔍 ROUTE DEBUG: Error stack:", e.stack);
                
                // Try to set busy to false
                try {
                    const oViewModel = this.getModel("viewModel");
                    if (oViewModel) {
                        oViewModel.setProperty("/busy", false);
                    }
                } catch (modelError) {
                    console.error("🔍 ROUTE DEBUG: Error resetting busy state:", modelError);
                }
            }
        },
        
        /**
         * Configure form with improved vertical layout (labels above fields)
         * @param {Object} oMetadata Table metadata
         * @param {Object} oData Entity data
         * @private
         */
        _configureForm: function(oMetadata, oData) {
            try {
                console.log("Finding suitable container for entity details");
                
                // Try to find any suitable container
                let oContainer = null;
                
                // Option 1: Look for the specific ID
                oContainer = this.getView().byId("detailContentArea") || 
                            this.getView().byId("entityDetailsContainer");
                
                // Option 2: Look for any ObjectPageSubSection
                if (!oContainer) {
                    const aSubSections = this.getView().getControlsByType("sap.uxap.ObjectPageSubSection");
                    if (aSubSections && aSubSections.length > 0) {
                        // Use the first subsection
                        oContainer = aSubSections[0];
                        console.log("Using ObjectPageSubSection as container");
                    }
                }
                
                // Option 3: Look for any Layout container
                if (!oContainer) {
                    const aLayouts = this.getView().getControlsByType("sap.ui.layout.form.SimpleForm") ||
                                    this.getView().getControlsByType("sap.ui.layout.form.Form") ||
                                    this.getView().getControlsByType("sap.m.VBox") ||
                                    this.getView().getControlsByType("sap.m.Panel");
                    
                    if (aLayouts && aLayouts.length > 0) {
                        oContainer = aLayouts[0];
                        console.log("Using layout container:", oContainer.getMetadata().getName());
                    }
                }
                
                // Option 4: Use page content as last resort
                if (!oContainer) {
                    const oPage = this.getView().getControlsByType("sap.m.Page")[0] ||
                                this.getView().getControlsByType("sap.uxap.ObjectPageLayout")[0];
                    
                    if (oPage) {
                        // Try to get the content aggregation
                        if (oPage.getContent && oPage.addContent) {
                            oContainer = oPage;
                            console.log("Using page as container");
                        }
                    }
                }
                
                if (!oContainer) {
                    console.error("Could not find any suitable container for entity details");
                    return;
                }
                
                // Create a responsive grid layout for better organization
                const oLayout = new sap.ui.layout.Grid({
                    defaultSpan: "XL4 L4 M6 S12", // Each field takes one third on large screens, half on medium, full on small
                    vSpacing: 1,
                    hSpacing: 1,
                    width: "100%"
                });
                
                // Add fields based on metadata
                oMetadata.columns.forEach((oColumnMetadata) => {
                    // Skip non-visible columns
                    if (!oColumnMetadata.visible) return;
                    
                    // Create a cell to hold the field
                    const oCell = new sap.m.VBox({
                        width: "100%",
                        alignItems: "Start"
                    });
                    
                    // Add label above
                    oCell.addItem(new Label({
                        text: oColumnMetadata.label,
                        design: "Bold",
                        width: "100%"
                    }).addStyleClass("sapUiTinyMarginBottom"));
                    
                    // Create text field
                    let oControl;
                    
                    switch (oColumnMetadata.type) {
                        case "relation":
                            oControl = new Text({
                                text: oData[oColumnMetadata.name + "_text"] || oData[oColumnMetadata.name] || ""
                            });
                            break;
                        case "boolean":
                            oControl = new Text({
                                text: oData[oColumnMetadata.name] ? "Yes" : "No"
                            });
                            break;
                        case "date":
                            oControl = new Text({
                                text: oData[oColumnMetadata.name] ? new Date(oData[oColumnMetadata.name]).toLocaleDateString() : ""
                            });
                            break;
                        case "number":
                            oControl = new Text({
                                text: oData[oColumnMetadata.name] !== undefined ? parseFloat(oData[oColumnMetadata.name]).toFixed(2) : ""
                            });
                            break;
                        default:
                            oControl = new Text({
                                text: oData[oColumnMetadata.name] || ""
                            });
                    }
                    
                    // Style the value text
                    oControl.addStyleClass("sapUiTinyMarginTop");
                    oControl.setWidth("100%");
                    
                    // Add field to cell
                    oCell.addItem(oControl);
                    
                    // Add cell to layout
                    oLayout.addContent(oCell.addStyleClass("sapUiSmallMargin"));
                });
                
                // Wrap in a panel for nicer appearance
                const oPanel = new sap.m.Panel({
                    headerText: "Details",
                    expandable: false,
                    expanded: true,
                    backgroundDesign: "Solid",
                    content: [oLayout]
                });
                
                // Clear the container or add to its aggregation
                if (oContainer.removeAllContent) {
                    oContainer.removeAllContent();
                    oContainer.addContent(oPanel);
                } else if (oContainer.removeAllItems) {
                    oContainer.removeAllItems();
                    oContainer.addItem(oPanel);
                } else if (oContainer.removeAllFormElements) {
                    oContainer.removeAllFormElements();
                    const oFormElement = new sap.ui.layout.form.FormElement();
                    oFormElement.addField(oPanel);
                    oContainer.addFormElement(oFormElement);
                } else if (oContainer.addContent) {
                    // Try to add without clearing (might cause duplicates but better than nothing)
                    oContainer.addContent(oPanel);
                } else {
                    console.error("Container doesn't have a method to add content:", oContainer);
                }
                
                console.log("Entity details added to container");
            } catch (error) {
                console.error("Error in dynamic _configureForm:", error);
            }
        },
                
       
        
       /**
         * Configure related items table
         * @param {string} sTableId Table ID
         * @private
         */
 
        _configureRelatedItemsTable: function(sTableId) {
            console.log("🔍 TABLE DEBUG: Started _configureRelatedItemsTable for table:", sTableId);
            
            try {
                const oTable = this.getView().byId("relatedItemsTable");
                
                console.log("🔍 TABLE DEBUG: Found table?", !!oTable, "Table ID:", oTable ? oTable.getId() : "null");
                
                if (!oTable) {
                    console.error("🔍 TABLE DEBUG: Related items table not found in the view! Check ID in XML");
                    return;
                }
                
                // Try getting current binding info to see if there's already a template
                const oBindingInfo = oTable.getBindingInfo("items");
                console.log("🔍 TABLE DEBUG: Current binding info:", oBindingInfo);
                
                // Clear existing columns
                console.log("🔍 TABLE DEBUG: Existing columns count:", oTable.getColumns().length);
                oTable.removeAllColumns();
                console.log("🔍 TABLE DEBUG: Removed all columns");
                
                // Use try-catch for metadata retrieval
                this.getTableMetadata(sTableId)
                    .then(oMetadata => {
                        console.log("🔍 TABLE DEBUG: Got metadata for table", sTableId, ":", JSON.stringify(oMetadata, null, 2));
                        
                        // Add columns based on visible fields (limit to 5)
                        const aVisibleColumns = oMetadata.columns.filter(col => col.visible).slice(0, 5);
                        console.log("🔍 TABLE DEBUG: Visible columns:", aVisibleColumns.length);
                        
                        aVisibleColumns.forEach((oColumnMetadata, index) => {
                            console.log(`🔍 TABLE DEBUG: Adding column ${index+1}:`, oColumnMetadata.name);
                            oTable.addColumn(new sap.m.Column({
                                header: new sap.m.Label({ text: oColumnMetadata.label })
                            }));
                        });
                        
                        // Add actions column for edit/delete buttons
                        console.log("🔍 TABLE DEBUG: Adding actions column");
                        oTable.addColumn(new sap.m.Column({
                            header: new sap.m.Label({ text: "Actions" }),
                            hAlign: "Right"
                        }));
                        
                        console.log("🔍 TABLE DEBUG: Finished adding columns, total:", oTable.getColumns().length);
                        
                        // Create the template for the items binding
                        console.log("🔍 TABLE DEBUG: Creating template for binding");
                        const oTemplate = new sap.m.ColumnListItem({
                            type: "Navigation",
                            press: this.onRelatedItemPress.bind(this)
                        });
                        
                        // Add cells to the template based on visible columns
                        aVisibleColumns.forEach((oColumnMetadata, index) => {
                            console.log(`🔍 TABLE DEBUG: Adding cell ${index+1} for column:`, oColumnMetadata.name);
                            
                            let oCell;
                            switch (oColumnMetadata.type) {
                                case "relation":
                                    oCell = new sap.m.Text({ 
                                        text: "{viewModel>" + oColumnMetadata.name + "_text}" 
                                    });
                                    break;
                                case "boolean":
                                    oCell = new sap.m.Text({ 
                                        text: {
                                            path: "viewModel>" + oColumnMetadata.name,
                                            formatter: this.formatter.formatBoolean
                                        }
                                    });
                                    break;
                                case "date":
                                    oCell = new sap.m.Text({ 
                                        text: {
                                            path: "viewModel>" + oColumnMetadata.name,
                                            formatter: this.formatter.formatDate
                                        }
                                    });
                                    break;
                                case "number":
                                    oCell = new sap.m.Text({ 
                                        text: {
                                            path: "viewModel>" + oColumnMetadata.name,
                                            formatter: this.formatter.formatNumber
                                        }
                                    });
                                    break;
                                default:
                                    oCell = new sap.m.Text({ 
                                        text: "{viewModel>" + oColumnMetadata.name + "}" 
                                    });
                            }
                            oTemplate.addCell(oCell);
                        });
                        
                        // Add the actions cell
                        console.log("🔍 TABLE DEBUG: Adding actions cell to template");
                        const oActions = new sap.m.HBox({
                            justifyContent: "End",
                            items: [
                                new sap.m.Button({
                                    icon: "sap-icon://edit",
                                    type: "Transparent",
                                    tooltip: "Edit",
                                    press: this.onEditRelatedItemPress.bind(this)
                                }),
                                new sap.m.Button({
                                    icon: "sap-icon://delete",
                                    type: "Transparent",
                                    tooltip: "Delete",
                                    press: this.onDeleteRelatedItemPress.bind(this)
                                })
                            ]
                        });
                        oTemplate.addCell(oActions);
                        
                        console.log("🔍 TABLE DEBUG: Template created with cells:", oTemplate.getCells().length);
                        
                        // Make a deep clone of the model data to track if bindings update
                        const oViewModel = this.getModel("viewModel");
                        const aRelatedItems = oViewModel.getProperty("/filteredRelatedItems") || [];
                        console.log("🔍 TABLE DEBUG: Current data in model:", JSON.stringify(aRelatedItems));
                        
                        try {
                            // Important: Properly bind the table with the template
                            console.log("🔍 TABLE DEBUG: About to bind items to table");
                            
                            // Make binding debugging explicit
                            const oBindingSettings = {
                                path: "viewModel>/filteredRelatedItems",
                                template: oTemplate
                            };
                            console.log("🔍 TABLE DEBUG: Binding settings:", JSON.stringify(oBindingSettings, function(key, value) {
                                if (key === "template") return "[Template Object]";
                                return value;
                            }));
                            
                            // Clear any existing bindings first
                            if (oTable.isBound("items")) {
                                console.log("🔍 TABLE DEBUG: Unbinding existing items");
                                oTable.unbindItems();
                            }
                            
                            // Apply the binding
                            oTable.bindItems(oBindingSettings);
                            
                            console.log("🔍 TABLE DEBUG: Items bound successfully");
                            
                            // Verify binding after the fact
                            const oNewBindingInfo = oTable.getBindingInfo("items");
                            console.log("🔍 TABLE DEBUG: New binding info path:", 
                                        oNewBindingInfo ? oNewBindingInfo.path : "none", 
                                        "Has template:", !!oNewBindingInfo && !!oNewBindingInfo.template);
                            
                        } catch (bindingError) {
                            console.error("🔍 TABLE DEBUG: Error during item binding:", bindingError);
                            console.error("🔍 TABLE DEBUG: Error stack:", bindingError.stack);
                        }
                        
                        console.log("🔍 TABLE DEBUG: Table configuration completed");
                        
                        // Force invalidation to ensure re-rendering
                        oTable.invalidate();
                        console.log("🔍 TABLE DEBUG: Table invalidated for re-rendering");
                        
                    }).catch(error => {
                        console.error("🔍 TABLE DEBUG: Error getting metadata:", error);
                        console.error("🔍 TABLE DEBUG: Error stack:", error.stack);
                    });
            } catch (e) {
                console.error("🔍 TABLE DEBUG: Critical error in _configureRelatedItemsTable:", e);
                console.error("🔍 TABLE DEBUG: Error stack:", e.stack);
            }
        },
  
        /**
         * Toggle navigation panel
         */
        onToggleNav: function() {
            try {
                // Get the SplitApp
                const oSplitApp = this.getOwnerComponent().getSplitApp();
                
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
                
                // Toggle state
                if (bExpanded) {
                    oSplitApp.hideMaster();
                    
                    // Update button if available
                    if (oToggleButton) {
                        oToggleButton.setIcon("sap-icon://menu2");
                        oToggleButton.setTooltip("Show Navigation");
                    }
                    
                    // Update model state
                    oAppViewModel.setProperty("/navExpanded", false);
                } else {
                    oSplitApp.showMaster();
                    
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
         * Create content for the edit form with direct control references and enhanced validation
         * @param {Object} oMetadata Table metadata
         * @param {Object} oEntityData Entity data
         * @returns {Array} Array of form content controls
         * @private
         */
        _createEditFormContent: function(oMetadata, oEntityData) {
            const aContent = [];
            
            // Store control references for validation
            this._editControls = {};
            
            // Add fields based on metadata
            oMetadata.columns.forEach((oColumnMetadata) => {
                // Skip fields that are not editable or not visible
                if (oColumnMetadata.editable === false || 
                    !oColumnMetadata.visible || 
                    oColumnMetadata.name === oMetadata.primaryKey ||
                    oColumnMetadata.name === 'created_at' ||
                    oColumnMetadata.name === 'updated_at') {
                    return;
                }
                
                // Add label
                aContent.push(new sap.m.Label({
                    text: oColumnMetadata.label,
                    required: oColumnMetadata.required === true
                }));
                
                // Create appropriate input control with enhanced validation
                let oControl;
                
                switch (oColumnMetadata.type) {
                    case "relation":
                        oControl = new sap.m.ComboBox({
                            selectedKey: oEntityData[oColumnMetadata.name],
                            required: oColumnMetadata.required === true,
                            showSecondaryValues: true
                        });
                        
                        // Load relation options
                        this._loadRelationOptionsForEdit(
                            oControl, 
                            oColumnMetadata.relation, 
                            oColumnMetadata.name
                        );
                        break;
                        
                    case "boolean":
                        oControl = new sap.m.CheckBox({
                            selected: oEntityData[oColumnMetadata.name] === true
                        });
                        break;
                    
                    case "date":
                        oControl = new sap.m.DatePicker({
                            value: oEntityData[oColumnMetadata.name] ? new Date(oEntityData[oColumnMetadata.name]).toISOString().split('T')[0] : null,
                            valueFormat: "yyyy-MM-dd",
                            displayFormat: "medium",
                            required: oColumnMetadata.required === true,
                            change: function(oEvent) {
                                // Clear error state on successful change
                                if (oEvent.getParameter("valid")) {
                                    oEvent.getSource().setValueState("None");
                                } else {
                                    oEvent.getSource().setValueState("Error");
                                    oEvent.getSource().setValueStateText("Please enter a valid date");
                                }
                            }
                        });
                        break;
                    
                    case "number":
                        oControl = new sap.m.Input({
                            value: oEntityData[oColumnMetadata.name],
                            type: "Number",
                            required: oColumnMetadata.required === true,
                            liveChange: function(oEvent) {
                                const value = oEvent.getParameter("value");
                                if (value && isNaN(parseFloat(value))) {
                                    oEvent.getSource().setValueState("Error");
                                    oEvent.getSource().setValueStateText("Please enter a valid number");
                                } else {
                                    oEvent.getSource().setValueState("None");
                                }
                            }
                        });
                        break;
                        
                    case "email":
                        oControl = new sap.m.Input({
                            value: oEntityData[oColumnMetadata.name],
                            type: "Email",
                            required: oColumnMetadata.required === true,
                            liveChange: function(oEvent) {
                                const value = oEvent.getParameter("value");
                                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                                if (value && !emailRegex.test(value)) {
                                    oEvent.getSource().setValueState("Error");
                                    oEvent.getSource().setValueStateText("Please enter a valid email address");
                                } else {
                                    oEvent.getSource().setValueState("None");
                                }
                            }
                        });
                        break;
                        
                    case "url":
                        oControl = new sap.m.Input({
                            value: oEntityData[oColumnMetadata.name],
                            type: "Url",
                            required: oColumnMetadata.required === true,
                            liveChange: function(oEvent) {
                                const value = oEvent.getParameter("value");
                                const urlRegex = /^(http|https):\/\/[^ "]+$/;
                                if (value && !urlRegex.test(value)) {
                                    oEvent.getSource().setValueState("Error");
                                    oEvent.getSource().setValueStateText("Please enter a valid URL (starting with http:// or https://)");
                                } else {
                                    oEvent.getSource().setValueState("None");
                                }
                            }
                        });
                        break;
                    
                    case "text":
                        oControl = new sap.m.TextArea({
                            value: oEntityData[oColumnMetadata.name],
                            rows: 3,
                            required: oColumnMetadata.required === true
                        });
                        break;
                    
                    default:
                        oControl = new sap.m.Input({
                            value: oEntityData[oColumnMetadata.name],
                            required: oColumnMetadata.required === true
                        });
                }
                
                // Store control reference
                this._editControls[oColumnMetadata.name] = oControl;
                
                // Add control to content
                aContent.push(oControl);
            });
            
            return aContent;
        },

        /**
         * Validate the edit form with enhanced type checking
         * @param {Object} oMetadata Table metadata
         * @returns {boolean} True if validation passes, false otherwise
         * @private
         */
        _validateEditForm: function(oMetadata) {
            let bValid = true;
            
            // Validate each field
            oMetadata.columns.forEach((oColumnMetadata) => {
                // Skip fields that are not editable or not visible
                if (oColumnMetadata.editable === false || 
                    !oColumnMetadata.visible || 
                    oColumnMetadata.name === oMetadata.primaryKey ||
                    oColumnMetadata.name === 'created_at' ||
                    oColumnMetadata.name === 'updated_at') {
                    return;
                }
                
                // Get control from stored references
                const oControl = this._editControls[oColumnMetadata.name];
                if (!oControl) return;
                
                // Reset validation state
                if (oControl.setValueState) {
                    oControl.setValueState("None");
                    if (oControl.setValueStateText) {
                        oControl.setValueStateText("");
                    }
                }
                
                // Get current value
                let vValue;
                if (oControl instanceof sap.m.CheckBox) {
                    vValue = oControl.getSelected();
                } else if (oControl.getValue) {
                    vValue = oControl.getValue();
                }
                
                // Check if field is required
                if (oColumnMetadata.required === true && 
                    (vValue === undefined || vValue === null || vValue === "")) {
                    bValid = false;
                    
                    if (oControl.setValueState) {
                        oControl.setValueState("Error");
                        if (oControl.setValueStateText) {
                            oControl.setValueStateText("This field is required");
                        }
                    }
                    
                    console.log("Validation failed for", oColumnMetadata.name, ": Required field is empty");
                    return;
                }
                
                // Skip further validation if value is empty (and not required)
                if (vValue === undefined || vValue === null || vValue === "") {
                    return;
                }
                
                // Validate by type
                let bTypeValid = true;
                let sErrorMessage = "";
                
                switch (oColumnMetadata.type) {
                    case "number":
                        if (isNaN(parseFloat(vValue)) || !isFinite(vValue)) {
                            bTypeValid = false;
                            sErrorMessage = "Please enter a valid number";
                        }
                        break;
                        
                    case "date":
                        const oDate = new Date(vValue);
                        if (isNaN(oDate.getTime())) {
                            bTypeValid = false;
                            sErrorMessage = "Please enter a valid date";
                        }
                        break;
                        
                    case "email":
                        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                        if (!emailRegex.test(vValue)) {
                            bTypeValid = false;
                            sErrorMessage = "Please enter a valid email address";
                        }
                        break;
                        
                    case "url":
                        const urlRegex = /^(http|https):\/\/[^ "]+$/;
                        if (!urlRegex.test(vValue)) {
                            bTypeValid = false;
                            sErrorMessage = "Please enter a valid URL (starting with http:// or https://)";
                        }
                        break;
                }
                
                if (!bTypeValid) {
                    bValid = false;
                    
                    if (oControl.setValueState) {
                        oControl.setValueState("Error");
                        if (oControl.setValueStateText) {
                            oControl.setValueStateText(sErrorMessage);
                        }
                    }
                    
                    console.log("Validation failed for", oColumnMetadata.name, ":", sErrorMessage);
                }
            });
            
            return bValid;
        },
        
        /**
         * Check if two objects are equal (for change detection)
         * @param {Object} obj1 First object
         * @param {Object} obj2 Second object
         * @returns {boolean} True if objects are equal
         * @private
         */
        _areObjectsEqual: function(obj1, obj2) {
            // Handle null or undefined
            if (obj1 === obj2) return true;
            if (!obj1 || !obj2) return false;
            
            // Get all keys from both objects
            const allKeys = [...new Set([...Object.keys(obj1), ...Object.keys(obj2)])];
            
            // Special keys to ignore (usually system metadata)
            const ignoredKeys = ['created_at', 'updated_at'];
            
            // Check each key
            for (const key of allKeys) {
                // Skip ignored keys
                if (ignoredKeys.includes(key)) continue;
                
                // Get values
                const val1 = obj1[key];
                const val2 = obj2[key];
                
                // Check if both values are objects
                if (typeof val1 === 'object' && typeof val2 === 'object' && 
                    val1 !== null && val2 !== null) {
                    // Recursively check nested objects
                    if (!this._areObjectsEqual(val1, val2)) return false;
                } 
                // Handle dates (convert to string for comparison)
                else if (val1 instanceof Date && val2 instanceof Date) {
                    if (val1.getTime() !== val2.getTime()) return false;
                }
                // Special handling for null/undefined - treat these as equal
                else if ((val1 === null || val1 === undefined) && 
                        (val2 === null || val2 === undefined)) {
                    continue;
                }
                // Check primitive values
                else if (val1 !== val2) {
                    return false;
                }
            }
            
            return true;
        },
        

      /**
         * Save entity data with complete parameter validation and data type correction
         * @param {string} sTableId The table ID
         * @param {string} sEntityId The entity ID 
         * @param {Object} oMetadata Table metadata (optional)
         * @param {Object} oEntityData Entity data to save (optional)
         * @private
         */
        /**
         * Save entity data with improved relation field handling
         * @param {string} sTableId The table ID
         * @param {string} sEntityId The entity ID 
         * @param {Object} oMetadata Table metadata (optional)
         * @param {Object} oEntityData Entity data to save (optional)
         * @private
         */
        _saveEntity: function(sTableId, sEntityId, oMetadata, oEntityData) {
            const oViewModel = this.getModel("viewModel");
            
            // Set busy state
            oViewModel.setProperty("/busy", true);
            
            // Ensure we have the correct sEntityId - get from model if not provided or if it's an object
            if (typeof sEntityId === 'object' || !sEntityId) {
                console.log("Entity ID is not a string, getting from model");
                sEntityId = oViewModel.getProperty("/entityId");
                
                // Additional validation
                if (!sEntityId) {
                    this.showErrorMessage("Error: Missing entity ID for update operation");
                    oViewModel.setProperty("/busy", false);
                    return;
                }
            }
            
            console.log("Using Entity ID for update:", sEntityId, "Type:", typeof sEntityId);
            
            // Safety checks for required parameters
            if (!sTableId) {
                console.error("Missing table ID for _saveEntity");
                oViewModel.setProperty("/busy", false);
                this.showErrorMessage("Error updating entity: Missing table ID");
                return;
            }
            
            // If entity data is not provided, get it from the view model
            const oSaveData = oEntityData || oViewModel.getProperty("/entity");
            if (!oSaveData) {
                console.error("No entity data available for saving");
                oViewModel.setProperty("/busy", false);
                this.showErrorMessage("Error updating entity: No data available");
                return;
            }
            
            // Get the correct metadata
            this.getTableMetadata(sTableId)
                .then(metadata => {
                    if (!metadata || !metadata.columns) {
                        throw new Error("Invalid metadata structure - missing columns");
                    }
                    
                    console.log("Using metadata for save:", metadata);
                    
                    // Create a clean copy of the data without read-only fields
                    const oDataToUpdate = {};
                    const sPrimaryKey = metadata.primaryKey;
                    
                    if (!sPrimaryKey) {
                        throw new Error("No primary key defined in metadata");
                    }
                    
                    console.log("Using primary key for update:", sPrimaryKey);
                    
                    // Process special field types like relations and fix their values
                    const processRelationFields = async () => {
                        // Use a promise array to wait for all relation processing
                        const relationPromises = [];
                        
                        // First pass - identify and process relation fields
                        for (const oColumnMetadata of metadata.columns) {
                            // Skip non-editable fields and primary key
                            if ((oColumnMetadata.editable === false && 
                                oColumnMetadata.name !== sPrimaryKey) || 
                                oColumnMetadata.name === sPrimaryKey) {
                                continue;
                            }
                            
                            // Special handling for relation fields
                            if (oColumnMetadata.type === "relation") {
                                const sFieldName = oColumnMetadata.name;
                                let relationValue = oSaveData[sFieldName];
                                
                                console.log(`Processing relation field ${sFieldName}, current value:`, relationValue, typeof relationValue);
                                
                                // If the value doesn't look like a valid key/ID, try to find the proper key
                                if (relationValue && (isNaN(Number(relationValue)) || typeof relationValue === "string" && relationValue.includes(" "))) {
                                    // This might be a display value rather than a key
                                    const relationPromise = this._resolveRelationKey(oColumnMetadata.relation, relationValue)
                                        .then(resolvedKey => {
                                            if (resolvedKey !== null) {
                                                console.log(`Resolved relation key for ${sFieldName}: ${resolvedKey}`);
                                                oDataToUpdate[sFieldName] = resolvedKey;
                                            } else {
                                                // Keep original value if we can't resolve
                                                console.log(`Could not resolve relation key for ${sFieldName}, using original value`);
                                                oDataToUpdate[sFieldName] = relationValue;
                                            }
                                        });
                                    
                                    relationPromises.push(relationPromise);
                                } else {
                                    // Convert to number if it's a string containing a number
                                    if (typeof relationValue === 'string' && !isNaN(parseInt(relationValue))) {
                                        relationValue = parseInt(relationValue);
                                    }
                                    
                                    oDataToUpdate[sFieldName] = relationValue;
                                    console.log(`Using relation value for ${sFieldName}:`, relationValue, typeof relationValue);
                                }
                            } else {
                                // For non-relation fields, just copy the value
                                oDataToUpdate[oColumnMetadata.name] = oSaveData[oColumnMetadata.name];
                            }
                        }
                        
                        // Wait for all relation processing to complete
                        await Promise.all(relationPromises);
                    };
                    
                    // Process relations and then update the entity
                    return processRelationFields().then(() => {
                        // Add server-side timestamp for updated_at if it exists in the schema
                        const hasUpdatedAtField = metadata.columns.some(col => col.name === 'updated_at');
                        if (hasUpdatedAtField) {
                            oDataToUpdate['updated_at'] = new Date().toISOString();
                        }
                        
                        console.log("Final data to update:", oDataToUpdate);
                        console.log("Table ID:", sTableId);
                        console.log("Entity ID:", sEntityId, "Type:", typeof sEntityId);
                        
                        // Update entity
                        return this.getSupabaseClient()
                            .from(sTableId)
                            .update(oDataToUpdate)
                            .eq(sPrimaryKey, sEntityId)
                            .then(({ data, error }) => {
                                if (error) {
                                    throw error;
                                }
                                return data;
                            });
                    });
                })
                .then(data => {
                    oViewModel.setProperty("/busy", false);
                    
                    // Reset edit mode
                    oViewModel.setProperty("/editMode", false);
                    
                    // Show success message
                    this.showSuccessMessage("Entity updated successfully");
                    
                    // Reload entity to refresh data
                    this._loadEntity(sTableId, sEntityId);
                })
                .catch(error => {
                    console.error("Error updating entity:", error);
                    this.showErrorMessage("Error updating entity: " + (error.message || JSON.stringify(error)));
                    oViewModel.setProperty("/busy", false);
                });
        },

        /**
         * Helper method to resolve relation key from display value
         * @param {string} sRelatedTable Related table name
         * @param {string} sDisplayValue Display value to resolve
         * @returns {Promise} Promise resolving to the key or null
         * @private
         */
        _resolveRelationKey: function(sRelatedTable, sDisplayValue) {
            console.log(`Trying to resolve relation key for ${sRelatedTable} with display value: "${sDisplayValue}"`);
            
            return this.getTableMetadata(sRelatedTable)
                .then(metadata => {
                    const sPrimaryKey = metadata.primaryKey;
                    const sTitleField = metadata.titleField || sPrimaryKey;
                    
                    console.log(`Using primary key ${sPrimaryKey} and title field ${sTitleField} for relation resolution`);
                    
                    // First try exact match on title field
                    return this.getSupabaseClient()
                        .from(sRelatedTable)
                        .select(sPrimaryKey)
                        .eq(sTitleField, sDisplayValue)
                        .then(({ data, error }) => {
                            if (error) {
                                console.error(`Error querying relation ${sRelatedTable}:`, error);
                                return null;
                            }
                            
                            if (data && data.length > 0) {
                                console.log(`Found exact match for ${sDisplayValue} in ${sRelatedTable}:`, data[0][sPrimaryKey]);
                                return data[0][sPrimaryKey];
                            }
                            
                            // If no exact match, try to see if the display value contains the key
                            const potentialKey = extractNumberFromString(sDisplayValue);
                            if (potentialKey !== null) {
                                console.log(`Extracted potential key ${potentialKey} from "${sDisplayValue}"`);
                                
                                // Verify this key exists
                                return this.getSupabaseClient()
                                    .from(sRelatedTable)
                                    .select(sPrimaryKey)
                                    .eq(sPrimaryKey, potentialKey)
                                    .then(({ data, error }) => {
                                        if (error) {
                                            console.error(`Error verifying key ${potentialKey}:`, error);
                                            return null;
                                        }
                                        
                                        if (data && data.length > 0) {
                                            console.log(`Verified key ${potentialKey} exists in ${sRelatedTable}`);
                                            return potentialKey;
                                        }
                                        
                                        console.log(`Could not verify key ${potentialKey} in ${sRelatedTable}`);
                                        return null;
                                    });
                            }
                            
                            console.log(`No relation key found for ${sDisplayValue} in ${sRelatedTable}`);
                            return null;
                        });
                })
                .catch(error => {
                    console.error(`Error resolving relation key:`, error);
                    return null;
                });
        },

        // Helper function to extract a number from a string
        extractNumberFromString (str) {
            if (!str || typeof str !== 'string') return null;
            
            // Extract all numbers from the string
            const matches = str.match(/\d+/g);
            if (matches && matches.length > 0) {
                // Return the last number found (often the ID)
                return parseInt(matches[matches.length - 1], 10);
            }
            
            return null;
        },

        /**
         * Handler for delete button press with related items check
         */
        onDeletePress: function() {
            const oViewModel = this.getModel("viewModel");
            const sTableId = oViewModel.getProperty("/tableId");
            const sEntityId = oViewModel.getProperty("/entityId");
            const sTableName = oViewModel.getProperty("/tableName");
            
            // Double-check for related items
            const aRelatedItems = oViewModel.getProperty("/relatedItems") || [];
            
            // If related items exist, show error message and cancel deletion
            if (aRelatedItems && aRelatedItems.length > 0) {
                sap.m.MessageBox.error(
                    "Cannot delete this " + oViewModel.getProperty("/tableName") + 
                    " because it has related items. Please delete all related items first.",
                    { title: "Delete Not Allowed" }
                );
                return;
            }
            
            // Show confirmation dialog if no related items exist
            sap.m.MessageBox.confirm(
                "Are you sure you want to delete this " + sTableName + "?", 
                {
                    title: "Delete Confirmation",
                    onClose: function(sAction) {
                        if (sAction === sap.m.MessageBox.Action.OK) {
                            // User confirmed, proceed with deletion
                            this._deleteEntity(sTableId, sEntityId);
                        }
                    }.bind(this),
                    styleClass: this.getOwnerComponent().getContentDensityClass()
                }
            );
        },

        /**
         * Delete the entity after confirmation
         * @param {string} sTableId The table ID
         * @param {string} sEntityId The entity ID
         * @private
         */
        _deleteEntity: function(sTableId, sEntityId) {
            const oViewModel = this.getModel("viewModel");
            
            // Set busy state
            oViewModel.setProperty("/busy", true);
            
            // Get metadata to determine primary key
            this.getTableMetadata(sTableId).then((oMetadata) => {
                const sPrimaryKey = oMetadata.primaryKey;
                
                // Delete the entity
                this.getSupabaseClient()
                    .from(sTableId)
                    .delete()
                    .eq(sPrimaryKey, sEntityId)
                    .then(({ error }) => {
                        oViewModel.setProperty("/busy", false);
                        
                        if (error) {
                            this.showErrorMessage("Error deleting entity", error);
                            return;
                        }
                        
                        const sTableName = oViewModel.getProperty("/tableName");
                        this.showSuccessMessage(sTableName + " deleted successfully");
                        
                        // Navigate back to the list view
                        this.getRouter().navTo("entityList", {
                            table: sTableId
                        });
                    })
                    .catch(error => {
                        console.error("Error in Supabase query:", error);
                        this.showErrorMessage("Error deleting entity: " + error.message);
                        oViewModel.setProperty("/busy", false);
                    });
            }).catch(error => {
                console.error("Error getting table metadata:", error);
                this.showErrorMessage("Error getting table metadata: " + error.message);
                oViewModel.setProperty("/busy", false);
            });
        },


        /**
         * Enhanced onSavePress method to handle navigation back to parent entity
         */
        onSavePress: function() {
            console.log("Save button pressed");
            
            // Get the view model and entity data
            const oViewModel = this.getModel("viewModel");
            const sTableId = oViewModel.getProperty("/tableId");
            const sEntityId = oViewModel.getProperty("/entityId");
            
            // Validate that we have a proper entity ID
            if (!sEntityId) {
                this.showErrorMessage("Cannot save: Missing entity ID");
                return;
            }
            
            console.log("Saving entity with ID:", sEntityId);
            
            // Store original entity data for checking changes later
            const oEntityData = JSON.parse(JSON.stringify(oViewModel.getProperty("/entity")));
            oViewModel.setProperty("/originalEntity", oEntityData);
            
            // Set busy state
            oViewModel.setProperty("/busy", true);
            
            // Get parent info from the view model
            let oParentInfo = oViewModel.getProperty("/parentInfo");
            
            // If not in view model, try backup
            if (!oParentInfo && this._parentInfoBackup) {
                console.log("Using parent info backup");
                oParentInfo = this._parentInfoBackup;
            }
            
            if (!oParentInfo) {
                try {
                    // Last attempt to get from session storage
                    const sParentInfo = sessionStorage.getItem("parentEntityInfo");
                    if (sParentInfo) {
                        oParentInfo = JSON.parse(sParentInfo);
                        console.log("Retrieved parent info from session storage");
                    }
                } catch (e) {
                    console.error("Error retrieving parent info from session storage:", e);
                }
            }
            
            console.log("Parent info for navigation after save:", 
                oParentInfo ? JSON.stringify(oParentInfo, null, 2) : "none");
            
            // Get metadata for the table
            this.getTableMetadata(sTableId).then((oMetadata) => {
                // Validate form data
                if (!this.validateForm(oMetadata, oEntityData)) {
                    this.showErrorMessage("Please correct the errors in the form");
                    oViewModel.setProperty("/busy", false);
                    return;
                }
                
                const sPrimaryKey = oMetadata.primaryKey;
                
                // Create a copy of the data without read-only fields
                const oDataToUpdate = {};
                
                oMetadata.columns.forEach((oColumnMetadata) => {
                    // Skip non-editable fields and primary key
                    if ((oColumnMetadata.editable === false && 
                        oColumnMetadata.name !== sPrimaryKey) || 
                        oColumnMetadata.name === sPrimaryKey) {
                        return;
                    }
                    
                    // Add field to update data
                    oDataToUpdate[oColumnMetadata.name] = oEntityData[oColumnMetadata.name];
                });
                
                // Add server-side timestamp for updated_at
                oDataToUpdate['updated_at'] = new Date().toISOString();
                
                console.log("Data to update:", JSON.stringify(oDataToUpdate, null, 2));
                
                // Update entity
                this.getSupabaseClient()
                    .from(sTableId)
                    .update(oDataToUpdate)
                    .eq(sPrimaryKey, sEntityId)
                    .then(({ data, error }) => {
                        oViewModel.setProperty("/busy", false);
                        
                        if (error) {
                            console.error("Update error:", error);
                            this.showErrorMessage("Error updating entity", error);
                            return;
                        }
                        
                        // Reset edit mode
                        oViewModel.setProperty("/editMode", false);
                        
                        // Show success message
                        this.showSuccessMessage("Entity updated successfully");
                        
                        // Try to clear session storage
                        try {
                            sessionStorage.removeItem("parentEntityInfo");
                            console.log("Cleared parent info from session storage");
                        } catch (e) {
                            console.warn("Could not clear session storage:", e);
                        }
                        
                        // Check if we're in a related item edit flow 
                        if (oParentInfo && oParentInfo.isEditing && 
                            oParentInfo.parentTable && oParentInfo.parentId) {
                            
                            console.log("Navigating back to parent entity after edit:", 
                                oParentInfo.parentTable, oParentInfo.parentId);
                            
                            // Navigate back to parent entity with a small delay
                            setTimeout(() => {
                                this.getRouter().navTo("entityDetail", {
                                    table: oParentInfo.parentTable,
                                    id: oParentInfo.parentId
                                });
                                console.log("Navigation back to parent initiated");
                            }, 100);
                        } else {
                            // No parent info or not in edit mode - reload the entity
                            this._loadEntity(sTableId, sEntityId);
                        }
                    })
                    .catch(error => {
                        console.error("Error in Supabase query:", error);
                        this.showErrorMessage("Error updating entity: " + error.message);
                        oViewModel.setProperty("/busy", false);
                    });
            }).catch(error => {
                console.error("Error getting table metadata:", error);
                this.showErrorMessage("Error getting table metadata: " + error.message);
                oViewModel.setProperty("/busy", false);
            });
        },
   
        /**
         * Enhanced onCancelPress method with improved parent entity detection
         */
        onCancelPress: function() {
            console.log("Cancel button pressed");
            
            const oViewModel = this.getModel("viewModel");
            const sTableId = oViewModel.getProperty("/tableId");
            
            // Get parent info from view model
            let oParentInfo = oViewModel.getProperty("/parentInfo");
            
            // If not in view model, try backup
            if (!oParentInfo && this._parentInfoBackup) {
                console.log("Using parent info backup for cancel");
                oParentInfo = this._parentInfoBackup;
            }
            
            if (!oParentInfo) {
                try {
                    // Last attempt to get from session storage
                    const sParentInfo = sessionStorage.getItem("parentEntityInfo");
                    if (sParentInfo) {
                        oParentInfo = JSON.parse(sParentInfo);
                        console.log("Retrieved parent info from session storage for cancel");
                    }
                } catch (e) {
                    console.error("Error retrieving parent info from session storage:", e);
                }
            }
            
            // Try to clear session storage
            try {
                sessionStorage.removeItem("parentEntityInfo");
                console.log("Cleared parent info from session storage");
            } catch (e) {
                console.warn("Could not clear session storage:", e);
            }
            
            // Reset edit mode
            oViewModel.setProperty("/editMode", false);
            
            // Navigate based on parent info
            if (oParentInfo && oParentInfo.parentTable && oParentInfo.parentId) {
                console.log("Navigating to parent entity after cancel:", 
                    oParentInfo.parentTable, oParentInfo.parentId);
                
                try {
                    // Force a small delay to ensure proper transition
                    setTimeout(() => {
                        this.getRouter().navTo("entityDetail", {
                            table: oParentInfo.parentTable,
                            id: oParentInfo.parentId
                        });
                        console.log("Navigation to parent initiated after cancel");
                    }, 100);
                } catch (e) {
                    console.error("Error during navigation to parent after cancel:", e);
                    
                    // Fallback navigation to list view
                    this.getRouter().navTo("entityList", {
                        table: sTableId
                    });
                }
            } else {
                // No parent info - reload the entity
                this._loadEntity(sTableId, oViewModel.getProperty("/entityId"));
            }
        },
                
        /**
         * Handler for add related item press
         */
        onAddRelatedItemPress: function() {
            const oViewModel = this.getModel("viewModel");
            const sTableId = oViewModel.getProperty("/tableId");
            const sEntityId = oViewModel.getProperty("/entityId");
            
            // Get metadata for the current table
            this.getTableMetadata(sTableId).then((oMetadata) => {
                // Get the relations
                if (!oMetadata.relations || oMetadata.relations.length === 0) {
                    this.showErrorMessage("No relations defined for this entity");
                    return;
                }
                
                const oRelation = oMetadata.relations[0];
                
                // Store parent information in session storage for use in create form
                const oParentInfo = {
                    parentTable: sTableId,
                    parentId: sEntityId,
                    foreignKey: oRelation.foreignKey
                };
                
                sessionStorage.setItem("parentEntityInfo", JSON.stringify(oParentInfo));
                
                // Navigate to create page for related table
                this.getRouter().navTo("entityCreate", {
                    table: oRelation.table
                });
            });
        },
        

        /**
         * Handler for edit related item press with proper event handling
         * @param {sap.ui.base.Event} oEvent The button press event
         * @public
         */
        onEditRelatedItemPress: function(oEvent) {
            console.log("Edit related item button pressed");
            
            // For UI5 events, prevent default event behavior
            if (oEvent.preventDefault) {
                oEvent.preventDefault();
            }
            
            // Get the button that was pressed
            const oButton = oEvent.getSource();
            
            // Get the list item - navigate up the control tree
            // Button is inside HBox which is inside a Cell which is inside a ColumnListItem
            let oItem = oButton;
            let nLevel = 0;
            
            // Find the ColumnListItem (table row)
            while (oItem && !(oItem instanceof sap.m.ColumnListItem) && nLevel < 5) {
                oItem = oItem.getParent();
                nLevel++;
            }
            
            if (!oItem || !(oItem instanceof sap.m.ColumnListItem)) {
                console.error("Could not find parent list item");
                return;
            }
            
            // Get the binding context
            const oContext = oItem.getBindingContext("viewModel");
            if (!oContext) {
                console.error("No binding context found for related item");
                return;
            }
            
            // Get the item data
            const oData = oContext.getObject();
            
            // Get view model and current entity info
            const oViewModel = this.getModel("viewModel");
            const sCurrentTableId = oViewModel.getProperty("/tableId");
            const sCurrentEntityId = oViewModel.getProperty("/entityId");
            
            console.log("Editing related item from parent:", sCurrentTableId, sCurrentEntityId);
            
            // Get the related table ID from the current table's relations
            this.getTableMetadata(sCurrentTableId).then((oMetadata) => {
                // Check if relations are defined
                if (!oMetadata.relations || oMetadata.relations.length === 0) {
                    console.error("No relations defined in metadata");
                    sap.m.MessageBox.error("No relations defined for this entity");
                    return;
                }
                
                // Get the first relation (related table info)
                const oRelation = oMetadata.relations[0];
                const sRelatedTableId = oRelation.table;
                
                console.log(`Relation found: ${sRelatedTableId} with foreign key ${oRelation.foreignKey}`);
                
                // Get metadata for related table
                this.getTableMetadata(sRelatedTableId).then((oRelatedMetadata) => {
                    // Get primary key for related table
                    const sPrimaryKey = oRelatedMetadata.primaryKey;
                    const sPrimaryKeyValue = oData[sPrimaryKey];
                    
                    console.log(`Related item primary key: ${sPrimaryKey}, value: ${sPrimaryKeyValue}`);
                    
                    // Create parent entity info with clear markers
                    const oParentInfo = {
                        parentTable: sCurrentTableId,
                        parentId: sCurrentEntityId,
                        isEditing: true,
                        foreignKey: oRelation.foreignKey,
                        sourceView: "EntityDetail", 
                        timestamp: new Date().getTime()
                    };
                    
                    console.log("Setting parent info in session storage:", JSON.stringify(oParentInfo, null, 2));
                    
                    // Store in session storage with explicit error handling
                    try {
                        // Clear any existing data first
                        sessionStorage.removeItem("parentEntityInfo");
                        // Then set the new data
                        sessionStorage.setItem("parentEntityInfo", JSON.stringify(oParentInfo));
                        console.log("Parent info successfully stored in session storage");
                    } catch (e) {
                        console.error("Failed to store parent info in session storage:", e);
                        // Show error to user
                        sap.m.MessageBox.error("Failed to store navigation state. Back navigation may not work correctly.");
                    }
                    
                    // Navigate to the detail view of the related item with delay to ensure storage completes
                    setTimeout(() => {
                        this.getRouter().navTo("entityDetail", {
                            table: sRelatedTableId,
                            id: sPrimaryKeyValue
                        });
                        console.log("Navigation to edit related item initiated");
                    }, 100);
                });
            });
        },
        
        /**
         * Handler for delete related item press
         */
        onDeleteRelatedItemPress: function(oEvent) {
            // Get the list item from the button's parent
            const oButton = oEvent.getSource();
            const oItem = oButton.getParent().getParent();
            
            // Get the binding context
            const oContext = oItem.getBindingContext("viewModel");
            if (!oContext) {
                console.error("No binding context found for related item");
                return;
            }
            
            const oData = oContext.getObject();
            const oViewModel = this.getModel("viewModel");
            const sTableId = oViewModel.getProperty("/tableId");
            
            console.log("Delete related item:", oData);
            
            // Get metadata for the current table
            this.getTableMetadata(sTableId).then((oMetadata) => {
                // Get the relations
                if (!oMetadata.relations || oMetadata.relations.length === 0) {
                    console.error("No relations defined in metadata");
                    return;
                }
                
                const oRelation = oMetadata.relations[0];
                
                // Get metadata for related table
                this.getTableMetadata(oRelation.table).then((oRelatedMetadata) => {
                    const sPrimaryKey = oRelatedMetadata.primaryKey;
                    const sPrimaryKeyValue = oData[sPrimaryKey];
                    
                    console.log(`Confirming deletion of related item: ${oRelation.table}/${sPrimaryKeyValue}`);
                    
                    // Confirm deletion
                    this.showConfirmationDialog(
                        "Are you sure you want to delete this related item?",
                        () => {
                            console.log(`Deleting related item: ${oRelation.table}/${sPrimaryKeyValue}`);
                            
                            // Delete related item
                            this.getSupabaseClient()
                                .from(oRelation.table)
                                .delete()
                                .eq(sPrimaryKey, sPrimaryKeyValue)
                                .then(({ error }) => {
                                    if (error) {
                                        console.error("Error deleting related item:", error);
                                        this.showErrorMessage("Error deleting related item", error);
                                        return;
                                    }
                                    
                                    console.log("Related item deleted successfully");
                                    
                                    // Reload entity to refresh related items
                                    this._loadEntity(sTableId, oViewModel.getProperty("/entityId"));
                                    this.showSuccessMessage("Related item deleted successfully");
                                });
                        },
                        "Delete Confirmation"
                    );
                });
            });
        },
        
        /**
         * Handler for related item press
         */
        onRelatedItemPress: function(oEvent) {
            const oItem = oEvent.getSource();
            const oContext = oItem.getBindingContext("viewModel");
            
            if (!oContext) {
                console.error("No binding context found for related item");
                return;
            }
            
            const oData = oContext.getObject();
            const oViewModel = this.getModel("viewModel");
            const sTableId = oViewModel.getProperty("/tableId");
            
            console.log("Item pressed:", oData);
            
            this.getTableMetadata(sTableId).then(oMetadata => {
                if (!oMetadata.relations || oMetadata.relations.length === 0) {
                    console.error("No relations defined for navigation");
                    return;
                }
                
                const oRelation = oMetadata.relations[0];
                
                this.getTableMetadata(oRelation.table).then(oRelatedMetadata => {
                    const sPrimaryKey = oRelatedMetadata.primaryKey;
                    const sPrimaryKeyValue = oData[sPrimaryKey];
                    
                    console.log(`Navigating to related item details: ${oRelation.table}/${sPrimaryKeyValue}`);
                    
                    // Navigate to detail view of related item
                    this.getRouter().navTo("entityDetail", {
                        table: oRelation.table,
                        id: sPrimaryKeyValue
                    });
                });
            });
        },
        
        /**
         * Search related items
         */
        onRelatedItemsSearch: function(oEvent) {
            const sQuery = oEvent.getParameter("query").toLowerCase();
            const oViewModel = this.getModel("viewModel");
            const aAllItems = [...oViewModel.getProperty("/relatedItems")]; // Create a copy
            
            // If no query, show all items
            if (!sQuery) {
                oViewModel.setProperty("/filteredRelatedItems", aAllItems);
                return;
            }
            
            // Filter items
            const aFilteredItems = aAllItems.filter(item => {
                // Convert item to string and check if it includes the query
                return JSON.stringify(item).toLowerCase().includes(sQuery);
            });
            
            // Update model with filtered items
            oViewModel.setProperty("/filteredRelatedItems", aFilteredItems);
        },

        /**
         * Reset error states on all fields with improved selector
         * @public
         */
        resetFormErrorStates: function() {
            console.log("Resetting error states on all form fields");
            
            // Find all input fields in the view and reset errors
            const aInputControls = [];
            
            // Look for standard input controls
            this.getView().$().find(".sapMInputBase").each(function() {
                const sId = this.id;
                const oControl = sap.ui.getCore().byId(sId);
                if (oControl) {
                    aInputControls.push(oControl);
                }
            });
            
            // Look for checkbox controls separately
            this.getView().$().find(".sapMCb").each(function() {
                const sId = this.id;
                const oControl = sap.ui.getCore().byId(sId);
                if (oControl) {
                    aInputControls.push(oControl);
                }
            });
            
            // Look for ComboBox controls separately
            this.getView().$().find(".sapMComboBox").each(function() {
                const sId = this.id;
                const oControl = sap.ui.getCore().byId(sId);
                if (oControl) {
                    aInputControls.push(oControl);
                }
            });
            
            console.log("Found", aInputControls.length, "controls to reset");
            
            // Reset all fields to non-error state
            aInputControls.forEach(oControl => {
                if (oControl.setValueState) {
                    console.log("Resetting value state for", oControl.getId());
                    oControl.setValueState("None");
                    if (oControl.setValueStateText) {
                        oControl.setValueStateText("");
                    }
                }
            });
            
            // Clear validation errors in the model
            const oViewModel = this.getModel("viewModel");
            if (oViewModel) {
                oViewModel.setProperty("/validationErrors", {});
            }
            
            console.log("Form error states reset complete");
        },

 
        // Updated _loadEntity method for EntityDetail.controller.js
        _loadEntity: function(sTableId, sEntityId) {
            console.log("🔍 ENTITY DEBUG: Starting _loadEntity method", {tableId: sTableId, entityId: sEntityId});
            
            try {
                const oViewModel = this.getModel("viewModel");
                
                if (!oViewModel) {
                    console.error("🔍 ENTITY DEBUG: viewModel not found!");
                    return;
                }
                
                // Set busy state
                oViewModel.setProperty("/busy", true);
                
                // Check if we have metadata stored
                if (!this._oTableMetadata) {
                    console.log("🔍 ENTITY DEBUG: No stored metadata, loading it now");
                    this.getTableMetadata(sTableId)
                        .then(oMetadata => {
                            console.log("🔍 ENTITY DEBUG: Metadata loaded successfully");
                            this._oTableMetadata = oMetadata;
                            this._continueLoadingEntity(sTableId, sEntityId, oMetadata);
                        })
                        .catch(error => {
                            console.error("🔍 ENTITY DEBUG: Error loading metadata:", error);
                            oViewModel.setProperty("/busy", false);
                        });
                } else {
                    console.log("🔍 ENTITY DEBUG: Using stored metadata");
                    this._continueLoadingEntity(sTableId, sEntityId, this._oTableMetadata);
                }
            } catch (e) {
                console.error("🔍 ENTITY DEBUG: Critical error in _loadEntity:", e);
                
                // Try to set busy to false
                try {
                    const oViewModel = this.getModel("viewModel");
                    if (oViewModel) {
                        oViewModel.setProperty("/busy", false);
                    }
                } catch (modelError) {
                    console.error("🔍 ENTITY DEBUG: Error resetting busy state:", modelError);
                }
            }
        },

        // Updated _continueLoadingEntity with polymorphic relationship handling
        _continueLoadingEntity: function(sTableId, sEntityId, oMetadata) {
            console.log("🔍 ENTITY DEBUG: Continuing entity loading with metadata");
            
            try {
                const oViewModel = this.getModel("viewModel");
                
                // Use table-specific primary key format
                const sPrimaryKey = oMetadata.primaryKey || `${sTableId}_id`;
                console.log("🔍 ENTITY DEBUG: Using primary key:", sPrimaryKey);
                
                if (!sPrimaryKey) {
                    console.error("🔍 ENTITY DEBUG: No primary key defined in metadata");
                    oViewModel.setProperty("/busy", false);
                    return;
                }
                
                // Check if entity ID is valid
                if (!sEntityId) {
                    console.error("🔍 ENTITY DEBUG: No entity ID specified");
                    oViewModel.setProperty("/busy", false);
                    return;
                }
                
                // Check if Supabase client is available
                if (!this.getSupabaseClient()) {
                    console.error("🔍 ENTITY DEBUG: Supabase client not available");
                    oViewModel.setProperty("/busy", false);
                    return;
                }
                
                // Build Supabase query with specific primary key field
                console.log(`🔍 ENTITY DEBUG: Building query: ${sTableId}.select('*').eq('${sPrimaryKey}', '${sEntityId}')`);
                
                // Load entity data
                this.getSupabaseClient()
                    .from(sTableId)
                    .select('*')
                    .eq(sPrimaryKey, sEntityId)
                    .single()
                    .then(async ({ data, error }) => {
                        if (error) {
                            console.error("🔍 ENTITY DEBUG: Error loading entity data:", error);
                            oViewModel.setProperty("/busy", false);
                            return;
                        }
                        
                        if (!data) {
                            console.error("🔍 ENTITY DEBUG: No data found for entity");
                            oViewModel.setProperty("/busy", false);
                            return;
                        }
                        
                        console.log("🔍 ENTITY DEBUG: Entity data loaded:", JSON.stringify(data, null, 2));
                        
                        // Check if this table has an entity_id field for polymorphic relationship
                        const hasEntityId = oMetadata.columns.some(col => col.name === "entity_id");
                        
                        // Load entity data if available (for polymorphic relationship)
                        if (hasEntityId && data.entity_id) {
                            try {
                                console.log("🔍 ENTITY DEBUG: Loading polymorphic entity data for entity_id:", data.entity_id);
                                
                                const { data: entityData, error: entityError } = await this.getSupabaseClient()
                                    .from("entities")
                                    .select('*')
                                    .eq("entity_id", data.entity_id)
                                    .single();
                                    
                                if (!entityError && entityData) {
                                    console.log("🔍 ENTITY DEBUG: Loaded entity data:", entityData);
                                    // Merge entity data with the current data
                                    data.entity_data = entityData;
                                }
                            } catch (e) {
                                console.error("🔍 ENTITY DEBUG: Error loading entity data:", e);
                            }
                        }
                        
                        // Process relation fields
                        console.log("🔍 ENTITY DEBUG: Processing relation fields");
                        for (const oColumnMetadata of oMetadata.columns) {
                            if (oColumnMetadata.type === "relation" && data[oColumnMetadata.name]) {
                                const relatedId = data[oColumnMetadata.name];
                                const relatedTable = oColumnMetadata.relation;
                                
                                console.log(`🔍 ENTITY DEBUG: Processing relation ${oColumnMetadata.name} -> ${relatedTable} (ID: ${relatedId})`);
                                
                                try {
                                    // Get related record
                                    const relatedMetadata = await this.getTableMetadata(relatedTable);
                                    const relatedPrimaryKey = relatedMetadata.primaryKey || `${relatedTable}_id`;
                                    
                                    console.log(`🔍 ENTITY DEBUG: Loading related data from ${relatedTable} where ${relatedPrimaryKey}=${relatedId}`);
                                    
                                    const { data: relatedData, error: relatedError } = await this.getSupabaseClient()
                                        .from(relatedTable)
                                        .select('*')
                                        .eq(relatedPrimaryKey, relatedId)
                                        .single();
                                    
                                    if (!relatedError && relatedData) {
                                        // Store related text
                                        const titleField = relatedMetadata.titleField || relatedPrimaryKey;
                                        data[oColumnMetadata.name + "_text"] = relatedData[titleField];
                                        data[oColumnMetadata.name + "_obj"] = relatedData;
                                        
                                        console.log(`🔍 ENTITY DEBUG: Loaded related text: ${data[oColumnMetadata.name + "_text"]}`);
                                    } else if (relatedError) {
                                        console.error(`🔍 ENTITY DEBUG: Error loading related data:`, relatedError);
                                    }
                                } catch (e) {
                                    console.error(`🔍 ENTITY DEBUG: Exception loading related data:`, e);
                                }
                            }
                        }
                        
                        // Update entity in model
                        console.log("🔍 ENTITY DEBUG: Setting entity data to model");
                        oViewModel.setProperty("/entity", data);
                        
                        // Keep a copy of the original data for checking changes
                        oViewModel.setProperty("/originalEntity", JSON.parse(JSON.stringify(data)));
                        
                        // Set entity title and subtitle
                        const sTitleField = oMetadata.titleField || sPrimaryKey;
                        const sSubtitleField = oMetadata.subtitleField;
                        
                        oViewModel.setProperty("/entityTitle", data[sTitleField]);
                        
                        if (sSubtitleField && data[sSubtitleField]) {
                            oViewModel.setProperty("/entitySubtitle", data[sSubtitleField]);
                        } else {
                            oViewModel.setProperty("/entitySubtitle", "ID: " + data[sPrimaryKey]);
                        }
                        
                        // Configure form
                        console.log("🔍 ENTITY DEBUG: Configuring entity form");
                        this._configureForm(oMetadata, data);
                        
                        // Load related items
                        console.log("🔍 ENTITY DEBUG: Loading related items");
                        this._loadRelatedItems(oMetadata, data);
                    })
                    .catch(error => {
                        console.error("🔍 ENTITY DEBUG: Error in Supabase query:", error);
                        oViewModel.setProperty("/busy", false);
                    });
            } catch (e) {
                console.error("🔍 ENTITY DEBUG: Critical error in _continueLoadingEntity:", e);
                
                // Try to set busy to false
                try {
                    const oViewModel = this.getModel("viewModel");
                    if (oViewModel) {
                        oViewModel.setProperty("/busy", false);
                    }
                } catch (modelError) {
                    console.error("🔍 ENTITY DEBUG: Error resetting busy state:", modelError);
                }
            }
        },
        

        /**
         * Load related items for the current entity with enhanced debugging
         * @param {Object} oMetadata The table metadata
         * @param {Object} oEntityData The entity data
         * @private
         */
        _loadRelatedItems: function(oMetadata, oEntityData) {
            console.log("🔍 RELATED DEBUG: Starting _loadRelatedItems method");
            
            try {
                const oViewModel = this.getModel("viewModel");
                const sTableId = oViewModel.getProperty("/tableId");
                
                // Make the related items section visible
                const oRelatedItemsSection = this.getView().byId("relatedItemsSection");
                if (oRelatedItemsSection) {
                    oRelatedItemsSection.setVisible(true);
                }
                
                // Check for polymorphic relationship via entities table
                const hasEntityId = oMetadata.columns.some(col => col.name === "entity_id");
                let entityId = null;
                
                if (hasEntityId && oEntityData.entity_id) {
                    entityId = oEntityData.entity_id;
                    console.log("🔍 RELATED DEBUG: Using polymorphic relationship via entity_id:", entityId);
                }
                
                // Check if relations exist
                const hasStandardRelations = oMetadata.relations && oMetadata.relations.length > 0;
                
                // If no relations and no entity_id, we can't load related items
                if (!hasStandardRelations && !entityId) {
                    console.log("🔍 RELATED DEBUG: No relations defined for table:", sTableId);
                    oViewModel.setProperty("/relatedItems", []);
                    oViewModel.setProperty("/filteredRelatedItems", []);
                    this._configureRelatedItemsTable(sTableId);
                    oViewModel.setProperty("/busy", false);
                    return;
                }
                
                // Use appropriate primary key
                const sPrimaryKey = oMetadata.primaryKey || `${sTableId}_id`;
                const sPrimaryKeyValue = oEntityData[sPrimaryKey];
                
                if (!sPrimaryKeyValue && !entityId) {
                    console.error("🔍 RELATED DEBUG: Primary key value not found in entity data!");
                    oViewModel.setProperty("/relatedItems", []);
                    oViewModel.setProperty("/filteredRelatedItems", []);
                    this._configureRelatedItemsTable(sTableId);
                    oViewModel.setProperty("/busy", false);
                    return;
                }
                
                // Prepare to collect all related items from different sources
                let allRelatedItemsPromises = [];
                
                // 1. First, check standard relations if available
                if (hasStandardRelations) {
                    const oRelation = oMetadata.relations[0];
                    console.log(`🔍 RELATED DEBUG: Loading standard relation data from ${oRelation.table} where ${oRelation.foreignKey}=${sPrimaryKeyValue}`);
                    
                    const standardRelationPromise = this.getSupabaseClient()
                        .from(oRelation.table)
                        .select('*')
                        .eq(oRelation.foreignKey, sPrimaryKeyValue)
                        .then(({ data, error }) => {
                            if (error) {
                                console.error("🔍 RELATED DEBUG: Error loading standard relation items:", error);
                                return [];
                            }
                            
                            const items = data || [];
                            console.log(`🔍 RELATED DEBUG: Loaded ${items.length} standard relation items`);
                            
                            // Process relations for these items
                            return this._processRelatedItemsRelations(oRelation.table, items);
                        })
                        .catch(error => {
                            console.error("🔍 RELATED DEBUG: Error in standard relation query:", error);
                            return [];
                        });
                        
                    allRelatedItemsPromises.push(standardRelationPromise);
                }
                
                // 2. Check for polymorphic relations via entity_id
                if (entityId) {
                    console.log(`🔍 RELATED DEBUG: Loading polymorphic relation data for entity_id ${entityId}`);
                    
                    // Look for items in notes table that reference this entity
                    const notesPromise = this.getSupabaseClient()
                        .from("notes")
                        .select('*')
                        .eq("entity_id", entityId)
                        .then(({ data, error }) => {
                            if (error) {
                                console.error("🔍 RELATED DEBUG: Error loading notes:", error);
                                return [];
                            }
                            
                            const items = data || [];
                            console.log(`🔍 RELATED DEBUG: Loaded ${items.length} notes`);
                            
                            // Add a type indicator for UI display
                            items.forEach(item => {
                                item._item_type = "Note";
                                item._relation_type = "polymorphic";
                            });
                            
                            return items;
                        })
                        .catch(error => {
                            console.error("🔍 RELATED DEBUG: Error in notes query:", error);
                            return [];
                        });
                        
                    allRelatedItemsPromises.push(notesPromise);
                    
                    // Look for items in files table that reference this entity
                    const filesPromise = this.getSupabaseClient()
                        .from("files")
                        .select('*')
                        .eq("entity_id", entityId)
                        .then(({ data, error }) => {
                            if (error) {
                                console.error("🔍 RELATED DEBUG: Error loading files:", error);
                                return [];
                            }
                            
                            const items = data || [];
                            console.log(`🔍 RELATED DEBUG: Loaded ${items.length} files`);
                            
                            // Add a type indicator for UI display
                            items.forEach(item => {
                                item._item_type = "File";
                                item._relation_type = "polymorphic";
                            });
                            
                            return items;
                        })
                        .catch(error => {
                            console.error("🔍 RELATED DEBUG: Error in files query:", error);
                            return [];
                        });
                        
                    allRelatedItemsPromises.push(filesPromise);
                    
                    // Look for items in entity_tags table that reference this entity
                    const tagsPromise = this.getSupabaseClient()
                        .from("entity_tags")
                        .select('*, tags(*)')
                        .eq("entity_id", entityId)
                        .then(({ data, error }) => {
                            if (error) {
                                console.error("🔍 RELATED DEBUG: Error loading entity_tags:", error);
                                return [];
                            }
                            
                            const items = data || [];
                            console.log(`🔍 RELATED DEBUG: Loaded ${items.length} entity_tags`);
                            
                            // Add a type indicator for UI display and merge tag data
                            items.forEach(item => {
                                item._item_type = "Tag";
                                item._relation_type = "polymorphic";
                                if (item.tags) {
                                    item.name = item.tags.name;
                                    item.category = item.tags.category;
                                    item.color = item.tags.color;
                                }
                            });
                            
                            return items;
                        })
                        .catch(error => {
                            console.error("🔍 RELATED DEBUG: Error in entity_tags query:", error);
                            return [];
                        });
                        
                    allRelatedItemsPromises.push(tagsPromise);
                }
                
                // Wait for all relation queries to complete
                Promise.all(allRelatedItemsPromises)
                    .then(relatedItemsArrays => {
                        // Flatten all arrays of related items
                        const allRelatedItems = [].concat(...relatedItemsArrays);
                        console.log(`🔍 RELATED DEBUG: Combined ${allRelatedItems.length} related items from all sources`);
                        
                        // Set the data in the model
                        oViewModel.setProperty("/relatedItems", allRelatedItems);
                        oViewModel.setProperty("/filteredRelatedItems", allRelatedItems);
                        
                        // Update delete button state based on related items
                        this._updateDeleteButtonState(allRelatedItems);
                        
                        // Configure and setup the related items table
                        this._configureRelatedItemsTable(sTableId);
                        
                        oViewModel.setProperty("/busy", false);
                        console.log("🔍 RELATED DEBUG: Related items loading complete");
                        
                        return allRelatedItems;
                    })
                    .catch(error => {
                        console.error("🔍 RELATED DEBUG: Error loading related items:", error);
                        oViewModel.setProperty("/busy", false);
                        return [];
                    });
            } catch (e) {
                console.error("🔍 RELATED DEBUG: Critical error in _loadRelatedItems:", e);
                
                const oViewModel = this.getModel("viewModel");
                if (oViewModel) {
                    oViewModel.setProperty("/busy", false);
                }
                
                return Promise.resolve([]);
            }
        },
        
        /**
         * Load relation options for a ComboBox with improved debugging and handling
         * @param {sap.m.ComboBox} oComboBox The ComboBox control
         * @param {string} sRelatedTable The related table name
         * @param {string} sFieldName The field name
         * @private
         */
        _loadRelationOptionsForEdit: function(oComboBox, sRelatedTable, sFieldName) {
            console.log(`Loading relation options for ${sFieldName} from table ${sRelatedTable}`);
            
            this.getTableMetadata(sRelatedTable).then(function(oMetadata) {
                const sPrimaryKey = oMetadata.primaryKey;
                const sTitleField = oMetadata.titleField || sPrimaryKey;
                
                console.log(`Relation ${sFieldName}: Using primary key '${sPrimaryKey}' and title field '${sTitleField}' from ${sRelatedTable}`);
                
                // Load related entities
                this.getSupabaseClient()
                    .from(sRelatedTable)
                    .select(`${sPrimaryKey}, ${sTitleField}`)
                    .then(({ data, error }) => {
                        if (error) {
                            console.error(`Error loading relation options for ${sFieldName}:`, error);
                            return;
                        }
                        
                        console.log(`Loaded ${data ? data.length : 0} relation options for ${sFieldName}`);
                        
                        // Clear existing items
                        oComboBox.removeAllItems();
                        
                        // Add empty item if field is not required
                        const oColumnMeta = oMetadata.columns.find(col => col.name === sFieldName);
                        if (oColumnMeta && !oColumnMeta.required) {
                            oComboBox.addItem(new sap.ui.core.Item({
                                key: "",
                                text: "- None -"
                            }));
                        }
                        
                        // Add items to ComboBox
                        if (data && data.length > 0) {
                            data.forEach(item => {
                                const sKey = item[sPrimaryKey];
                                const sText = item[sTitleField] || sKey;
                                
                                oComboBox.addItem(new sap.ui.core.Item({
                                    key: sKey,
                                    text: sText
                                }));
                                
                                console.log(`Added relation option: key=${sKey}, text=${sText}`);
                            });
                        }
                        
                        // Log the initial selected value to help with debugging
                        console.log(`Initial selected key for ${sFieldName}: ${oComboBox.getSelectedKey()}`);
                    });
            }.bind(this))
            .catch(error => {
                console.error(`Error getting metadata for relation ${sFieldName}:`, error);
            });
        },

 
        /**
         * Enhanced navigation handler that properly handles parent entity return
         */
        onNavBack: function() {
            console.log("Back button pressed");
            
            const oViewModel = this.getModel("viewModel");
            const sTableId = oViewModel.getProperty("/tableId");
            const sEntityId = oViewModel.getProperty("/entityId");
            
            // Try to get parent info from all possible sources
            const tryGetParentInfo = () => {
                // First check view model
                let oParentInfo = oViewModel.getProperty("/parentInfo");
                if (oParentInfo && oParentInfo.parentTable && oParentInfo.parentId) {
                    console.log("Using parent info from view model");
                    return oParentInfo;
                }

                // Then check backup
                if (this._parentInfoBackup && this._parentInfoBackup.parentTable && this._parentInfoBackup.parentId) {
                    console.log("Using parent info from backup");
                    return this._parentInfoBackup;
                }

                // Finally check session storage
                try {
                    const sParentInfo = sessionStorage.getItem("parentEntityInfo");
                    if (sParentInfo) {
                        const oStoredInfo = JSON.parse(sParentInfo);
                        if (oStoredInfo.parentTable && oStoredInfo.parentId) {
                            console.log("Using parent info from session storage");
                            return oStoredInfo;
                        }
                    }
                } catch (e) {
                    console.error("Error retrieving parent info from session storage:", e);
                }
                
                return null;
            };
            
            // Get parent info
            const oParentInfo = tryGetParentInfo();
            
            if (oParentInfo) {
                console.log("Found valid parent info:", JSON.stringify(oParentInfo, null, 2));
                
                // Prepare for navigation
                const sParentTable = oParentInfo.parentTable;
                const sParentId = oParentInfo.parentId;
                
                // Force a delay to ensure state is synchronized
                setTimeout(() => {
                    console.log(`Navigating to parent entity: ${sParentTable}/${sParentId}`);
                    
                    // Navigate to parent entity
                    this.getRouter().navTo("entityDetail", {
                        table: sParentTable,
                        id: sParentId
                    });
                    
                    // Clear parent info AFTER successful navigation
                    setTimeout(() => {
                        try {
                            sessionStorage.removeItem("parentEntityInfo");
                            console.log("Cleared parent info from session storage after navigation");
                        } catch (e) {
                            console.warn("Could not clear session storage after navigation:", e);
                        }
                    }, 300);
                }, 100);
            } else {
                // No parent info found, navigate to list view
                console.log("No parent info, navigating to list view after back button");
                this.getRouter().navTo("entityList", {
                    table: sTableId
                });
                
                // Still clear session storage
                try {
                    sessionStorage.removeItem("parentEntityInfo");
                    console.log("Cleared parent info from session storage");
                } catch (e) {
                    console.warn("Could not clear session storage:", e);
                }
            }
        },
                        /**
         * Update delete button state based on related items
         * @param {Array} aRelatedItems Array of related items
         * @private
         */
        _updateDeleteButtonState: function(aRelatedItems) {
            // Find the delete button - it could be in different containers depending on the view
            let oDeleteButton = null;
            
            // Try to find in header actions first (most likely location)
            const oObjectPageLayout = this.getView().byId("ObjectPageLayout");
            if (oObjectPageLayout) {
                const oHeaderTitle = oObjectPageLayout.getHeaderTitle();
                if (oHeaderTitle) {
                    const aActions = oHeaderTitle.getActions() || [];
                    for (let i = 0; i < aActions.length; i++) {
                        const oAction = aActions[i];
                        if (oAction.getIcon && oAction.getIcon() === "sap-icon://delete") {
                            oDeleteButton = oAction;
                            break;
                        }
                    }
                }
            }
            
            // If not found, try alternative locations
            if (!oDeleteButton) {
                oDeleteButton = this.getView().byId("deleteButton");
            }
            
            // If button found, update its state
            if (oDeleteButton) {
                const bHasRelatedItems = aRelatedItems && aRelatedItems.length > 0;
                
                // Disable the button if related items exist
                oDeleteButton.setEnabled(!bHasRelatedItems);
                
                // Add a tooltip explaining why it's disabled
                if (bHasRelatedItems) {
                    oDeleteButton.setTooltip("Cannot delete while related items exist");
                } else {
                    oDeleteButton.setTooltip("Delete this entity");
                }
            }
        },

        /**
         * Handler for edit button press with server data refresh
         */
        onEditPress: function() {
            console.log("Edit button pressed - fetching latest data from server");
            
            // Get the view model and entity data
            const oViewModel = this.getModel("viewModel");
            const sTableId = oViewModel.getProperty("/tableId");
            const sEntityId = oViewModel.getProperty("/entityId");
            
            // Validate that we have a proper entity ID
            if (!sEntityId) {
                this.showErrorMessage("Cannot edit: Missing entity ID");
                return;
            }
            
            console.log("Fetching latest data for entity ID:", sEntityId);
            
            // Set busy state while fetching
            oViewModel.setProperty("/busy", true);
            
            // Get metadata for the table
            this.getTableMetadata(sTableId).then((oMetadata) => {
                const sPrimaryKey = oMetadata.primaryKey;
                
                // Fetch the latest data from server
                this.getSupabaseClient()
                    .from(sTableId)
                    .select('*')
                    .eq(sPrimaryKey, sEntityId)
                    .single()
                    .then(async ({ data, error }) => {
                        oViewModel.setProperty("/busy", false);
                        
                        if (error) {
                            console.error("Error fetching latest entity data:", error);
                            this.showErrorMessage("Error fetching latest data", error);
                            return;
                        }
                        
                        if (!data) {
                            console.error("No data found for entity");
                            this.showErrorMessage("Entity not found");
                            return;
                        }
                        
                        console.log("Latest entity data fetched:", data);
                        
                        // Process relation fields if needed
                        for (const oColumnMetadata of oMetadata.columns) {
                            if (oColumnMetadata.type === "relation" && data[oColumnMetadata.name]) {
                                const relatedId = data[oColumnMetadata.name];
                                const relatedTable = oColumnMetadata.relation;
                                
                                try {
                                    // Get related record
                                    const relatedMetadata = await this.getTableMetadata(relatedTable);
                                    const relatedPrimaryKey = relatedMetadata.primaryKey;
                                    const { data: relatedData, error: relatedError } = await this.getSupabaseClient()
                                        .from(relatedTable)
                                        .select('*')
                                        .eq(relatedPrimaryKey, relatedId)
                                        .single();
                                    
                                    if (!relatedError && relatedData) {
                                        // Store related text
                                        const titleField = relatedMetadata.titleField || relatedPrimaryKey;
                                        data[oColumnMetadata.name + "_text"] = relatedData[titleField];
                                        data[oColumnMetadata.name + "_obj"] = relatedData;
                                    }
                                } catch (e) {
                                    console.error("Error loading related data", e);
                                }
                            }
                        }
                        
                        // Update entity in model with fresh data
                        oViewModel.setProperty("/entity", data);
                        
                        // Store original entity data for checking changes later
                        oViewModel.setProperty("/originalEntity", JSON.parse(JSON.stringify(data)));
                        
                        // Now proceed with opening the edit dialog with the fresh data
                        this._openEditDialogWithFreshData(oMetadata, data);
                        
                    })
                    .catch(error => {
                        console.error("Error in Supabase query:", error);
                        this.showErrorMessage("Error fetching latest data: " + error.message);
                        oViewModel.setProperty("/busy", false);
                    });
            }).catch(error => {
                console.error("Error getting table metadata:", error);
                this.showErrorMessage("Error getting table metadata: " + error.message);
                oViewModel.setProperty("/busy", false);
            });
        },

        /**
         * Open edit dialog with freshly fetched data
         * @param {Object} oMetadata The table metadata
         * @param {Object} oEntityData The fresh entity data
         * @private
         */
        _openEditDialogWithFreshData: function(oMetadata, oEntityData) {
            // Create a dialog with a simple form
            const oEditDialog = new sap.m.Dialog({
                title: "Edit " + this.getModel("viewModel").getProperty("/tableName"),
                contentWidth: "40rem",
                content: [
                    new sap.ui.layout.form.SimpleForm({
                        editable: true,
                        layout: "ResponsiveGridLayout",
                        labelSpanXL: 4,
                        labelSpanL: 4,
                        labelSpanM: 4,
                        labelSpanS: 12,
                        columnsXL: 1,
                        columnsL: 1,
                        content: this._createEditFormContent(oMetadata, oEntityData)
                    })
                ],
                beginButton: new sap.m.Button({
                    text: "Save",
                    type: "Emphasized",
                    press: function() {
                        // Validation and save logic as before
                        let bValid = true;
                        
                        // Reset validation states
                        this._editControls = this._editControls || {};
                        Object.values(this._editControls).forEach(function(oControl) {
                            if (oControl.setValueState) {
                                oControl.setValueState("None");
                            }
                        });
                        
                        // Check required fields and validate types
                        bValid = this._validateEditForm(oMetadata);
                        
                        // If validation fails, show a message and don't close the dialog
                        if (!bValid) {
                            sap.m.MessageToast.show("Please correct the errors before saving");
                            return;
                        }
                        
                        // Collect updated data from controls
                        const oUpdatedData = JSON.parse(JSON.stringify(oEntityData));
                        oMetadata.columns.forEach((oColumnMetadata) => {
                            // Skip fields that are not editable or not visible
                            if (oColumnMetadata.editable === false || 
                                !oColumnMetadata.visible || 
                                oColumnMetadata.name === oMetadata.primaryKey ||
                                oColumnMetadata.name === 'created_at' ||
                                oColumnMetadata.name === 'updated_at') {
                                return;
                            }
                            
                            const oControl = this._editControls[oColumnMetadata.name];
                            if (!oControl) return;
                            
                            // Get value based on control type
                            if (oControl instanceof sap.m.CheckBox) {
                                oUpdatedData[oColumnMetadata.name] = oControl.getSelected();
                            } else if (oControl instanceof sap.m.DatePicker) {
                                oUpdatedData[oColumnMetadata.name] = oControl.getValue();
                            } else if (oControl.getValue) {
                                oUpdatedData[oColumnMetadata.name] = oControl.getValue();
                            }
                        });
                        
                        // Check if any changes were made
                        if (this._areObjectsEqual(oUpdatedData, oEntityData)) {
                            sap.m.MessageBox.information(
                                "No changes were made to this record.",
                                {
                                    title: "No Changes",
                                    onClose: function() {
                                        // Close dialog anyway
                                        oEditDialog.close();
                                    }
                                }
                            );
                            return;
                        }
                        
                        // Save data - explicitly pass the entityId as a separate parameter
                        this._saveEntity(this.getModel("viewModel").getProperty("/tableId"), 
                                        this.getModel("viewModel").getProperty("/entityId"), 
                                        oMetadata, oUpdatedData);
                        
                        // Close dialog
                        oEditDialog.close();
                    }.bind(this)
                }),
                endButton: new sap.m.Button({
                    text: "Cancel",
                    press: function() {
                        oEditDialog.close();
                    }
                }),
                afterClose: function() {
                    oEditDialog.destroy();
                    // Clean up stored controls
                    this._editControls = null;
                }.bind(this)
            });
            
            this.getView().addDependent(oEditDialog);
            oEditDialog.open();
        },

          /**
         * Load notes and files for the current entity
         * @param {string} sTableId The table ID
         * @param {string} sEntityId The entity ID
         * @private
         */
          _loadNotesAndFiles: function(sTableId, sEntityId) {
            console.log("Loading notes and files for entity:", sTableId, sEntityId);
            
            const oViewModel = this.getModel("viewModel");
            
            // Ensure notes and files arrays exist in the model
            if (!oViewModel.getProperty("/notes")) {
                oViewModel.setProperty("/notes", []);
            }
            if (!oViewModel.getProperty("/files")) {
                oViewModel.setProperty("/files", []);
            }
            
            // Get entity type for polymorphic queries
            const sEntityType = sTableId.replace(/_$/, ''); // Remove trailing underscore if exists
            
            // Load Notes
            this.getSupabaseClient()
                .from("notes")
                .select('*')
                .eq("entity_id", sEntityId)
                .eq("entity_type", sEntityType)
                .order('created_at', { ascending: false })
                .then(({ data, error }) => {
                    if (error) {
                        console.error("Error loading notes:", error);
                        return;
                    }
                    
                    oViewModel.setProperty("/notes", data || []);
                    console.log(`Loaded ${data?.length || 0} notes`);
                });

            // Load Files
            this.getSupabaseClient()
                .from("files")
                .select('*')
                .eq("entity_id", sEntityId)
                .eq("entity_type", sEntityType)
                .order('created_at', { ascending: false })
                .then(({ data, error }) => {
                    if (error) {
                        console.error("Error loading files:", error);
                        return;
                    }
                    
                    oViewModel.setProperty("/files", data || []);
                    console.log(`Loaded ${data?.length || 0} files`);
                });
        },

        /**
         * Handler for Add Note button
         */
        onAddNote: function() {
            const oViewModel = this.getModel("viewModel");
            const sTableId = oViewModel.getProperty("/tableId");
            const sEntityId = oViewModel.getProperty("/entityId");
            
            if (!this._oNoteDialog) {
                this._oNoteDialog = new Dialog({
                    title: "Add Note",
                    contentWidth: "600px",
                    content: [
                        new VBox({
                            items: [
                                new Label({ text: "Title", required: true }),
                                new Input({ id: this.createId("noteTitle"), width: "100%" }),
                                new Label({ text: "Content", required: true }),
                                new TextArea({ 
                                    id: this.createId("noteContent"), 
                                    width: "100%", 
                                    rows: 6,
                                    growing: true 
                                }),
                                new Label({ text: "Category" }),
                                new Select({
                                    id: this.createId("noteCategory"),
                                    width: "100%",
                                    items: [
                                        new Item({ key: "general", text: "General" }),
                                        new Item({ key: "meeting", text: "Meeting" }),
                                        new Item({ key: "task", text: "Task" }),
                                        new Item({ key: "reminder", text: "Reminder" })
                                    ]
                                }),
                                new CheckBox({
                                    id: this.createId("notePrivate"),
                                    text: "Private Note",
                                    selected: false
                                })
                            ]
                        }).addStyleClass("sapUiMediumMargin")
                    ],
                    beginButton: new Button({
                        text: "Save",
                        type: "Emphasized",
                        press: this._saveNote.bind(this)
                    }),
                    endButton: new Button({
                        text: "Cancel",
                        press: function() {
                            this._oNoteDialog.close();
                        }.bind(this)
                    }),
                    afterClose: function() {
                        // Reset form fields
                        this.byId("noteTitle").setValue("");
                        this.byId("noteContent").setValue("");
                        this.byId("noteCategory").setSelectedKey("general");
                        this.byId("notePrivate").setSelected(false);
                    }.bind(this)
                });
                
                this.getView().addDependent(this._oNoteDialog);
            }
            
            this._oNoteDialog.open();
        },

        /**
         * Save a new note
         * @private
         */
        _saveNote: function() {
            const oViewModel = this.getModel("viewModel");
            const sTableId = oViewModel.getProperty("/tableId");
            const sEntityId = oViewModel.getProperty("/entityId");
            const sEntityType = sTableId.replace(/_$/, ''); // Remove trailing underscore if exists
            
            const sTitle = this.byId("noteTitle").getValue();
            const sContent = this.byId("noteContent").getValue();
            const sCategory = this.byId("noteCategory").getSelectedKey();
            const bIsPrivate = this.byId("notePrivate").getSelected();
            
            if (!sTitle || !sContent) {
                MessageBox.error("Please enter both title and content for the note.");
                return;
            }
            
            // Prepare note data
            const oNoteData = {
                entity_id: sEntityId,
                entity_type: sEntityType,
                title: sTitle,
                note: sContent,
                category: sCategory || "general",
                is_private: bIsPrivate,
                created_by: "Current User", // You might want to get this from user session
                created_at: new Date().toISOString()
            };
            
            // Save to Supabase
            this.getSupabaseClient()
                .from("notes")
                .insert(oNoteData)
                .then(({ data, error }) => {
                    if (error) {
                        console.error("Error saving note:", error);
                        MessageBox.error("Failed to save note: " + error.message);
                        return;
                    }
                    
                    MessageToast.show("Note saved successfully");
                    this._oNoteDialog.close();
                    
                    // Reload notes
                    this._loadNotesAndFiles(sTableId, sEntityId);
                })
                .catch(error => {
                    console.error("Error in Supabase query:", error);
                    MessageBox.error("Failed to save note.");
                });
        },

      
     
        /**
         * Handler for Edit Note
         */
        onEditNote: function(oEvent) {
            const oSource = oEvent.getSource();
            const oContext = oSource.getBindingContext("viewModel");
            const oNoteData = oContext.getObject();
            
            this._openNoteEditDialog(oNoteData);
        },

        /**
         * Handler for Delete Note
         */
        onDeleteNote: function(oEvent) {
            const oSource = oEvent.getSource();
            const oContext = oSource.getBindingContext("viewModel");
            const oNoteData = oContext.getObject();
            
            MessageBox.confirm(
                "Are you sure you want to delete this note?",
                {
                    title: "Delete Confirmation",
                    actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                    onClose: (sAction) => {
                        if (sAction === MessageBox.Action.YES) {
                            this._deleteNote(oNoteData.note_id);
                        }
                    }
                }
            );
        },

        /**
         * Handler for Edit File
         */
        onEditFile: function(oEvent) {
            const oSource = oEvent.getSource();
            const oContext = oSource.getBindingContext("viewModel");
            const oFileData = oContext.getObject();
            
            this._openFileEditDialog(oFileData);
        },

   
        /**
         * Open edit dialog for note
         * @private
         */
        _openNoteEditDialog: function(oNoteData) {
            if (!this._oNoteEditDialog) {
                this._oNoteEditDialog = new Dialog({
                    title: "Edit Note",
                    contentWidth: "600px",
                    content: [
                        new VBox({
                            items: [
                                new Label({ text: "Title", required: true }),
                                new Input({ id: this.createId("editNoteTitle"), width: "100%" }),
                                new Label({ text: "Content", required: true }),
                                new TextArea({ 
                                    id: this.createId("editNoteContent"), 
                                    width: "100%", 
                                    rows: 6,
                                    growing: true 
                                }),
                                new Label({ text: "Category" }),
                                new Select({
                                    id: this.createId("editNoteCategory"),
                                    width: "100%",
                                    items: [
                                        new Item({ key: "general", text: "General" }),
                                        new Item({ key: "meeting", text: "Meeting" }),
                                        new Item({ key: "task", text: "Task" }),
                                        new Item({ key: "reminder", text: "Reminder" })
                                    ]
                                }),
                                new CheckBox({
                                    id: this.createId("editNotePrivate"),
                                    text: "Private Note",
                                    selected: false
                                })
                            ]
                        }).addStyleClass("sapUiMediumMargin")
                    ],
                    beginButton: new Button({
                        text: "Save Changes",
                        type: "Emphasized",
                        press: () => {
                            this._updateNote(oNoteData.note_id);
                        }
                    }),
                    endButton: new Button({
                        text: "Cancel",
                        press: () => {
                            this._oNoteEditDialog.close();
                        }
                    })
                });
                
                this.getView().addDependent(this._oNoteEditDialog);
            }
            
            // Populate form with existing data
            this.byId("editNoteTitle").setValue(oNoteData.title);
            this.byId("editNoteContent").setValue(oNoteData.note);
            this.byId("editNoteCategory").setSelectedKey(oNoteData.category || "general");
            this.byId("editNotePrivate").setSelected(oNoteData.is_private || false);
            
            this._oNoteEditDialog.open();
        },

        /**
         * Delete a note
         * @private
         */
        _deleteNote: function(sNoteId) {
            const oViewModel = this.getModel("viewModel");
            const sTableId = oViewModel.getProperty("/tableId");
            const sEntityId = oViewModel.getProperty("/entityId");
            
            this.getSupabaseClient()
                .from("notes")
                .delete()
                .eq("note_id", sNoteId)
                .then(({ error }) => {
                    if (error) {
                        console.error("Error deleting note:", error);
                        MessageBox.error("Failed to delete note: " + error.message);
                        return;
                    }
                    
                    MessageToast.show("Note deleted successfully");
                    this._loadNotesAndFiles(sTableId, sEntityId);
                })
                .catch(error => {
                    console.error("Error in Supabase query:", error);
                    MessageBox.error("Failed to delete note.");
                });
        },

        /**
         * Delete a file
         * @private
         */
        _deleteFile: function(sFileId) {
            const oViewModel = this.getModel("viewModel");
            const sTableId = oViewModel.getProperty("/tableId");
            const sEntityId = oViewModel.getProperty("/entityId");
            
            this.getSupabaseClient()
                .from("files")
                .delete()
                .eq("file_id", sFileId)
                .then(({ error }) => {
                    if (error) {
                        console.error("Error deleting file:", error);
                        MessageBox.error("Failed to delete file: " + error.message);
                        return;
                    }
                    
                    MessageToast.show("File deleted successfully");
                    this._loadNotesAndFiles(sTableId, sEntityId);
                })
                .catch(error => {
                    console.error("Error in Supabase query:", error);
                    MessageBox.error("Failed to delete file.");
                });
        },


        /**
         * Format file size from KB to human readable format
         * @param {number} sizeInKB Size in kilobytes
         * @returns {string} Formatted file size
         */
        formatFileSize: function(sizeInKB) {
            if (!sizeInKB) return "0 B";
            
            if (sizeInKB < 1024) {
                return Math.round(sizeInKB) + " KB";
            } else if (sizeInKB < 1024 * 1024) {
                return (sizeInKB / 1024).toFixed(1) + " MB";
            } else {
                return (sizeInKB / (1024 * 1024)).toFixed(1) + " GB";
            }
        },

        /**
         * Format date to readable string
         * @param {string} dateString ISO date string
         * @returns {string} Formatted date
         */
        formatDate: function(dateString) {
            if (!dateString) return "";
            
            const date = new Date(dateString);
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.round(diffMs / 60000);
            const diffHours = Math.round(diffMs / 3600000);
            const diffDays = Math.round(diffMs / 86400000);
            
            if (diffMins < 1) {
                return "just now";
            } else if (diffMins < 60) {
                return diffMins + " mins ago";
            } else if (diffHours < 24) {
                return diffHours + " hours ago";
            } else if (diffDays === 1) {
                return "yesterday";
            } else if (diffDays < 7) {
                return diffDays + " days ago";
            } else {
                return date.toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                });
            }
        },

        /**
         * Format category name
         * @param {string} category Category key
         * @returns {string} Formatted category name
         */
        formatCategory: function(category) {
            if (!category) return "";
            
            const categories = {
                "general": "General",
                "meeting": "Meeting",
                "task": "Task",
                "reminder": "Reminder",
                "document": "Document",
                "image": "Image",
                "spreadsheet": "Spreadsheet",
                "presentation": "Presentation",
                "other": "Other"
            };
            
            return categories[category] || category.charAt(0).toUpperCase() + category.slice(1);
        },

        /**
         * Check if note is private
         * @param {boolean} isPrivate Private flag
         * @returns {boolean} Whether to show private indicator
         */
        isPrivateNote: function(isPrivate) {
            return !!isPrivate;
        },

        /**
         * Check if there are no notes
         * @param {Array} notes Array of notes
         * @returns {boolean} True if no notes
         */
        hasNoNotes: function(notes) {
            return !notes || notes.length === 0;
        },

        /**
         * Additional event handlers
         */

        /**
         * Create initial entity record with notes and files support
         */
        _createEntityWithNotesFiles: function(sTableId, oEntityData) {
            const sEntityType = sTableId.replace(/_$/, '');
            
            // First create entity record
            return this.getSupabaseClient()
                .from("entities")
                .insert({
                    entity_type: sEntityType,
                    name: oEntityData.name || oEntityData[Object.keys(oEntityData)[1]], // Use appropriate field
                    description: oEntityData.description || ""
                })
                .select()
                .then(({ data: entityData, error: entityError }) => {
                    if (entityError) throw new Error("Failed to create entity record");
                    
                    const sEntityId = entityData[0].entity_id;
                    
                    // Update main entity data with entity_id
                    const oDataWithEntityId = {
                        ...oEntityData,
                        entity_id: sEntityId
                    };
                    
                    // Create main record
                    return this.getSupabaseClient()
                        .from(sTableId)
                        .insert(oDataWithEntityId)
                        .select()
                        .then(({ data, error }) => {
                            if (error) {
                                // Rollback entity creation if main record fails
                                this.getSupabaseClient()
                                    .from("entities")
                                    .delete()
                                    .eq("entity_id", sEntityId);
                                throw error;
                            }
                            return data;
                        });
                });
        },

  
        // File upload handler for EntityDetail.controller.js
        // Replace your existing _uploadFile method with this one

        _uploadFile: function(oFile) {
            const supabase = this.getSupabaseClient();
            const oViewModel = this.getModel("viewModel");
            const sEntityId = oViewModel.getProperty("/entityId");
            const sTableName = oViewModel.getProperty("/tableName");
            
            if (!oFile || !sEntityId) {
                sap.m.MessageToast.show("Invalid file or entity");
                return;
            }
            
            // Clean up table name for storage path (remove trailing 's' if present)
            let sEntityType = sTableName.toLowerCase();
            if (sEntityType.endsWith('s')) {
                sEntityType = sEntityType.slice(0, -1);
            }
            
            // Generate unique file name with simpler format
            const sTimestamp = Date.now();
            const sOriginalName = oFile.name;
            const sFileExtension = sOriginalName.split('.').pop().toLowerCase();
            // Create a simpler storage path without special characters
            const sStorageFileName = `${sEntityType}_${sEntityId}_${sTimestamp}.${sFileExtension}`;
            
            // Show busy indicator
            oViewModel.setProperty("/uploadingFile", true);
            
            // Upload function
            const uploadToStorage = async () => {
                try {
                    console.log("Uploading file:", sOriginalName, "as:", sStorageFileName);
                    
                    // First check if the bucket exists and is properly configured
                    // Try uploading to a general 'uploads' bucket instead of 'files'
                    const bucketName = 'uploads'; // Make sure this bucket exists in your Supabase Storage
                    
                    // Upload to storage bucket
                    const { data: storageData, error: storageError } = await supabase.storage
                        .from(bucketName)
                        .upload(sStorageFileName, oFile, {
                            cacheControl: '3600',
                            upsert: true // Allow overwriting if file exists
                        });
                    
                    if (storageError) {
                        console.error("Storage upload error:", storageError);
                        
                        // If bucket doesn't exist, provide helpful message
                        if (storageError.message && storageError.message.includes('bucket')) {
                            throw new Error(`Storage bucket '${bucketName}' not found. Please create it in Supabase Storage.`);
                        }
                        throw storageError;
                    }
                    
                    console.log("File uploaded to storage:", storageData);
                    
                    // Get the public URL (if bucket is public)
                    const { data: urlData } = supabase.storage
                        .from(bucketName)
                        .getPublicUrl(sStorageFileName);
                    
                    // Prepare file metadata for database
                    const oFileMetadata = {
                        entity_id: sEntityId,
                        entity_type: sTableName.toLowerCase(),
                        file_name: sOriginalName,
                        original_name: sOriginalName,
                        file_type: sFileExtension,
                        file_size: Math.round(oFile.size / 1024), // Convert to KB
                        mime_type: oFile.type || 'application/octet-stream',
                        storage_path: `${bucketName}/${sStorageFileName}`, // Full path including bucket
                        public_url: urlData?.publicUrl || null,
                        description: "",
                        category: "document",
                        is_private: false,
                        uploaded_by: "system" // Replace with actual user when auth is implemented
                    };
                    
                    console.log("Inserting file metadata:", oFileMetadata);
                    
                    // Save file metadata to database
                    const { data: fileRecord, error: dbError } = await supabase
                        .from('files')
                        .insert(oFileMetadata)
                        .select()
                        .single();
                    
                    if (dbError) {
                        console.error("Database error:", dbError);
                        
                        // If database insert fails, try to clean up the uploaded file
                        try {
                            await supabase.storage
                                .from(bucketName)
                                .remove([sStorageFileName]);
                        } catch (cleanupError) {
                            console.error("Cleanup error:", cleanupError);
                        }
                        
                        throw dbError;
                    }
                    
                    console.log("File metadata saved:", fileRecord);
                    
                    // Update the view model with the new file
                    const aCurrentFiles = oViewModel.getProperty("/files") || [];
                    aCurrentFiles.unshift(fileRecord); // Add to beginning of array
                    oViewModel.setProperty("/files", aCurrentFiles);
                    
                    sap.m.MessageToast.show("File uploaded successfully");
                    
                } catch (error) {
                    console.error("Error uploading file:", error);
                    let errorMessage = "Error uploading file: ";
                    
                    if (error.message) {
                        errorMessage += error.message;
                    } else if (error.code) {
                        errorMessage += error.code;
                    } else {
                        errorMessage += "Unknown error";
                    }
                    
                    sap.m.MessageToast.show(errorMessage);
                } finally {
                    oViewModel.setProperty("/uploadingFile", false);
                }
            };
            
            // Execute the upload
            uploadToStorage();
        },

        // File selection dialog
        onAddFile: function() {
            const oFileInput = document.createElement("input");
            oFileInput.type = "file";
            
            // You can restrict file types here
            // oFileInput.accept = "image/*,application/pdf,.doc,.docx,.xls,.xlsx";
            
            oFileInput.onchange = (oEvent) => {
                const aFiles = oEvent.target.files;
                if (aFiles && aFiles.length > 0) {
                    const oFile = aFiles[0];
                    
                    // Basic validation
                    const maxSize = 10 * 1024 * 1024; // 10MB
                    if (oFile.size > maxSize) {
                        sap.m.MessageToast.show("File size exceeds 10MB limit");
                        return;
                    }
                    
                    this._uploadFile(oFile);
                }
            };
            
            oFileInput.click();
        },

        // View/Download file
        onViewFile: function(oEvent) {
            const oSource = oEvent.getSource();
            const oContext = oSource.getBindingContext("viewModel");
            const oFile = oContext.getObject();
            
            if (oFile.public_url) {
                // Open in new tab
                window.open(oFile.public_url, '_blank');
            } else if (oFile.storage_path) {
                // Try to generate a download URL
                const supabase = this.getSupabaseClient();
                const [bucketName, ...pathParts] = oFile.storage_path.split('/');
                const filePath = pathParts.join('/');
                
                supabase.storage
                    .from(bucketName)
                    .createSignedUrl(filePath, 3600) // 1 hour expiry
                    .then(({ data, error }) => {
                        if (error) {
                            console.error("Error creating signed URL:", error);
                            sap.m.MessageToast.show("Unable to view file");
                        } else if (data?.signedUrl) {
                            window.open(data.signedUrl, '_blank');
                        }
                    });
            } else {
                sap.m.MessageToast.show("File URL not available");
            }
        },

        // Delete file handler
        onDeleteFile: function(oEvent) {
            const oSource = oEvent.getSource();
            const oContext = oSource.getBindingContext("viewModel");
            const oFile = oContext.getObject();
            
            sap.m.MessageBox.confirm("Are you sure you want to delete this file?", {
                actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
                onClose: async (sAction) => {
                    if (sAction === sap.m.MessageBox.Action.YES) {
                        try {
                            const supabase = this.getSupabaseClient();
                            
                            // Delete from storage first
                            if (oFile.storage_path) {
                                const [bucketName, ...pathParts] = oFile.storage_path.split('/');
                                const filePath = pathParts.join('/');
                                
                                const { error: storageError } = await supabase.storage
                                    .from(bucketName)
                                    .remove([filePath]);
                                
                                if (storageError) {
                                    console.error("Error deleting from storage:", storageError);
                                    // Continue to delete metadata even if storage deletion fails
                                }
                            }
                            
                            // Delete metadata from database
                            const { error: dbError } = await supabase
                                .from('files')
                                .delete()
                                .eq('file_id', oFile.file_id);
                            
                            if (dbError) {
                                throw dbError;
                            }
                            
                            // Update view model
                            const oViewModel = this.getModel("viewModel");
                            const aFiles = oViewModel.getProperty("/files");
                            const iIndex = aFiles.findIndex(f => f.file_id === oFile.file_id);
                            
                            if (iIndex > -1) {
                                aFiles.splice(iIndex, 1);
                                oViewModel.setProperty("/files", aFiles);
                            }
                            
                            sap.m.MessageToast.show("File deleted successfully");
                            
                        } catch (error) {
                            console.error("Error deleting file:", error);
                            sap.m.MessageToast.show("Error deleting file: " + error.message);
                        }
                    }
                }
            });
        }
    
    });
});