sap.ui.define([
    "sap/ui/core/mvc/ControllerExtension",
    "sap/m/Label",
    "sap/m/Text",
    "sap/m/Input",
    "sap/m/TextArea",
    "sap/m/CheckBox",
    "sap/m/DatePicker",
    "sap/m/ComboBox",
    "sap/ui/layout/Grid",
    "sap/ui/layout/GridData",
    "sap/m/VBox",
    "sap/m/HBox",
    "sap/m/Panel"
], function(
    ControllerExtension, 
    Label, 
    Text, 
    Input, 
    TextArea, 
    CheckBox, 
    DatePicker, 
    ComboBox,
    Grid,
    GridData,
    VBox,
    HBox,
    Panel
) {
    "use strict";

    return ControllerExtension.extend("com.supabase.easyui5.controller.EntityDetailForm", {
        /**
         * Configure the form based on entity metadata
         * @param {Object} oMetadata The table metadata
         * @param {Object} oEntityData The entity data
         * @public
         */
        configureForm: function(oMetadata, oEntityData) {
            console.log("Configuring form with metadata:", oMetadata);
            
            // Get the form from the view
            const oFormContainer = this.getView().byId("entityDetailsContainer");
            
            if (!oFormContainer) {
                console.error("Form container not found");
                return;
            }
            
            // Clear existing form elements
            oFormContainer.removeAllFormElements();
            
            // Get the current view model and edit mode
            const oViewModel = this.getModel("viewModel");
            const bEditMode = oViewModel.getProperty("/editMode");
            
            console.log("Edit Mode:", bEditMode);
            
            // Initialize form fields collection if in edit mode
            if (bEditMode) {
                this.initFormFields();
            }
            
            // Add form elements based on metadata
            oMetadata.columns.forEach((oColumnMetadata) => {
                // Skip hidden columns
                if (!oColumnMetadata.visible) {
                    return;
                }
                
                // Create form element
                const oFormElement = new sap.ui.layout.form.FormElement({
                    label: new Label({
                        text: oColumnMetadata.label,
                        required: bEditMode && oColumnMetadata.required
                    })
                });
                
                // Determine the control based on column type and edit mode
                let oField;
                const sPath = "viewModel>/entity/" + oColumnMetadata.name;
                
                if (bEditMode) {
                    // Create an editable field based on metadata
                    if (oColumnMetadata.type === "relation") {
                        // Relation fields - ComboBox
                        oField = new ComboBox({
                            selectedKey: {
                                path: sPath,
                                mode: 'TwoWay'
                            },
                            width: "100%",
                            enabled: !(oColumnMetadata.editable === false),
                            valueState: "{= ${viewModel>/validationErrors/" + oColumnMetadata.name + "} ? 'Error' : 'None' }",
                            valueStateText: "{viewModel>/validationErrors/" + oColumnMetadata.name + "}",
                            selectionChange: this.createFieldChangeHandler(oColumnMetadata)
                        });
                        
                        // Load relation options
                        this.loadRelationOptions(
                            oField, 
                            oColumnMetadata.relation, 
                            oColumnMetadata.name
                        );
                    } else if (oColumnMetadata.type === "boolean") {
                        // Boolean fields - Checkbox
                        oField = new CheckBox({
                            selected: {
                                path: sPath,
                                mode: 'TwoWay'
                            },
                            enabled: !(oColumnMetadata.editable === false),
                            select: this.createFieldChangeHandler(oColumnMetadata)
                        });
                    } else if (oColumnMetadata.type === "date") {
                        // Date fields - DatePicker
                        oField = new DatePicker({
                            value: {
                                path: sPath,
                                mode: 'TwoWay',
                                type: new sap.ui.model.type.Date({
                                    pattern: "yyyy-MM-dd"
                                })
                            },
                            valueFormat: "yyyy-MM-dd",
                            displayFormat: "mediumDate",
                            enabled: !(oColumnMetadata.editable === false),
                            valueState: "{= ${viewModel>/validationErrors/" + oColumnMetadata.name + "} ? 'Error' : 'None' }",
                            valueStateText: "{viewModel>/validationErrors/" + oColumnMetadata.name + "}",
                            change: function(oEvent) {
                                // Clear error state on successful change
                                if (oEvent.getParameter("valid")) {
                                    oEvent.getSource().setValueState("None");
                                    this.clearFieldError(oColumnMetadata.name);
                                } else {
                                    oEvent.getSource().setValueState("Error");
                                    oEvent.getSource().setValueStateText("Please enter a valid date");
                                    this.setFieldError(oColumnMetadata.name, "Please enter a valid date");
                                }
                            }.bind(this)
                        });
                    } else if (oColumnMetadata.type === "number") {
                        // Number fields - Input with type Number
                        oField = new Input({
                            value: {
                                path: sPath,
                                mode: 'TwoWay',
                                type: new sap.ui.model.type.Float({
                                    decimals: 2
                                })
                            },
                            type: "Number",
                            enabled: !(oColumnMetadata.editable === false),
                            valueState: "{= ${viewModel>/validationErrors/" + oColumnMetadata.name + "} ? 'Error' : 'None' }",
                            valueStateText: "{viewModel>/validationErrors/" + oColumnMetadata.name + "}",
                            liveChange: function(oEvent) {
                                const value = oEvent.getParameter("value");
                                
                                if (value && isNaN(parseFloat(value))) {
                                    oEvent.getSource().setValueState("Error");
                                    oEvent.getSource().setValueStateText("Please enter a valid number");
                                    this.setFieldError(oColumnMetadata.name, "Please enter a valid number");
                                } else {
                                    oEvent.getSource().setValueState("None");
                                    this.clearFieldError(oColumnMetadata.name);
                                }
                            }.bind(this)
                        });
                    } else if (oColumnMetadata.type === "email") {
                        // Email fields - Input with type Email
                        oField = new Input({
                            value: {
                                path: sPath,
                                mode: 'TwoWay'
                            },
                            type: "Email",
                            enabled: !(oColumnMetadata.editable === false),
                            valueState: "{= ${viewModel>/validationErrors/" + oColumnMetadata.name + "} ? 'Error' : 'None' }",
                            valueStateText: "{viewModel>/validationErrors/" + oColumnMetadata.name + "}",
                            liveChange: function(oEvent) {
                                const value = oEvent.getParameter("value");
                                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                                
                                if (value && !emailRegex.test(value)) {
                                    oEvent.getSource().setValueState("Error");
                                    oEvent.getSource().setValueStateText("Please enter a valid email address");
                                    this.setFieldError(oColumnMetadata.name, "Please enter a valid email address");
                                } else {
                                    oEvent.getSource().setValueState("None");
                                    this.clearFieldError(oColumnMetadata.name);
                                }
                            }.bind(this)
                        });
                    } else if (oColumnMetadata.type === "url") {
                        // URL fields - Input with type Url
                        oField = new Input({
                            value: {
                                path: sPath,
                                mode: 'TwoWay'
                            },
                            type: "Url",
                            enabled: !(oColumnMetadata.editable === false),
                            valueState: "{= ${viewModel>/validationErrors/" + oColumnMetadata.name + "} ? 'Error' : 'None' }",
                            valueStateText: "{viewModel>/validationErrors/" + oColumnMetadata.name + "}",
                            liveChange: function(oEvent) {
                                const value = oEvent.getParameter("value");
                                const urlRegex = /^(http|https):\/\/[^ "]+$/;
                                
                                if (value && !urlRegex.test(value)) {
                                    oEvent.getSource().setValueState("Error");
                                    oEvent.getSource().setValueStateText("Please enter a valid URL (starting with http:// or https://)");
                                    this.setFieldError(oColumnMetadata.name, "Please enter a valid URL (starting with http:// or https://)");
                                } else {
                                    oEvent.getSource().setValueState("None");
                                    this.clearFieldError(oColumnMetadata.name);
                                }
                            }.bind(this)
                        });
                    } else if (oColumnMetadata.type === "text") {
                        // Text/Textarea fields - TextArea
                        oField = new TextArea({
                            value: {
                                path: sPath,
                                mode: 'TwoWay'
                            },
                            rows: 3,
                            width: "100%",
                            enabled: !(oColumnMetadata.editable === false),
                            valueState: "{= ${viewModel>/validationErrors/" + oColumnMetadata.name + "} ? 'Error' : 'None' }",
                            valueStateText: "{viewModel>/validationErrors/" + oColumnMetadata.name + "}",
                            liveChange: this.createFieldChangeHandler(oColumnMetadata)
                        });
                    } else {
                        // Default to Input for string fields
                        oField = new Input({
                            value: {
                                path: sPath,
                                mode: 'TwoWay'
                            },
                            enabled: !(oColumnMetadata.editable === false),
                            valueState: "{= ${viewModel>/validationErrors/" + oColumnMetadata.name + "} ? 'Error' : 'None' }",
                            valueStateText: "{viewModel>/validationErrors/" + oColumnMetadata.name + "}",
                            liveChange: this.createFieldChangeHandler(oColumnMetadata)
                        });
                    }
                    
                    // Store the field in the parent controller for validation
                    if (this.getView().getController()._formFields) {
                        this.getView().getController()._formFields[oColumnMetadata.name] = oField;
                    }
                } else {
                    // Read-only display fields
                    oField = this.createDisplayField(oColumnMetadata, oEntityData);
                }
                
                // Add field to form element
                oFormElement.addField(oField);
                
                // Add form element to container
                oFormContainer.addFormElement(oFormElement);
            });
            
            console.log("Form configuration complete");
        },
        
        /**
         * Configure form with improved vertical layout (labels above fields)
         * @param {Object} oMetadata Table metadata
         * @param {Object} oData Entity data
         * @public
         */
        configureGridForm: function(oMetadata, oData) {
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
                const oLayout = new Grid({
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
                    const oCell = new VBox({
                        width: "100%",
                        alignItems: "Start"
                    });
                    
                    // Add label above
                    oCell.addItem(new Label({
                        text: oColumnMetadata.label,
                        design: "Bold",
                        width: "100%"
                    }).addStyleClass("sapUiTinyMarginBottom"));
                    
                    // Create display field based on column type
                    let oControl = this.createDisplayField(oColumnMetadata, oData);
                    
                    // Style the value text
                    oControl.addStyleClass("sapUiTinyMarginTop");
                    oControl.setWidth("100%");
                    
                    // Add field to cell
                    oCell.addItem(oControl);
                    
                    // Add cell to layout
                    oLayout.addContent(oCell.addStyleClass("sapUiSmallMargin"));
                });
                
                // Wrap in a panel for nicer appearance
                const oPanel = new Panel({
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
                console.error("Error in dynamic configureGridForm:", error);
            }
        },
        
        /**
         * Load entity data from Supabase
         * @param {string} sTableId The table ID
         * @param {string} sEntityId The entity ID
         * @returns {Promise} A promise that resolves with the loaded entity
         * @public
         */
        loadEntity: function(sTableId, sEntityId) {
            console.log("Loading entity data for table:", sTableId, "entity ID:", sEntityId);
            
            const oViewModel = this.getModel("viewModel");
            
            // Set busy state
            oViewModel.setProperty("/busy", true);
            
            return new Promise((resolve, reject) => {
                // Get metadata to determine primary key
                this.getTableMetadata(sTableId).then((oMetadata) => {
                    console.log("Got metadata for table:", sTableId);
                    const sPrimaryKey = oMetadata.primaryKey;
                    
                    console.log("Primary key from metadata:", sPrimaryKey);
                    
                    if (!sPrimaryKey) {
                        this.showErrorMessage("Error: No primary key defined in metadata");
                        oViewModel.setProperty("/busy", false);
                        reject(new Error("No primary key defined"));
                        return;
                    }
                    
                    // Check if entity ID is valid
                    if (!sEntityId) {
                        this.showErrorMessage("Error: No entity ID specified");
                        oViewModel.setProperty("/busy", false);
                        reject(new Error("No entity ID specified"));
                        return;
                    }
                    
                    // Store metadata for validation
                    this.getView().getController()._currentMetadata = oMetadata;
                    
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
                                reject(error);
                                return;
                            }
                            
                            if (!data) {
                                console.error("No data found for entity");
                                this.showErrorMessage("Entity not found");
                                oViewModel.setProperty("/busy", false);
                                reject(new Error("Entity not found"));
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
                            
                            // Configure form (either default form or grid form)
                            const bUseGridForm = oViewModel.getProperty("/useGridForm");
                            if (bUseGridForm) {
                                this.configureGridForm(oMetadata, data);
                            } else {
                                this.configureForm(oMetadata, data);
                            }
                            
                            // Set busy to false
                            oViewModel.setProperty("/busy", false);
                            
                            // Resolve the promise with the loaded entity
                            resolve(data);
                        }).catch(error => {
                            console.error("Error in Supabase query:", error);
                            this.showErrorMessage("Error loading entity: " + error.message);
                            oViewModel.setProperty("/busy", false);
                            reject(error);
                        });
                }).catch((error) => {
                    console.error("Error getting table metadata:", error);
                    this.showErrorMessage("Error loading metadata: " + error.message);
                    oViewModel.setProperty("/busy", false);
                    reject(error);
                });
            });
        },
        
        /**
         * Validate the form data
         * @returns {boolean} True if the form is valid
         * @public
         */
        validateForm: function() {
            const oViewModel = this.getModel("viewModel");
            const oEntityData = oViewModel.getProperty("/entity");
            const oValidationErrors = {};
            const oMetadata = this.getView().getController()._currentMetadata;
            let bValid = true;
            
            // Make sure we have metadata
            if (!oMetadata) {
                console.error("No metadata available for validation");
                return false;
            }
            
            // Get all form fields from the parent controller
            const oFormFields = this.getView().getController()._formFields || {};
            
            // Reset field states
            Object.values(oFormFields).forEach(oField => {
                if (oField.setValueState) {
                    oField.setValueState("None");
                }
            });
            
            // Validate each field
            oMetadata.columns.forEach(oColumnMetadata => {
                // Skip fields that are not editable or primary key
                if (oColumnMetadata.editable === false || 
                    oColumnMetadata.name === oMetadata.primaryKey ||
                    oColumnMetadata.name === 'created_at' ||
                    oColumnMetadata.name === 'updated_at') {
                    return;
                }
                
                const sFieldName = oColumnMetadata.name;
                const vFieldValue = oEntityData[sFieldName];
                const oField = oFormFields[sFieldName];
                
                // Check required fields
                if (oColumnMetadata.required && 
                    (vFieldValue === undefined || vFieldValue === null || vFieldValue === "")) {
                    bValid = false;
                    oValidationErrors[sFieldName] = "This field is required";
                    
                    // Set error state on the field
                    if (oField && oField.setValueState) {
                        oField.setValueState("Error");
                        if (oField.setValueStateText) {
                            oField.setValueStateText("This field is required");
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
                        
                        // Set error state on the field
                        if (oField && oField.setValueState) {
                            oField.setValueState("Error");
                            if (oField.setValueStateText) {
                                oField.setValueStateText(sErrorMessage);
                            }
                        }
                        
                        console.log("Type validation failed:", sFieldName, sErrorMessage);
                    }
                }
            });
            
            // Update validation errors in the model
            oViewModel.setProperty("/validationErrors", oValidationErrors);
            
            return bValid;
        },
        
        /**
         * Save entity data after validation
         * @param {string} sTableId The table ID
         * @param {string} sEntityId The entity ID
         * @returns {Promise} A promise that resolves when the entity is saved
         * @public
         */
        saveEntity: function(sTableId, sEntityId) {
            const oViewModel = this.getModel("viewModel");
            const oEntityData = oViewModel.getProperty("/entity");
            
            // Set busy state
            oViewModel.setProperty("/busy", true);
            
            return new Promise((resolve, reject) => {
                // Get metadata for primary key and validation
                this.getTableMetadata(sTableId).then((oMetadata) => {
                    const sPrimaryKey = oMetadata.primaryKey;
                    
                    // Perform validation
                    if (!this.validateForm()) {
                        this.showErrorMessage("Please correct the errors in the form");
                        oViewModel.setProperty("/busy", false);
                        reject(new Error("Validation failed"));
                        return;
                    }
                    
                    // Get clean data for save
                    const oDataToUpdate = this.getEntityDataForSave(oMetadata, oEntityData, sPrimaryKey);
                    
                    console.log("Data to update:", oDataToUpdate);
                    
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
                                reject(error);
                                return;
                            }
                            
                            // Reset edit mode
                            oViewModel.setProperty("/editMode", false);
                            
                            // Show success message
                            this.showSuccessMessage("Entity updated successfully");
                            
                            // Reload entity to refresh data
                            this.loadEntity(sTableId, sEntityId)
                                .then(data => resolve(data))
                                .catch(error => {
                                    console.error("Error reloading entity after save:", error);
                                    // Still resolve because the save was successful
                                    resolve(oEntityData);
                                });
                        })
                        .catch(error => {
                            console.error("Error in Supabase query:", error);
                            this.showErrorMessage("Error updating entity: " + error.message);
                            oViewModel.setProperty("/busy", false);
                            reject(error);
                        });
                }).catch(error => {
                    console.error("Error getting table metadata:", error);
                    this.showErrorMessage("Error getting table metadata: " + error.message);
                    oViewModel.setProperty("/busy", false);
                    reject(error);
                });
            });
        }
    });
});