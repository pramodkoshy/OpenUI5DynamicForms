sap.ui.define([
    "sap/ui/core/mvc/ControllerExtension"
], function(ControllerExtension) {
    "use strict";

    return ControllerExtension.extend("com.supabase.easyui5.controller.EntityDetailRelatedItems", {
        
        /**
         * Load related items for the current entity
         * @param {Object} oMetadata The table metadata
         * @param {Object} oData The entity data
         * @private
         */
        _loadRelatedItems: function(oMetadata, oData) {
            if (!oMetadata.relations || oMetadata.relations.length === 0) {
                return Promise.resolve([]);
            }
            
            const oViewModel = this.getModel("viewModel");
            const sTableId = oViewModel.getProperty("/tableId");
            const sPrimaryKey = oMetadata.primaryKey;
            const oRelation = oMetadata.relations[0];
            
            console.log("Loading related items from table:", oRelation.table);
            
            // If no primary key value, return
            if (!oData[sPrimaryKey]) {
                return Promise.resolve([]);
            }
            
            // Load related items from the related table
            return this.getSupabaseClient()
                .from(oRelation.table)
                .select('*')
                .eq(oRelation.foreignKey, oData[sPrimaryKey])
                .then(({ data: relatedData, error }) => {
                    if (error) {
                        console.error("Error loading related items", error);
                        this.showErrorMessage("Error loading related items", error);
                        return [];
                    }
                    
                    console.log("Related items loaded:", relatedData ? relatedData.length : 0);
                    
                    // Process relation fields in related items
                    return this._processRelatedItemsRelations(oRelation.table, relatedData || [])
                        .then(() => {
                            // Update view model
                            oViewModel.setProperty("/relatedItems", relatedData || []);
                            oViewModel.setProperty("/filteredRelatedItems", relatedData || []);
                            
                            // Configure the related items table
                            this._configureRelatedItemsTable(oRelation.table);
                            
                            // Set busy to false
                            oViewModel.setProperty("/busy", false);
                            
                            return relatedData || [];
                        });
                })
                .catch(error => {
                    console.error("Error fetching related items", error);
                    this.showErrorMessage("Error fetching related items", error);
                    oViewModel.setProperty("/busy", false);
                    return [];
                });
        },
        
        /**
         * Process relation fields in related items
         * @param {string} sTableId The table ID
         * @param {Array} aItems The items array
         * @returns {Promise} A promise that resolves with processed items
         * @private 
         */
        _processRelatedItemsRelations: function(sTableId, aItems) {
            if (!aItems || aItems.length === 0) {
                return Promise.resolve(aItems);
            }
            
            // Use a promise to handle async operations
            return this.getTableMetadata(sTableId)
                .then(oMetadata => {
                    // Find relation columns
                    const aRelationColumns = oMetadata.columns.filter(col => col.type === "relation");
                    
                    if (aRelationColumns.length === 0) {
                        return aItems;
                    }
                    
                    // Process each relation column with promise chain
                    const processPromises = aItems.map(oItem => {
                        const relationPromises = aRelationColumns
                            .filter(oColumn => oItem[oColumn.name])
                            .map(oColumn => {
                                const relatedId = oItem[oColumn.name];
                                const relatedTable = oColumn.relation;
                                
                                return this.getTableMetadata(relatedTable)
                                    .then(relatedMetadata => {
                                        return this.getSupabaseClient()
                                            .from(relatedTable)
                                            .select('*')
                                            .eq(relatedMetadata.primaryKey, relatedId)
                                            .single()
                                            .then(({ data: relatedData, error: relatedError }) => {
                                                if (!relatedError && relatedData) {
                                                    // Store related text
                                                    oItem[oColumn.name + "_text"] = 
                                                        relatedData[relatedMetadata.titleField];
                                                }
                                                return oItem;
                                            })
                                            .catch(e => {
                                                console.error("Error processing relation in related item", e);
                                                return oItem;
                                            });
                                    });
                            });
                        
                        return Promise.all(relationPromises).then(() => oItem);
                    });
                    
                    return Promise.all(processPromises)
                        .then(processedItems => {
                            const oViewModel = this.getModel("viewModel");
                            oViewModel.setProperty("/filteredRelatedItems", processedItems);
                            oViewModel.setProperty("/relatedItems", processedItems);
                            return processedItems;
                        });
                })
                .catch(e => {
                    console.error("Error processing relations in related items", e);
                    return aItems;
                });
        },

        /**
         * Configure the related items table
         * @param {string} sTableId The table ID
         * @private
         */
        _configureRelatedItemsTable: function(sTableId) {
            this.getTableMetadata(sTableId).then(oMetadata => {
                const oTable = this.getView().byId("relatedItemsTable");
                
                if (!oTable) {
                    console.error("Related items table not found");
                    return;
                }
                
                // Clear existing columns
                oTable.removeAllColumns();
                
                // Get the list item template
                let oTemplate = oTable.getBindingInfo("items") && oTable.getBindingInfo("items").template;
                if (!oTemplate) {
                    oTemplate = new sap.m.ColumnListItem({
                        type: "Navigation",
                        press: this.onRelatedItemPress.bind(this)
                    });
                } else {
                    oTemplate.removeAllCells();
                }
                
                // Add columns based on metadata (show only 5 most important columns)
                let aVisibleColumns = oMetadata.columns.filter(col => col.visible);
                if (aVisibleColumns.length > 5) {
                    aVisibleColumns = aVisibleColumns.slice(0, 5);
                }
                
                aVisibleColumns.forEach(oColumnMetadata => {
                    // Add column
                    oTable.addColumn(new sap.m.Column({
                        header: new sap.m.Label({
                            text: oColumnMetadata.label
                        })
                    }));
                    
                    // Add cell
                    let oCell;
                    
                    if (oColumnMetadata.type === "relation") {
                        oCell = new sap.m.Text({
                            text: "{viewModel>" + oColumnMetadata.name + "_text}"
                        });
                    } else if (oColumnMetadata.type === "boolean") {
                        oCell = new sap.m.Text({
                            text: {
                                path: "viewModel>" + oColumnMetadata.name,
                                formatter: this.formatter.formatBoolean
                            }
                        });
                    } else if (oColumnMetadata.type === "date") {
                        oCell = new sap.m.Text({
                            text: {
                                path: "viewModel>" + oColumnMetadata.name,
                                formatter: this.formatter.formatDate
                            }
                        });
                    } else if (oColumnMetadata.type === "number") {
                        oCell = new sap.m.Text({
                            text: {
                                path: "viewModel>" + oColumnMetadata.name,
                                formatter: this.formatter.formatNumber
                            }
                        });
                    } else {
                        oCell = new sap.m.Text({
                            text: "{viewModel>" + oColumnMetadata.name + "}"
                        });
                    }
                    
                    oTemplate.addCell(oCell);
                });
                
                // Add actions column
                oTable.addColumn(new sap.m.Column({
                    header: new sap.m.Label({
                        text: "Actions"
                    }),
                    hAlign: "Right"
                }));
                
                // Add actions buttons
                const oActions = new sap.m.HBox({
                    justifyContent: "End",
                    items: [
                        new sap.m.Button({
                            icon: "sap-icon://edit",
                            type: "Transparent",
                            tooltip: "Edit",
                            press: this.onEditRelatedItemPress.bind(this)
                        }),
                        new sap.m.Button({
                            icon: "sap-icon://delete",
                            type: "Transparent",
                            tooltip: "Delete",
                            press: this.onDeleteRelatedItemPress.bind(this)
                        })
                    ]
                });
                
                oTemplate.addCell(oActions);
                
                // Rebind the table with the updated template
                oTable.bindItems({
                    path: "viewModel>/filteredRelatedItems",
                    template: oTemplate
                });
                
                console.log("Related items table configured");
            });
        },
        
        /**
         * Handler for related items search
         * @param {sap.ui.base.Event} oEvent The search event
         */
        onRelatedItemsSearch: function(oEvent) {
            const sQuery = oEvent.getParameter("value");
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
         * Handler for related item press
         * @param {sap.ui.base.Event} oEvent The item press event
         */
        onRelatedItemPress: function(oEvent) {
            const oItem = oEvent.getSource();
            const oContext = oItem.getBindingContext("viewModel");
            
            if (!oContext) {
                return;
            }
            
            const oData = oContext.getObject();
            const oViewModel = this.getModel("viewModel");
            const sTableId = oViewModel.getProperty("/tableId");
            
            this.getTableMetadata(sTableId).then(oMetadata => {
                if (!oMetadata.relations || oMetadata.relations.length === 0) {
                    return;
                }
                
                const oRelation = oMetadata.relations[0];
                
                this.getTableMetadata(oRelation.table).then(oRelatedMetadata => {
                    const sPrimaryKey = oRelatedMetadata.primaryKey;
                    const sPrimaryKeyValue = oData[sPrimaryKey];
                    
                    // Navigate to detail view of related item
                    this.getRouter().navTo("entityDetail", {
                        table: oRelation.table,
                        id: sPrimaryKeyValue
                    });
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
         * Handler for add related item button press
         */
        onAddRelatedItemPress: function() {
            const oViewModel = this.getModel("viewModel");
            const sTableId = oViewModel.getProperty("/tableId");
            const sEntityId = oViewModel.getProperty("/entityId");
            
            // Get metadata for the current table
            this.getTableMetadata(sTableId).then((oMetadata) => {
                // Get the first relation
                if (!oMetadata.relations || oMetadata.relations.length === 0) {
                    console.error("No relations defined in metadata");
                    return;
                }
                
                const oRelation = oMetadata.relations[0];
                
                // Store parent information in session storage for use in create form
                const oParentInfo = {
                    parentTable: sTableId,
                    parentId: sEntityId,
                    foreignKey: oRelation.foreignKey
                };
                
                sessionStorage.setItem("parentEntityInfo", JSON.stringify(oParentInfo));
                
                // Navigate to create page for related table
                this.getRouter().navTo("entityCreate", {
                    table: oRelation.table
                });
            });
        }
    });
});