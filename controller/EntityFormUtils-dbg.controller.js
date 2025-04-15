sap.ui.define([
    "sap/ui/core/mvc/ControllerExtension",
    "sap/m/Text",
    "sap/m/Input",
    "sap/m/TextArea",
    "sap/m/CheckBox",
    "sap/m/DatePicker",
    "sap/m/ComboBox",
    "sap/ui/core/Item"
], function(
    ControllerExtension,
    Text,
    Input,
    TextArea,
    CheckBox,
    DatePicker,
    ComboBox,
    Item
) {
    "use strict";

    return ControllerExtension.extend("com.supabase.easyui5.controller.EntityFormUtils", {
        /**
         * Load options for relation fields
         * @param {sap.m.ComboBox} oComboBox The ComboBox control
         * @param {string} sRelatedTable The related table
         * @param {string} sFieldName The field name
         * @public
         */
        loadRelationOptions: function(oComboBox, sRelatedTable, sFieldName) {
            console.log(`Loading relation options for ${sFieldName} from table ${sRelatedTable}`);
            
            // Get metadata for related table
            this.getTableMetadata(sRelatedTable).then((oMetadata) => {
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
                                const oItem = new Item({
                                    key: item[sPrimaryKey],
                                    text: item[sTitleField]
                                });
                                oComboBox.addItem(oItem);
                                
                                console.log(`Added item: Key=${item[sPrimaryKey]}, Text=${item[sTitleField]}`);
                            });
                        }
                    });
            });
        },
        
        /**
         * Create an input field based on column metadata with enhanced validation
         * @param {Object} oColumnMetadata The column metadata
         * @param {string} sPath The binding path
         * @param {boolean} bIsRequired Whether the field is required
         * @param {string} sUniqueId A unique ID for the field
         * @param {boolean} bIsParentForeignKey Whether this is a parent foreign key
         * @returns {sap.ui.core.Control} The created control
         * @public
         */
        createInputField: function(oColumnMetadata, sPath, bIsRequired, sUniqueId, bIsParentForeignKey) {
            let oControl;
            
            switch (oColumnMetadata.type) {
                case "relation":
                    if (bIsParentForeignKey) {
                        oControl = new Text({
                            id: sUniqueId,
                            text: `Connected to parent ${this.getModel("viewModel").getProperty("/parentInfo/parentTable")} (ID: ${this.getModel("viewModel").getProperty("/parentInfo/parentId")})`
                        });
                    } else {
                        oControl = new ComboBox({
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
                        
                        this.loadRelationOptions(
                            oControl, 
                            oColumnMetadata.relation, 
                            oColumnMetadata.name
                        );
                    }
                    break;
                
                case "boolean":
                    oControl = new CheckBox({
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
                    oControl = new DatePicker({
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
                    oControl = new Input({
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
                    oControl = new Input({
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
                    oControl = new Input({
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
                    oControl = new TextArea({
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
                    oControl = new Input({
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
         * Create a generic field change handler to clear validation errors
         * @param {Object} oColumnMetadata The column metadata
         * @returns {Function} The change handler function
         * @public
         */
        createFieldChangeHandler: function(oColumnMetadata) {
            return function(oEvent) {
                // Clear any error state
                if (oEvent.getSource().setValueState) {
                    oEvent.getSource().setValueState("None");
                }
                
                // Clear the error from the model
                this.clearFieldError(oColumnMetadata.name);
            }.bind(this);
        },
        
        /**
         * Set field error in the validation errors
         * @param {string} sFieldName The field name
         * @param {string} sErrorMessage The error message
         * @public
         */
        setFieldError: function(sFieldName, sErrorMessage) {
            const oViewModel = this.getModel("viewModel");
            const oErrors = oViewModel.getProperty("/validationErrors") || {};
            
            oErrors[sFieldName] = sErrorMessage;
            oViewModel.setProperty("/validationErrors", oErrors);
        },
        
        /**
         * Clear field error from validation errors
         * @param {string} sFieldName The field name
         * @public
         */
        clearFieldError: function(sFieldName) {
            const oViewModel = this.getModel("viewModel");
            const oErrors = oViewModel.getProperty("/validationErrors") || {};
            
            if (oErrors[sFieldName]) {
                delete oErrors[sFieldName];
                oViewModel.setProperty("/validationErrors", oErrors);
            }
        },
        
        /**
         * Create read-only display field
         * @param {Object} oColumnMetadata The column metadata
         * @param {Object} oEntityData The entity data
         * @returns {sap.ui.core.Control} The created control
         * @public
         */
        createDisplayField: function(oColumnMetadata, oEntityData) {
            let oField;
            
            switch (oColumnMetadata.type) {
                case "relation":
                    const sRelatedText = oEntityData[oColumnMetadata.name + "_text"] || 
                                         oEntityData[oColumnMetadata.name];
                    oField = new Text({
                        text: sRelatedText || ""
                    });
                    break;
                    
                case "boolean":
                    oField = new Text({
                        text: oEntityData[oColumnMetadata.name] ? "Yes" : "No"
                    });
                    break;
                    
                case "date":
                    oField = new Text({
                        text: oEntityData[oColumnMetadata.name] ? 
                              new Date(oEntityData[oColumnMetadata.name]).toLocaleDateString() : 
                              ""
                    });
                    break;
                    
                case "number":
                    oField = new Text({
                        text: oEntityData[oColumnMetadata.name] !== undefined ? 
                              parseFloat(oEntityData[oColumnMetadata.name]).toFixed(2) : 
                              ""
                    });
                    break;
                    
                default:
                    oField = new Text({
                        text: oEntityData[oColumnMetadata.name] || ""
                    });
            }
            
            return oField;
        },
        
        /**
         * Initialize form fields collection for validation
         * @public
         */
        initFormFields: function() {
            this.getView().getController()._formFields = this.getView().getController()._formFields || {};
        },
        
        /**
         * Get entity data with validation
         * @param {Object} oMetadata The metadata object
         * @param {Object} oEntityData The entity data to validate
         * @param {string} sPrimaryKey The primary key field name
         * @returns {Object} The clean data object for insert/update
         * @public
         */
        getEntityDataForSave: function(oMetadata, oEntityData, sPrimaryKey) {
            // Create a copy of the data without read-only fields
            const oDataToSave = {};
            
            if (!oMetadata || !oEntityData) {
                return oDataToSave;
            }
            
            oMetadata.columns.forEach((oColumnMetadata) => {
                // Skip non-editable fields and primary key
                if ((oColumnMetadata.editable === false && 
                    oColumnMetadata.name !== sPrimaryKey) || 
                    oColumnMetadata.name === sPrimaryKey) {
                    return;
                }
                
                // Add field to save data
                oDataToSave[oColumnMetadata.name] = oEntityData[oColumnMetadata.name];
            });
            
            // Add server-side timestamp for updated_at if it exists
            if ('updated_at' in oEntityData) {
                oDataToSave['updated_at'] = new Date().toISOString();
            }
            
            return oDataToSave;
        }
    });
});