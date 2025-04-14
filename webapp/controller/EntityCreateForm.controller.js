sap.ui.define([
    "sap/ui/core/mvc/ControllerExtension",
    "sap/m/Label"
], function(ControllerExtension, Label) {
    "use strict";

    return ControllerExtension.extend("com.supabase.easyui5.controller.EntityCreateForm", {
        /**
         * Initialize entity data with default values and handle parent data
         * @param {Object} oMetadata The table metadata
         * @private
         */
        initializeEntityData: function(oMetadata) {
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
         * Configure form for creating a new entity
         * @param {Object} oMetadata The table metadata
         * @private
         */
        configureForm: function(oMetadata) {
            console.log("Configuring create form with metadata:", JSON.stringify(oMetadata, null, 2));
            
            const oFormContainer = this.getView().byId("entityCreateContainer");
            
            if (!oFormContainer) {
                console.error("Form container not found");
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
                    label: new Label({
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
                
                // Create appropriate input control
                try {
                    const oControl = this.createInputField(
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
         * Create an input field with parent info handling
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
            
            if (bIsParentForeignKey) {
                // Create a read-only field showing the parent connection
                oControl = new sap.m.Text({
                    id: sUniqueId,
                    text: `Connected to parent ${this.getModel("viewModel").getProperty("/parentInfo/parentTable")} (ID: ${this.getModel("viewModel").getProperty("/parentInfo/parentId")})`
                });
                return oControl;
            }
            
            switch (oColumnMetadata.type) {
                case "relation":
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
                        selectionChange: this.createFieldChangeHandler(oColumnMetadata)
                    });
                    
                    this.loadRelationOptions(
                        oControl, 
                        oColumnMetadata.relation, 
                        oColumnMetadata.name
                    );
                    break;
                
                case "boolean":
                    oControl = new sap.m.CheckBox({
                        id: sUniqueId,
                        selected: {
                            path: sPath
                        },
                        width: "100%",
                        select: this.createFieldChangeHandler(oColumnMetadata)
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
                        valueStateText: "{viewModel>/validationErrors/" + oColumnMetadata.name + "}"
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
                        valueStateText: "{viewModel>/validationErrors/" + oColumnMetadata.name + "}"
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
                        valueStateText: "{viewModel>/validationErrors/" + oColumnMetadata.name + "}"
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
         * Validate the form data and save entity
         * @param {string} sTableId The table ID
         * @returns {Promise} A promise that resolves when the entity is saved
         * @public
         */
        validateAndSaveEntity: function(sTableId) {
            const oViewModel = this.getModel("viewModel");
            const oEntityData = oViewModel.getProperty("/entity");
            
            console.log("Save pressed with entity data:", oEntityData);
            
            // Reset any existing error states
            this.resetFormErrorStates();
            
            // Set busy state
            oViewModel.setProperty("/busy", true);
            
            // Return a promise that resolves when the entity is saved
            return new Promise((resolve, reject) => {
                // Load metadata for validation
                this.getTableMetadata(sTableId).then((oMetadata) => {
                    // Perform validation
                    if (!this.validateForm(oMetadata, oEntityData)) {
                        this.showErrorMessage("Please correct the errors in the form");
                        oViewModel.setProperty("/busy", false);
                        reject(new Error("Validation failed"));
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
                    
                    console.log("Data to insert:", oDataToInsert);
                    
                    // Create entity
                    this.getSupabaseClient()
                        .from(sTableId)
                        .insert(oDataToInsert)
                        .then(({ data, error }) => {
                            oViewModel.setProperty("/busy", false);
                            
                            if (error) {
                                this.showErrorMessage("Error creating entity", error);
                                reject(error);
                                return;
                            }
                            
                            const sTableName = oViewModel.getProperty("/tableName");
                            this.showSuccessMessage(sTableName + " created successfully");
                            
                            // Resolve the promise with the created entity
                            resolve(data);
                        })
                        .catch(error => {
                            console.error("Error in Supabase query:", error);
                            this.showErrorMessage("Error creating entity: " + error.message);
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
        },

        // Add this method to your EntityCreate.controller.js to improve schema validation

        /**
         * Validate and prepare entity data for saving
         * This method carefully checks if fields exist in the database before sending them
         * @param {Object} oMetadata Table metadata
         * @param {Object} oEntityData Raw entity data
         * @returns {Object} Clean entity data ready for saving
         * @private
         */
        _prepareEntityDataForSave: function(oMetadata, oEntityData) {
            // Create a clean object for saving
            const oDataToSave = {};
            
            // Get an array of actual column names from metadata
            const aValidColumnNames = oMetadata.columns.map(col => col.name);
            
            console.log("Valid column names:", aValidColumnNames);
            
            // Only include fields that exist in the database schema
            Object.keys(oEntityData).forEach(sFieldName => {
                // Skip fields that don't exist in the database schema
                if (!aValidColumnNames.includes(sFieldName)) {
                    console.log(`Skipping field '${sFieldName}' as it's not found in the schema`);
                    return;
                }
                
                // Get column metadata
                const oColumnMetadata = oMetadata.columns.find(col => col.name === sFieldName);
                
                // Skip fields that shouldn't be editable
                if (oColumnMetadata && oColumnMetadata.editable === false && 
                    sFieldName !== oMetadata.primaryKey) {
                    console.log(`Skipping non-editable field '${sFieldName}'`);
                    return;
                }
                
                // Skip the primary key for create operations
                if (sFieldName === oMetadata.primaryKey) {
                    console.log(`Skipping primary key field '${sFieldName}'`);
                    return;
                }
                
                // Add the field to the data to save
                oDataToSave[sFieldName] = oEntityData[sFieldName];
            });
            
            console.log("Prepared data for save:", oDataToSave);
            
            return oDataToSave;
        },

        /**
         * Updated onSavePress method with improved schema validation
         */
        onSavePress: function() {
            const oViewModel = this.getModel("viewModel");
            const sTableId = oViewModel.getProperty("/tableId");
            const oEntityData = oViewModel.getProperty("/entity");
            
            console.log("Save pressed with entity data:", oEntityData);
            
            // Reset any existing error states
            this._resetFormErrorStates();
            
            // Set busy state
            oViewModel.setProperty("/busy", true);
            
            // Load metadata for validation
            this.getTableMetadata(sTableId).then((oMetadata) => {
                // Perform validation
                if (!this._validateForm(oMetadata, oEntityData)) {
                    this.showErrorMessage("Please correct the errors in the form");
                    oViewModel.setProperty("/busy", false);
                    return;
                }
                
                // Prepare clean data for saving
                const oDataToInsert = this._prepareEntityDataForSave(oMetadata, oEntityData);
                
                console.log("Data to insert:", oDataToInsert);
                
                // Create entity
                this.getSupabaseClient()
                    .from(sTableId)
                    .insert(oDataToInsert)
                    .then(({ data, error }) => {
                        oViewModel.setProperty("/busy", false);
                        
                        if (error) {
                            this.showErrorMessage("Error creating entity", error);
                            console.error("Error details:", error);
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
        }
    });
});