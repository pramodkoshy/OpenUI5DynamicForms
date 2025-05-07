sap.ui.define([
    "sap/ui/core/mvc/ControllerExtension",
    "sap/m/Column",
    "sap/m/Label",
    "sap/m/Text",
    "sap/m/ColumnListItem",
    "sap/m/HBox",
    "sap/m/Button",
    "sap/m/Dialog",
    "sap/m/MessageBox"
], function(
    ControllerExtension,
    Column,
    Label,
    Text,
    ColumnListItem,
    HBox,
    Button,
    Dialog,
    MessageBox
) {
    "use strict";

    return ControllerExtension.extend("com.supabase.easyui5.controller.EntityDetailRelatedItems", {
        
     
        
        /**
         * Process relation fields in related items
         * @param {string} sTableId The table ID
         * @param {Array} aItems The items array
         * @returns {Promise} A promise resolving with processed items
         * @private 
         */
        _processRelatedItemsRelations: function(sTableId, aItems) {
            if (!aItems || aItems.length === 0) {
                return Promise.resolve(aItems);
            }
            
            console.log("🔍 RELATED DEBUG: Processing relations for", aItems.length, "items");
            
            // Use a promise to handle async operations
            return this.getTableMetadata(sTableId)
                .then(oMetadata => {
                    // Find relation columns
                    const aRelationColumns = oMetadata.columns.filter(col => col.type === "relation");
                    
                    if (aRelationColumns.length === 0) {
                        return aItems;
                    }
                    
                    console.log("🔍 RELATED DEBUG: Found", aRelationColumns.length, "relation columns");
                    
                    // Process each relation column with promise chain
                    const processPromises = aItems.map(oItem => {
                        const relationPromises = aRelationColumns
                            .filter(oColumn => oItem[oColumn.name])
                            .map(oColumn => {
                                const relatedId = oItem[oColumn.name];
                                const relatedTable = oColumn.relation;
                                
                                console.log(`🔍 RELATED DEBUG: Processing relation ${oColumn.name} -> ${relatedTable} (ID: ${relatedId})`);
                                
                                return this.getTableMetadata(relatedTable)
                                    .then(relatedMetadata => {
                                        const sPrimaryKey = relatedMetadata.primaryKey;
                                        const sTitleField = relatedMetadata.titleField || sPrimaryKey;
                                        
                                        return this.getSupabaseClient()
                                            .from(relatedTable)
                                            .select('*')
                                            .eq(sPrimaryKey, relatedId)
                                            .single()
                                            .then(({ data: relatedData, error: relatedError }) => {
                                                if (!relatedError && relatedData) {
                                                    // Store related text
                                                    oItem[oColumn.name + "_text"] = 
                                                        relatedData[sTitleField] || relatedData[sPrimaryKey];
                                                    console.log(`🔍 RELATED DEBUG: Loaded related text: ${oItem[oColumn.name + "_text"]}`);
                                                } else if (relatedError) {
                                                    console.error(`🔍 RELATED DEBUG: Error loading related data:`, relatedError);
                                                    // Set a fallback text
                                                    oItem[oColumn.name + "_text"] = `ID: ${relatedId}`;
                                                }
                                                return oItem;
                                            })
                                            .catch(e => {
                                                console.error("🔍 RELATED DEBUG: Error processing relation in related item", e);
                                                // Set a fallback text
                                                oItem[oColumn.name + "_text"] = `ID: ${relatedId}`;
                                                return oItem;
                                            });
                                    });
                            });
                        
                        // If there are no relation promises, just return the item
                        if (relationPromises.length === 0) {
                            return Promise.resolve(oItem);
                        }
                        
                        // Otherwise, wait for all relation promises to complete
                        return Promise.all(relationPromises).then(() => oItem);
                    });
                    
                    return Promise.all(processPromises)
                        .then(processedItems => {
                            console.log("🔍 RELATED DEBUG: Completed processing relations for all items");
                            return processedItems;
                        });
                })
                .catch(e => {
                    console.error("🔍 RELATED DEBUG: Error processing relations in related items", e);
                    return aItems;
                });
        },
    
                /**
         * Handler for related items search
         * @param {sap.ui.base.Event} oEvent The search event
         * @public
         */
        onRelatedItemsSearch: function(oEvent) {
            const sQuery = oEvent.getParameter("query") || oEvent.getParameter("newValue") || "";
            const oViewModel = this.getModel("viewModel");
            const aAllItems = oViewModel.getProperty("/relatedItems") || [];
            
            // If no query, show all items
            if (!sQuery) {
                oViewModel.setProperty("/filteredRelatedItems", aAllItems);
                return;
            }
            
            // Filter items
            const sQueryLower = sQuery.toLowerCase();
            const aFilteredItems = aAllItems.filter(item => {
                // Search in all properties
                return Object.values(item).some(value => {
                    if (value === null || value === undefined) {
                        return false;
                    }
                    
                    return String(value).toLowerCase().includes(sQueryLower);
                });
            });
            
            oViewModel.setProperty("/filteredRelatedItems", aFilteredItems);
            console.log(`🔍 RELATED DEBUG: Filtered related items to ${aFilteredItems.length} of ${aAllItems.length} total`);
        },

        /**
         * Handler for related item press
         * @param {sap.ui.base.Event} oEvent The item press event
         * @public
         */
        onRelatedItemPress: function(oEvent) {
            const oItem = oEvent.getSource();
            const oContext = oItem.getBindingContext("viewModel");
            
            if (!oContext) {
                console.error("No binding context found for related item");
                return;
            }
            
            const oData = oContext.getObject();
            const oViewModel = this.getModel("viewModel");
            const sTableId = oViewModel.getProperty("/tableId");
            
            console.log("Item pressed:", oData);
            
            this.getTableMetadata(sTableId).then(oMetadata => {
                if (!oMetadata.relations || oMetadata.relations.length === 0) {
                    console.error("No relations defined for navigation");
                    return;
                }
                
                const oRelation = oMetadata.relations[0];
                
                this.getTableMetadata(oRelation.table).then(oRelatedMetadata => {
                    const sPrimaryKey = oRelatedMetadata.primaryKey;
                    const sPrimaryKeyValue = oData[sPrimaryKey];
                    
                    console.log(`Navigating to related item details: ${oRelation.table}/${sPrimaryKeyValue}`);
                    
                    // Navigate to detail view of related item
                    this.getRouter().navTo("entityDetail", {
                        table: oRelation.table,
                        id: sPrimaryKeyValue
                    });
                });
            });
        },
        
        /**
         * Handler for delete related item press with improved event handling
         * @param {sap.ui.base.Event} oEvent The button press event
         * @public
         */
        onDeleteRelatedItemPress: function(oEvent) {
            // First, explicitly stop the event propagation to prevent any navigation
            oEvent.preventDefault();
            oEvent.stopPropagation();
            
            // Get the button that was pressed
            const oButton = oEvent.getSource();
            
            // Get the list item from the button's parent's parent
            const oItem = oButton.getParent().getParent();
            
            // Get the binding context
            const oContext = oItem.getBindingContext("viewModel");
            if (!oContext) {
                console.error("No binding context found for related item");
                return;
            }
            
            const oData = oContext.getObject();
            const oViewModel = this.getModel("viewModel");
            const sTableId = oViewModel.getProperty("/tableId");
            
            console.log("Delete related item:", oData);
            
            // Get metadata for the current table
            this.getTableMetadata(sTableId).then((oMetadata) => {
                // Get the first relation
                if (!oMetadata.relations || oMetadata.relations.length === 0) {
                    console.error("No relations defined in metadata");
                    return;
                }
                
                const oRelation = oMetadata.relations[0];
                
                // Get metadata for related table
                this.getTableMetadata(oRelation.table).then((oRelatedMetadata) => {
                    const sPrimaryKey = oRelatedMetadata.primaryKey;
                    const sPrimaryKeyValue = oData[sPrimaryKey];
                    
                    console.log(`Confirming deletion of related item: ${oRelation.table}/${sPrimaryKeyValue}`);
                    
                    // Confirm deletion
                    sap.m.MessageBox.confirm(
                        "Are you sure you want to delete this related item?",
                        {
                            title: "Delete Confirmation",
                            onClose: function(sAction) {
                                if (sAction === sap.m.MessageBox.Action.OK) {
                                    console.log(`Deleting related item: ${oRelation.table}/${sPrimaryKeyValue}`);
                                    
                                    // Show busy state
                                    oViewModel.setProperty("/busy", true);
                                    
                                    // Delete related item
                                    this.getSupabaseClient()
                                        .from(oRelation.table)
                                        .delete()
                                        .eq(sPrimaryKey, sPrimaryKeyValue)
                                        .then(({ error }) => {
                                            oViewModel.setProperty("/busy", false);
                                            
                                            if (error) {
                                                console.error("Error deleting related item:", error);
                                                sap.m.MessageBox.error("Error deleting related item: " + error.message);
                                                return;
                                            }
                                            
                                            console.log("Related item deleted successfully");
                                            
                                            // Create a copy of the current related items
                                            const aCurrentItems = [...oViewModel.getProperty("/relatedItems")];
                                            const aFilteredItems = [...oViewModel.getProperty("/filteredRelatedItems")];
                                            
                                            // Remove the deleted item from both arrays
                                            const iItemIndex = aCurrentItems.findIndex(item => item[sPrimaryKey] === sPrimaryKeyValue);
                                            if (iItemIndex !== -1) {
                                                aCurrentItems.splice(iItemIndex, 1);
                                                oViewModel.setProperty("/relatedItems", aCurrentItems);
                                            }
                                            
                                            const iFilteredIndex = aFilteredItems.findIndex(item => item[sPrimaryKey] === sPrimaryKeyValue);
                                            if (iFilteredIndex !== -1) {
                                                aFilteredItems.splice(iFilteredIndex, 1);
                                                oViewModel.setProperty("/filteredRelatedItems", aFilteredItems);
                                            }
                                            
                                            // Show success message
                                            sap.m.MessageToast.show("Related item deleted successfully");
                                        })
                                        .catch(error => {
                                            oViewModel.setProperty("/busy", false);
                                            console.error("Error in delete operation:", error);
                                            sap.m.MessageBox.error("Error deleting related item: " + error.message);
                                        });
                                }
                            }.bind(this)
                        }
                    );
                });
            });
        },
    // Add this method to the EntityDetailRelatedItems.controller.js file

        /**
         * Handler for add related item press using modal dialog
         * @public
         */
        onAddRelatedItemPress: function() {
            console.log("Add related item button pressed");
            
            const oViewModel = this.getModel("viewModel");
            const sTableId = oViewModel.getProperty("/tableId");
            const sEntityId = oViewModel.getProperty("/entityId");
            
            console.log(`Adding related item for parent entity ${sTableId}/${sEntityId}`);
            
            // Get metadata for the current table
            this.getTableMetadata(sTableId).then((oMetadata) => {
                // Get the first relation
                if (!oMetadata.relations || oMetadata.relations.length === 0) {
                    console.error("No relations defined in metadata");
                    sap.m.MessageBox.error("No relations defined for this entity");
                    return;
                }
                
                const oRelation = oMetadata.relations[0];
                const sRelatedTableId = oRelation.table;
                
                console.log(`Creating dialog for new ${sRelatedTableId} related to ${sTableId}/${sEntityId}`);
                
                // Get metadata for related table
                this.getTableMetadata(sRelatedTableId).then((oRelatedMetadata) => {
                    // Create a new entity object with default values
                    const oNewEntity = {};
                    
                    // Initialize with default values
                    oRelatedMetadata.columns.forEach((oColumnMetadata) => {
                        if (oColumnMetadata.name === oRelation.foreignKey) {
                            // Set the foreign key to parent entity
                            oNewEntity[oColumnMetadata.name] = sEntityId;
                        } else if (oColumnMetadata.type === "boolean") {
                            oNewEntity[oColumnMetadata.name] = false;
                        } else if (oColumnMetadata.type === "number") {
                            oNewEntity[oColumnMetadata.name] = 0;
                        } else if (oColumnMetadata.type === "date") {
                            oNewEntity[oColumnMetadata.name] = new Date().toISOString().split('T')[0];
                        } else {
                            oNewEntity[oColumnMetadata.name] = "";
                        }
                    });
                    
                    // Create a dialog model
                    const oDialogModel = new sap.ui.model.json.JSONModel({
                        entity: oNewEntity,
                        validationErrors: {},
                        title: `Add New ${oRelatedMetadata.titleField ? oRelatedMetadata.titleField : "Related Item"}`,
                        busy: false
                    });
                    
                    // Create a simple form for the dialog
                    const oForm = new sap.ui.layout.form.SimpleForm({
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
                    
                    // Form fields collection for validation
                    const formFields = {};
                    
                    // Add form fields based on metadata
                    oRelatedMetadata.columns.forEach((oColumnMetadata) => {
                        // Skip fields that are not editable or primary key
                        if (oColumnMetadata.editable === false || 
                            oColumnMetadata.name === oRelatedMetadata.primaryKey ||
                            oColumnMetadata.name === 'created_at' ||
                            oColumnMetadata.name === 'updated_at') {
                            return;
                        }
                        
                        // Check if this is the foreign key field connecting to the parent
                        const bIsParentForeignKey = oColumnMetadata.name === oRelation.foreignKey;
                        if (bIsParentForeignKey) {
                            // Show read-only field for parent relation
                            oForm.addContent(new sap.m.Label({
                                text: oColumnMetadata.label,
                                required: oColumnMetadata.required
                            }));
                            
                            oForm.addContent(new sap.m.Text({
                                text: `Connected to ${oViewModel.getProperty("/tableName")} (ID: ${sEntityId})`
                            }));
                            
                            return;
                        }
                        
                        // Create label
                        oForm.addContent(new sap.m.Label({
                            text: oColumnMetadata.label,
                            required: oColumnMetadata.required === true
                        }));
                        
                        // Create appropriate control based on field type
                        let oControl;
                        
                        switch (oColumnMetadata.type) {
                            case "relation":
                                oControl = new sap.m.ComboBox({
                                    selectedKey: "{/entity/" + oColumnMetadata.name + "}",
                                    width: "100%",
                                    enabled: true,
                                    valueState: "{= ${/validationErrors/" + oColumnMetadata.name + "} ? 'Error' : 'None' }",
                                    valueStateText: "{/validationErrors/" + oColumnMetadata.name + "}"
                                });
                                
                                // Load relation options
                                this._loadRelationOptionsForDialog(
                                    oControl, 
                                    oColumnMetadata.relation,
                                    oColumnMetadata.required
                                );
                                break;
                                
                            case "boolean":
                                oControl = new sap.m.CheckBox({
                                    selected: "{/entity/" + oColumnMetadata.name + "}"
                                });
                                break;
                                
                            case "date":
                                oControl = new sap.m.DatePicker({
                                    value: {
                                        path: "/entity/" + oColumnMetadata.name,
                                        type: new sap.ui.model.type.Date({
                                            pattern: "yyyy-MM-dd"
                                        })
                                    },
                                    valueFormat: "yyyy-MM-dd",
                                    displayFormat: "medium",
                                    width: "100%",
                                    required: oColumnMetadata.required === true,
                                    valueState: "{= ${/validationErrors/" + oColumnMetadata.name + "} ? 'Error' : 'None' }",
                                    valueStateText: "{/validationErrors/" + oColumnMetadata.name + "}"
                                });
                                break;
                                
                            case "number":
                                oControl = new sap.m.Input({
                                    value: {
                                        path: "/entity/" + oColumnMetadata.name,
                                        type: new sap.ui.model.type.Float({
                                            minFractionDigits: 0,
                                            maxFractionDigits: 2
                                        })
                                    },
                                    type: "Number",
                                    width: "100%",
                                    required: oColumnMetadata.required === true,
                                    valueState: "{= ${/validationErrors/" + oColumnMetadata.name + "} ? 'Error' : 'None' }",
                                    valueStateText: "{/validationErrors/" + oColumnMetadata.name + "}"
                                });
                                break;
                                
                            case "email":
                                oControl = new sap.m.Input({
                                    value: "{/entity/" + oColumnMetadata.name + "}",
                                    type: "Email",
                                    width: "100%",
                                    required: oColumnMetadata.required === true,
                                    valueState: "{= ${/validationErrors/" + oColumnMetadata.name + "} ? 'Error' : 'None' }",
                                    valueStateText: "{/validationErrors/" + oColumnMetadata.name + "}"
                                });
                                break;
                                
                            case "text":
                                oControl = new sap.m.TextArea({
                                    value: "{/entity/" + oColumnMetadata.name + "}",
                                    rows: 3,
                                    growing: true,
                                    width: "100%",
                                    required: oColumnMetadata.required === true,
                                    valueState: "{= ${/validationErrors/" + oColumnMetadata.name + "} ? 'Error' : 'None' }",
                                    valueStateText: "{/validationErrors/" + oColumnMetadata.name + "}"
                                });
                                break;
                                
                            default:
                                oControl = new sap.m.Input({
                                    value: "{/entity/" + oColumnMetadata.name + "}",
                                    width: "100%",
                                    required: oColumnMetadata.required === true,
                                    valueState: "{= ${/validationErrors/" + oColumnMetadata.name + "} ? 'Error' : 'None' }",
                                    valueStateText: "{/validationErrors/" + oColumnMetadata.name + "}"
                                });
                        }
                        
                        // Add the control to the form
                        oForm.addContent(oControl);
                        
                        // Store for validation
                        formFields[oColumnMetadata.name] = oControl;
                    });
                    
                    // Create the dialog
                    const oDialog = new sap.m.Dialog({
                        title: "{/title}",
                        contentWidth: "40rem",
                        contentHeight: "auto",
                        resizable: true,
                        draggable: true,
                        stretch: sap.ui.Device.system.phone,
                        content: [oForm],
                        beginButton: new sap.m.Button({
                            text: "Create",
                            type: "Emphasized",
                            press: function() {
                                // Validate form data
                                const bValid = this._validateDialogForm(oRelatedMetadata, oDialogModel.getProperty("/entity"), formFields);
                                
                                if (!bValid) {
                                    sap.m.MessageToast.show("Please correct the errors in the form");
                                    return;
                                }
                                
                                // Set dialog to busy state
                                oDialogModel.setProperty("/busy", true);
                                
                                // Get form data
                                const oEntityData = oDialogModel.getProperty("/entity");
                                
                                // Make sure the foreign key to parent is set
                                oEntityData[oRelation.foreignKey] = sEntityId;
                                
                                // Create the entity
                                this.getSupabaseClient()
                                    .from(sRelatedTableId)
                                    .insert(oEntityData)
                                    .then(({ data, error }) => {
                                        oDialogModel.setProperty("/busy", false);
                                        
                                        if (error) {
                                            console.error("Error creating related item:", error);
                                            sap.m.MessageBox.error("Error creating related item: " + error.message);
                                            return;
                                        }
                                        
                                        // Close the dialog
                                        oDialog.close();
                                        
                                        // Show success message
                                        sap.m.MessageToast.show("Related item created successfully");
                                        
                                        // Refresh the related items
                                        this._loadRelatedItems(oMetadata, oViewModel.getProperty("/entity"));
                                    })
                                    .catch(error => {
                                        oDialogModel.setProperty("/busy", false);
                                        console.error("Error in Supabase query:", error);
                                        sap.m.MessageBox.error("Error creating related item: " + error.message);
                                    });
                            }.bind(this)
                        }),
                        endButton: new sap.m.Button({
                            text: "Cancel",
                            press: function() {
                                oDialog.close();
                            }
                        }),
                        afterClose: function() {
                            oDialog.destroy();
                        }
                    });
                    
                    // Set the model on the dialog
                    oDialog.setModel(oDialogModel);
                    
                    // Add the dialog to the view for lifecycle management
                    this.getView().addDependent(oDialog);
                    
                    // Open the dialog
                    oDialog.open();
                });
            });
        },

        /**
         * Improved handler for edit related item press with proper parent info storage
         */
        onEditRelatedItemPress: function(oEvent) {
            // First, explicitly stop the event propagation to prevent any navigation
            oEvent.preventDefault();
            oEvent.stopPropagation();
            
            // Get the button that was pressed
            const oButton = oEvent.getSource();
            
            // Get the list item from the button's parent's parent (HBox -> Cell -> ListItem)
            const oItem = oButton.getParent().getParent().getParent();
            
            // Get the binding context
            const oContext = oItem.getBindingContext("viewModel");
            if (!oContext) {
                console.error("No binding context found for related item");
                return;
            }
            
            // Get the item data
            const oData = oContext.getObject();
            
            // Get view model and parent table ID
            const oViewModel = this.getModel("viewModel");
            const sTableId = oViewModel.getProperty("/tableId");
            const sEntityId = oViewModel.getProperty("/entityId");
            
            console.log("Editing related item:", JSON.stringify(oData, null, 2));
            console.log("Parent entity:", sTableId, sEntityId);
            
            // Get the related table ID from the current table's relations
            this.getTableMetadata(sTableId).then((oMetadata) => {
                // Check if relations are defined
                if (!oMetadata.relations || oMetadata.relations.length === 0) {
                    console.error("No relations defined in metadata");
                    MessageBox.error("No relations defined for this entity");
                    return;
                }
                
                // Get the first relation (related table info)
                const oRelation = oMetadata.relations[0];
                const sRelatedTableId = oRelation.table;
                
                console.log(`Relation found: ${sRelatedTableId} with foreign key ${oRelation.foreignKey}`);
                
                // Get metadata for related table
                this.getTableMetadata(sRelatedTableId).then((oRelatedMetadata) => {
                    // Get primary key for related table
                    const sPrimaryKey = oRelatedMetadata.primaryKey;
                    const sPrimaryKeyValue = oData[sPrimaryKey];
                    
                    console.log(`Related item primary key: ${sPrimaryKey}, value: ${sPrimaryKeyValue}`);
                    
                    // **IMPORTANT** - Store parent entity info for back navigation
                    const oParentInfo = {
                        parentTable: sTableId,
                        parentId: sEntityId,
                        isEditing: true, // Flag to indicate we're editing a related item
                        foreignKey: oRelation.foreignKey // Store the foreign key for reference
                    };
                    
                    console.log("Storing parent info in session storage:", JSON.stringify(oParentInfo, null, 2));
                    sessionStorage.setItem("parentEntityInfo", JSON.stringify(oParentInfo));
                    
                    // Navigate to the detail view of the related item
                    this.getRouter().navTo("entityDetail", {
                        table: sRelatedTableId,
                        id: sPrimaryKeyValue
                    });
                });
            });
        },


        /**
         * Configure related items table with dialog editing support
         * @param {string} sTableId The table ID
         * @public
         */
        _configureRelatedItemsTable: function(sTableId) {
            console.log("🔍 TABLE DEBUG: Started _configureRelatedItemsTable for table:", sTableId);
            
            try {
                const oTable = this.getView().byId("relatedItemsTable");
                
                if (!oTable) {
                    console.error("🔍 TABLE DEBUG: Related items table not found in the view! Check ID in XML");
                    return;
                }
                
                // Clear existing columns
                oTable.removeAllColumns();
                console.log("🔍 TABLE DEBUG: Removed all columns");
                
                this.getTableMetadata(sTableId)
                    .then(oMetadata => {
                        console.log("🔍 TABLE DEBUG: Got metadata for table", sTableId);
                        
                        // Add columns based on visible fields (limit to 5)
                        const aVisibleColumns = oMetadata.columns.filter(col => col.visible).slice(0, 5);
                        console.log("🔍 TABLE DEBUG: Visible columns:", aVisibleColumns.length);
                        
                        aVisibleColumns.forEach((oColumnMetadata, index) => {
                            console.log(`🔍 TABLE DEBUG: Adding column ${index+1}:`, oColumnMetadata.name);
                            oTable.addColumn(new sap.m.Column({
                                header: new sap.m.Label({ text: oColumnMetadata.label })
                            }));
                        });
                        
                        // Add actions column for edit/delete buttons
                        console.log("🔍 TABLE DEBUG: Adding actions column");
                        oTable.addColumn(new sap.m.Column({
                            header: new sap.m.Label({ text: "Actions" }),
                            hAlign: "Right"
                        }));
                        
                        console.log("🔍 TABLE DEBUG: Finished adding columns, total:", oTable.getColumns().length);
                        
                        // CRUCIAL CHANGE: Set table to non-navigation mode
                        oTable.setMode("None");
                        
                        // Create the template for the items binding
                        console.log("🔍 TABLE DEBUG: Creating template for binding");
                        const oTemplate = new sap.m.ColumnListItem({
                            // We no longer use the Navigation type
                            type: "Inactive"
                        });
                        
                        // Add cells to the template based on visible columns
                        aVisibleColumns.forEach((oColumnMetadata, index) => {
                            console.log(`🔍 TABLE DEBUG: Adding cell ${index+1} for column:`, oColumnMetadata.name);
                            
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
                                            formatter: function(value) {
                                                return value ? "Yes" : "No";
                                            }
                                        }
                                    });
                                    break;
                                case "date":
                                    oCell = new sap.m.Text({ 
                                        text: {
                                            path: "viewModel>" + oColumnMetadata.name,
                                            formatter: function(value) {
                                                if (!value) return "";
                                                return new Date(value).toLocaleDateString();
                                            }
                                        }
                                    });
                                    break;
                                case "number":
                                    oCell = new sap.m.Text({ 
                                        text: {
                                            path: "viewModel>" + oColumnMetadata.name,
                                            formatter: function(value) {
                                                if (value === undefined || value === null) return "";
                                                return parseFloat(value).toFixed(2);
                                            }
                                        }
                                    });
                                    break;
                                default:
                                    oCell = new sap.m.Text({ 
                                        text: "{viewModel>" + oColumnMetadata.name + "}" 
                                    });
                            }
                            oTemplate.addCell(oCell);
                        });
                        
                        // Add the actions cell with edit, view, and delete buttons
                        // THIS IS THE KEY CHANGE - using direct functions instead of event handlers
                        console.log("🔍 TABLE DEBUG: Adding actions cell to template");
                        
                        const oActionsCell = new sap.m.HBox({
                            justifyContent: "End",
                            items: [
                                // Edit button - now using the dialog edit handler directly
                                new sap.m.Button({
                                    icon: "sap-icon://edit",
                                    type: "Transparent",
                                    tooltip: "Edit",
                                    press: this._handleRelatedItemEdit.bind(this)
                                }).addStyleClass("sapUiTinyMarginEnd"),
                                
                                // View button
                                new sap.m.Button({
                                    icon: "sap-icon://display",
                                    type: "Transparent",
                                    tooltip: "View Details",
                                    press: this._handleRelatedItemView.bind(this)
                                }).addStyleClass("sapUiTinyMarginEnd"),
                                
                                // Delete button
                                new sap.m.Button({
                                    icon: "sap-icon://delete",
                                    type: "Transparent",
                                    tooltip: "Delete",
                                    press: this._handleRelatedItemDelete.bind(this)
                                })
                            ]
                        });
                        
                        oTemplate.addCell(oActionsCell);
                        
                        // Apply the binding
                        try {
                            // Unbind items before rebinding
                            if (oTable.isBound("items")) {
                                console.log("🔍 TABLE DEBUG: Unbinding existing items");
                                oTable.unbindItems();
                            }
                            
                            oTable.bindItems({
                                path: "viewModel>/filteredRelatedItems",
                                template: oTemplate
                            });
                            
                            console.log("🔍 TABLE DEBUG: Items bound successfully");
                        } catch (bindingError) {
                            console.error("🔍 TABLE DEBUG: Error during item binding:", bindingError);
                        }
                        
                        // Force invalidation to ensure re-rendering
                        oTable.invalidate();
                        
                    }).catch(error => {
                        console.error("🔍 TABLE DEBUG: Error getting metadata:", error);
                    });
            } catch (e) {
                console.error("🔍 TABLE DEBUG: Critical error in _configureRelatedItemsTable:", e);
            }
        },

        /**
         * Handle edit button press in related items table
         * This implementation shows a modal dialog instead of navigating away
         * @param {sap.ui.base.Event} oEvent The button press event
         * @private
         */
        _handleRelatedItemEdit: function(oEvent) {
            console.log("🔍 HANDLER DEBUG: Edit button clicked");
            
            // Get the button
            const oButton = oEvent.getSource();
            
            // Get the list item from the button's parent's parent (HBox -> Cell -> ListItem)
            const oItem = oButton.getParent().getParent().getParent();
            
            // Get the binding context
            const oContext = oItem.getBindingContext("viewModel");
            if (!oContext) {
                console.error("No binding context found for related item");
                return;
            }
            
            // Get the item data
            const oData = oContext.getObject();
            
            // Get view model and parent table ID
            const oViewModel = this.getModel("viewModel");
            const sTableId = oViewModel.getProperty("/tableId");
            
            // Get the related table ID from the current table's relations
            this.getTableMetadata(sTableId).then((oMetadata) => {
                // Check if relations are defined
                if (!oMetadata.relations || oMetadata.relations.length === 0) {
                    console.error("No relations defined in metadata");
                    sap.m.MessageBox.error("No relations defined for this entity");
                    return;
                }
                
                // Get the first relation (related table info)
                const oRelation = oMetadata.relations[0];
                const sRelatedTableId = oRelation.table;
                
                console.log(`Using relation: ${sRelatedTableId} with foreign key ${oRelation.foreignKey}`);
                
                // Get metadata for related table
                this.getTableMetadata(sRelatedTableId).then((oRelatedMetadata) => {
                    // Get primary key for related table
                    const sPrimaryKey = oRelatedMetadata.primaryKey;
                    const sPrimaryKeyValue = oData[sPrimaryKey];
                    
                    console.log(`Primary key: ${sPrimaryKey}, value: ${sPrimaryKeyValue}`);
                    
                    // Create dialog model with a clone of the entity data
                    const oDialogModel = new sap.ui.model.json.JSONModel({
                        entity: JSON.parse(JSON.stringify(oData)),
                        validationErrors: {},
                        title: `Edit ${oData[oRelatedMetadata.titleField] || "Related Item"}`
                    });
                    
                    // Create a form for the dialog
                    const oForm = new sap.ui.layout.form.SimpleForm({
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
                    
                    // Store field controls for validation
                    const oFormControls = {};
                    
                    // Add form fields based on metadata
                    oRelatedMetadata.columns.forEach((oColumnMetadata) => {
                        // Skip fields that are not editable or system-managed
                        if (oColumnMetadata.editable === false || 
                            oColumnMetadata.name === oRelatedMetadata.primaryKey ||
                            oColumnMetadata.name === 'created_at' ||
                            oColumnMetadata.name === 'updated_at') {
                            return;
                        }
                        
                        // Check if this is the foreign key field connecting to the parent
                        const bIsParentForeignKey = oColumnMetadata.name === oRelation.foreignKey;
                        
                        // Create label
                        oForm.addContent(new sap.m.Label({
                            text: oColumnMetadata.label,
                            required: oColumnMetadata.required === true
                        }));
                        
                        // Create appropriate field based on type
                        let oControl;
                        
                        if (bIsParentForeignKey) {
                            // Read-only field for parent relation
                            oControl = new sap.m.Text({
                                text: `Connected to ${oViewModel.getProperty("/tableName")} (ID: ${oViewModel.getProperty("/entityId")})`
                            });
                        } else if (oColumnMetadata.type === "relation") {
                            // ComboBox for relation fields
                            oControl = new sap.m.ComboBox({
                                selectedKey: {
                                    path: "/entity/" + oColumnMetadata.name
                                },
                                width: "100%",
                                valueState: "{= ${/validationErrors/" + oColumnMetadata.name + "} ? 'Error' : 'None' }",
                                valueStateText: "{/validationErrors/" + oColumnMetadata.name + "}"
                            });
                            
                            // Load relation options
                            this._loadRelationOptionsForDialog(
                                oControl, 
                                oColumnMetadata.relation,
                                oColumnMetadata.required === true
                            );
                        } else if (oColumnMetadata.type === "boolean") {
                            // CheckBox for boolean fields
                            oControl = new sap.m.CheckBox({
                                selected: {
                                    path: "/entity/" + oColumnMetadata.name
                                }
                            });
                        } else if (oColumnMetadata.type === "date") {
                            // DatePicker for date fields
                            oControl = new sap.m.DatePicker({
                                value: {
                                    path: "/entity/" + oColumnMetadata.name,
                                    type: new sap.ui.model.type.Date({
                                        pattern: "yyyy-MM-dd"
                                    })
                                },
                                valueFormat: "yyyy-MM-dd",
                                displayFormat: "medium",
                                width: "100%",
                                valueState: "{= ${/validationErrors/" + oColumnMetadata.name + "} ? 'Error' : 'None' }",
                                valueStateText: "{/validationErrors/" + oColumnMetadata.name + "}"
                            });
                        } else if (oColumnMetadata.type === "number") {
                            // Input for number fields
                            oControl = new sap.m.Input({
                                value: {
                                    path: "/entity/" + oColumnMetadata.name,
                                    type: new sap.ui.model.type.Float({
                                        minFractionDigits: 0,
                                        maxFractionDigits: 2
                                    })
                                },
                                type: "Number",
                                width: "100%",
                                valueState: "{= ${/validationErrors/" + oColumnMetadata.name + "} ? 'Error' : 'None' }",
                                valueStateText: "{/validationErrors/" + oColumnMetadata.name + "}"
                            });
                        } else if (oColumnMetadata.type === "text") {
                            // TextArea for text fields
                            oControl = new sap.m.TextArea({
                                value: {
                                    path: "/entity/" + oColumnMetadata.name
                                },
                                rows: 3,
                                growing: true,
                                width: "100%",
                                valueState: "{= ${/validationErrors/" + oColumnMetadata.name + "} ? 'Error' : 'None' }",
                                valueStateText: "{/validationErrors/" + oColumnMetadata.name + "}"
                            });
                        } else {
                            // Default to Input for string fields
                            oControl = new sap.m.Input({
                                value: {
                                    path: "/entity/" + oColumnMetadata.name
                                },
                                width: "100%",
                                valueState: "{= ${/validationErrors/" + oColumnMetadata.name + "} ? 'Error' : 'None' }",
                                valueStateText: "{/validationErrors/" + oColumnMetadata.name + "}"
                            });
                        }
                        
                        // Add the control to the form
                        oForm.addContent(oControl);
                        
                        // Store control reference for validation
                        oFormControls[oColumnMetadata.name] = oControl;
                    });
                    
                    // Create the dialog
                    const oDialog = new sap.m.Dialog({
                        title: "{/title}",
                        contentWidth: "40rem",
                        contentHeight: "auto",
                        resizable: true,
                        draggable: true,
                        content: [oForm],
                        beginButton: new sap.m.Button({
                            text: "Save",
                            type: "Emphasized",
                            press: function() {
                                // Validate the form
                                const bValid = this._validateDialogForm(oRelatedMetadata, oDialogModel.getProperty("/entity"), oFormControls);
                                
                                if (!bValid) {
                                    sap.m.MessageBox.error("Please correct the errors in the form");
                                    return;
                                }
                                
                                // Get updated data from the dialog model
                                const oUpdatedData = oDialogModel.getProperty("/entity");
                                
                                // Ensure foreign key to parent is maintained
                                oUpdatedData[oRelation.foreignKey] = oViewModel.getProperty("/entityId");
                                
                                console.log("Saving updated data:", JSON.stringify(oUpdatedData, null, 2));
                                
                                // Set busy state
                                oDialog.setBusy(true);
                                
                                // Update the entity in the database
                                this.getSupabaseClient()
                                    .from(sRelatedTableId)
                                    .update(oUpdatedData)
                                    .eq(sPrimaryKey, sPrimaryKeyValue)
                                    .then(({ data, error }) => {
                                        oDialog.setBusy(false);
                                        
                                        if (error) {
                                            console.error("Error updating related item:", error);
                                            sap.m.MessageBox.error("Error updating related item: " + error.message);
                                            return;
                                        }
                                        
                                        console.log("Related item updated successfully:", data);
                                        
                                        // Show success message
                                        sap.m.MessageToast.show("Related item updated successfully");
                                        
                                        // Close the dialog
                                        oDialog.close();
                                        
                                        // Reload related items to refresh the list
                                        this._loadRelatedItems(oMetadata, oViewModel.getProperty("/entity"));
                                    })
                                    .catch(error => {
                                        oDialog.setBusy(false);
                                        console.error("Error in Supabase query:", error);
                                        sap.m.MessageBox.error("Error updating related item: " + error.message);
                                    });
                            }.bind(this)
                        }),
                        endButton: new sap.m.Button({
                            text: "Cancel",
                            press: function() {
                                oDialog.close();
                            }
                        }),
                        afterClose: function() {
                            oDialog.destroy();
                        }
                    });
                    
                    // Set the model on the dialog
                    oDialog.setModel(oDialogModel);
                    
                    // Add the dialog to the view
                    this.getView().addDependent(oDialog);
                    
                    // Open the dialog
                    oDialog.open();
                })
                .catch(error => {
                    console.error("Error loading related table metadata:", error);
                    sap.m.MessageBox.error("Error loading metadata: " + error.message);
                });
            })
            .catch(error => {
                console.error("Error loading parent table metadata:", error);
                sap.m.MessageBox.error("Error loading metadata: " + error.message);
            });
        },

        /**
         * Handle view button press in related items table
         * @param {sap.ui.base.Event} oEvent The button press event
         * @private
         */
        _handleRelatedItemView: function(oEvent) {
            console.log("🔍 HANDLER DEBUG: View button clicked");
            
            // Get the button
            const oButton = oEvent.getSource();
            
            // Get the list item from the button's parent's parent (HBox -> Cell -> ListItem)
            const oItem = oButton.getParent().getParent().getParent();
            
            // Get the binding context
            const oContext = oItem.getBindingContext("viewModel");
            if (!oContext) {
                console.error("No binding context found for related item");
                return;
            }
            
            // Get the item data
            const oData = oContext.getObject();
            
            // Get view model and parent table ID
            const oViewModel = this.getModel("viewModel");
            const sTableId = oViewModel.getProperty("/tableId");
            
            // Get the related table ID from the current table's relations
            this.getTableMetadata(sTableId).then(oMetadata => {
                if (!oMetadata.relations || oMetadata.relations.length === 0) {
                    console.error("No relations defined in metadata");
                    return;
                }
                
                const oRelation = oMetadata.relations[0];
                
                this.getTableMetadata(oRelation.table).then(oRelatedMetadata => {
                    const sPrimaryKey = oRelatedMetadata.primaryKey;
                    const sPrimaryKeyValue = oData[sPrimaryKey];
                    
                    console.log(`Navigating to related item details: ${oRelation.table}/${sPrimaryKeyValue}`);
                    
                    // Navigate to detail view of related item
                    this.getRouter().navTo("entityDetail", {
                        table: oRelation.table,
                        id: sPrimaryKeyValue
                    });
                });
            });
        },

        /**
         * Handle delete button press in related items table
         * @param {sap.ui.base.Event} oEvent The button press event
         * @private
         */
        _handleRelatedItemDelete: function(oEvent) {
            console.log("🔍 HANDLER DEBUG: Delete button clicked");
            
            // Get the button
            const oButton = oEvent.getSource();
            
            // Get the list item from the button's parent's parent (HBox -> Cell -> ListItem)
            const oItem = oButton.getParent().getParent().getParent();
            
            // Get the binding context
            const oContext = oItem.getBindingContext("viewModel");
            if (!oContext) {
                console.error("No binding context found for related item");
                return;
            }
            
            const oData = oContext.getObject();
            const oViewModel = this.getModel("viewModel");
            const sTableId = oViewModel.getProperty("/tableId");
            
            // Get metadata for the current table
            this.getTableMetadata(sTableId).then((oMetadata) => {
                // Get the relations
                if (!oMetadata.relations || oMetadata.relations.length === 0) {
                    console.error("No relations defined in metadata");
                    return;
                }
                
                const oRelation = oMetadata.relations[0];
                
                // Get metadata for related table
                this.getTableMetadata(oRelation.table).then((oRelatedMetadata) => {
                    const sPrimaryKey = oRelatedMetadata.primaryKey;
                    const sPrimaryKeyValue = oData[sPrimaryKey];
                    
                    console.log(`Confirming deletion of related item: ${oRelation.table}/${sPrimaryKeyValue}`);
                    
                    // Confirm deletion
                    sap.m.MessageBox.confirm(
                        "Are you sure you want to delete this related item?",
                        {
                            title: "Delete Confirmation",
                            onClose: function(sAction) {
                                if (sAction === sap.m.MessageBox.Action.OK) {
                                    console.log(`Deleting related item: ${oRelation.table}/${sPrimaryKeyValue}`);
                                    
                                    // Show busy state
                                    oViewModel.setProperty("/busy", true);
                                    
                                    // Delete related item
                                    this.getSupabaseClient()
                                        .from(oRelation.table)
                                        .delete()
                                        .eq(sPrimaryKey, sPrimaryKeyValue)
                                        .then(({ error }) => {
                                            oViewModel.setProperty("/busy", false);
                                            
                                            if (error) {
                                                console.error("Error deleting related item:", error);
                                                sap.m.MessageBox.error("Error deleting related item: " + error.message);
                                                return;
                                            }
                                            
                                            console.log("Related item deleted successfully");
                                            
                                            // Create a copy of the current related items
                                            const aCurrentItems = [...oViewModel.getProperty("/relatedItems")];
                                            const aFilteredItems = [...oViewModel.getProperty("/filteredRelatedItems")];
                                            
                                            // Remove the deleted item from both arrays
                                            const iItemIndex = aCurrentItems.findIndex(item => item[sPrimaryKey] === sPrimaryKeyValue);
                                            if (iItemIndex !== -1) {
                                                aCurrentItems.splice(iItemIndex, 1);
                                                oViewModel.setProperty("/relatedItems", aCurrentItems);
                                            }
                                            
                                            const iFilteredIndex = aFilteredItems.findIndex(item => item[sPrimaryKey] === sPrimaryKeyValue);
                                            if (iFilteredIndex !== -1) {
                                                aFilteredItems.splice(iFilteredIndex, 1);
                                                oViewModel.setProperty("/filteredRelatedItems", aFilteredItems);
                                            }
                                            
                                            // Show success message
                                            sap.m.MessageToast.show("Related item deleted successfully");
                                        })
                                        .catch(error => {
                                            oViewModel.setProperty("/busy", false);
                                            console.error("Error in delete operation:", error);
                                            sap.m.MessageBox.error("Error deleting related item: " + error.message);
                                        });
                                }
                            }.bind(this)
                        }
                    );
                });
            });
        },

        /**
         * Manually configure the related items table without using automatic binding
         * @param {string} sTableId The table ID
         * @private
         */
        _setupRelatedItemsTable: function(sTableId) {
            // Get the table
            const oTable = this.getView().byId("relatedItemsTable");
            if (!oTable) {
                console.error("Related items table not found");
                return;
            }
            
            // Clear existing columns and items
            oTable.removeAllColumns();
            oTable.removeAllItems();
            
            // Get view model
            const oViewModel = this.getModel("viewModel");
            
            // Get related items
            const aRelatedItems = oViewModel.getProperty("/filteredRelatedItems") || [];
            
            // Get metadata for the table
            this.getTableMetadata(sTableId).then((oMetadata) => {
                // Get the relations
                if (!oMetadata.relations || oMetadata.relations.length === 0) {
                    console.log("No relations defined for table:", sTableId);
                    return;
                }
                
                const oRelation = oMetadata.relations[0];
                const sRelatedTableId = oRelation.table;
                
                // Get metadata for related table
                this.getTableMetadata(sRelatedTableId).then((oRelatedMetadata) => {
                    // Get visible columns (limit to 4 to leave room for actions)
                    const aVisibleColumns = oRelatedMetadata.columns.filter(col => col.visible).slice(0, 4);
                    
                    // Add columns to table
                    aVisibleColumns.forEach(oColumnMetadata => {
                        oTable.addColumn(new sap.m.Column({
                            header: new sap.m.Label({ text: oColumnMetadata.label })
                        }));
                    });
                    
                    // Add actions column
                    oTable.addColumn(new sap.m.Column({
                        header: new sap.m.Label({ text: "Actions" }),
                        hAlign: "End"
                    }));
                    
                    // Add items to table
                    aRelatedItems.forEach((oItem, iIndex) => {
                        // Create row
                        const oRow = new sap.m.ColumnListItem({
                            type: "Inactive" // Make row non-clickable
                        });
                        
                        // Add data cells
                        aVisibleColumns.forEach(oColumnMetadata => {
                            let oCell;
                            const value = oItem[oColumnMetadata.name];
                            
                            // Format value based on field type
                            switch (oColumnMetadata.type) {
                                case "relation":
                                    oCell = new sap.m.Text({ 
                                        text: oItem[oColumnMetadata.name + "_text"] || value 
                                    });
                                    break;
                                case "boolean":
                                    oCell = new sap.m.Text({ 
                                        text: value ? "Yes" : "No" 
                                    });
                                    break;
                                case "date":
                                    oCell = new sap.m.Text({ 
                                        text: value ? new Date(value).toLocaleDateString() : "" 
                                    });
                                    break;
                                case "number":
                                    oCell = new sap.m.Text({ 
                                        text: value !== undefined && value !== null ? parseFloat(value).toFixed(2) : "" 
                                    });
                                    break;
                                default:
                                    oCell = new sap.m.Text({ 
                                        text: value || "" 
                                    });
                            }
                            
                            oRow.addCell(oCell);
                        });
                        
                        // Add actions cell
                        const oActionsCell = new sap.m.HBox({
                            justifyContent: "End",
                            items: [
                                // Edit button
                                new sap.m.Button({
                                    icon: "sap-icon://edit",
                                    type: "Transparent",
                                    tooltip: "Edit",
                                    press: function() {
                                        this._openEditDialog(oRelation.table, oItem, oRelatedMetadata);
                                    }.bind(this)
                                }).addStyleClass("sapUiTinyMarginEnd"),
                                
                                // View button
                                new sap.m.Button({
                                    icon: "sap-icon://display",
                                    type: "Transparent",
                                    tooltip: "View Details",
                                    press: function() {
                                        // Navigate to detail view
                                        const sPrimaryKey = oRelatedMetadata.primaryKey;
                                        this.getRouter().navTo("entityDetail", {
                                            table: oRelation.table,
                                            id: oItem[sPrimaryKey]
                                        });
                                    }.bind(this)
                                }).addStyleClass("sapUiTinyMarginEnd"),
                                
                                // Delete button
                                new sap.m.Button({
                                    icon: "sap-icon://delete",
                                    type: "Transparent",
                                    tooltip: "Delete",
                                    press: function() {
                                        this._confirmDeleteItem(oRelation.table, oItem, oRelatedMetadata);
                                    }.bind(this)
                                })
                            ]
                        });
                        
                        oRow.addCell(oActionsCell);
                        
                        // Add row to table
                        oTable.addItem(oRow);
                    });
                });
            });
        },

        /**
         * Open edit dialog for a related item
         * @param {string} sTableId The table ID
         * @param {Object} oItem The item data
         * @param {Object} oMetadata The table metadata
         * @private
         */
        _openEditDialog: function(sTableId, oItem, oMetadata) {
            // Create dialog model with a clone of the entity data
            const oDialogModel = new sap.ui.model.json.JSONModel({
                entity: JSON.parse(JSON.stringify(oItem)),
                validationErrors: {},
                title: `Edit ${oItem[oMetadata.titleField] || "Related Item"}`
            });
            
            // Create form for the dialog
            const oForm = new sap.ui.layout.form.SimpleForm({
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
            
            // Field controls for validation
            const oFormControls = {};
            
            // Add form fields based on metadata
            oMetadata.columns.forEach((oColumnMetadata) => {
                // Skip non-editable and system fields
                if (oColumnMetadata.editable === false || 
                    oColumnMetadata.name === oMetadata.primaryKey ||
                    oColumnMetadata.name === 'created_at' ||
                    oColumnMetadata.name === 'updated_at') {
                    return;
                }
                
                // Create label
                oForm.addContent(new sap.m.Label({
                    text: oColumnMetadata.label,
                    required: oColumnMetadata.required === true
                }));
                
                // Create appropriate field
                let oControl;
                
                switch (oColumnMetadata.type) {
                    case "relation":
                        oControl = new sap.m.ComboBox({
                            selectedKey: {
                                path: "/entity/" + oColumnMetadata.name
                            },
                            width: "100%"
                        });
                        break;
                        
                    case "boolean":
                        oControl = new sap.m.CheckBox({
                            selected: {
                                path: "/entity/" + oColumnMetadata.name
                            }
                        });
                        break;
                        
                    case "date":
                        oControl = new sap.m.DatePicker({
                            value: {
                                path: "/entity/" + oColumnMetadata.name,
                                type: new sap.ui.model.type.Date({
                                    pattern: "yyyy-MM-dd"
                                })
                            },
                            valueFormat: "yyyy-MM-dd",
                            displayFormat: "medium",
                            width: "100%"
                        });
                        break;
                        
                    case "number":
                        oControl = new sap.m.Input({
                            value: {
                                path: "/entity/" + oColumnMetadata.name,
                                type: new sap.ui.model.type.Float({
                                    minFractionDigits: 0,
                                    maxFractionDigits: 2
                                })
                            },
                            type: "Number",
                            width: "100%"
                        });
                        break;
                        
                    case "text":
                        oControl = new sap.m.TextArea({
                            value: {
                                path: "/entity/" + oColumnMetadata.name
                            },
                            rows: 3,
                            growing: true,
                            width: "100%"
                        });
                        break;
                        
                    default:
                        oControl = new sap.m.Input({
                            value: {
                                path: "/entity/" + oColumnMetadata.name
                            },
                            width: "100%"
                        });
                }
                
                // Add control to form
                oForm.addContent(oControl);
                
                // Store for validation
                oFormControls[oColumnMetadata.name] = oControl;
            });
            
            // Create dialog
            const oDialog = new sap.m.Dialog({
                title: "{/title}",
                contentWidth: "40rem",
                contentHeight: "auto",
                resizable: true,
                draggable: true,
                content: [oForm],
                beginButton: new sap.m.Button({
                    text: "Save",
                    type: "Emphasized",
                    press: function() {
                        // Get updated data
                        const oUpdatedData = oDialogModel.getProperty("/entity");
                        
                        // Save entity
                        this.getSupabaseClient()
                            .from(sTableId)
                            .update(oUpdatedData)
                            .eq(oMetadata.primaryKey, oItem[oMetadata.primaryKey])
                            .then(({ data, error }) => {
                                if (error) {
                                    sap.m.MessageBox.error("Error updating item: " + error.message);
                                    return;
                                }
                                
                                // Show success message
                                sap.m.MessageToast.show("Item updated successfully");
                                
                                // Close dialog
                                oDialog.close();
                                
                                // Reload data
                                this._loadRelatedItems(
                                    this._oTableMetadata, 
                                    this.getModel("viewModel").getProperty("/entity")
                                );
                            })
                            .catch(error => {
                                sap.m.MessageBox.error("Error: " + error.message);
                            });
                    }.bind(this)
                }),
                endButton: new sap.m.Button({
                    text: "Cancel",
                    press: function() {
                        oDialog.close();
                    }
                }),
                afterClose: function() {
                    oDialog.destroy();
                }
            });
            
            // Set model
            oDialog.setModel(oDialogModel);
            
            // Add to view
            this.getView().addDependent(oDialog);
            
            // Open dialog
            oDialog.open();
        },

        /**
         * Confirm and delete a related item
         * @param {string} sTableId The table ID
         * @param {Object} oItem The item data
         * @param {Object} oMetadata The table metadata
         * @private
         */
        _confirmDeleteItem: function(sTableId, oItem, oMetadata) {
            // Show confirmation dialog
            sap.m.MessageBox.confirm(
                "Are you sure you want to delete this item?",
                {
                    title: "Delete Confirmation",
                    onClose: function(sAction) {
                        if (sAction === sap.m.MessageBox.Action.OK) {
                            // Delete item
                            this.getSupabaseClient()
                                .from(sTableId)
                                .delete()
                                .eq(oMetadata.primaryKey, oItem[oMetadata.primaryKey])
                                .then(({ error }) => {
                                    if (error) {
                                        sap.m.MessageBox.error("Error deleting item: " + error.message);
                                        return;
                                    }
                                    
                                    // Show success message
                                    sap.m.MessageToast.show("Item deleted successfully");
                                    
                                    // Reload data
                                    this._loadRelatedItems(
                                        this._oTableMetadata, 
                                        this.getModel("viewModel").getProperty("/entity")
                                    );
                                })
                                .catch(error => {
                                    sap.m.MessageBox.error("Error: " + error.message);
                                });
                        }
                    }.bind(this)
                }
            );
        },

        /**
         * Load related items with improved state handling
         * @param {Object} oMetadata The table metadata
         * @param {Object} oEntityData The entity data
         * @returns {Promise} A promise resolving with the loaded items
         * @private
         */
        _loadRelatedItems: function(oMetadata, oEntityData) {
            console.log("Starting _loadRelatedItems method");
            
            try {
                const oViewModel = this.getModel("viewModel");
                const sTableId = oViewModel.getProperty("/tableId");
                
                // Make the related items section visible
                const oRelatedItemsSection = this.getView().byId("relatedItemsSection");
                if (oRelatedItemsSection) {
                    oRelatedItemsSection.setVisible(true);
                }
                
                // Check if relations exist
                if (!oMetadata.relations || oMetadata.relations.length === 0) {
                    console.log("No relations defined for table:", sTableId);
                    oViewModel.setProperty("/relatedItems", []);
                    oViewModel.setProperty("/filteredRelatedItems", []);
                    this._setupRelatedItemsTable(sTableId);
                    oViewModel.setProperty("/busy", false);
                    return Promise.resolve([]);
                }
                
                const oRelation = oMetadata.relations[0];
                
                // Use appropriate primary key
                const sPrimaryKey = oMetadata.primaryKey || `${sTableId}_id`;
                const sPrimaryKeyValue = oEntityData[sPrimaryKey];
                
                if (!sPrimaryKeyValue) {
                    console.error("Primary key value not found in entity data!");
                    oViewModel.setProperty("/relatedItems", []);
                    oViewModel.setProperty("/filteredRelatedItems", []);
                    this._setupRelatedItemsTable(sTableId);
                    oViewModel.setProperty("/busy", false);
                    return Promise.resolve([]);
                }
                
                // Store the related table ID for later reference
                this._sRelatedTableId = oRelation.table;
                
                console.log(`Loading data from ${oRelation.table} where ${oRelation.foreignKey}=${sPrimaryKeyValue}`);
                
                return this.getSupabaseClient()
                    .from(oRelation.table)
                    .select('*')
                    .eq(oRelation.foreignKey, sPrimaryKeyValue)
                    .then(({ data: relatedData, error }) => {
                        if (error) {
                            console.error("Error loading related items:", error);
                            oViewModel.setProperty("/busy", false);
                            return [];
                        }
                        
                        const aItems = relatedData || [];
                        console.log(`Loaded ${aItems.length} related items`);
                        
                        return this._processRelatedItemsRelations(oRelation.table, aItems)
                            .then(processedItems => {
                                // Set the data in the model
                                oViewModel.setProperty("/relatedItems", processedItems);
                                oViewModel.setProperty("/filteredRelatedItems", processedItems);
                                
                                // Update delete button state based on related items
                                this._updateDeleteButtonState(processedItems);
                                
                                // Configure and setup the related items table
                                this._configureRelatedItemsTable(sTableId);
                                
                                oViewModel.setProperty("/busy", false);
                                console.log("Related items loading complete");
                                
                                return processedItems;
                            });
                    })
                    .catch(error => {
                        console.error("Error in Supabase query:", error);
                        oViewModel.setProperty("/busy", false);
                        return [];
                    });
            } catch (e) {
                console.error("Critical error in _loadRelatedItems:", e);
                
                const oViewModel = this.getModel("viewModel");
                if (oViewModel) {
                    oViewModel.setProperty("/busy", false);
                }
                
                return Promise.resolve([]);
            }
        },

        /**
         * Lifecycle hook when the controller is initialized with improved parent info handling
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
                validationErrors: {},
                parentInfo: null    // Store parent info for navigation after save
            });
            
            // Set the model on the view
            this.setModel(oViewModel, "viewModel");
            
            // Register for route matched event
            this.getRouter().getRoute("entityDetail").attachPatternMatched(this._onRouteMatched, this);
            
            // Check for parent info in session storage (for related items edit flow)
            this._loadParentInfoForEdit();
            
            // Register extensions
            try {
                this._registerExtensions();
            } catch (error) {
                console.error("Could not register extensions:", error);
            }
        },

        /**
         * Load parent info for edit navigation flow
         * @private
         */
        _loadParentInfoForEdit: function() {
            try {
                const sParentInfo = sessionStorage.getItem("parentEntityInfo");
                console.log("Checking for parent info in detail view:", sParentInfo);
                
                if (sParentInfo) {
                    const oParentInfo = JSON.parse(sParentInfo);
                    
                    // Only use if this has the isEditing flag
                    if (oParentInfo.isEditing === true) {
                        console.log("Found parent info for edit mode:", JSON.stringify(oParentInfo, null, 2));
                        
                        // Store in view model for later use in save handler
                        const oViewModel = this.getModel("viewModel");
                        oViewModel.setProperty("/parentInfo", oParentInfo);
                        
                        // Create a backup
                        this._parentInfoBackup = JSON.parse(JSON.stringify(oParentInfo));
                    }
                }
            } catch (e) {
                console.error("Error parsing parent entity info:", e);
            }
        },

       /**
         * Navigation handler with improved parent entity detection
         */
        onNavBack: function() {
            console.log("Back button pressed");
            
            const oViewModel = this.getModel("viewModel");
            const sTableId = oViewModel.getProperty("/tableId");
            
            // Get parent info from view model
            let oParentInfo = oViewModel.getProperty("/parentInfo");
            
            // If not in view model, try backup
            if (!oParentInfo && this._parentInfoBackup) {
                console.log("Using parent info backup for back navigation");
                oParentInfo = this._parentInfoBackup;
            }
            
            if (!oParentInfo) {
                try {
                    // Last attempt to get from session storage
                    const sParentInfo = sessionStorage.getItem("parentEntityInfo");
                    if (sParentInfo) {
                        oParentInfo = JSON.parse(sParentInfo);
                        console.log("Retrieved parent info from session storage for back navigation");
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
                console.log("Navigating to parent entity after back button:", 
                    oParentInfo.parentTable, oParentInfo.parentId);
                
                try {
                    // Force a small delay to ensure proper transition
                    setTimeout(() => {
                        this.getRouter().navTo("entityDetail", {
                            table: oParentInfo.parentTable,
                            id: oParentInfo.parentId
                        });
                        console.log("Navigation to parent initiated after back button");
                    }, 100);
                } catch (e) {
                    console.error("Error during navigation to parent after back button:", e);
                    
                    // Fallback navigation to list view
                    this.getRouter().navTo("entityList", {
                        table: sTableId
                    });
                }
            } else {
                // Navigate back to list view
                console.log("No parent info, navigating to list view after back button");
                this.getRouter().navTo("entityList", {
                    table: sTableId
                });
            }
        },

        /**
         * This function should be already implemented in your controller, but make sure it's working correctly:
         */

        /**
         * Handle edit button press in related items table
         * @param {sap.ui.base.Event} oEvent The button press event
         * @private
         */
        _handleRelatedItemEdit: function(oEvent) {
            console.log("🔍 HANDLER DEBUG: Edit button clicked");
            
            // Get the button
            const oButton = oEvent.getSource();
            
            // Get the list item from the button's parent's parent (HBox -> Cell -> ListItem)
            const oItem = oButton.getParent().getParent().getParent();
            
            // Get the binding context
            const oContext = oItem.getBindingContext("viewModel");
            if (!oContext) {
                console.error("No binding context found for related item");
                return;
            }
            
            // Get the item data
            const oData = oContext.getObject();
            
            // Get view model and parent table ID
            const oViewModel = this.getModel("viewModel");
            const sTableId = oViewModel.getProperty("/tableId");
            
            // Get the related table ID from the current table's relations
            this.getTableMetadata(sTableId).then((oMetadata) => {
                // Check if relations are defined
                if (!oMetadata.relations || oMetadata.relations.length === 0) {
                    console.error("No relations defined in metadata");
                    sap.m.MessageBox.error("No relations defined for this entity");
                    return;
                }
                
                // Get the first relation (related table info)
                const oRelation = oMetadata.relations[0];
                const sRelatedTableId = oRelation.table;
                
                console.log(`Using relation: ${sRelatedTableId} with foreign key ${oRelation.foreignKey}`);
                
                // Get metadata for related table
                this.getTableMetadata(sRelatedTableId).then((oRelatedMetadata) => {
                    // Get primary key for related table
                    const sPrimaryKey = oRelatedMetadata.primaryKey;
                    const sPrimaryKeyValue = oData[sPrimaryKey];
                    
                    console.log(`Primary key: ${sPrimaryKey}, value: ${sPrimaryKeyValue}`);
                    
                    // Create dialog model with a clone of the entity data
                    const oDialogModel = new sap.ui.model.json.JSONModel({
                        entity: JSON.parse(JSON.stringify(oData)),
                        validationErrors: {},
                        title: `Edit ${oData[oRelatedMetadata.titleField] || "Related Item"}`
                    });
                    
                    // Create a form for the dialog
                    const oForm = new sap.ui.layout.form.SimpleForm({
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
                    
                    // Store field controls for validation
                    const oFormControls = {};
                    
                    // Add form fields based on metadata
                    oRelatedMetadata.columns.forEach((oColumnMetadata) => {
                        // Skip fields that are not editable or system-managed
                        if (oColumnMetadata.editable === false || 
                            oColumnMetadata.name === oRelatedMetadata.primaryKey ||
                            oColumnMetadata.name === 'created_at' ||
                            oColumnMetadata.name === 'updated_at') {
                            return;
                        }
                        
                        // Check if this is the foreign key field connecting to the parent
                        const bIsParentForeignKey = oColumnMetadata.name === oRelation.foreignKey;
                        
                        // Create label
                        oForm.addContent(new sap.m.Label({
                            text: oColumnMetadata.label,
                            required: oColumnMetadata.required === true
                        }));
                        
                        // Create appropriate field based on type
                        let oControl;
                        
                        if (bIsParentForeignKey) {
                            // Read-only field for parent relation
                            oControl = new sap.m.Text({
                                text: `Connected to ${oViewModel.getProperty("/tableName")} (ID: ${oViewModel.getProperty("/entityId")})`
                            });
                        } else if (oColumnMetadata.type === "relation") {
                            // ComboBox for relation fields
                            oControl = new sap.m.ComboBox({
                                selectedKey: {
                                    path: "/entity/" + oColumnMetadata.name
                                },
                                width: "100%",
                                valueState: "{= ${/validationErrors/" + oColumnMetadata.name + "} ? 'Error' : 'None' }",
                                valueStateText: "{/validationErrors/" + oColumnMetadata.name + "}"
                            });
                            
                            // Load relation options
                            this._loadRelationOptionsForDialog(
                                oControl, 
                                oColumnMetadata.relation,
                                oColumnMetadata.required === true
                            );
                        } else if (oColumnMetadata.type === "boolean") {
                            // CheckBox for boolean fields
                            oControl = new sap.m.CheckBox({
                                selected: {
                                    path: "/entity/" + oColumnMetadata.name
                                }
                            });
                        } else if (oColumnMetadata.type === "date") {
                            // DatePicker for date fields
                            oControl = new sap.m.DatePicker({
                                value: {
                                    path: "/entity/" + oColumnMetadata.name,
                                    type: new sap.ui.model.type.Date({
                                        pattern: "yyyy-MM-dd"
                                    })
                                },
                                valueFormat: "yyyy-MM-dd",
                                displayFormat: "medium",
                                width: "100%",
                                valueState: "{= ${/validationErrors/" + oColumnMetadata.name + "} ? 'Error' : 'None' }",
                                valueStateText: "{/validationErrors/" + oColumnMetadata.name + "}"
                            });
                        } else if (oColumnMetadata.type === "number") {
                            // Input for number fields
                            oControl = new sap.m.Input({
                                value: {
                                    path: "/entity/" + oColumnMetadata.name,
                                    type: new sap.ui.model.type.Float({
                                        minFractionDigits: 0,
                                        maxFractionDigits: 2
                                    })
                                },
                                type: "Number",
                                width: "100%",
                                valueState: "{= ${/validationErrors/" + oColumnMetadata.name + "} ? 'Error' : 'None' }",
                                valueStateText: "{/validationErrors/" + oColumnMetadata.name + "}"
                            });
                        } else if (oColumnMetadata.type === "text") {
                            // TextArea for text fields
                            oControl = new sap.m.TextArea({
                                value: {
                                    path: "/entity/" + oColumnMetadata.name
                                },
                                rows: 3,
                                growing: true,
                                width: "100%",
                                valueState: "{= ${/validationErrors/" + oColumnMetadata.name + "} ? 'Error' : 'None' }",
                                valueStateText: "{/validationErrors/" + oColumnMetadata.name + "}"
                            });
                        } else {
                            // Default to Input for string fields
                            oControl = new sap.m.Input({
                                value: {
                                    path: "/entity/" + oColumnMetadata.name
                                },
                                width: "100%",
                                valueState: "{= ${/validationErrors/" + oColumnMetadata.name + "} ? 'Error' : 'None' }",
                                valueStateText: "{/validationErrors/" + oColumnMetadata.name + "}"
                            });
                        }
                        
                        // Add the control to the form
                        oForm.addContent(oControl);
                        
                        // Store control reference for validation
                        oFormControls[oColumnMetadata.name] = oControl;
                    });
                    
                    // Create the dialog
                    const oDialog = new sap.m.Dialog({
                        title: "{/title}",
                        contentWidth: "40rem",
                        contentHeight: "auto",
                        resizable: true,
                        draggable: true,
                        content: [oForm],
                        beginButton: new sap.m.Button({
                            text: "Save",
                            type: "Emphasized",
                            press: function() {
                                // Validate the form
                                const bValid = this._validateDialogForm(oRelatedMetadata, oDialogModel.getProperty("/entity"), oFormControls);
                                
                                if (!bValid) {
                                    sap.m.MessageBox.error("Please correct the errors in the form");
                                    return;
                                }
                                
                                // Get updated data from the dialog model
                                const oUpdatedData = oDialogModel.getProperty("/entity");
                                
                                // Ensure foreign key to parent is maintained
                                oUpdatedData[oRelation.foreignKey] = oViewModel.getProperty("/entityId");
                                
                                console.log("Saving updated data:", JSON.stringify(oUpdatedData, null, 2));
                                
                                // Set busy state
                                oDialog.setBusy(true);
                                
                                // Update the entity in the database
                                this.getSupabaseClient()
                                    .from(sRelatedTableId)
                                    .update(oUpdatedData)
                                    .eq(sPrimaryKey, sPrimaryKeyValue)
                                    .then(({ data, error }) => {
                                        oDialog.setBusy(false);
                                        
                                        if (error) {
                                            console.error("Error updating related item:", error);
                                            sap.m.MessageBox.error("Error updating related item: " + error.message);
                                            return;
                                        }
                                        
                                        console.log("Related item updated successfully:", data);
                                        
                                        // Show success message
                                        sap.m.MessageToast.show("Related item updated successfully");
                                        
                                        // Close the dialog
                                        oDialog.close();
                                        
                                        // Reload related items to refresh the list
                                        this._loadRelatedItems(oMetadata, oViewModel.getProperty("/entity"));
                                    })
                                    .catch(error => {
                                        oDialog.setBusy(false);
                                        console.error("Error in Supabase query:", error);
                                        sap.m.MessageBox.error("Error updating related item: " + error.message);
                                    });
                            }.bind(this)
                        }),
                        endButton: new sap.m.Button({
                            text: "Cancel",
                            press: function() {
                                oDialog.close();
                            }
                        }),
                        afterClose: function() {
                            oDialog.destroy();
                        }
                    });
                    
                    // Set the model on the dialog
                    oDialog.setModel(oDialogModel);
                    
                    // Add the dialog to the view
                    this.getView().addDependent(oDialog);
                    
                    // Open the dialog
                    oDialog.open();
                })
                .catch(error => {
                    console.error("Error loading related table metadata:", error);
                    sap.m.MessageBox.error("Error loading metadata: " + error.message);
                });
            })
            .catch(error => {
                console.error("Error loading parent table metadata:", error);
                sap.m.MessageBox.error("Error loading metadata: " + error.message);
            });
        },

        /**
         * Validate form data in the dialog
         * @param {Object} oMetadata The table metadata
         * @param {Object} oEntityData The entity data
         * @param {Object} oFormControls Object containing form field references
         * @returns {boolean} True if validation passes, false otherwise
         * @private
         */
        _validateDialogForm: function(oMetadata, oEntityData, oFormControls) {
            const oValidationErrors = {};
            let bValid = true;
            
            // Reset all fields to non-error state
            Object.values(oFormControls).forEach(oControl => {
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
                const oControl = oFormControls[sFieldName];
                
                // Skip if no control found (might be a parent foreign key shown as text)
                if (!oControl) return;
                
                // Check required fields
                if (oColumnMetadata.required && 
                    (vFieldValue === undefined || vFieldValue === null || vFieldValue === "")) {
                    bValid = false;
                    oValidationErrors[sFieldName] = "This field is required";
                    
                    // Set error state on the field
                    if (oControl.setValueState) {
                        oControl.setValueState("Error");
                        if (oControl.setValueStateText) {
                            oControl.setValueStateText("This field is required");
                        }
                    }
                    
                    console.log("Required field validation failed:", sFieldName);
                    return;
                }
                
                // Skip further validation if empty (and not required)
                if (vFieldValue === undefined || vFieldValue === null || vFieldValue === "") {
                    return;
                }
                
                // Validate field type
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
                    if (oControl.setValueState) {
                        oControl.setValueState("Error");
                        if (oControl.setValueStateText) {
                            oControl.setValueStateText(sErrorMessage);
                        }
                    }
                    
                    console.log("Type validation failed:", sFieldName, sErrorMessage);
                }
            });
            
            return bValid;
        },

        /**
         * Load relation options for dialog ComboBox
         * @param {sap.m.ComboBox} oComboBox The ComboBox control
         * @param {string} sRelatedTable The related table name
         * @param {boolean} bRequired Whether the field is required
         * @private
         */
        _loadRelationOptionsForDialog: function(oComboBox, sRelatedTable, bRequired) {
            console.log(`Loading relation options for table ${sRelatedTable}`);
            
            // Get metadata for related table
            this.getTableMetadata(sRelatedTable)
                .then(oMetadata => {
                    const sPrimaryKey = oMetadata.primaryKey;
                    const sTitleField = oMetadata.titleField || sPrimaryKey;
                    
                    console.log(`Using primary key ${sPrimaryKey} and title field ${sTitleField}`);
                    
                    // Load all records from the related table
                    this.getSupabaseClient()
                        .from(sRelatedTable)
                        .select('*')
                        .then(({ data, error }) => {
                            if (error) {
                                console.error(`Error loading relation options for ${sRelatedTable}:`, error);
                                return;
                            }
                            
                            console.log(`Loaded ${data ? data.length : 0} options from ${sRelatedTable}`);
                            
                            // Clear existing items
                            oComboBox.removeAllItems();
                            
                            // Add empty item if not required
                            if (!bRequired) {
                                oComboBox.addItem(new sap.ui.core.Item({
                                    key: "",
                                    text: "- None -"
                                }));
                            }
                            
                            // Add items to ComboBox
                            if (data && data.length > 0) {
                                data.forEach(item => {
                                    // Use title field if available, otherwise use primary key
                                    const sDisplayText = item[sTitleField] || `ID: ${item[sPrimaryKey]}`;
                                    
                                    oComboBox.addItem(new sap.ui.core.Item({
                                        key: item[sPrimaryKey],
                                        text: sDisplayText
                                    }));
                                    
                                    console.log(`Added option: ${item[sPrimaryKey]} - ${sDisplayText}`);
                                });
                            } else {
                                console.log(`No items found in ${sRelatedTable}`);
                            }
                        })
                        .catch(error => {
                            console.error(`Error in Supabase query for ${sRelatedTable}:`, error);
                        });
                })
                .catch(error => {
                    console.error(`Error getting metadata for relation ${sRelatedTable}:`, error);
                });
        },


        /**
         * Update delete button state based on related items
         * @param {Array} aRelatedItems Array of related items
         * @private
         */
        _updateDeleteButtonState: function(aRelatedItems) {
            // Find the delete button - it could be in different containers depending on the view
            let oDeleteButton = null;
            
            // Try to find in header actions first (most likely location)
            const oObjectPageLayout = this.getView().byId("ObjectPageLayout");
            if (oObjectPageLayout) {
                const oHeaderTitle = oObjectPageLayout.getHeaderTitle();
                if (oHeaderTitle) {
                    const aActions = oHeaderTitle.getActions() || [];
                    for (let i = 0; i < aActions.length; i++) {
                        const oAction = aActions[i];
                        if (oAction.getIcon && oAction.getIcon() === "sap-icon://delete") {
                            oDeleteButton = oAction;
                            break;
                        }
                    }
                }
            }
            
            // If not found, try alternative locations
            if (!oDeleteButton) {
                oDeleteButton = this.getView().byId("deleteButton");
            }
            
            // If button found, update its state
            if (oDeleteButton) {
                const bHasRelatedItems = aRelatedItems && aRelatedItems.length > 0;
                
                // Disable the button if related items exist
                oDeleteButton.setEnabled(!bHasRelatedItems);
                
                // Add a tooltip explaining why it's disabled
                if (bHasRelatedItems) {
                    oDeleteButton.setTooltip("Cannot delete while related items exist");
                } else {
                    oDeleteButton.setTooltip("Delete this entity");
                }
            }
        },

        _updateDeleteButtonState: function(aRelatedItems) {
            // Find the delete button in the header actions
            const oObjectPageLayout = this.getView().byId("ObjectPageLayout");
            if (oObjectPageLayout) {
                const oHeaderTitle = oObjectPageLayout.getHeaderTitle();
                if (oHeaderTitle) {
                    const aActions = oHeaderTitle.getActions() || [];
                    for (let i = 0; i < aActions.length; i++) {
                        const oAction = aActions[i];
                        if (oAction.getIcon && oAction.getIcon() === "sap-icon://delete") {
                            // Disable button if related items exist
                            const bHasRelatedItems = aRelatedItems && aRelatedItems.length > 0;
                            oAction.setEnabled(!bHasRelatedItems);
                            
                            // Update tooltip to explain why
                            if (bHasRelatedItems) {
                                oAction.setTooltip("Cannot delete while related items exist");
                            } else {
                                oAction.setTooltip("Delete this entity");
                            }
                            break;
                        }
                    }
                }
            }
        }
    });
});