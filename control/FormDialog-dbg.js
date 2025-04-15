sap.ui.define([
    "sap/ui/base/Object",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/ui/layout/form/SimpleForm",
    "sap/m/Label",
    "sap/m/Input",
    "sap/m/TextArea",
    "sap/m/CheckBox",
    "sap/m/DatePicker",
    "sap/m/ComboBox",
    "sap/ui/core/Item",
    "sap/m/MessageBox",
    "sap/ui/model/json/JSONModel"
], function(
    BaseObject,
    Dialog,
    Button,
    SimpleForm,
    Label,
    Input,
    TextArea,
    CheckBox,
    DatePicker,
    ComboBox,
    Item,
    MessageBox,
    JSONModel
) {
    "use strict";

    /**
     * Dynamic Form Dialog component that can be reused across the application
     * for both creating and editing entities.
     */
    return BaseObject.extend("com.supabase.easyui5.control.FormDialog", {
        /**
         * Constructor for the form dialog
         * @param {sap.ui.core.mvc.Controller} oController Reference to the controller that creates this dialog
         * @param {Object} oParams Configuration parameters
         */
        constructor: function(oController, oParams) {
            BaseObject.call(this);
            
            this._oController = oController;
            this._oDialog = null;
            this._oForm = null;
            this._oFormControls = {};
            this._fnSuccessCallback = null;
            
            // Default parameters
            this._oParams = {
                title: "Entity Form",
                mode: "create", // "create" or "edit"
                tableId: "",
                entityId: "",
                metadata: null,
                entity: {},
                parentInfo: null,
                successCallback: null,
                cancelCallback: null
            };
            
            // Override with user-provided parameters
            if (oParams) {
                for (var key in oParams) {
                    if (oParams.hasOwnProperty(key)) {
                        this._oParams[key] = oParams[key];
                    }
                }
            }
            
            // Create dialog model
            this._oDialogModel = new JSONModel({
                title: this._oParams.title,
                entity: this._oParams.entity || {},
                validationErrors: {},
                busy: false
            });
            
            // Store success callback
            this._fnSuccessCallback = this._oParams.successCallback;
            this._fnCancelCallback = this._oParams.cancelCallback;
        },
        
        /**
         * Open the form dialog
         * @public
         */
        open: function() {
            // Create dialog if it doesn't exist
            if (!this._oDialog) {
                this._createDialog();
            }
            
            // Reset validation errors
            this._oDialogModel.setProperty("/validationErrors", {});
            
            // Open the dialog
            this._oDialog.open();
            
            return this;
        },
        
        /**
         * Close the dialog
         * @public
         */
        close: function() {
            if (this._oDialog) {
                this._oDialog.close();
            }
            
            return this;
        },
        
        /**
         * Get the dialog instance
         * @returns {sap.m.Dialog} The dialog instance
         * @public
         */
        getDialog: function() {
            if (!this._oDialog) {
                this._createDialog();
            }
            
            return this._oDialog;
        },
        
        /**
         * Get the form model
         * @returns {sap.ui.model.json.JSONModel} The form model
         * @public
         */
        getModel: function() {
            return this._oDialogModel;
        },
        
        /**
         * Create the dialog
         * @private
         */
        _createDialog: function() {
            // Create form
            this._oForm = new SimpleForm({
                editable: true,
                layout: "ResponsiveGridLayout",
                labelSpanXL: 4,
                labelSpanL: 4,
                labelSpanM: 4,
                labelSpanS: 12,
                adjustLabelSpan: false,
                emptySpanXL: 0,
                emptySpanL: 0,
                emptySpanM: 0,
                emptySpanS: 0,
                columnsXL: 1,
                columnsL: 1,
                columnsM: 1,
                singleContainerFullSize: false
            });
            
            // Create dialog
            this._oDialog = new Dialog({
                title: "{/title}",
                contentWidth: "40rem",
                contentHeight: "auto",
                resizable: true,
                draggable: true,
                modal: true, // Set dialog to modal
                verticalScrolling: true,
                horizontalScrolling: false,
                stretch: sap.ui.Device.system.phone,
                content: [this._oForm],
                beginButton: new Button({
                    text: this._oParams.mode === "create" ? "Create" : "Save",
                    type: "Emphasized",
                    press: this._onSavePress.bind(this)
                }),
                endButton: new Button({
                    text: "Cancel",
                    press: this._onCancelPress.bind(this)
                }),
                afterClose: this._onAfterClose.bind(this),
                escapeHandler: this._handleEscapeKey.bind(this),
                busyIndicatorDelay: 0
            });
            
            // Set dialog model
            this._oDialog.setModel(this._oDialogModel);
            
            // Add dialog to controller view
            this._oController.getView().addDependent(this._oDialog);
            
            // If we have metadata, create form fields
            if (this._oParams.metadata) {
                this._createFormFields(this._oParams.metadata, this._oParams.entity);
            }
            else if (this._oParams.tableId) {
                // Load metadata
                this._loadMetadata(this._oParams.tableId);
            }
        },
        
        /**
         * Handle escape key press
         * @param {Object} oEscapeEvent The escape event
         * @private
         */
        _handleEscapeKey: function(oEscapeEvent) {
            // Show confirmation if there are changes
            if (this._hasChanges()) {
                oEscapeEvent.preventDefault(); // Prevent default escape behavior
                
                MessageBox.confirm(
                    "Are you sure you want to discard your changes?",
                    {
                        title: "Discard Changes",
                        onClose: function(sAction) {
                            if (sAction === MessageBox.Action.OK) {
                                this.close();
                            }
                        }.bind(this)
                    }
                );
            } else {
                // No changes, close without confirmation
                return true; // Allow default escape behavior
            }
        },
        
        /**
         * Check if the form has unsaved changes
         * @returns {boolean} True if there are unsaved changes
         * @private
         */
        _hasChanges: function() {
            // Implementation would compare current entity with original
            // For simplicity, always assume there are changes
            return true;
        },
        
        /**
         * Load metadata for the table
         * @param {string} sTableId The table ID
         * @private
         */
        _loadMetadata: function(sTableId) {
            // Set dialog to busy state
            this._oDialogModel.setProperty("/busy", true);
            
            // Get metadata from table
            this._oController.getTableMetadata(sTableId)
                .then(function(oMetadata) {
                    // Store metadata
                    this._oParams.metadata = oMetadata;
                    
                    // Create form fields based on metadata
                    this._createFormFields(oMetadata, this._oParams.entity);
                    
                    // Set dialog to non-busy state
                    this._oDialogModel.setProperty("/busy", false);
                }.bind(this))
                .catch(function(error) {
                    console.error("Error loading metadata:", error);
                    this._oDialogModel.setProperty("/busy", false);
                    MessageBox.error("Error loading form: " + error.message);
                }.bind(this));
        },
        
        /**
         * Create form fields based on metadata
         * @param {Object} oMetadata The table metadata
         * @param {Object} oEntityData The entity data
         * @private
         */
        _createFormFields: function(oMetadata, oEntityData) {
            // Clear form
            this._oForm.removeAllContent();
            this._oFormControls = {};
            
            // Get parent info
            var oParentInfo = this._oParams.parentInfo;
            
            // Process fields
            oMetadata.columns.forEach(function(oColumnMetadata) {
                // Skip fields that are not editable or primary key
                if (oColumnMetadata.editable === false || 
                    oColumnMetadata.name === oMetadata.primaryKey ||
                    oColumnMetadata.name === 'created_at' ||
                    oColumnMetadata.name === 'updated_at') {
                    return;
                }
                
                // Check if this is a parent foreign key
                var bIsParentForeignKey = oParentInfo && 
                    oColumnMetadata.name === oParentInfo.foreignKey;
                
                // Create label
                var oLabel = new Label({
                    text: oColumnMetadata.label,
                    required: oColumnMetadata.required === true
                });
                
                // Add label to form
                this._oForm.addContent(oLabel);
                
                // Create field
                var oField = this._createField(
                    oColumnMetadata, 
                    "/entity/" + oColumnMetadata.name, 
                    bIsParentForeignKey
                );
                
                // Add field to form
                this._oForm.addContent(oField);
                
                // Store field for validation
                this._oFormControls[oColumnMetadata.name] = oField;
            }.bind(this));
        },
        
        /**
         * Create a field based on column metadata
         * @param {Object} oColumnMetadata The column metadata
         * @param {string} sPath The binding path
         * @param {boolean} bIsParentForeignKey Whether this is a parent foreign key
         * @returns {sap.ui.core.Control} The created field
         * @private
         */
        _createField: function(oColumnMetadata, sPath, bIsParentForeignKey) {
            var oField;
            var sFieldName = oColumnMetadata.name;
            var bRequired = oColumnMetadata.required === true;
            
            // Value state binding
            var sValueState = "{= ${/validationErrors/" + sFieldName + "} ? 'Error' : 'None' }";
            var sValueStateText = "{/validationErrors/" + sFieldName + "}";
            
            // Create different controls based on field type
            switch (oColumnMetadata.type) {
                case "relation":
                    if (bIsParentForeignKey) {
                        // Show read-only text for parent relation
                        oField = new Input({
                            value: {
                                path: this._oParams.parentInfo.parentId
                            },
                            description: "Connected to parent " + this._oParams.parentInfo.parentTable,
                            editable: false
                        });
                    } else {
                        // Create combo box for relation
                        oField = new ComboBox({
                            selectedKey: {
                                path: sPath,
                                mode: "TwoWay"
                            },
                            valueState: sValueState,
                            valueStateText: sValueStateText,
                            width: "100%",
                            required: bRequired,
                            showSecondaryValues: true,
                            enabled: true
                        });
                        
                        // Load relation options
                        this._loadRelationOptions(
                            oField, 
                            oColumnMetadata.relation, 
                            bRequired
                        );
                    }
                    break;
                
                case "boolean":
                    oField = new CheckBox({
                        selected: {
                            path: sPath,
                            mode: "TwoWay"
                        },
                        enabled: true
                    });
                    break;
                    
                case "date":
                    oField = new DatePicker({
                        value: {
                            path: sPath,
                            mode: "TwoWay",
                            type: new sap.ui.model.type.Date({
                                pattern: "yyyy-MM-dd"
                            })
                        },
                        valueFormat: "yyyy-MM-dd",
                        displayFormat: "medium",
                        valueState: sValueState,
                        valueStateText: sValueStateText,
                        width: "100%",
                        required: bRequired,
                        change: this._createValidationHandler.bind(this, oColumnMetadata)
                    });
                    break;
                
                case "text":
                    oField = new TextArea({
                        value: {
                            path: sPath,
                            mode: "TwoWay"
                        },
                        valueState: sValueState,
                        valueStateText: sValueStateText,
                        rows: 3,
                        growing: true,
                        growingMaxLines: 10,
                        width: "100%",
                        required: bRequired
                    });
                    break;
                    
                case "number":
                    oField = new Input({
                        value: {
                            path: sPath,
                            mode: "TwoWay",
                            type: new sap.ui.model.type.Float({
                                minFractionDigits: 0,
                                maxFractionDigits: 2
                            })
                        },
                        type: "Number",
                        valueState: sValueState,
                        valueStateText: sValueStateText,
                        width: "100%",
                        required: bRequired,
                        liveChange: this._createValidationHandler.bind(this, oColumnMetadata)
                    });
                    break;
                
                case "email":
                    oField = new Input({
                        value: {
                            path: sPath,
                            mode: "TwoWay"
                        },
                        type: "Email",
                        valueState: sValueState,
                        valueStateText: sValueStateText,
                        width: "100%",
                        required: bRequired,
                        liveChange: this._createValidationHandler.bind(this, oColumnMetadata)
                    });
                    break;
                
                default:
                    // Default to string input
                    oField = new Input({
                        value: {
                            path: sPath,
                            mode: "TwoWay"
                        },
                        valueState: sValueState,
                        valueStateText: sValueStateText,
                        width: "100%",
                        required: bRequired,
                        liveChange: this._createValidationHandler.bind(this, oColumnMetadata)
                    });
            }
            
            return oField;
        },
        
        /**
         * Create a validation handler for a field
         * @param {Object} oColumnMetadata The column metadata
         * @returns {Function} The validation handler function
         * @private
         */
        _createValidationHandler: function(oColumnMetadata, oEvent) {
            var sFieldName = oColumnMetadata.name;
            var oField = oEvent.getSource();
            var sValue = oEvent.getParameter("value");
            
            // Get current validation errors
            var oValidationErrors = this._oDialogModel.getProperty("/validationErrors") || {};
            
            // Validate based on field type
            switch (oColumnMetadata.type) {
                case "number":
                    if (sValue && isNaN(parseFloat(sValue))) {
                        // Invalid number
                        oValidationErrors[sFieldName] = "Please enter a valid number";
                        oField.setValueState("Error");
                        oField.setValueStateText("Please enter a valid number");
                    } else {
                        // Valid
                        delete oValidationErrors[sFieldName];
                        oField.setValueState("None");
                    }
                    break;
                    
                case "email":
                    var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (sValue && !emailRegex.test(sValue)) {
                        // Invalid email
                        oValidationErrors[sFieldName] = "Please enter a valid email address";
                        oField.setValueState("Error");
                        oField.setValueStateText("Please enter a valid email address");
                    } else {
                        // Valid
                        delete oValidationErrors[sFieldName];
                        oField.setValueState("None");
                    }
                    break;
                    
                case "date":
                    var bValid = oEvent.getParameter("valid");
                    if (!bValid) {
                        // Invalid date
                        oValidationErrors[sFieldName] = "Please enter a valid date";
                        oField.setValueState("Error");
                        oField.setValueStateText("Please enter a valid date");
                    } else {
                        // Valid
                        delete oValidationErrors[sFieldName];
                        oField.setValueState("None");
                    }
                    break;
                    
                default:
                    // For required fields, check if empty
                    if (oColumnMetadata.required && (!sValue || sValue.trim() === "")) {
                        oValidationErrors[sFieldName] = "This field is required";
                        oField.setValueState("Error");
                        oField.setValueStateText("This field is required");
                    } else {
                        // Valid
                        delete oValidationErrors[sFieldName];
                        oField.setValueState("None");
                    }
            }
            
            // Update validation errors in the model
            this._oDialogModel.setProperty("/validationErrors", oValidationErrors);
        },
        
        /**
         * Load relation options for a ComboBox
         * @param {sap.m.ComboBox} oComboBox The ComboBox control
         * @param {string} sRelatedTable The related table name
         * @param {boolean} bRequired Whether the field is required
         * @private
         */
        _loadRelationOptions: function(oComboBox, sRelatedTable, bRequired) {
            // Get metadata for the related table
            this._oController.getTableMetadata(sRelatedTable)
                .then(function(oMetadata) {
                    // Get primary key and title field
                    var sPrimaryKey = oMetadata.primaryKey;
                    var sTitleField = oMetadata.titleField || sPrimaryKey;
                    
                    // Load data from the related table
                    this._oController.getSupabaseClient()
                        .from(sRelatedTable)
                        .select('*')
                        .then(function({ data, error }) {
                            if (error) {
                                console.error("Error loading relation options:", error);
                                return;
                            }
                            
                            // Clear existing items
                            oComboBox.removeAllItems();
                            
                            // Add empty item if not required
                            if (!bRequired) {
                                oComboBox.addItem(new Item({
                                    key: "",
                                    text: "- None -"
                                }));
                            }
                            
                            // Add items
                            if (data && data.length > 0) {
                                data.forEach(function(item) {
                                    oComboBox.addItem(new Item({
                                        key: item[sPrimaryKey],
                                        text: item[sTitleField]
                                    }));
                                });
                            }
                        });
                }.bind(this))
                .catch(function(error) {
                    console.error("Error getting metadata for relation:", error);
                });
        },
        
        /**
         * Validate the form
         * @returns {boolean} Whether the form is valid
         * @private
         */
        _validateForm: function() {
            // Get current entity data and metadata
            var oEntityData = this._oDialogModel.getProperty("/entity");
            var oMetadata = this._oParams.metadata;
            var oValidationErrors = {};
            var bValid = true;
            
            // Validate each field
            oMetadata.columns.forEach(function(oColumnMetadata) {
                // Skip fields that are not editable or primary key
                if (oColumnMetadata.editable === false || 
                    oColumnMetadata.name === oMetadata.primaryKey ||
                    oColumnMetadata.name === 'created_at' ||
                    oColumnMetadata.name === 'updated_at') {
                    return;
                }
                
                var sFieldName = oColumnMetadata.name;
                var vFieldValue = oEntityData[sFieldName];
                var oField = this._oFormControls[sFieldName];
                
                // Skip parent foreign key fields
                if (this._oParams.parentInfo && 
                    sFieldName === this._oParams.parentInfo.foreignKey) {
                    return;
                }
                
                // Check required fields
                if (oColumnMetadata.required === true && 
                    (vFieldValue === undefined || vFieldValue === null || vFieldValue === "")) {
                    bValid = false;
                    oValidationErrors[sFieldName] = "This field is required";
                    
                    if (oField && oField.setValueState) {
                        oField.setValueState("Error");
                        oField.setValueStateText("This field is required");
                    }
                    
                    console.log("Validation failed for", sFieldName, ": Required field is empty");
                } 
                // Validate field type
                else if (vFieldValue !== undefined && vFieldValue !== null && vFieldValue !== "") {
                    var bTypeValid = true;
                    var sErrorMessage = "";
                    
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
                            var oDate = new Date(vFieldValue);
                            if (isNaN(oDate.getTime())) {
                                bTypeValid = false;
                                sErrorMessage = "Please enter a valid date";
                            }
                            break;
                            
                        case "email":
                            // Basic email validation regex
                            var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                            if (!emailRegex.test(vFieldValue)) {
                                bTypeValid = false;
                                sErrorMessage = "Please enter a valid email address";
                            }
                            break;
                    }
                    
                    if (!bTypeValid) {
                        bValid = false;
                        oValidationErrors[sFieldName] = sErrorMessage;
                        
                        if (oField && oField.setValueState) {
                            oField.setValueState("Error");
                            oField.setValueStateText(sErrorMessage);
                        }
                        
                        console.log("Validation failed for", sFieldName, ":", sErrorMessage);
                    }
                }
            }.bind(this));
            
            // Update validation errors in the model
            this._oDialogModel.setProperty("/validationErrors", oValidationErrors);
            
            return bValid;
        },
        
        /**
         * Save handler
         * @private
         */
        _onSavePress: function() {
            // Get current entity data
            var oEntityData = this._oDialogModel.getProperty("/entity");
            var sTableId = this._oParams.tableId;
            var sEntityId = this._oParams.entityId;
            var sMode = this._oParams.mode;
            
            // Validate form
            if (!this._validateForm()) {
                MessageBox.error("Please correct the errors in the form");
                return;
            }
            
            // Set dialog to busy state
            this._oDialog.setBusy(true);
            
            // Prepare final data with parent relation if needed
            var oFinalData = Object.assign({}, oEntityData);
            
            // If we have parent info in create mode, set the foreign key
            if (sMode === "create" && this._oParams.parentInfo) {
                var sParentForeignKey = this._oParams.parentInfo.foreignKey;
                var sParentId = this._oParams.parentInfo.parentId;
                
                // Set the foreign key
                oFinalData[sParentForeignKey] = sParentId;
            }
            
            // Perform the operation based on mode
            if (sMode === "create") {
                // Create new entity
                this._oController.getSupabaseClient()
                    .from(sTableId)
                    .insert(oFinalData)
                    .then(({ data, error }) => {
                        this._oDialog.setBusy(false);
                        
                        if (error) {
                            console.error("Error creating entity:", error);
                            MessageBox.error("Error creating entity: " + error.message);
                            return;
                        }
                        
                        // Close dialog
                        this._oDialog.close();
                        
                        // Call success callback if provided
                        if (this._fnSuccessCallback) {
                            var createdEntity = data && data.length > 0 ? data[0] : oFinalData;
                            this._fnSuccessCallback(createdEntity);
                        }
                    })
                    .catch(error => {
                        this._oDialog.setBusy(false);
                        console.error("Error in Supabase query:", error);
                        MessageBox.error("Error creating entity: " + error.message);
                    });
            } 
            else if (sMode === "edit") {
                // Update existing entity
                var oMetadata = this._oParams.metadata;
                var sPrimaryKey = oMetadata.primaryKey;
                
                // Update entity
                this._oController.getSupabaseClient()
                    .from(sTableId)
                    .update(oFinalData)
                    .eq(sPrimaryKey, sEntityId)
                    .then(({ data, error }) => {
                        this._oDialog.setBusy(false);
                        
                        if (error) {
                            console.error("Error updating entity:", error);
                            MessageBox.error("Error updating entity: " + error.message);
                            return;
                        }
                        
                        // Close dialog
                        this._oDialog.close();
                        
                        // Call success callback if provided
                        if (this._fnSuccessCallback) {
                            var updatedEntity = data && data.length > 0 ? data[0] : oFinalData;
                            this._fnSuccessCallback(updatedEntity);
                        }
                    })
                    .catch(error => {
                        this._oDialog.setBusy(false);
                        console.error("Error in Supabase query:", error);
                        MessageBox.error("Error updating entity: " + error.message);
                    });
            }
        },
        
        /**
         * Cancel handler
         * @private
         */
        _onCancelPress: function() {
            // Check if there are unsaved changes
            if (this._hasChanges()) {
                MessageBox.confirm(
                    "Are you sure you want to discard your changes?",
                    {
                        title: "Discard Changes",
                        onClose: function(sAction) {
                            if (sAction === MessageBox.Action.OK) {
                                this._oDialog.close();
                            }
                        }.bind(this)
                    }
                );
            } else {
                this._oDialog.close();
            }
        },
        
        /**
         * After close handler
         * @private
         */
        _onAfterClose: function() {
            // Call cancel callback if provided
            if (this._fnCancelCallback) {
                this._fnCancelCallback();
            }
        },
        
        /**
         * Destroy the dialog
         * @public
         */
        destroy: function() {
            if (this._oDialog) {
                this._oDialog.destroy();
                this._oDialog = null;
            }
            
            this._oFormControls = {};
            this._oForm = null;
            this._fnSuccessCallback = null;
            this._fnCancelCallback = null;
        }
    });
});