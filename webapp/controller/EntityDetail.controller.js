sap.ui.define([
    "com/supabase/easyui5/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/m/Text",
    "sap/m/Input",
    "sap/m/Label"
], function(
    BaseController, 
    JSONModel, 
    Text, 
    Input, 
    Label
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
         * Lifecycle hook when the controller is initialized
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
                validationErrors: {}
            });
            
            // Set the model on the view with the name "viewModel"
            this.getView().setModel(oViewModel, "viewModel");
            
            // Register for route matched event
            this.getRouter().getRoute("entityDetail").attachPatternMatched(this._onRouteMatched, this);
            
            // Explicitly register extensions
            this._registerExtensions();
        },
        
        _registerExtensions: function() {
            console.log("Registering controller extensions");
            try {
                const extensionsModule = sap.ui.require("com/supabase/easyui5/controller/EntityDetailExtensions");
                if (extensionsModule) {
                    console.log("Extensions module found");
                    const extensions = extensionsModule();
                    console.log("Registered extensions:", extensions);
                    
                    // Expose save and cancel handlers
                    this.onSavePress = extensions.actions.onSavePress.bind(this);
                    this.onCancelPress = extensions.actions.onCancelPress.bind(this);
                } else {
                    console.error("Extensions module not found");
                }
            } catch (error) {
                console.error("Error registering extensions:", error);
            }
        },
        

        
        /**
         * Route matched handler
         * @param {sap.ui.base.Event} oEvent The route matched event
         * @private
         */
        _onRouteMatched: function(oEvent) {
            console.log("EntityDetail route matched");
            const sTableId = oEvent.getParameter("arguments").table;
            const sEntityId = oEvent.getParameter("arguments").id;
            
            console.log("Table ID:", sTableId);
            console.log("Entity ID:", sEntityId);
            
            // Store the table ID and entity ID in the view model
            const oViewModel = this.getModel("viewModel");
            oViewModel.setProperty("/tableId", sTableId);
            oViewModel.setProperty("/entityId", sEntityId);
            
            // Set table name based on the ID (capitalize first letter)
            const sTableName = sTableId.charAt(0).toUpperCase() + sTableId.slice(1).replace(/_/g, " ");
            oViewModel.setProperty("/tableName", sTableName);
            
            // Reset validation errors
            oViewModel.setProperty("/validationErrors", {});
            
            // Reset edit mode
            oViewModel.setProperty("/editMode", false);
            
            // Load entity data
            this._loadEntity(sTableId, sEntityId);
        },
        
        /**
         * Direct form configuration method if extensions fail
         * @param {Object} oMetadata Table metadata
         * @param {Object} oData Entity data
         * @private
         */
        _configureForm: function(oMetadata, oData) {
            const oFormContainer = this.getView().byId("entityDetailsContainer");
            
            // Clear existing form elements
            oFormContainer.removeAllFormElements();
            
            // Add form elements based on metadata
            oMetadata.columns.forEach((oColumnMetadata) => {
                // Skip non-visible columns
                if (!oColumnMetadata.visible) return;
                
                // Create form element
                const oFormElement = new sap.ui.layout.form.FormElement({
                    label: new Label({
                        text: oColumnMetadata.label
                    })
                });
                
                // Create text field
                let oControl;
                
                switch (oColumnMetadata.type) {
                    case "relation":
                        oControl = new Text({
                            text: oData[oColumnMetadata.name + "_text"] || oData[oColumnMetadata.name]
                        });
                        break;
                    case "boolean":
                        oControl = new Text({
                            text: this.formatter.formatBoolean(oData[oColumnMetadata.name])
                        });
                        break;
                    case "date":
                        oControl = new Text({
                            text: this.formatter.formatDate(oData[oColumnMetadata.name])
                        });
                        break;
                    case "number":
                        oControl = new Text({
                            text: this.formatter.formatNumber(oData[oColumnMetadata.name])
                        });
                        break;
                    default:
                        oControl = new Text({
                            text: oData[oColumnMetadata.name] || ""
                        });
                }
                
                oFormElement.addField(oControl);
                oFormContainer.addFormElement(oFormElement);
            });
        },
        
        /**
         * Direct related items loading method if extensions fail
         * @param {Object} oMetadata Table metadata
         * @param {Object} oData Entity data
         * @private
         */
        _loadRelatedItems: function(oMetadata, oData) {
            const oViewModel = this.getModel("viewModel");
            
            // Check if relations exist
            if (!oMetadata.relations || oMetadata.relations.length === 0) {
                oViewModel.setProperty("/busy", false);
                return;
            }
            
            const oRelation = oMetadata.relations[0];
            const sPrimaryKey = oMetadata.primaryKey;
            
            // Fetch related items
            this.getSupabaseClient()
                .from(oRelation.table)
                .select('*')
                .eq(oRelation.foreignKey, oData[sPrimaryKey])
                .then(({ data: relatedData, error }) => {
                    if (error) {
                        console.error("Error loading related items", error);
                        oViewModel.setProperty("/busy", false);
                        return;
                    }
                    
                    console.log("Related items loaded:", relatedData);
                    
                    // Update view model
                    oViewModel.setProperty("/relatedItems", relatedData || []);
                    oViewModel.setProperty("/filteredRelatedItems", relatedData || []);
                    
                    // Configure related items table
                    this._configureRelatedItemsTable(oRelation.table);
                    
                    // Set busy to false
                    oViewModel.setProperty("/busy", false);
                })
                .catch(error => {
                    console.error("Error fetching related items", error);
                    oViewModel.setProperty("/busy", false);
                });
        },
        
        /**
         * Configure related items table
         * @param {string} sTableId Table ID
         * @private
         */
        _configureRelatedItemsTable: function(sTableId) {
            this.getTableMetadata(sTableId).then(oMetadata => {
                const oTable = this.getView().byId("relatedItemsTable");
                
                if (!oTable) {
                    console.error("Related items table not found");
                    return;
                }
                
                // Clear existing columns
                oTable.removeAllColumns();
                
                // Add columns
                const aVisibleColumns = oMetadata.columns.filter(col => col.visible).slice(0, 5);
                
                aVisibleColumns.forEach(oColumnMetadata => {
                    oTable.addColumn(new sap.m.Column({
                        header: new sap.m.Label({ text: oColumnMetadata.label })
                    }));
                });
                
                // Rebind table
                oTable.bindItems({
                    path: "viewModel>/filteredRelatedItems",
                    template: new sap.m.ColumnListItem({
                        cells: aVisibleColumns.map(oColumnMetadata => {
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
                            return oCell;
                        })
                    })
                });
            });
        },
        
        /**
         * Load entity data from Supabase
         * @param {string} sTableId The table ID
         * @param {string} sEntityId The entity ID
         * @private
         */
        _loadEntity: function(sTableId, sEntityId) {
            console.log("Loading entity data for table:", sTableId, "entity ID:", sEntityId);
            
            const oViewModel = this.getModel("viewModel");
            
            // Set busy state
            oViewModel.setProperty("/busy", true);
            
            // Get metadata to determine primary key
            this.getTableMetadata(sTableId).then((oMetadata) => {
                console.log("Got metadata for table:", sTableId);
                const sPrimaryKey = oMetadata.primaryKey;
                
                console.log("Primary key from metadata:", sPrimaryKey);
                
                if (!sPrimaryKey) {
                    this.showErrorMessage("Error: No primary key defined in metadata");
                    oViewModel.setProperty("/busy", false);
                    return;
                }
                
                // Check if entity ID is valid
                if (!sEntityId) {
                    this.showErrorMessage("Error: No entity ID specified");
                    oViewModel.setProperty("/busy", false);
                    return;
                }
                
                // Load entity data
                this.getSupabaseClient()
                    .from(sTableId)
                    .select('*')
                    .eq(sPrimaryKey, sEntityId)
                    .single()
                    .then(async ({ data, error }) => {
                        if (error) {
                            console.error("Error loading entity data:", error);
                            this.showErrorMessage("Error loading entity: " + error.message);
                            oViewModel.setProperty("/busy", false);
                            return;
                        }
                        
                        if (!data) {
                            console.error("No data found for entity");
                            this.showErrorMessage("Entity not found");
                            oViewModel.setProperty("/busy", false);
                            return;
                        }
                        
                        console.log("Entity data loaded:", data);
                        
                        // Process relation fields
                        for (const oColumnMetadata of oMetadata.columns) {
                            if (oColumnMetadata.type === "relation" && data[oColumnMetadata.name]) {
                                const relatedId = data[oColumnMetadata.name];
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
                                        data[oColumnMetadata.name + "_text"] = relatedData[relatedMetadata.titleField];
                                        data[oColumnMetadata.name + "_obj"] = relatedData;
                                    }
                                } catch (e) {
                                    console.error("Error loading related data", e);
                                }
                            }
                        }
                        
                        // Update entity in model
                        console.log("Setting entity data to model");
                        oViewModel.setProperty("/entity", data);
                        
                        // Set entity title and subtitle
                        const sTitleField = oMetadata.titleField || sPrimaryKey;
                        const sSubtitleField = oMetadata.subtitleField;
                        
                        oViewModel.setProperty("/entityTitle", data[sTitleField]);
                        
                        if (sSubtitleField && data[sSubtitleField]) {
                            oViewModel.setProperty("/entitySubtitle", data[sSubtitleField]);
                        } else {
                            oViewModel.setProperty("/entitySubtitle", "ID: " + data[sPrimaryKey]);
                        }
                        
                        // Try to configure form and load related items
                        try {
                            this._configureForm(oMetadata, data);
                            this._loadRelatedItems(oMetadata, data);
                        } catch (extensionError) {
                            console.error("Error in form/related items processing:", extensionError);
                            oViewModel.setProperty("/busy", false);
                        }
                    }).catch(error => {
                        console.error("Error in Supabase query:", error);
                        this.showErrorMessage("Error loading entity: " + error.message);
                        oViewModel.setProperty("/busy", false);
                    });
            }).catch((error) => {
                console.error("Error getting table metadata:", error);
                this.showErrorMessage("Error loading metadata: " + error.message);
                oViewModel.setProperty("/busy", false);
            });
        },
        
        /**
         * Navigation handler
         */
        onNavBack: function() {
            const sTableId = this.getModel("viewModel").getProperty("/tableId");
            
            // Navigate back to list
            this.getRouter().navTo("entityList", {
                table: sTableId
            });
        },


        /**
         * Toggle navigation panel
         */
        onToggleNav: function() {
            // Get SplitApp directly
            let oSplitApp = sap.ui.getCore().byId("__component0---app--app");
            
            // If direct approach fails, try other methods
            if (!oSplitApp) {
                console.log("Direct SplitApp access failed, trying fallbacks");
                // Try component
                if (this.getOwnerComponent().getSplitApp) {
                    oSplitApp = this.getOwnerComponent().getSplitApp();
                }
                
                // Try root control
                if (!oSplitApp && this.getOwnerComponent().getRootControl()) {
                    oSplitApp = this.getOwnerComponent().getRootControl().byId("app");
                }
            }
            
            // Get app view model (either from component or directly)
            let oAppViewModel = this.getOwnerComponent().getModel("appView");
            if (!oAppViewModel) {
                // Try getting it from the component's root view
                const oRootControl = this.getOwnerComponent().getRootControl();
                if (oRootControl && oRootControl.getModel) {
                    oAppViewModel = oRootControl.getModel("appView");
                }
            }
            
            // Get toggle button 
            const oToggleButton = this.getView().byId("navToggleButton");
            
            console.log("Detail toggle nav button pressed");
            console.log("SplitApp reference:", oSplitApp);
            console.log("AppViewModel:", oAppViewModel);
            
            if (oSplitApp) {
                // Get current state from model or assume it's hidden in detail view
                const bExpanded = oAppViewModel ? oAppViewModel.getProperty("/navExpanded") : false;
                
                console.log("Current nav state:", bExpanded ? "expanded" : "collapsed");
                
                // Set the mode to ShowHideMode to ensure the master can be shown
                oSplitApp.setMode("ShowHideMode");
                
                // Use timeout to ensure mode is applied
                setTimeout(function() {
                    // Show the master panel
                    console.log("Showing master panel");
                    oSplitApp.showMaster();
                    
                    // Update button if available
                    if (oToggleButton) {
                        oToggleButton.setIcon("sap-icon://navigation-left-arrow");
                        oToggleButton.setTooltip("Hide Navigation");
                    }
                    
                    // Update model if available
                    if (oAppViewModel) {
                        oAppViewModel.setProperty("/navExpanded", true);
                    }
                }, 0);
            } else {
                console.error("Could not find SplitApp control");
            }
        },

        onEditPress: function() {
            console.log("Edit button pressed");
            
            // Get the view model and table ID
            const oViewModel = this.getModel("viewModel");
            const sTableId = oViewModel.getProperty("/tableId");
            
            // Set edit mode to true
            oViewModel.setProperty("/editMode", true);
            console.log("Edit mode set to true");
            
            // Load metadata and reconfigure form for edit mode
            this.getTableMetadata(sTableId).then((oMetadata) => {
                console.log("Metadata loaded for edit mode", oMetadata);
                
                // Get current entity data
                const oEntityData = oViewModel.getProperty("/entity");
                
                // Configure form for edit mode
                this._configureFormForEdit(oMetadata, oEntityData);
            }).catch(error => {
                console.error("Error getting table metadata for edit:", error);
            });
        },
        
        /**
         * Fallback method to configure form for edit mode
         * @param {Object} oMetadata Table metadata
         * @param {Object} oEntityData Current entity data
         * @private
         */
        _configureFormForEdit: function(oMetadata, oEntityData) {
            console.log("Configuring form for edit mode");
            
            if (!oMetadata || !oEntityData) {
                console.error("Metadata or entity data not available for edit form configuration");
                return;
            }
            console.log("Fallback form configuration for edit mode");
            
            const oFormContainer = this.getView().byId("entityDetailsContainer");
            if (!oFormContainer) {
                console.error("Form container not found for edit");
                return;
            }
            
            // Clear existing form elements
            oFormContainer.removeAllFormElements();
            
            // Process each column in metadata
            oMetadata.columns.forEach((oColumnMetadata) => {
                // Skip hidden or non-editable columns
                if (!oColumnMetadata.visible || 
                    oColumnMetadata.editable === false || 
                    oColumnMetadata.name === oMetadata.primaryKey ||
                    oColumnMetadata.name === 'created_at' ||
                    oColumnMetadata.name === 'updated_at') {
                    return;
                }
                
                // Create form element
                const oFormElement = new sap.ui.layout.form.FormElement({
                    label: new sap.m.Label({
                        text: oColumnMetadata.label || oColumnMetadata.name,
                        required: oColumnMetadata.required
                    })
                });
                
                // Determine control for edit mode
                const sPath = "viewModel>/entity/" + oColumnMetadata.name;
                let oControl;
                
                switch (oColumnMetadata.type) {
                    case "relation":
                        oControl = new sap.m.ComboBox({
                            selectedKey: {
                                path: sPath,
                                mode: 'TwoWay'
                            },
                            width: "100%"
                        });
                        
                        // Load relation options
                        this._loadRelationOptions(
                            oControl, 
                            oColumnMetadata.relation, 
                            oColumnMetadata.name
                        );
                        break;
                    
                    case "boolean":
                        oControl = new sap.m.CheckBox({
                            selected: {
                                path: sPath,
                                mode: 'TwoWay'
                            }
                        });
                        break;
                    
                    case "date":
                        oControl = new sap.m.DatePicker({
                            value: {
                                path: sPath,
                                mode: 'TwoWay',
                                type: new sap.ui.model.type.Date({
                                    pattern: "yyyy-MM-dd"
                                })
                            },
                            valueFormat: "yyyy-MM-dd",
                            displayFormat: "mediumDate",
                            width: "100%"
                        });
                        break;
                    
                    case "number":
                        oControl = new sap.m.Input({
                            value: {
                                path: sPath,
                                mode: 'TwoWay',
                                type: new sap.ui.model.type.Float({
                                    decimals: 2
                                })
                            },
                            type: "Number",
                            width: "100%"
                        });
                        break;
                    
                    case "text":
                        oControl = new sap.m.TextArea({
                            value: {
                                path: sPath,
                                mode: 'TwoWay'
                            },
                            rows: 3,
                            width: "100%"
                        });
                        break;
                    
                    default:
                        oControl = new sap.m.Input({
                            value: {
                                path: sPath,
                                mode: 'TwoWay'
                            },
                            width: "100%"
                        });
                }
                
                // Add field to form element
                oFormElement.addField(oControl);
                
                // Add form element to container
                oFormContainer.addFormElement(oFormElement);
            });
            
            console.log("Fallback edit form configuration complete");
        },
        
        /**
         * Load options for relation fields
         * @param {sap.m.ComboBox} oComboBox The ComboBox control
         * @param {string} sRelatedTable The related table
         * @param {string} sFieldName The field name
         * @private
         */
        _loadRelationOptions: function(oComboBox, sRelatedTable, sFieldName) {
            console.log(`Loading relation options for ${sFieldName} from table ${sRelatedTable}`);
            
            // Get metadata for related table
            this.getTableMetadata(sRelatedTable).then(function(oMetadata) {
                const sPrimaryKey = oMetadata.primaryKey;
                const sTitleField = oMetadata.titleField || sPrimaryKey;
                
                // Load related entities
                this.getSupabaseClient()
                    .from(sRelatedTable)
                    .select('*')
                    .then(({ data, error }) => {
                        if (error) {
                            console.error("Error loading relation options", error);
                            return;
                        }
                        
                        // Clear existing items
                        oComboBox.removeAllItems();
                        
                        // Add items to ComboBox
                        data.forEach(item => {
                            const oItem = new sap.ui.core.Item({
                                key: item[sPrimaryKey],
                                text: item[sTitleField]
                            });
                            oComboBox.addItem(oItem);
                        });
                    });
            }.bind(this));

            // Check if the table has any relations
            if (oMetadata.relations && oMetadata.relations.length > 0) {
                // Create a button to add related items
                const oAddRelatedButton = new sap.m.Button({
                    text: "Add Related Item",
                    press: this.onAddRelatedItemPress.bind(this),
                    visible: "{= ${viewModel>/editMode} }"
                });
                
                // Add the button to the form container
                oFormContainer.addContent(oAddRelatedButton);
            }


        },

        
        onSavePress: function() {
            console.log("Save button pressed");
            
            const oViewModel = this.getModel("viewModel");
            const sTableId = oViewModel.getProperty("/tableId");
            const sEntityId = oViewModel.getProperty("/entityId");
            const oEntityData = oViewModel.getProperty("/entity");
            
            // Set busy state
            oViewModel.setProperty("/busy", true);
            
            // Validate the data
            this.getTableMetadata(sTableId).then((oMetadata) => {
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
                
                // Update entity
                this.getSupabaseClient()
                    .from(sTableId)
                    .update(oDataToUpdate)
                    .eq(sPrimaryKey, sEntityId)
                    .then(({ data, error }) => {
                        oViewModel.setProperty("/busy", false);
                        
                        if (error) {
                            this.showErrorMessage("Error updating entity", error);
                            return;
                        }
                        
                        // Reset edit mode
                        oViewModel.setProperty("/editMode", false);
                        
                        // Show success message  
                        this.showSuccessMessage("Entity updated successfully");
                        
                        // Reload entity to refresh data
                        this._loadEntity(sTableId, sEntityId);
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
        
        onCancelPress: function() {
            console.log("Cancel button pressed");
            
            const oViewModel = this.getModel("viewModel");
            const sTableId = oViewModel.getProperty("/tableId");
            const sEntityId = oViewModel.getProperty("/entityId");
            
            // Reset edit mode
            oViewModel.setProperty("/editMode", false);
            
            // Reload the original entity data to discard changes  
            this._loadEntity(sTableId, sEntityId);
        },

        onAddRelatedItemPress: function() {
            const oViewModel = this.getModel("viewModel");
            const sTableId = oViewModel.getProperty("/tableId");
            const sEntityId = oViewModel.getProperty("/entityId");
            
            // Get metadata for the current table
            this.getTableMetadata(sTableId).then((oMetadata) => {
                // Get the first relation
                if (!oMetadata.relations || oMetadata.relations.length === 0) {
                    console.error("No relations defined in metadata");
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

        onAddRelatedItemPress: function() {
            const oViewModel = this.getModel("viewModel");
            const sTableId = oViewModel.getProperty("/tableId");
            const sEntityId = oViewModel.getProperty("/entityId");
            
            // Get metadata for the current table
            this.getTableMetadata(sTableId).then((oMetadata) => {
                // Get the first relation
                if (!oMetadata.relations || oMetadata.relations.length === 0) {
                    console.error("No relations defined in metadata");
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


    });
});