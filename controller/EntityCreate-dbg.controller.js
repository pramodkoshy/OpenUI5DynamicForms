sap.ui.define([
    "com/supabase/easyui5/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/m/Text",
    "sap/m/Input",
    "sap/m/TextArea",
    "sap/m/CheckBox",
    "sap/m/DatePicker", 
    "sap/m/ComboBox",
    "sap/ui/core/Item"
], function(
    BaseController, 
    JSONModel, 
    Text, 
    Input, 
    TextArea, 
    CheckBox, 
    DatePicker, 
    ComboBox, 
    Item
) {
    "use strict";

    return BaseController.extend("com.supabase.easyui5.controller.EntityCreate", {
        
        /**
         * Lifecycle hook when the controller is initialized
         */
        onInit: function() {
            const oViewModel = new JSONModel({
                tableName: "",
                tableId: "",
                entity: {},
                busy: false,
                validationErrors: {},
                parentInfo: null
            });
            
            this.setModel(oViewModel, "viewModel");
            
            // Register for route matched event
            this.getRouter().getRoute("entityCreate").attachPatternMatched(this._onRouteMatched, this);

             // Check if we have parent entity info (for related items)
            try {
                const sParentInfo = sessionStorage.getItem("parentEntityInfo");
                if (sParentInfo) {
                    const oParentInfo = JSON.parse(sParentInfo);
                    // Only use if this is the right table
                    if (oParentInfo.foreignKey && oParentInfo.parentTable && oParentInfo.parentId) {
                        oViewModel.setProperty("/parentInfo", oParentInfo);
                    }
                }
            } catch (e) {
                console.error("Error parsing parent entity info:", e);
            }
        },
        
        /**
         * Route matched handler
         * @param {sap.ui.base.Event} oEvent The route matched event
         * @private
         */
        _onRouteMatched: function(oEvent) {
            try {
                const sTableId = oEvent.getParameter("arguments").table;
                console.log("EntityCreate route matched with table:", sTableId);
                
                // Store the table ID in the view model
                const oViewModel = this.getModel("viewModel");
                oViewModel.setProperty("/tableId", sTableId);
                
                // Set table name based on the ID (capitalize first letter)
                const sTableName = sTableId.charAt(0).toUpperCase() + sTableId.slice(1).replace(/_/g, " ");
                oViewModel.setProperty("/tableName", sTableName);
                
                // Set the page title
                this.getView().byId("entityCreatePage").setTitle("Create New " + sTableName);
                
                // Reset entity data and validation errors
                oViewModel.setProperty("/entity", {});
                oViewModel.setProperty("/validationErrors", {});
                
                // Check if we have parent entity info (for related items)
                try {
                    const sParentInfo = sessionStorage.getItem("parentEntityInfo");
                    if (sParentInfo) {
                        const oParentInfo = JSON.parse(sParentInfo);
                        // Only use if this is the right table
                        if (oParentInfo.foreignKey && oParentInfo.parentTable && oParentInfo.parentId) {
                            oViewModel.setProperty("/parentInfo", oParentInfo);
                        }
                    }
                } catch (e) {
                    console.error("Error parsing parent entity info:", e);
                }
                
                // Load metadata for the table
                this.getTableMetadata(sTableId).then((oMetadata) => {
                    console.log("Table metadata:", oMetadata);
                    
                    // Initialize entity data with default values
                    this._initializeEntityData(oMetadata);
                    
                    // Configure form
                    this._configureForm(oMetadata);
                }).catch(error => {
                    console.error("Error loading metadata:", error);
                    this.showErrorMessage("Error loading metadata: " + error.message);
                });
            } catch (routeError) {
                console.error("Error in route matched handler:", routeError);
                this.showErrorMessage("An unexpected error occurred: " + routeError.message);
            }
        },
        
        /**
         * Initialize entity data with default values
         * @param {Object} oMetadata The table metadata
         * @private
         */
        _initializeEntityData: function(oMetadata) {
            const oEntityData = {};
            const oViewModel = this.getModel("viewModel");
            const oParentInfo = oViewModel.getProperty("/parentInfo");
            
            // Set default values for all fields
            oMetadata.columns.forEach((oColumnMetadata) => {
                // If we have parent info and this is the foreign key, set it
                if (oParentInfo && oColumnMetadata.name === oParentInfo.foreignKey) {
                    oEntityData[oColumnMetadata.name] = oParentInfo.parentId;
                } else if (oColumnMetadata.type === "boolean") {
                    oEntityData[oColumnMetadata.name] = false;
                } else if (oColumnMetadata.type === "number") {
                    oEntityData[oColumnMetadata.name] = 0;
                } else if (oColumnMetadata.type === "date") {
                    oEntityData[oColumnMetadata.name] = new Date().toISOString().split('T')[0];
                } else {
                    oEntityData[oColumnMetadata.name] = "";
                }
            });
            
            // Update entity in model
            oViewModel.setProperty("/entity", oEntityData);
        },
        
        /**
         * Configure form fields dynamically
         * @param {Object} oMetadata Table metadata
         * @private
         */
        _configureForm: function(oMetadata) {
            console.log("Detailed Metadata:", JSON.stringify(oMetadata, null, 2));
            
            const oFormContainer = this.getView().byId("entityCreateContainer");
            if (!oFormContainer) {
                console.error("CRITICAL: Form container not found!");
                return;
            }
            
            // Clear existing form elements
            oFormContainer.removeAllFormElements();
            
            const oViewModel = this.getModel("viewModel");
            const oEntityData = oViewModel.getProperty("/entity");
            const oParentInfo = oViewModel.getProperty("/parentInfo");
            
            console.log("Current Entity Data:", JSON.stringify(oEntityData, null, 2));
            console.log("Parent Info:", JSON.stringify(oParentInfo, null, 2));
            
            // Generate a unique identifier
            const sUniqueFormId = "createForm_" + Date.now() + "_";
            
            // Count of processable columns and added elements
            let iProcessableColumns = 0;
            let iAddedElements = 0;
            
            // Collect field configurations
            const aFieldConfigurations = oMetadata.columns.filter(oColumnMetadata => 
                !(oColumnMetadata.editable === false || 
                  oColumnMetadata.name === oMetadata.primaryKey ||
                  oColumnMetadata.name === 'created_at' ||
                  oColumnMetadata.name === 'updated_at')
            );
            
            // Process each field configuration
            aFieldConfigurations.forEach((oColumnMetadata, index) => {
                console.log(`Processing column: ${oColumnMetadata.name}`);
                
                iProcessableColumns++;
                
                // Create form element
                const bIsRequired = oColumnMetadata.required === true;
                const oFormElement = new sap.ui.layout.form.FormElement({
                    label: new sap.m.Label({
                        text: oColumnMetadata.label || oColumnMetadata.name,
                        required: bIsRequired
                    })
                });
                
                // Determine the control based on column type
                let oControl = null;
                const sPath = "viewModel>/entity/" + oColumnMetadata.name;
                
                // Generate a truly unique ID
                const sUniqueId = sUniqueFormId + oColumnMetadata.name + "_" + index;
                
                // Check if this is a parent foreign key
                const bIsParentForeignKey = oParentInfo && 
                    oColumnMetadata.name === oParentInfo.foreignKey;
                
                console.log(`Column ${oColumnMetadata.name} - Type: ${oColumnMetadata.type}`);
                
                // Create appropriate input control
                try {
                    switch (oColumnMetadata.type) {
                        case "relation":
                            if (bIsParentForeignKey) {
                                oControl = new sap.m.Text({
                                    id: sUniqueId,
                                    text: `Connected to parent ${oParentInfo.parentTable} (ID: ${oParentInfo.parentId})`
                                });
                            } else {
                                oControl = new sap.m.ComboBox({
                                    id: sUniqueId,
                                    selectedKey: {
                                        path: sPath
                                    },
                                    width: "100%",
                                    required: bIsRequired
                                });
                                
                                this._loadRelationOptions(
                                    oControl, 
                                    oColumnMetadata.relation, 
                                    oColumnMetadata.name
                                );
                            }
                            break;
                        
                        case "boolean":
                            oControl = new sap.m.CheckBox({
                                id: sUniqueId,
                                selected: {
                                    path: sPath
                                },
                                width: "100%"
                            });
                            break;
                        
                        case "date":
                            oControl = new sap.m.DatePicker({
                                id: sUniqueId,
                                value: {
                                    path: sPath,
                                    type: new sap.ui.model.type.Date({
                                        pattern: "yyyy-MM-dd"
                                    })
                                },
                                valueFormat: "yyyy-MM-dd",
                                displayFormat: "mediumDate",
                                width: "100%",
                                required: bIsRequired
                            });
                            break;
                        
                        case "number":
                            oControl = new sap.m.Input({
                                id: sUniqueId,
                                value: {
                                    path: sPath,
                                    type: new sap.ui.model.type.Float({
                                        decimals: 2
                                    })
                                },
                                type: "Number",
                                width: "100%",
                                required: bIsRequired
                            });
                            break;
                        
                        case "text":
                            oControl = new sap.m.TextArea({
                                id: sUniqueId,
                                value: {
                                    path: sPath
                                },
                                rows: 3,
                                width: "100%",
                                required: bIsRequired
                            });
                            break;
                        
                        default:
                            oControl = new sap.m.Input({
                                id: sUniqueId,
                                value: {
                                    path: sPath
                                },
                                width: "100%",
                                required: bIsRequired
                            });
                    }
                } catch (controlError) {
                    console.error(`Error creating control for ${oColumnMetadata.name}:`, controlError);
                    // Skip this control and continue with the next
                    return;
                }
                
                // Ensure control is created
                if (oControl) {
                    // Add field to form element
                    oFormElement.addField(oControl);
                    
                    // Add form element to container
                    oFormContainer.addFormElement(oFormElement);
                    
                    iAddedElements++;
                    
                    console.log(`Added form element for ${oColumnMetadata.name}`);
                } else {
                    console.error(`Failed to create control for ${oColumnMetadata.name}`);
                }
            });
            
            console.log(`Form configuration complete. Processable columns: ${iProcessableColumns}, Added elements: ${iAddedElements}`);
            
            // Force layout update
            const oForm = this.getView().byId("entityCreateForm");
            if (oForm) {
                oForm.invalidate();
            }
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
                console.log(`Metadata for related table ${sRelatedTable}:`, JSON.stringify(oMetadata, null, 2));
                
                const sPrimaryKey = oMetadata.primaryKey;
                const sTitleField = oMetadata.titleField || sPrimaryKey;
                
                console.log(`Primary Key: ${sPrimaryKey}, Title Field: ${sTitleField}`);
                
                // Load related entities
                this.getSupabaseClient()
                    .from(sRelatedTable)
                    .select('*')
                    .then(({ data, error }) => {
                        if (error) {
                            console.error("Error loading relation options", error);
                            return;
                        }
                        
                        console.log(`Loaded ${data ? data.length : 0} relation options`);
                        
                        // Clear existing items
                        oComboBox.removeAllItems();
                        
                        // Add items to ComboBox
                        if (data) {
                            data.forEach(item => {
                                const oItem = new sap.ui.core.Item({
                                    key: item[sPrimaryKey],
                                    text: item[sTitleField]
                                });
                                oComboBox.addItem(oItem);
                                
                                console.log(`Added item: Key=${item[sPrimaryKey]}, Text=${item[sTitleField]}`);
                            });
                        }
                    });
            }.bind(this));
        },
        
        /**
         * Handler for save button press
         */
        onSavePress: function() {
            const oViewModel = this.getModel("viewModel");
            const sTableId = oViewModel.getProperty("/tableId");
            const oEntityData = oViewModel.getProperty("/entity");
            
            // Set busy state
            oViewModel.setProperty("/busy", true);
            
            // Validate the data
            this.getTableMetadata(sTableId).then((oMetadata) => {
                if (!this._validateForm(oMetadata, oEntityData)) {
                    this.showErrorMessage("Please fill in all required fields");
                    oViewModel.setProperty("/busy", false);
                    return;
                }
                
                // Create a copy of the data without read-only fields
                const oDataToInsert = {};
                
                oMetadata.columns.forEach((oColumnMetadata) => {
                    // Skip non-editable fields and primary key
                    if ((oColumnMetadata.editable === false && 
                         oColumnMetadata.name !== oMetadata.primaryKey) || 
                        oColumnMetadata.name === oMetadata.primaryKey) {
                        return;
                    }
                    
                    // Add field to insert data
                    oDataToInsert[oColumnMetadata.name] = oEntityData[oColumnMetadata.name];
                });
                
                // Create entity
                this.getSupabaseClient()
                    .from(sTableId)
                    .insert(oDataToInsert)
                    .then(({ data, error }) => {
                        oViewModel.setProperty("/busy", false);
                        
                        if (error) {
                            this.showErrorMessage("Error creating entity", error);
                            return;
                        }
                        
                        const sTableName = oViewModel.getProperty("/tableName");
                        this.showSuccessMessage(sTableName + " created successfully");
                        
                        // Check if we have parent info - if so, navigate back to the parent
                        const oParentInfo = oViewModel.getProperty("/parentInfo");
                        if (oParentInfo && oParentInfo.parentTable && oParentInfo.parentId) {
                            // Clear the session storage
                            sessionStorage.removeItem("parentEntityInfo");
                            
                            // Navigate back to parent
                            this.getRouter().navTo("entityDetail", {
                                table: oParentInfo.parentTable,
                                id: oParentInfo.parentId
                            });
                        } else {
                            // Navigate back to list view
                            this.getRouter().navTo("entityList", {
                                table: sTableId
                            });
                        }
                    })
                    .catch(error => {
                        console.error("Error in Supabase query:", error);
                        this.showErrorMessage("Error creating entity: " + error.message);
                        oViewModel.setProperty("/busy", false);
                    });
            }).catch(error => {
                console.error("Error getting table metadata:", error);
                this.showErrorMessage("Error getting table metadata: " + error.message);
                oViewModel.setProperty("/busy", false);
            });
        },
        
        /**
         * Validate form data
         * @param {Object} oMetadata The table metadata
         * @param {Object} oEntityData The entity data
         * @returns {boolean} True if validation passes, false otherwise
         * @private 
         */
        _validateForm: function(oMetadata, oEntityData) {
            const oViewModel = this.getModel("viewModel");
            const oValidationErrors = {};
            let bValid = true;
            
            // Check required fields
            oMetadata.columns.forEach((oColumnMetadata) => {
                // Skip fields that are not editable or primary key
                if (oColumnMetadata.editable === false || 
                    oColumnMetadata.name === oMetadata.primaryKey) {
                    return;
                }
                
                if (oColumnMetadata.required && 
                    (oEntityData[oColumnMetadata.name] === undefined || 
                     oEntityData[oColumnMetadata.name] === null || 
                     oEntityData[oColumnMetadata.name] === "")) {
                    bValid = false;
                    oValidationErrors[oColumnMetadata.name] = "This field is required";
                }
            });
            
            oViewModel.setProperty("/validationErrors", oValidationErrors);
            
            // If there are validation errors, reconfigure the form to show them
            if (!bValid) {
                this._configureForm(oMetadata);
            }
            
            return bValid;
        },
        
        /**
         * Handler for cancel button press
         */
        onCancelPress: function() {
            const oViewModel = this.getModel("viewModel");
            const sTableId = oViewModel.getProperty("/tableId");

            // Check if we have parent info - if so, navigate back to the parent
            const oParentInfo = oViewModel.getProperty("/parentInfo");
            if (oParentInfo && oParentInfo.parentTable && oParentInfo.parentId) {
                // Clear the session storage
                sessionStorage.removeItem("parentEntityInfo");

                // Navigate back to parent
                this.getRouter().navTo("entityDetail", {
                    table: oParentInfo.parentTable,
                    id: oParentInfo.parentId,
                });
            } else {
                // Navigate back to list view
                this.getRouter().navTo("entityList", {
                    table: sTableId
                });
            }
        },
        
        /**
         * Navigation handler
         */
        onNavBack: function() {
            // Navigate back to list view
            const sTableId = this.getModel("viewModel").getProperty("/tableId");
            this.getRouter().navTo("entityList", {
                table: sTableId
            });
        }
    });
});