sap.ui.define([
    "sap/ui/core/mvc/ControllerExtension"
], function(ControllerExtension) {
    "use strict";

    return ControllerExtension.extend("com.supabase.easyui5.controller.EntityValidation", {
        /**
         * Validate form data with improved error handling
         * @param {Object} oMetadata The table metadata
         * @param {Object} oEntityData The entity data
         * @returns {boolean} True if validation passes, false otherwise
         * @public
         */
        validateForm: function(oMetadata, oEntityData) {
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
         * Reset error states on all form fields
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
        }
    });
});