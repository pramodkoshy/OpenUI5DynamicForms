sap.ui.define([
    "sap/ui/core/mvc/ControllerExtension"
], function(ControllerExtension) {
    "use strict";

    return ControllerExtension.extend("com.supabase.easyui5.controller.EntityCreateForm", {
        /**
         * Configure the form for creating a new entity
         * @param {Object} oMetadata The table metadata
         * @private
         */
        _configureForm: function(oMetadata) {
            console.log("EntityCreateForm - Configuring create form with metadata:", oMetadata);
            
            // Get form container
            const oFormContainer = this.getView().byId("entityCreateContainer");
            
            if (!oFormContainer) {
                console.error("EntityCreateForm - Form container not found");
                return;
            }
            
            // Clear existing form elements
            oFormContainer.removeAllFormElements();
            
            // Get view model
            const oViewModel = this.getModel("viewModel");
            const oEntityData = oViewModel.getProperty("/entity");
            const oParentInfo = oViewModel.getProperty("/parentInfo");
            
            // Process each column in metadata
            oMetadata.columns.forEach((oColumnMetadata) => {
                // Skip system-generated or non-creatable columns
                if (oColumnMetadata.editable === false || 
                    oColumnMetadata.name === oMetadata.primaryKey) {
                    return;
                }
                
                // Create form element
                const oFormElement = new sap.ui.layout.form.FormElement({
                    label: new sap.m.Label({
                        text: oColumnMetadata.label,
                        required: oColumnMetadata.required === true
                    })
                });
                
                const sPath = "viewModel>/entity/" + oColumnMetadata.name;
                let oControl;
                
                // Check if this is a parent foreign key
                const bIsParentForeignKey = oParentInfo && 
                    oColumnMetadata.name === oParentInfo.foreignKey;
                
                // Create control based on column type
                if (oColumnMetadata.type === "relation") {
                    if (bIsParentForeignKey) {
                        // If this is the parent foreign key, show read-only text
                        oControl = new sap.m.Text({
                            text: `Connected to parent ${oParentInfo.parentTable} (ID: ${oParentInfo.parentId})`
                        });
                    } else {
                        // ComboBox for relations
                        oControl = new sap.m.ComboBox({
                            selectedKey: {
                                path: sPath
                            },
                            width: "100%",
                            required: oColumnMetadata.required
                        });
                        
                        // Load relation options
                        this._loadRelationOptions(
                            oControl, 
                            oColumnMetadata.relation, 
                            oColumnMetadata.name
                        );
                    }
                } else if (oColumnMetadata.type === "boolean") {
                    oControl = new sap.m.CheckBox({
                        selected: {
                            path: sPath
                        },
                        width: "100%"
                    });
                } else if (oColumnMetadata.type === "date") {
                    oControl = new sap.m.DatePicker({
                        value: {
                            path: sPath,
                            type: new sap.ui.model.type.Date({
                                pattern: "yyyy-MM-dd"
                            })
                        },
                        valueFormat: "yyyy-MM-dd",
                        displayFormat: "mediumDate",
                        width: "100%",
                        required: oColumnMetadata.required
                    });
                } else if (oColumnMetadata.type === "number") {
                    oControl = new sap.m.Input({
                        value: {
                            path: sPath,
                            type: new sap.ui.model.type.Float({
                                decimals: 2
                            })
                        },
                        type: "Number",
                        width: "100%",
                        required: oColumnMetadata.required
                    });
                } else if (oColumnMetadata.type === "text") {
                    oControl = new sap.m.TextArea({
                        value: {
                            path: sPath
                        },
                        rows: 3,
                        width: "100%",
                        required: oColumnMetadata.required
                    });
                } else {
                    // Default to standard Input
                    oControl = new sap.m.Input({
                        value: {
                            path: sPath
                        },
                        width: "100%",
                        required: oColumnMetadata.required
                    });
                }
                
                // Add field to form element
                oFormElement.addField(oControl);
                
                // Add form element to container
                oFormContainer.addFormElement(oFormElement);
            });

            console.log("EntityCreateForm - Create form configuration complete");
        },
        
        /**
         * Load options for relation fields
         * @param {sap.m.ComboBox} oComboBox The ComboBox control
         * @param {string} sRelatedTable The related table
         * @param {string} sFieldName The field name
         * @private
         */
        _loadRelationOptions: function(oComboBox, sRelatedTable, sFieldName) {
            console.log(`EntityCreateForm - Loading relation options for ${sRelatedTable}`);
            
            // Get reference to the controller's method
            const fnGetTableMetadata = this.getView().getController().getTableMetadata;
            const fnGetSupabaseClient = this.getView().getController().getSupabaseClient;
            
            // Get metadata for related table
            fnGetTableMetadata.call(this.getView().getController(), sRelatedTable)
                .then(function(oMetadata) {
                    const sPrimaryKey = oMetadata.primaryKey;
                    const sTitleField = oMetadata.titleField || sPrimaryKey;
                    
                    // Load related entities
                    fnGetSupabaseClient.call(this.getView().getController())
                        .from(sRelatedTable)
                        .select('*')
                        .then(({ data, error }) => {
                            if (error) {
                                console.error("EntityCreateForm - Error loading relation options", error);
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
        }
    });
});