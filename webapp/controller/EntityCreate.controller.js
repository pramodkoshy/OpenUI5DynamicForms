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
         * EntityCreate.controller.js
         * 
         * Enhanced onInit method to ensure parent info is properly loaded
         */
        onInit: function() {
            console.log("EntityCreate controller initializing");
            
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
            
            // Load parent entity info immediately
            this._loadParentEntityInfo();
        },

        /**
         * Load parent entity info from session storage
         * This is a dedicated method to ensure parent info is loaded properly
         */
        _loadParentEntityInfo: function() {
            try {
                const sParentInfo = sessionStorage.getItem("parentEntityInfo");
                console.log("Loading parent entity info from session storage:", sParentInfo);
                
                if (sParentInfo) {
                    const oParentInfo = JSON.parse(sParentInfo);
                    console.log("Parsed parent info:", JSON.stringify(oParentInfo, null, 2));
                    
                    // Verify all required fields are present
                    if (oParentInfo.parentTable && oParentInfo.parentId && oParentInfo.foreignKey) {
                        console.log("Setting parent info in view model");
                        
                        // Set parent info in view model
                        const oViewModel = this.getModel("viewModel");
                        oViewModel.setProperty("/parentInfo", oParentInfo);
                        
                        // Create a backup copy of parent info as a safeguard
                        this._parentInfoBackup = JSON.parse(JSON.stringify(oParentInfo));
                        console.log("Parent info backup created");
                    } else {
                        console.warn("Parent info is incomplete:", JSON.stringify(oParentInfo));
                    }
                } else {
                    console.log("No parent info found in session storage");
                }
            } catch (e) {
                console.error("Error loading parent entity info:", e);
            }
        },


        /**
         * Route matched handler with enhanced parent info handling
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
                
                // Re-load parent info to ensure it's available
                this._loadParentEntityInfo();
                
                // Load metadata for the table
                this.getTableMetadata(sTableId).then((oMetadata) => {
                    console.log("Table metadata loaded:", JSON.stringify(oMetadata, null, 2));
                    
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
         * Enhanced _initializeEntityData method for EntityCreate.controller.js
         * Replace the existing method with this implementation
         */
        _initializeEntityData: function(oMetadata) {
            const oEntityData = {};
            const oViewModel = this.getModel("viewModel");
            const oParentInfo = oViewModel.getProperty("/parentInfo");
            
            console.log("Initializing entity data with metadata:", JSON.stringify(oMetadata.columns.map(c => c.name), null, 2));
            console.log("Parent info:", oParentInfo ? JSON.stringify(oParentInfo) : "none");
            
            // Set default values for all fields
            oMetadata.columns.forEach((oColumnMetadata) => {
                // If we have parent info and this is the foreign key, set it
                if (oParentInfo && oColumnMetadata.name === oParentInfo.foreignKey) {
                    console.log(`Setting foreign key ${oColumnMetadata.name} to parent ID ${oParentInfo.parentId}`);
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
            
            console.log("Initialized entity data:", JSON.stringify(oEntityData, null, 2));
            
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
                
                // Create form element
                const bIsRequired = oColumnMetadata.required === true;
                const oFormElement = new sap.ui.layout.form.FormElement({
                    label: new sap.m.Label({
                        text: oColumnMetadata.label || oColumnMetadata.name,
                        required: bIsRequired
                    })
                });
                
                // Determine the control based on column type
                const sPath = "viewModel>/entity/" + oColumnMetadata.name;
                
                // Generate a truly unique ID
                const sUniqueId = sUniqueFormId + oColumnMetadata.name + "_" + index;
                
                // Check if this is a parent foreign key
                const bIsParentForeignKey = oParentInfo && 
                    oColumnMetadata.name === oParentInfo.foreignKey;
                
                console.log(`Column ${oColumnMetadata.name} - Type: ${oColumnMetadata.type}`);
                
                // Create appropriate input control using the new method
                try {
                    const oControl = this._createInputField(
                        oColumnMetadata, 
                        sPath, 
                        bIsRequired, 
                        sUniqueId, 
                        bIsParentForeignKey
                    );
                    
                    // Ensure control is created
                    if (oControl) {
                        // Add field to form element
                        oFormElement.addField(oControl);
                        // Add form element to container
                        oFormContainer.addFormElement(oFormElement);
                        
                        console.log(`Added form element for ${oColumnMetadata.name}`);
                    } else {
                        console.error(`Failed to create control for ${oColumnMetadata.name}`);
                    }
                } catch (controlError) {
                    console.error(`Error creating control for ${oColumnMetadata.name}:`, controlError);
                }
            });
            
            console.log(`Form configuration complete.`);
            
            // Force layout update
            const oForm = this.getView().byId("entityCreateForm");
            if (oForm) {
                oForm.invalidate();
            }
        },
                
        /**
         * Load options for relation fields with improved field detection
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
                        
                        // Inspect first record to understand available fields
                        if (data && data.length > 0) {
                            console.log(`Sample record fields: ${Object.keys(data[0]).join(', ')}`);
                        }
                        
                        // Clear existing items
                        oComboBox.removeAllItems();
                        
                        // Add items to ComboBox
                        if (data) {
                            data.forEach(item => {
                                // Try multiple common name fields if the title field is undefined
                                let displayText = item[sTitleField];
                                
                                if (!displayText) {
                                    // Try common alternative field names for name/title
                                    const alternatives = ['name', 'customer_name', 'company_name', 'title', 
                                                        'display_name', 'full_name', 'label'];
                                    
                                    for (const alt of alternatives) {
                                        if (item[alt]) {
                                            displayText = item[alt];
                                            console.log(`Using alternative field '${alt}' for display text`);
                                            break;
                                        }
                                    }
                                    
                                    // If still no display text, use the first non-ID field as fallback
                                    if (!displayText) {
                                        const nonIdFields = Object.keys(item).filter(key => 
                                            key !== sPrimaryKey && 
                                            !key.endsWith('_id') && 
                                            !key.includes('created_at') && 
                                            !key.includes('updated_at'));
                                        
                                        if (nonIdFields.length > 0) {
                                            displayText = item[nonIdFields[0]];
                                            console.log(`Using fallback field '${nonIdFields[0]}' for display text`);
                                        }
                                    }
                                    
                                    // Last resort, use the ID
                                    if (!displayText) {
                                        displayText = `ID: ${item[sPrimaryKey]}`;
                                    }
                                }
                                
                                // Create the item with the determined display text
                                const oItem = new sap.ui.core.Item({
                                    key: item[sPrimaryKey],
                                    text: displayText
                                });
                                oComboBox.addItem(oItem);
                                
                                console.log(`Added item: Key=${item[sPrimaryKey]}, Text=${displayText}`);
                            });
                        }
                    });
            }.bind(this));
        },
        /**
         * Create an input field based on column metadata with enhanced validation
         * @param {Object} oColumnMetadata The column metadata
         * @param {string} sPath The binding path
         * @param {boolean} bIsRequired Whether the field is required
         * @param {string} sUniqueId A unique ID for the field
         * @param {boolean} bIsParentForeignKey Whether this is a parent foreign key
         * @returns {sap.ui.core.Control} The created control
         * @private
         */
        _createInputField: function(oColumnMetadata, sPath, bIsRequired, sUniqueId, bIsParentForeignKey) {
            let oControl;
            
            switch (oColumnMetadata.type) {
                case "relation":
                    if (bIsParentForeignKey) {
                        oControl = new sap.m.Text({
                            id: sUniqueId,
                            text: `Connected to parent ${this.getModel("viewModel").getProperty("/parentInfo/parentTable")} (ID: ${this.getModel("viewModel").getProperty("/parentInfo/parentId")})`
                        });
                    } else {
                        oControl = new sap.m.ComboBox({
                            id: sUniqueId,
                            selectedKey: {
                                path: sPath
                            },
                            width: "100%",
                            required: bIsRequired,
                            showSecondaryValues: true,
                            valueState: "{= ${viewModel>/validationErrors/" + oColumnMetadata.name + "} ? 'Error' : 'None' }",
                            valueStateText: "{viewModel>/validationErrors/" + oColumnMetadata.name + "}",
                            selectionChange: function(oEvent) {
                                // Clear error state on selection
                                oEvent.getSource().setValueState("None");
                                
                                // Get view model to clear validation errors
                                const oViewModel = this.getModel("viewModel");
                                const oErrors = oViewModel.getProperty("/validationErrors") || {};
                                if (oErrors[oColumnMetadata.name]) {
                                    delete oErrors[oColumnMetadata.name];
                                    oViewModel.setProperty("/validationErrors", oErrors);
                                }
                            }.bind(this)
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
                        width: "100%",
                        select: function(oEvent) {
                            // Get the view model to access validation errors
                            const oViewModel = this.getModel("viewModel");
                            const oErrors = oViewModel.getProperty("/validationErrors");
                            
                            // Clear any errors for this field
                            if (oErrors && oErrors[oColumnMetadata.name]) {
                                delete oErrors[oColumnMetadata.name];
                                oViewModel.setProperty("/validationErrors", oErrors);
                            }
                        }.bind(this)
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
                        displayFormat: "medium",
                        width: "100%",
                        required: bIsRequired,
                        valueState: "{= ${viewModel>/validationErrors/" + oColumnMetadata.name + "} ? 'Error' : 'None' }",
                        valueStateText: "{viewModel>/validationErrors/" + oColumnMetadata.name + "}",
                        change: function(oEvent) {
                            // Clear error state on successful change
                            if (oEvent.getParameter("valid")) {
                                oEvent.getSource().setValueState("None");
                                
                                // Get the view model to access validation errors
                                const oViewModel = this.getModel("viewModel");
                                const oErrors = oViewModel.getProperty("/validationErrors");
                                
                                // Clear any errors for this field
                                if (oErrors && oErrors[oColumnMetadata.name]) {
                                    delete oErrors[oColumnMetadata.name];
                                    oViewModel.setProperty("/validationErrors", oErrors);
                                }
                            } else {
                                oEvent.getSource().setValueState("Error");
                                oEvent.getSource().setValueStateText("Please enter a valid date");
                                
                                // Get the view model to update validation errors
                                const oViewModel = this.getModel("viewModel");
                                const oErrors = oViewModel.getProperty("/validationErrors") || {};
                                
                                // Set error for this field
                                oErrors[oColumnMetadata.name] = "Please enter a valid date";
                                oViewModel.setProperty("/validationErrors", oErrors);
                            }
                        }.bind(this)
                    });
                    break;
                
                case "number":
                    oControl = new sap.m.Input({
                        id: sUniqueId,
                        value: {
                            path: sPath,
                            type: new sap.ui.model.type.Float({
                                minFractionDigits: 0,
                                maxFractionDigits: 2
                            })
                        },
                        type: "Number",
                        width: "100%",
                        required: bIsRequired,
                        valueState: "{= ${viewModel>/validationErrors/" + oColumnMetadata.name + "} ? 'Error' : 'None' }",
                        valueStateText: "{viewModel>/validationErrors/" + oColumnMetadata.name + "}",
                        liveChange: function(oEvent) {
                            const value = oEvent.getParameter("value");
                            
                            // Get the view model to access/update validation errors
                            const oViewModel = this.getModel("viewModel");
                            const oErrors = oViewModel.getProperty("/validationErrors") || {};
                            
                            if (value && isNaN(parseFloat(value))) {
                                oEvent.getSource().setValueState("Error");
                                oEvent.getSource().setValueStateText("Please enter a valid number");
                                
                                // Set error for this field
                                oErrors[oColumnMetadata.name] = "Please enter a valid number";
                                oViewModel.setProperty("/validationErrors", oErrors);
                            } else {
                                oEvent.getSource().setValueState("None");
                                
                                // Clear any errors for this field
                                if (oErrors[oColumnMetadata.name]) {
                                    delete oErrors[oColumnMetadata.name];
                                    oViewModel.setProperty("/validationErrors", oErrors);
                                }
                            }
                        }.bind(this)
                    });
                    break;
                
                case "email":
                    oControl = new sap.m.Input({
                        id: sUniqueId,
                        value: {
                            path: sPath
                        },
                        type: "Email",
                        width: "100%",
                        required: bIsRequired,
                        valueState: "{= ${viewModel>/validationErrors/" + oColumnMetadata.name + "} ? 'Error' : 'None' }",
                        valueStateText: "{viewModel>/validationErrors/" + oColumnMetadata.name + "}",
                        liveChange: function(oEvent) {
                            const value = oEvent.getParameter("value");
                            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                            
                            // Get the view model to access/update validation errors
                            const oViewModel = this.getModel("viewModel");
                            const oErrors = oViewModel.getProperty("/validationErrors") || {};
                            
                            if (value && !emailRegex.test(value)) {
                                oEvent.getSource().setValueState("Error");
                                oEvent.getSource().setValueStateText("Please enter a valid email address");
                                
                                // Set error for this field
                                oErrors[oColumnMetadata.name] = "Please enter a valid email address";
                                oViewModel.setProperty("/validationErrors", oErrors);
                            } else {
                                oEvent.getSource().setValueState("None");
                                
                                // Clear any errors for this field
                                if (oErrors[oColumnMetadata.name]) {
                                    delete oErrors[oColumnMetadata.name];
                                    oViewModel.setProperty("/validationErrors", oErrors);
                                }
                            }
                        }.bind(this)
                    });
                    break;
                    
                case "url":
                    oControl = new sap.m.Input({
                        id: sUniqueId,
                        value: {
                            path: sPath
                        },
                        type: "Url",
                        width: "100%",
                        required: bIsRequired,
                        valueState: "{= ${viewModel>/validationErrors/" + oColumnMetadata.name + "} ? 'Error' : 'None' }",
                        valueStateText: "{viewModel>/validationErrors/" + oColumnMetadata.name + "}",
                        liveChange: function(oEvent) {
                            const value = oEvent.getParameter("value");
                            const urlRegex = /^(http|https):\/\/[^ "]+$/;
                            
                            // Get the view model to access/update validation errors
                            const oViewModel = this.getModel("viewModel");
                            const oErrors = oViewModel.getProperty("/validationErrors") || {};
                            
                            if (value && !urlRegex.test(value)) {
                                oEvent.getSource().setValueState("Error");
                                oEvent.getSource().setValueStateText("Please enter a valid URL (starting with http:// or https://)");
                                
                                // Set error for this field
                                oErrors[oColumnMetadata.name] = "Please enter a valid URL (starting with http:// or https://)";
                                oViewModel.setProperty("/validationErrors", oErrors);
                            } else {
                                oEvent.getSource().setValueState("None");
                                
                                // Clear any errors for this field
                                if (oErrors[oColumnMetadata.name]) {
                                    delete oErrors[oColumnMetadata.name];
                                    oViewModel.setProperty("/validationErrors", oErrors);
                                }
                            }
                        }.bind(this)
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
                        required: bIsRequired,
                        valueState: "{= ${viewModel>/validationErrors/" + oColumnMetadata.name + "} ? 'Error' : 'None' }",
                        valueStateText: "{viewModel>/validationErrors/" + oColumnMetadata.name + "}"
                    });
                    break;
                
                default:
                    oControl = new sap.m.Input({
                        id: sUniqueId,
                        value: {
                            path: sPath
                        },
                        width: "100%",
                        required: bIsRequired,
                        valueState: "{= ${viewModel>/validationErrors/" + oColumnMetadata.name + "} ? 'Error' : 'None' }",
                        valueStateText: "{viewModel>/validationErrors/" + oColumnMetadata.name + "}"
                    });
            }
            
            // Set control ID with consistent naming for easier access
            if (oControl.setId) {
                oControl.setId(this.getView().createId(oColumnMetadata.name + "Input"));
            }
            
            return oControl;
        },
        
        /**
         * Reset error states on all form fields
         * @private
         */
        _resetFormErrorStates: function() {
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
        
        /**
         * Validate form data
         * @param {Object} oMetadata The table metadata
         * @param {Object} oEntityData The entity data
         * @returns {boolean} True if validation passes, false otherwise
         * @private
         */
        _validateForm: function(oMetadata, oEntityData) {
            const oValidationErrors = {};
            let bValid = true;
            
            // Find all input fields in the current view for validation
            const aInputControls = [];
            this.getView().$().find(".sapMInputBase, .sapMCheckBox").each(function() {
                const sId = this.id;
                const oControl = sap.ui.getCore().byId(sId);
                if (oControl) {
                    aInputControls.push(oControl);
                }
            });
            
            console.log("Found input controls:", aInputControls.length);
            
            // Reset all fields to non-error state
            aInputControls.forEach(oControl => {
                if (oControl.setValueState) {
                    oControl.setValueState("None");
                    if (oControl.setValueStateText) {
                        oControl.setValueStateText("");
                    }
                }
            });
            
            // Check required fields and validate types
            oMetadata.columns.forEach((oColumnMetadata) => {
                // Skip fields that are not editable or primary key
                if (oColumnMetadata.editable === false || 
                    oColumnMetadata.name === oMetadata.primaryKey ||
                    oColumnMetadata.name === 'created_at' ||
                    oColumnMetadata.name === 'updated_at') {
                    return;
                }
                
                const sFieldName = oColumnMetadata.name;
                const vFieldValue = oEntityData[sFieldName];
                let oControl = null;
                
                // Find the input control for this field
                for (let i = 0; i < aInputControls.length; i++) {
                    const sControlId = aInputControls[i].getId();
                    if (sControlId.endsWith(sFieldName + "Input") || 
                        sControlId.indexOf(sFieldName + "Input") !== -1) {
                        oControl = aInputControls[i];
                        break;
                    }
                }
                
                if (!oControl) {
                    console.log("Control not found for field:", sFieldName);
                } else {
                    console.log("Found control for field:", sFieldName, oControl.getId());
                }
                
                // Check required fields
                if (oColumnMetadata.required && 
                    (vFieldValue === undefined || vFieldValue === null || vFieldValue === "")) {
                    bValid = false;
                    oValidationErrors[sFieldName] = "This field is required";
                    
                    // Set error state on the input control
                    if (oControl && oControl.setValueState) {
                        oControl.setValueState("Error");
                        if (oControl.setValueStateText) {
                            oControl.setValueStateText("This field is required");
                        }
                    }
                    
                    console.log("Required field validation failed:", sFieldName);
                } 
                // Validate field type
                else if (vFieldValue !== undefined && vFieldValue !== null && vFieldValue !== "") {
                    let bTypeValid = true;
                    let sErrorMessage = "";
                    
                    switch (oColumnMetadata.type) {
                        case "number":
                            // Check if value is a valid number
                            if (isNaN(parseFloat(vFieldValue)) || !isFinite(vFieldValue)) {
                                bTypeValid = false;
                                sErrorMessage = "Please enter a valid number";
                            }
                            break;
                            
                        case "date":
                            // Check if value is a valid date
                            const oDate = new Date(vFieldValue);
                            if (isNaN(oDate.getTime())) {
                                bTypeValid = false;
                                sErrorMessage = "Please enter a valid date";
                            }
                            break;
                            
                        case "email":
                            // Basic email validation regex
                            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                            if (!emailRegex.test(vFieldValue)) {
                                bTypeValid = false;
                                sErrorMessage = "Please enter a valid email address";
                            }
                            break;
                            
                        case "url":
                            // Basic URL validation regex
                            const urlRegex = /^(http|https):\/\/[^ "]+$/;
                            if (!urlRegex.test(vFieldValue)) {
                                bTypeValid = false;
                                sErrorMessage = "Please enter a valid URL (starting with http:// or https://)";
                            }
                            break;
                    }
                    
                    if (!bTypeValid) {
                        bValid = false;
                        oValidationErrors[sFieldName] = sErrorMessage;
                        
                        // Set error state on the input control
                        if (oControl && oControl.setValueState) {
                            oControl.setValueState("Error");
                            if (oControl.setValueStateText) {
                                oControl.setValueStateText(sErrorMessage);
                            }
                        }
                        
                        console.log("Type validation failed:", sFieldName, sErrorMessage);
                    }
                }
            });
            
            // Store validation errors in the view model
            const oViewModel = this.getModel("viewModel");
            if (oViewModel) {
                oViewModel.setProperty("/validationErrors", oValidationErrors);
            }
            
            console.log("Validation result:", bValid ? "Valid" : "Invalid", oValidationErrors);
            
            return bValid;
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
        },



        /**
         * Enhanced save press handler with fail-safe navigation
         */
        onSavePress: function() {
            const oViewModel = this.getModel("viewModel");
            const sTableId = oViewModel.getProperty("/tableId");
            const oEntityData = oViewModel.getProperty("/entity");
            
            console.log("Save pressed with entity data:", JSON.stringify(oEntityData, null, 2));
            
            // Reset any existing error states
            this._resetFormErrorStates();
            
            // Set busy state
            oViewModel.setProperty("/busy", true);
            
            // Get parent info from the view model
            let oParentInfo = oViewModel.getProperty("/parentInfo");
            
            // If no parent info in view model, try backup or session storage
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
                        console.log("Retrieved parent info from session storage:", JSON.stringify(oParentInfo, null, 2));
                    }
                } catch (e) {
                    console.error("Error retrieving parent info from session storage:", e);
                }
            }
            
            console.log("Final parent info for saving:", oParentInfo ? JSON.stringify(oParentInfo) : "none");
            
            // Load metadata for validation
            this.getTableMetadata(sTableId).then((oMetadata) => {
                // Perform validation
                if (!this._validateForm(oMetadata, oEntityData)) {
                    this.showErrorMessage("Please correct the errors in the form");
                    oViewModel.setProperty("/busy", false);
                    return;
                }
                
                // Create a copy of the data without read-only fields
                const oDataToInsert = {};
                
                oMetadata.columns.forEach((oColumnMetadata) => {
                    // Skip non-editable fields and primary key
                    if ((oColumnMetadata.editable === false && 
                        oColumnMetadata.name !== oMetadata.primaryKey) || 
                        oColumnMetadata.name === oMetadata.primaryKey ||
                        oColumnMetadata.name === 'created_at' ||
                        oColumnMetadata.name === 'updated_at') {
                        return;
                    }
                    
                    // Add field to insert data
                    oDataToInsert[oColumnMetadata.name] = oEntityData[oColumnMetadata.name];
                });
                
                // If we have parent info, ensure foreign key is set
                if (oParentInfo && oParentInfo.foreignKey && oParentInfo.parentId) {
                    console.log(`Setting foreign key ${oParentInfo.foreignKey} = ${oParentInfo.parentId}`);
                    oDataToInsert[oParentInfo.foreignKey] = oParentInfo.parentId;
                }
                
                console.log("Data to insert:", JSON.stringify(oDataToInsert, null, 2));
                
                // Create entity
                this.getSupabaseClient()
                    .from(sTableId)
                    .insert(oDataToInsert)
                    .then(({ data, error }) => {
                        oViewModel.setProperty("/busy", false);
                        
                        if (error) {
                            console.error("Error creating entity:", error);
                            this.showErrorMessage("Error creating entity: " + error.message);
                            return;
                        }
                        
                        const sTableName = oViewModel.getProperty("/tableName");
                        this.showSuccessMessage(sTableName + " created successfully");
                        
                        // Try to clear session storage
                        try {
                            sessionStorage.removeItem("parentEntityInfo");
                            console.log("Cleared parent info from session storage");
                        } catch (e) {
                            console.warn("Could not clear session storage:", e);
                        }
                        
                        // NAVIGATION AFTER SAVE:
                        this._navigateAfterSave(oParentInfo, sTableId);
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
         * Dedicated method for navigation after save to centralize the logic
         */
        _navigateAfterSave: function(oParentInfo, sTableId) {
            console.log("Navigating after save");
            
            // If parent info exists, navigate back to parent detail
            if (oParentInfo && oParentInfo.parentTable && oParentInfo.parentId) {
                console.log("Navigating to parent entity:", oParentInfo.parentTable, oParentInfo.parentId);
                
                try {
                    // Force a small delay to ensure proper transition
                    setTimeout(() => {
                        this.getRouter().navTo("entityDetail", {
                            table: oParentInfo.parentTable,
                            id: oParentInfo.parentId
                        });
                        console.log("Navigation to parent initiated");
                    }, 100);
                } catch (e) {
                    console.error("Error during navigation to parent:", e);
                    
                    // Fallback navigation to list view
                    try {
                        this.getRouter().navTo("entityList", {
                            table: sTableId
                        });
                        console.log("Fallback navigation to list view initiated");
                    } catch (e2) {
                        console.error("Error during fallback navigation:", e2);
                    }
                }
            } else {
                // No parent info, navigate to list view
                console.log("No parent info, navigating to list view");
                this.getRouter().navTo("entityList", {
                    table: sTableId
                });
            }
        },
 
        /**
         * Enhanced cancel press handler with improved navigation
         */
        onCancelPress: function() {
            console.log("Cancel pressed");
            
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
                // Navigate back to list view
                console.log("No parent info, navigating to list view after cancel");
                this.getRouter().navTo("entityList", {
                    table: sTableId
                });
            }
        },

    });
});