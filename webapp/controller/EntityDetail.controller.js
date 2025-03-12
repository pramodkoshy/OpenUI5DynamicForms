sap.ui.define([
    "com/supabase/easyui5/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/m/Label",
    "sap/m/Input",
    "sap/m/DatePicker",
    "sap/m/TextArea",
    "sap/m/CheckBox",
    "sap/m/Text",
    "sap/m/ComboBox",
    "sap/ui/core/Item",
    "sap/m/Column"
], function(BaseController, JSONModel, Label, Input, DatePicker, TextArea, CheckBox, Text, ComboBox, Item, Column) {
    "use strict";

    return BaseController.extend("com.supabase.easyui5.controller.EntityDetail", {
        
        /**
         * Formatter methods for the view
         */
        formatter: {
            formatDate: function(dateString) {
                if (!dateString) {
                    return "";
                }
                return new Date(dateString).toLocaleDateString();
            }
        },
        
        /**
         * Lifecycle hook when the controller is initialized
         */
        onInit: function() {
            const oViewModel = new JSONModel({
                tableName: "",
                tableId: "",
                entityId: "",
                entityTitle: "",
                entitySubtitle: "",
                entity: {},
                relatedItems: [],
                filteredRelatedItems: [],
                editMode: false,
                busy: false,
                delay: 0
            });
            
            this.setModel(oViewModel, "viewModel");
            
            // Register for route matched event
            this.getRouter().getRoute("entityDetail").attachPatternMatched(this._onRouteMatched, this);
        },
        
        /**
         * Route matched handler
         * @param {sap.ui.base.Event} oEvent The route matched event
         * @private
         */
        _onRouteMatched: function(oEvent) {
            console.log("EntityDetail route matched");
            const sTableId = oEvent.getParameter("arguments").table;
            const sEntityId = oEvent.getParameter("arguments").id;
            
            console.log("Table ID:", sTableId);
            console.log("Entity ID:", sEntityId);
            
            // Store the table ID and entity ID in the view model
            const oViewModel = this.getModel("viewModel");
            oViewModel.setProperty("/tableId", sTableId);
            oViewModel.setProperty("/entityId", sEntityId);
            
            // Set table name based on the ID (capitalize first letter)
            const sTableName = sTableId.charAt(0).toUpperCase() + sTableId.slice(1).replace(/_/g, " ");
            oViewModel.setProperty("/tableName", sTableName);
            
            // Load entity data
            this._loadEntity(sTableId, sEntityId);
        },
        
        /**
         * Load entity data from Supabase
         * @param {string} sTableId The table ID
         * @param {string} sEntityId The entity ID
         * @private
         */
        _loadEntity: function(sTableId, sEntityId) {
            const oViewModel = this.getModel("viewModel");
            
            // Set busy state
            oViewModel.setProperty("/busy", true);
            
            console.log("Loading entity data", sTableId, sEntityId);
            
            // Get metadata to determine primary key
            this.getTableMetadata(sTableId).then((oMetadata) => {
                const sPrimaryKey = oMetadata.primaryKey;
                
                console.log("Primary key from metadata:", sPrimaryKey);
                
                if (!sPrimaryKey) {
                    this.showErrorMessage("Error: No primary key defined in metadata");
                    oViewModel.setProperty("/busy", false);
                    return;
                }
                
                // Check if entity ID is valid
                if (!sEntityId) {
                    this.showErrorMessage("Error: No entity ID specified");
                    oViewModel.setProperty("/busy", false);
                    return;
                }
                
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
                            return;
                        }
                        
                        if (!data) {
                            console.error("No data found for entity");
                            this.showErrorMessage("Entity not found");
                            oViewModel.setProperty("/busy", false);
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
                        
                        // Configure form fields
                        this._configureForm(oMetadata, data);
                        
                        // Load related items if any
                        if (oMetadata.relations && oMetadata.relations.length > 0) {
                            this._loadRelatedItems(oMetadata, data);
                        }
                        
                        oViewModel.setProperty("/busy", false);
                    })
                    .catch(error => {
                        console.error("Error in Supabase query:", error);
                        this.showErrorMessage("Error loading entity: " + error.message);
                        oViewModel.setProperty("/busy", false);
                    });
            }).catch((error) => {
                console.error("Error getting table metadata:", error);
                this.showErrorMessage("Error loading metadata: " + error.message);
                oViewModel.setProperty("/busy", false);
            });
        },
        
        /**
         * Configure form fields based on metadata
         * @param {Object} oMetadata The table metadata
         * @param {Object} oData The entity data
         * @private
         */
        _configureForm: function(oMetadata, oData) {
            try {
                // Get the SimpleForm from the view
                const oForm = this.getView().byId("entityDetailsForm");
                
                // Clear existing form content
                oForm.removeAllContent();
                
                // Add fields based on metadata
                oMetadata.columns.forEach((oColumnMetadata) => {
                    // Create label
                    const oLabel = new Label({
                        text: oColumnMetadata.label,
                        required: oColumnMetadata.required
                    });
                    
                    oForm.addContent(oLabel);
                    
                    // Create field
                    let oField;
                    const bEditable = oColumnMetadata.editable !== false;
                    
                    switch (oColumnMetadata.type) {
                        case "string":
                            if (bEditable) {
                                oField = new Input({
                                    value: "{viewModel>/entity/" + oColumnMetadata.name + "}",
                                    enabled: "{viewModel>/editMode}"
                                });
                            } else {
                                oField = new Text({
                                    text: "{viewModel>/entity/" + oColumnMetadata.name + "}"
                                });
                            }
                            break;
                        case "text":
                            if (bEditable) {
                                oField = new TextArea({
                                    value: "{viewModel>/entity/" + oColumnMetadata.name + "}",
                                    rows: 4,
                                    width: "100%",
                                    enabled: "{viewModel>/editMode}"
                                });
                            } else {
                                oField = new Text({
                                    text: "{viewModel>/entity/" + oColumnMetadata.name + "}"
                                });
                            }
                            break;
                        case "number":
                            if (bEditable) {
                                oField = new Input({
                                    value: "{viewModel>/entity/" + oColumnMetadata.name + "}",
                                    type: "Number",
                                    enabled: "{viewModel>/editMode}"
                                });
                            } else {
                                oField = new Text({
                                    text: "{viewModel>/entity/" + oColumnMetadata.name + "}"
                                });
                            }
                            break;
                        case "date":
                            if (bEditable) {
                                oField = new DatePicker({
                                    value: {
                                        path: "viewModel>/entity/" + oColumnMetadata.name,
                                        formatter: function(value) {
                                            if (!value) {
                                                return null;
                                            }
                                            
                                            return new Date(value);
                                        }
                                    },
                                    enabled: "{viewModel>/editMode}"
                                });
                            } else {
                                oField = new Text({
                                    text: {
                                        path: "viewModel>/entity/" + oColumnMetadata.name,
                                        formatter: function(value) {
                                            if (!value) {
                                                return "";
                                            }
                                            
                                            return new Date(value).toLocaleDateString();
                                        }
                                    }
                                });
                            }
                            break;
                        case "boolean":
                            if (bEditable) {
                                oField = new CheckBox({
                                    selected: "{viewModel>/entity/" + oColumnMetadata.name + "}",
                                    enabled: "{viewModel>/editMode}"
                                });
                            } else {
                                oField = new Text({
                                    text: {
                                        path: "viewModel>/entity/" + oColumnMetadata.name,
                                        formatter: function(value) {
                                            return value ? "Yes" : "No";
                                        }
                                    }
                                });
                            }
                            break;
                        case "relation":
                            if (bEditable) {
                                oField = new ComboBox({
                                    selectedKey: "{viewModel>/entity/" + oColumnMetadata.name + "}",
                                    enabled: "{viewModel>/editMode}"
                                });
                                
                                // Load related entities
                                this._loadRelationOptions(oField, oColumnMetadata.relation, oColumnMetadata.name);
                            } else {
                                oField = new Text({
                                    text: "{viewModel>/entity/" + oColumnMetadata.name + "_text}"
                                });
                            }
                            break;
                        default:
                            oField = new Text({
                                text: "{viewModel>/entity/" + oColumnMetadata.name + "}"
                            });
                    }
                    
                    oForm.addContent(oField);
                });
            } catch (e) {
                console.error("Error configuring form:", e);
                this.showErrorMessage("Error configuring form: " + e.message);
            }
        },
        
        /**
         * Load options for relation fields
         * @param {sap.m.ComboBox} oComboBox The combo box to fill
         * @param {string} sRelatedTable The related table
         * @param {string} sFieldName The field name
         * @private
         */
                // Line 350 context (fix by removing the unused parameter):
        _loadRelationOptions: function(oComboBox, sRelatedTable) {
            // Get metadata for related table
            this.getTableMetadata(sRelatedTable).then(function(oMetadata) {
                const sPrimaryKey = oMetadata.primaryKey;
                const sTitleField = oMetadata.titleField || sPrimaryKey;
                
                // Load related entities
                this.getSupabaseClient()
                    .from(sRelatedTable)
                    .select('*')
                    .then(({ data, error }) => {
                        if (error) {
                            console.error("Error loading relation options", error);
                            return;
                        }
                        
                        // Add items to combo box
                        data.forEach((oRelatedEntity) => {
                            oComboBox.addItem(new sap.ui.core.Item({
                                key: oRelatedEntity[sPrimaryKey],
                                text: oRelatedEntity[sTitleField]
                            }));
                        });
                    });
            }.bind(this));
        },
        
        /**
         * Load related items
         * @param {Object} oMetadata The table metadata
         * @param {Object} oData The entity data
         * @private
         */
        _loadRelatedItems: function(oMetadata, oData) {
            try {
                const oViewModel = this.getModel("viewModel");
                const oRelatedItemsTable = this.getView().byId("relatedItemsTable");
                
                if (!oRelatedItemsTable) {
                    console.error("Related items table not found in view");
                    return;
                }
                
                // Get the first relation
                const oRelation = oMetadata.relations[0];
                
                // Get metadata for related table
                this.getTableMetadata(oRelation.table).then((oRelatedMetadata) => {
                    // Configure table columns
                    oRelatedItemsTable.removeAllColumns();
                    
                    // Add columns for visible fields
                    const visibleColumns = oRelatedMetadata.columns.filter(col => col.visible).slice(0, 5);
                    visibleColumns.forEach(col => {
                        oRelatedItemsTable.addColumn(new Column({
                            header: new Text({ text: col.label })
                        }));
                    });
                    
                    // Add an actions column
                    oRelatedItemsTable.addColumn(new Column({
                        header: new Text({ text: "Actions" }),
                        hAlign: "End"
                    }));
                    
                    // Load related data
                    this.getSupabaseClient()
                        .from(oRelation.table)
                        .select('*')
                        .eq(oRelation.foreignKey, oData[oMetadata.primaryKey])
                        .then(({ data: relatedData, error }) => {
                            if (error) {
                                console.error("Error loading related items", error);
                                return;
                            }
                            
                            // Store related items in view model
                            oViewModel.setProperty("/relatedItems", relatedData || []);
                            oViewModel.setProperty("/filteredRelatedItems", relatedData || []);
                            
                            // Configure item template
                            const oTemplate = new sap.m.ColumnListItem({
                                type: "Active",
                                press: this.onRelatedItemPress.bind(this)
                            });
                            
                            // Add cells for data columns
                            visibleColumns.forEach(col => {
                                let cell;
                                
                                if (col.type === "date") {
                                    cell = new Text({
                                        text: {
                                            path: 'viewModel>' + col.name,
                                            formatter: function(value) {
                                                if (!value) return "";
                                                return new Date(value).toLocaleDateString();
                                            }
                                        }
                                    });
                                } else if (col.type === "boolean") {
                                    cell = new Text({
                                        text: {
                                            path: 'viewModel>' + col.name,
                                            formatter: function(value) {
                                                return value ? "Yes" : "No";
                                            }
                                        }
                                    });
                                } else {
                                    cell = new Text({ 
                                        text: '{viewModel>' + col.name + '}' 
                                    });
                                }
                                
                                oTemplate.addCell(cell);
                            });
                            
                            // Add actions cell
                            const actionsCell = new sap.m.HBox({
                                items: [
                                    new sap.m.Button({
                                        icon: "sap-icon://edit",
                                        type: "Transparent",
                                        press: this.onEditRelatedItemPress.bind(this),
                                        tooltip: "Edit"
                                    }),
                                    new sap.m.Button({
                                        icon: "sap-icon://delete",
                                        type: "Transparent",
                                        press: this.onDeleteRelatedItemPress.bind(this),
                                        tooltip: "Delete"
                                    })
                                ]
                            });
                            
                            oTemplate.addCell(actionsCell);
                            
                            // Bind the table
                            oRelatedItemsTable.bindItems({
                                path: "viewModel>/filteredRelatedItems",
                                template: oTemplate
                            });
                        });
                });
            } catch (e) {
                console.error("Error loading related items:", e);
                this.showErrorMessage("Error loading related items: " + e.message);
            }
        },
        
        /**
         * Handler for related items search
         * @param {sap.ui.base.Event} oEvent The search event
         */
        onRelatedItemsSearch: function(oEvent) {
            const sQuery = oEvent.getParameter("query");
            const oViewModel = this.getModel("viewModel");
            const aItems = oViewModel.getProperty("/relatedItems");
            
            // If no query, show all items
            if (!sQuery) {
                oViewModel.setProperty("/filteredRelatedItems", aItems);
                return;
            }
            
            // Filter items
            const sQueryLower = sQuery.toLowerCase();
            const aFilteredItems = aItems.filter(item => {
                // Search in all properties
                return Object.values(item).some(value => {
                    if (value === null || value === undefined) {
                        return false;
                    }
                    
                    return String(value).toLowerCase().includes(sQueryLower);
                });
            });
            
            oViewModel.setProperty("/filteredRelatedItems", aFilteredItems);
        },
        
        /**
         * Handler for "View Related" button press
         */
        onViewRelatedPress: function() {
            // Scroll to related items section
            const oObjectPageLayout = this.getView().byId("ObjectPageLayout");
            const oSection = this.getView().byId("relatedItemsSection");
            
            if (oObjectPageLayout && oSection) {
                oObjectPageLayout.scrollToSection(oSection.getId());
            }
        },
        
        /**
         * Handler for "Export Details" button press
         */
        onExportDetailsPress: function() {
            // Implementation for exporting details
            this.showInformationMessage("Export functionality not implemented yet");
        },
        
        /**
         * Handler for edit button press
         */
        onEditPress: function() {
            this.getModel("viewModel").setProperty("/editMode", true);
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
            
            // Get metadata to determine primary key
            this.getTableMetadata(sTableId).then((oMetadata) => {
                const sPrimaryKey = oMetadata.primaryKey;
                const sPrimaryKeyValue = oEntityData[sPrimaryKey];
                
                // Create a copy of the data without read-only fields
                const oDataToUpdate = {};
                
                oMetadata.columns.forEach((oColumnMetadata) => {
                    // Skip non-editable fields
                    if (oColumnMetadata.editable === false) {
                        return;
                    }
                    
                    // Skip primary key
                    if (oColumnMetadata.name === sPrimaryKey) {
                        return;
                    }
                    
                    // Skip relation objects
                    if (oColumnMetadata.name.endsWith("_text") || oColumnMetadata.name.endsWith("_obj")) {
                        return;
                    }
                    
                    // Add field to update data
                    oDataToUpdate[oColumnMetadata.name] = oEntityData[oColumnMetadata.name];
                });
                
                // Update entity
                this.getSupabaseClient()
                    .from(sTableId)
                    .update(oDataToUpdate)
                    .eq(sPrimaryKey, sPrimaryKeyValue)
                    .then(({ error }) => {
                        if (error) {
                            this.showErrorMessage("Error updating entity", error);
                            oViewModel.setProperty("/busy", false);
                            return;
                        }
                        
                        // Reload entity
                        this._loadEntity(sTableId, sPrimaryKeyValue);
                        
                        // Exit edit mode
                        oViewModel.setProperty("/editMode", false);
                        this.showSuccessMessage("Entity updated successfully");
                    });
            });
        },
        
        /**
         * Handler for cancel button press
         */
        onCancelPress: function() {
            // Exit edit mode and reload entity
            const oViewModel = this.getModel("viewModel");
            const sTableId = oViewModel.getProperty("/tableId");
            const sEntityId = oViewModel.getProperty("/entityId");
            
            oViewModel.setProperty("/editMode", false);
            this._loadEntity(sTableId, sEntityId);
        },
        
        /**
         * Handler for delete button press
         */
        onDeletePress: function() {
            const oViewModel = this.getModel("viewModel");
            const sTableId = oViewModel.getProperty("/tableId");
            const sEntityId = oViewModel.getProperty("/entityId");
            
            // Confirm deletion
            this.showConfirmationDialog(
                "Are you sure you want to delete this entity?",
                () => {
                    // Get metadata to determine primary key
                    this.getTableMetadata(sTableId).then((oMetadata) => {
                        const sPrimaryKey = oMetadata.primaryKey;
                        
                        // Delete entity
                        this.getSupabaseClient()
                            .from(sTableId)
                            .delete()
                            .eq(sPrimaryKey, sEntityId)
                            .then(({ error }) => {
                                if (error) {
                                    this.showErrorMessage("Error deleting entity", error);
                                    return;
                                }
                                
                                // Navigate back to list
                                this.getRouter().navTo("entityList", {
                                    table: sTableId
                                });
                                
                                this.showSuccessMessage("Entity deleted successfully");
                            });
                    });
                },
                "Delete Confirmation"
            );
        },
        
        /**
         * Handler for related item press
         * @param {sap.ui.base.Event} oEvent The list item press event
         */
        onRelatedItemPress: function(oEvent) {
            try {
                const oItem = oEvent.getSource();
                
                // Get the binding context
                const oContext = oItem.getBindingContext("viewModel");
                if (!oContext) {
                    console.error("No binding context found for related item");
                    return;
                }
                
                const oData = oContext.getObject();
                if (!oData) {
                    console.error("No data found in binding context for related item");
                    return;
                }
                
                const oViewModel = this.getModel("viewModel");
                const sTableId = oViewModel.getProperty("/tableId");
                
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
                        
                        if (sPrimaryKeyValue === undefined || sPrimaryKeyValue === null) {
                            console.error("Primary key value not found in related item data", sPrimaryKey);
                            return;
                        }
                        
                        console.log("Navigating to related item:", {
                            table: oRelation.table,
                            id: sPrimaryKeyValue
                        });
                        
                        // Navigate to detail page of related item
                        this.getRouter().navTo("entityDetail", {
                            table: oRelation.table,
                            id: sPrimaryKeyValue
                        });
                    });
                });
            } catch (e) {
                console.error("Error in related item press:", e);
                this.showErrorMessage("Error navigating to related item: " + e.message);
            }
        },
        
        /**
         * Handler for add related item button press
         */
        onAddRelatedItemPress: function() {
            const oViewModel = this.getModel("viewModel");
            const sTableId = oViewModel.getProperty("/tableId");
            
            // Get metadata for the current table
            this.getTableMetadata(sTableId).then((oMetadata) => {
                // Get the first relation
                if (!oMetadata.relations || oMetadata.relations.length === 0) {
                    this.showErrorMessage("No relations defined for this entity");
                    return;
                }
                
                const oRelation = oMetadata.relations[0];
                
                // Navigate to create page for the related table
                this.getRouter().navTo("entityCreate", {
                    table: oRelation.table
                });
            });
        },
        
        /**
         * Handler for edit related item button press
         * @param {sap.ui.base.Event} oEvent The button press event
         */
        onEditRelatedItemPress: function(oEvent) {
            // Get the list item from the button's parent
            const oButton = oEvent.getSource();
            const oListItem = oButton.getParent().getParent();
            
            // Get the binding context
            const oContext = oListItem.getBindingContext("viewModel");
            if (!oContext) {
                console.error("No binding context found for related item");
                return;
            }
            
            const oData = oContext.getObject();
            const oViewModel = this.getModel("viewModel");
            const sTableId = oViewModel.getProperty("/tableId");
            
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
                    
                    // Navigate to detail page of related item
                    this.getRouter().navTo("entityDetail", {
                        table: oRelation.table,
                        id: sPrimaryKeyValue
                    });
                });
            });
        },
        
        /**
         * Handler for delete related item button press
         * @param {sap.ui.base.Event} oEvent The button press event
         */
        onDeleteRelatedItemPress: function(oEvent) {
            // Get the list item from the button's parent
            const oButton = oEvent.getSource();
            const oListItem = oButton.getParent().getParent();
            
            // Get the binding context
            const oContext = oListItem.getBindingContext("viewModel");
            if (!oContext) {
                console.error("No binding context found for related item");
                return;
            }
            
            const oData = oContext.getObject();
            const oViewModel = this.getModel("viewModel");
            const sTableId = oViewModel.getProperty("/tableId");
            
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
                    
                    // Confirm deletion
                    this.showConfirmationDialog(
                        "Are you sure you want to delete this related item?",
                        () => {
                            // Delete related item
                            this.getSupabaseClient()
                                .from(oRelation.table)
                                .delete()
                                .eq(sPrimaryKey, sPrimaryKeyValue)
                                .then(({ error }) => {
                                    if (error) {
                                        this.showErrorMessage("Error deleting related item", error);
                                        return;
                                    }
                                    
                                    // Reload entity to refresh related items
                                    this._loadEntity(sTableId, oViewModel.getProperty("/entityId"));
                                    this.showSuccessMessage("Related item deleted successfully");
                                });
                        },
                        "Delete Confirmation"
                    );
                });
            });
        },
        /**
         * Navigation handler
         */
        onNavBack: function() {
            const sTableId = this.getModel("viewModel").getProperty("/tableId");
            
            // Navigate back to list
            this.getRouter().navTo("entityList", {
                table: sTableId
            });
        },

        // Line 205 context (fix by removing the unused parameter):
        getRelatedRecords: function(sTableId, sForeignKey, sPrimaryKeyValue) {
            return new Promise((resolve, reject) => {
                this.getSupabaseClient()
                    .from(sTableId)
                    .select('*')
                    .eq(sForeignKey, sPrimaryKeyValue)
                    .then(({ data, error }) => {
                        if (error) {
                            reject(error);
                            return;
                        }
                        resolve(data || []);
                    })
                    .catch(error => {
                        reject(error);
                    });
            });
        }

        


    });

    
});