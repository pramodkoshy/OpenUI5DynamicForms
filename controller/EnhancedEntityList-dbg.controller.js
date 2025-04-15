sap.ui.define([
    "com/supabase/easyui5/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/m/Column",
    "sap/m/Text",
    "sap/m/Label",
    "com/supabase/easyui5/control/FormDialog"
], function(BaseController, JSONModel, Column, Text, Label, FormDialog) {
    "use strict";

    return BaseController.extend("com.supabase.easyui5.controller.EnhancedEntityList", {
        
        /**
         * Lifecycle hook when the controller is initialized
         */
        onInit: function() {
            const oViewModel = new JSONModel({
                tableName: "",
                tableId: "",
                items: [],
                busy: false
            });
            
            this.setModel(oViewModel, "viewModel");
            
            // Register for route matched event
            this.getRouter().getRoute("entityList").attachPatternMatched(this._onRouteMatched, this);
        },
        
        /**
         * Route matched handler
         * @param {sap.ui.base.Event} oEvent The route matched event
         * @private
         */
        _onRouteMatched: function(oEvent) {
            const sTableId = oEvent.getParameter("arguments").table;
            console.log("EntityList route matched with table:", sTableId);
            
            // Store the table ID in the view model
            const oViewModel = this.getModel("viewModel");
            oViewModel.setProperty("/tableId", sTableId);
            
            // Set table name based on the ID (capitalize first letter)
            const sTableName = sTableId.charAt(0).toUpperCase() + sTableId.slice(1).replace(/_/g, " ");
            oViewModel.setProperty("/tableName", sTableName);
            
            // Set the page title
            this.getView().byId("entityListPage").setTitle(sTableName + " List");
            
            // Load metadata for the table
            this.getTableMetadata(sTableId).then((oMetadata) => {
                // Store metadata for later use
                this._oTableMetadata = oMetadata;
                
                // Configure table columns based on metadata
                this._configureTable(oMetadata);
                
                // Load the data
                this._loadData(sTableId, oMetadata);
            }).catch(error => {
                console.error("Error loading metadata:", error);
            });
        },
        
        /**
         * Configure the table columns based on metadata
         * @param {Object} oMetadata The table metadata
         * @private
         */
        _configureTable: function(oMetadata) {
            // ... existing table configuration code ...
        },
        
        /**
         * Load data from Supabase
         * @param {string} sTableId The table ID
         * @param {Object} oMetadata The table metadata
         * @private
         */
        _loadData: function(sTableId, oMetadata) {
            // ... existing load data code ...
        },
        
        /**
         * Handler for the item press (navigation to detail)
         * @param {sap.ui.base.Event} oEvent The item press event
         */
        onItemPress: function(oEvent) {
            // ... existing item press code ...
        },
        
        /**
         * Enhanced create button press handler using FormDialog
         */
        onCreatePress: function() {
            const sTableId = this.getModel("viewModel").getProperty("/tableId");
            const sTableName = this.getModel("viewModel").getProperty("/tableName");
            
            // Create and open form dialog for entity creation
            this._oCreateDialog = new FormDialog(this, {
                title: "Create New " + sTableName,
                mode: "create",
                tableId: sTableId,
                // We don't need to predefine entity data as the dialog will create defaults
                
                // Handle successful creation
                successCallback: function(oCreatedEntity) {
                    this.showSuccessMessage(sTableName + " created successfully");
                    
                    // Refresh the list to show the new entity
                    this._loadData(sTableId, this._oTableMetadata);
                }.bind(this),
                
                // Optional: Handle cancel action
                cancelCallback: function() {
                    console.log("Create operation cancelled");
                }
            }).open();
        },
        
        /**
         * Add context menu with edit option to table items
         * @param {sap.ui.base.Event} oEvent The press event
         */
        onItemContextMenu: function(oEvent) {
            // Get selected item and context
            const oItem = oEvent.getSource();
            const oContext = oItem.getBindingContext("viewModel");
            
            if (!oContext) {
                return;
            }
            
            // Get entity data and metadata
            const oEntityData = oContext.getObject();
            const sTableId = this.getModel("viewModel").getProperty("/tableId");
            const sTableName = this.getModel("viewModel").getProperty("/tableName");
            
            // Get primary key value
            const sPrimaryKey = this._oTableMetadata.primaryKey;
            const sEntityId = oEntityData[sPrimaryKey];
            
            // Create context menu
            if (!this._oContextMenu) {
                this._oContextMenu = new sap.m.Menu({
                    items: [
                        new sap.m.MenuItem({
                            text: "Edit",
                            icon: "sap-icon://edit",
                            press: function() {
                                this._openEditDialog(sTableId, sEntityId, oEntityData, sTableName);
                            }.bind(this)
                        }),
                        new sap.m.MenuItem({
                            text: "Delete",
                            icon: "sap-icon://delete",
                            press: function() {
                                this._confirmAndDeleteEntity(sTableId, sEntityId, sTableName);
                            }.bind(this)
                        })
                    ]
                });
                
                this.getView().addDependent(this._oContextMenu);
            }
            
            // Open context menu
            this._oContextMenu.openBy(oItem);
        },
        
        /**
         * Add quick edit button to table items
         * @param {sap.ui.base.Event} oEvent The press event 
         */
        onEditButtonPress: function(oEvent) {
            // Get button and parent list item
            const oButton = oEvent.getSource();
            const oItem = oButton.getParent().getParent(); // Button is in HBox in ColumnListItem
            
            // Get context
            const oContext = oItem.getBindingContext("viewModel");
            
            if (!oContext) {
                return;
            }
            
            // Get entity data and metadata
            const oEntityData = oContext.getObject();
            const sTableId = this.getModel("viewModel").getProperty("/tableId");
            const sTableName = this.getModel("viewModel").getProperty("/tableName");
            
            // Get primary key value
            const sPrimaryKey = this._oTableMetadata.primaryKey;
            const sEntityId = oEntityData[sPrimaryKey];
            
            // Open edit dialog
            this._openEditDialog(sTableId, sEntityId, oEntityData, sTableName);
        },
        
        /**
         * Open edit dialog
         * @param {string} sTableId Table ID
         * @param {string} sEntityId Entity ID
         * @param {Object} oEntityData Entity data
         * @param {string} sTableName Table name
         * @private
         */
        _openEditDialog: function(sTableId, sEntityId, oEntityData, sTableName) {
            // Create and open form dialog for entity edit
            this._oEditDialog = new FormDialog(this, {
                title: "Edit " + sTableName,
                mode: "edit",
                tableId: sTableId,
                entityId: sEntityId,
                entity: oEntityData,
                // Optional: We can pass the metadata directly to avoid another fetch
                metadata: this._oTableMetadata,
                
                // Handle successful update
                successCallback: function(oUpdatedEntity) {
                    this.showSuccessMessage(sTableName + " updated successfully");
                    
                    // Refresh the list to show the updated entity
                    this._loadData(sTableId, this._oTableMetadata);
                }.bind(this),
                
                // Optional: Handle cancel action
                cancelCallback: function() {
                    console.log("Edit operation cancelled");
                }
            }).open();
        },
        
        /**
         * Confirm and delete entity
         * @param {string} sTableId Table ID
         * @param {string} sEntityId Entity ID
         * @param {string} sTableName Table name
         * @private
         */
        _confirmAndDeleteEntity: function(sTableId, sEntityId, sTableName) {
            // Show confirmation dialog
            this.showConfirmationDialog(
                "Are you sure you want to delete this " + sTableName + "?",
                function() {
                    // Delete the entity
                    this.getSupabaseClient()
                        .from(sTableId)
                        .delete()
                        .eq(this._oTableMetadata.primaryKey, sEntityId)
                        .then(({ error }) => {
                            if (error) {
                                this.showErrorMessage("Error deleting " + sTableName, error);
                                return;
                            }
                            
                            this.showSuccessMessage(sTableName + " deleted successfully");
                            
                            // Refresh the list
                            this._loadData(sTableId, this._oTableMetadata);
                        })
                        .catch(error => {
                            this.showErrorMessage("Error deleting " + sTableName, error);
                        });
                }.bind(this),
                "Delete Confirmation"
            );
        },
        
        /**
         * Handler for bulk delete button press
         */
        onDeleteSelectedPress: function() {
            // ... bulk delete implementation ...
        },
        
        /**
         * Handler for the refresh button press
         */
        onRefreshPress: function() {
            const sTableId = this.getModel("viewModel").getProperty("/tableId");
            
            // Load the data
            this._loadData(sTableId, this._oTableMetadata);
        },
        
        /**
         * Handler for the search
         * @param {sap.ui.base.Event} oEvent The search event
         */
        onSearch: function(oEvent) {
            // ... existing search code ...
        },
        
        /**
         * Clean up resources when controller is destroyed
         */
        onExit: function() {
            // Destroy dialogs and menus
            if (this._oCreateDialog) {
                this._oCreateDialog.destroy();
                this._oCreateDialog = null;
            }
            
            if (this._oEditDialog) {
                this._oEditDialog.destroy();
                this._oEditDialog = null;
            }
            
            if (this._oContextMenu) {
                this._oContextMenu.destroy();
                this._oContextMenu = null;
            }
        }
    });
});