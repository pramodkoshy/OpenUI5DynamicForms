sap.ui.define([
    "sap/ui/core/mvc/ControllerExtension"
], function(ControllerExtension) {
    "use strict";

    return ControllerExtension.extend("com.supabase.easyui5.controller.EntityDetailForm", {
        /**
         * Configure the form based on entity metadata
         * @param {Object} oMetadata The table metadata
         * @param {Object} oEntityData The entity data
         * @private
         */
        _configureForm: function(oMetadata, oEntityData) {
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
            
            // Add form elements based on metadata
            oMetadata.columns.forEach((oColumnMetadata) => {
                // Skip hidden columns
                if (!oColumnMetadata.visible) {
                    return;
                }
                
                // Create form element
                const oFormElement = new sap.ui.layout.form.FormElement({
                    label: new sap.m.Label({
                        text: oColumnMetadata.label,
                        required: bEditMode && oColumnMetadata.required
                    })
                });
                
                // Determine the control based on column type and edit mode
                let oField;
                const sPath = "viewModel>/entity/" + oColumnMetadata.name;
                
                if (oColumnMetadata.type === "relation") {
                    // Relation fields
                    if (bEditMode) {
                        // In edit mode, show a ComboBox
                        oField = new sap.m.ComboBox({
                            selectedKey: {
                                path: sPath,
                                mode: 'TwoWay'
                            },
                            width: "100%",
                            enabled: !(oColumnMetadata.editable === false)
                        });
                        
                        // Load relation options
                        this._loadRelationOptions(
                            oField, 
                            oColumnMetadata.relation, 
                            oColumnMetadata.name
                        );
                    } else {
                        // In view mode, show text
                        const sRelatedText = oEntityData[oColumnMetadata.name + "_text"] 
                                             || oEntityData[oColumnMetadata.name];
                        
                        oField = new sap.m.Text({
                            text: sRelatedText || ""
                        });
                    }
                } else if (oColumnMetadata.type === "boolean") {
                    // Boolean fields
                    if (bEditMode) {
                        oField = new sap.m.CheckBox({
                            selected: {
                                path: sPath,
                                mode: 'TwoWay'
                            },
                            enabled: !(oColumnMetadata.editable === false)
                        });
                    } else {
                        oField = new sap.m.Text({
                            text: oEntityData[oColumnMetadata.name] ? "Yes" : "No"
                        });
                    }
                } else if (oColumnMetadata.type === "date") {
                    // Date fields
                    if (bEditMode) {
                        oField = new sap.m.DatePicker({
                            value: {
                                path: sPath,
                                mode: 'TwoWay',
                                type: new sap.ui.model.type.Date({
                                    pattern: "yyyy-MM-dd"
                                })
                            },
                            valueFormat: "yyyy-MM-dd",
                            displayFormat: "mediumDate",
                            enabled: !(oColumnMetadata.editable === false)
                        });
                    } else {
                        oField = new sap.m.Text({
                            text: oEntityData[oColumnMetadata.name] 
                                ? new Date(oEntityData[oColumnMetadata.name]).toLocaleDateString() 
                                : ""
                        });
                    }
                } else if (oColumnMetadata.type === "number") {
                    // Number fields
                    if (bEditMode) {
                        oField = new sap.m.Input({
                            value: {
                                path: sPath,
                                mode: 'TwoWay',
                                type: new sap.ui.model.type.Float({
                                    decimals: 2
                                })
                            },
                            type: "Number",
                            enabled: !(oColumnMetadata.editable === false)
                        });
                    } else {
                        oField = new sap.m.Text({
                            text: oEntityData[oColumnMetadata.name] !== undefined 
                                ? parseFloat(oEntityData[oColumnMetadata.name]).toFixed(2) 
                                : ""
                        });
                    }
                } else if (oColumnMetadata.type === "text") {
                    // Text/Textarea fields
                    if (bEditMode) {
                        oField = new sap.m.TextArea({
                            value: {
                                path: sPath,
                                mode: 'TwoWay'
                            },
                            rows: 3,
                            width: "100%",
                            enabled: !(oColumnMetadata.editable === false)
                        });
                    } else {
                        oField = new sap.m.Text({
                            text: oEntityData[oColumnMetadata.name] || ""
                        });
                    }
                } else {
                    // Default to Input/Text for string fields
                    if (bEditMode) {
                        oField = new sap.m.Input({
                            value: {
                                path: sPath,
                                mode: 'TwoWay'
                            },
                            enabled: !(oColumnMetadata.editable === false)
                        });
                    } else {
                        oField = new sap.m.Text({
                            text: oEntityData[oColumnMetadata.name] || ""
                        });
                    }
                }
                
                // Add field to form element
                oFormElement.addField(oField);
                
                // Add form element to container
                oFormContainer.addFormElement(oFormElement);
            });
            
            console.log("Form configuration complete");
        }
    });
});