sap.ui.define([
    "sap/ui/core/mvc/ControllerExtension",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/Text",
    "sap/m/MessageToast",
    "sap/ui/core/IconPool"
], function(ControllerExtension, Dialog, Button, Text, MessageToast, IconPool) {
    "use strict";

    return ControllerExtension.extend("com.supabase.easyui5.controller.EntityDetailActions", {
        
        /**
         * Handler for save button press
         * @public
         */
        onSavePress: function() {
            console.log("Save button pressed in extensions");
            
            const oViewModel = this.getModel("viewModel");
            const sTableId = oViewModel.getProperty("/tableId");
            const sEntityId = oViewModel.getProperty("/entityId");
            
            // Set busy state
            oViewModel.setProperty("/busy", true);
            
            // Get the current entity data directly from the model
            const oEntityData = JSON.parse(JSON.stringify(oViewModel.getProperty("/entity")));
            
            console.log("Full Entity Data:", JSON.stringify(oEntityData, null, 2));
            
            // Validate the data
            this.getTableMetadata(sTableId).then((oMetadata) => {
                // Store metadata for validation
                this.getView().getController()._currentMetadata = oMetadata;
                
                // Use the validation function from the form extension
                if (this.validateForm && typeof this.validateForm === "function") {
                    if (!this.validateForm()) {
                        this._showErrorDialog("Validation Error", "Please correct the errors in the form");
                        oViewModel.setProperty("/busy", false);
                        return;
                    }
                } else {
                    // Fallback to generic validation if extension function is not available
                    if (!this.validateForm(oMetadata, oEntityData)) {
                        this._showErrorDialog("Validation Error", "Please correct the errors in the form");
                        oViewModel.setProperty("/busy", false);
                        return;
                    }
                }
                
                const sPrimaryKey = oMetadata.primaryKey;
                
                // Create a copy of the data without read-only fields
                const oDataToUpdate = {};
                
                oMetadata.columns.forEach((oColumnMetadata) => {
                    // Skip non-editable fields and primary key
                    if (oColumnMetadata.editable === false && 
                        oColumnMetadata.name !== sPrimaryKey) {
                        return;
                    }
                    
                    // Add field to update data
                    oDataToUpdate[oColumnMetadata.name] = oEntityData[oColumnMetadata.name];
                });
                
                console.log("Prepared Update Data:", JSON.stringify(oDataToUpdate, null, 2));
                
                // Add server-side timestamp for updated_at
                if ('updated_at' in oEntityData) {
                    oDataToUpdate['updated_at'] = new Date().toISOString();
                }
                
                // Show confirmation dialog
                this._showConfirmationDialog(
                    "Save Changes", 
                    "Are you sure you want to save these changes?",
                    () => {
                        // Update entity
                        this.getSupabaseClient()
                            .from(sTableId)
                            .update(oDataToUpdate)
                            .eq(sPrimaryKey, sEntityId)
                            .then(({ data, error }) => {
                                oViewModel.setProperty("/busy", false);
                                
                                if (error) {
                                    console.error("Update error:", error);
                                    this._showErrorDialog("Update Error", "Error updating entity: " + error.message);
                                    return;
                                }
                                
                                // Reset edit mode
                                oViewModel.setProperty("/editMode", false);
                                
                                // Show success message
                                this._showSuccessDialog("Success", "Entity updated successfully");
                                
                                // Reload entity to refresh data
                                this._loadEntity(sTableId, sEntityId);
                            })
                            .catch(error => {
                                console.error("Error in Supabase query:", error);
                                this._showErrorDialog("Update Error", "Error updating entity: " + error.message);
                                oViewModel.setProperty("/busy", false);
                            });
                    },
                    () => {
                        // User canceled the save operation
                        oViewModel.setProperty("/busy", false);
                    }
                );
            }).catch(error => {
                console.error("Error getting table metadata:", error);
                this._showErrorDialog("Metadata Error", "Error getting table metadata: " + error.message);
                oViewModel.setProperty("/busy", false);
            });
        },
        
        /**
         * Handler for cancel button press
         * @public
         */
        onCancelPress: function() {
            console.log("Cancel button pressed in extensions");
            
            const oViewModel = this.getModel("viewModel");
            const sTableId = oViewModel.getProperty("/tableId");
            const sEntityId = oViewModel.getProperty("/entityId");
            
            // Show confirmation dialog for cancellation
            this._showConfirmationDialog(
                "Cancel Editing", 
                "Are you sure you want to discard your changes?",
                () => {
                    // Reset edit mode
                    oViewModel.setProperty("/editMode", false);
                    
                    // Reload the original entity data to discard changes
                    this._loadEntity(sTableId, sEntityId);
                },
                null // No action needed if user decides not to cancel
            );
        },
        
        /**
         * Handler for edit button press
         * @public
         */
        onEditPress: function() {
            console.log("Edit button pressed in extensions");
            
            const oViewModel = this.getModel("viewModel");
            
            // Initialize form fields collection if needed
            this.getView().getController()._formFields = {};
            
            // Toggle edit mode
            oViewModel.setProperty("/editMode", true);
            
            // Store original entity data for cancel
            const oEntityData = oViewModel.getProperty("/entity");
            oViewModel.setProperty("/originalEntity", JSON.parse(JSON.stringify(oEntityData)));
        },
        
        /**
         * Handler for delete button press
         * @public
         */
        onDeletePress: function() {
            const oViewModel = this.getModel("viewModel");
            const sTableId = oViewModel.getProperty("/tableId");
            const sEntityId = oViewModel.getProperty("/entityId");
            const sTableName = oViewModel.getProperty("/tableName");
            
            // Show delete confirmation dialog
            this._showConfirmationDialog(
                "Delete Confirmation", 
                "Are you sure you want to delete this " + sTableName + "?",
                () => {
                    // User confirmed, proceed with deletion
                    this._deleteEntity(sTableId, sEntityId);
                },
                null // No action needed if user decides not to delete
            );
        },
        
        /**
         * Delete the entity after confirmation
         * @param {string} sTableId The table ID
         * @param {string} sEntityId The entity ID
         * @private
         */
        _deleteEntity: function(sTableId, sEntityId) {
            const oViewModel = this.getModel("viewModel");
            
            // Set busy state
            oViewModel.setProperty("/busy", true);
            
            // Get metadata to determine primary key
            this.getTableMetadata(sTableId).then((oMetadata) => {
                const sPrimaryKey = oMetadata.primaryKey;
                
                // Delete the entity
                this.getSupabaseClient()
                    .from(sTableId)
                    .delete()
                    .eq(sPrimaryKey, sEntityId)
                    .then(({ error }) => {
                        oViewModel.setProperty("/busy", false);
                        
                        if (error) {
                            this._showErrorDialog("Delete Error", "Error deleting entity: " + error.message);
                            return;
                        }
                        
                        const sTableName = oViewModel.getProperty("/tableName");
                        this._showSuccessDialog("Success", sTableName + " deleted successfully", () => {
                            // Navigate back to the list view after user clicks OK
                            this.getRouter().navTo("entityList", {
                                table: sTableId
                            });
                        });
                    })
                    .catch(error => {
                        console.error("Error in Supabase query:", error);
                        this._showErrorDialog("Delete Error", "Error deleting entity: " + error.message);
                        oViewModel.setProperty("/busy", false);
                    });
            }).catch((error) => {
                console.error("Error getting table metadata:", error);
                this._showErrorDialog("Metadata Error", "Error loading metadata: " + error.message);
                oViewModel.setProperty("/busy", false);
            });
        },
        
        /**
         * Show a confirmation dialog
         * @param {string} sTitle The dialog title
         * @param {string} sMessage The dialog message
         * @param {function} fnConfirm Function to call when confirmed
         * @param {function} fnCancel Function to call when canceled
         * @private
         */
        _showConfirmationDialog: function(sTitle, sMessage, fnConfirm, fnCancel) {
            if (this._oConfirmDialog) {
                this._oConfirmDialog.destroy();
            }
            
            this._oConfirmDialog = new Dialog({
                title: sTitle,
                type: "Message",
                state: "Warning",
                icon: IconPool.getIconURI("question-mark"),
                content: new Text({
                    text: sMessage
                }),
                beginButton: new Button({
                    text: "Yes",
                    press: function () {
                        this._oConfirmDialog.close();
                        if (fnConfirm) {
                            fnConfirm();
                        }
                    }.bind(this)
                }),
                endButton: new Button({
                    text: "No",
                    press: function () {
                        this._oConfirmDialog.close();
                        if (fnCancel) {
                            fnCancel();
                        }
                    }.bind(this)
                }),
                styleClass: this.getOwnerComponent().getContentDensityClass(),
                verticalScrolling: false
            });
            
            this._oConfirmDialog.open();
        },
        
        /**
         * Show a success dialog
         * @param {string} sTitle The dialog title
         * @param {string} sMessage The dialog message
         * @param {function} fnCallback Function to call when dialog is closed
         * @private
         */
        _showSuccessDialog: function(sTitle, sMessage, fnCallback) {
            if (this._oSuccessDialog) {
                this._oSuccessDialog.destroy();
            }
            
            this._oSuccessDialog = new Dialog({
                title: sTitle,
                type: "Message",
                state: "Success",
                icon: IconPool.getIconURI("accept"),
                content: new Text({
                    text: sMessage
                }),
                beginButton: new Button({
                    text: "OK",
                    press: function () {
                        this._oSuccessDialog.close();
                        if (fnCallback) {
                            fnCallback();
                        }
                    }.bind(this)
                }),
                styleClass: this.getOwnerComponent().getContentDensityClass(),
                verticalScrolling: false
            });
            
            this._oSuccessDialog.open();
        },
        
        /**
         * Show an error dialog
         * @param {string} sTitle The dialog title
         * @param {string} sMessage The dialog message
         * @param {function} fnCallback Function to call when dialog is closed
         * @private
         */
        _showErrorDialog: function(sTitle, sMessage, fnCallback) {
            if (this._oErrorDialog) {
                this._oErrorDialog.destroy();
            }
            
            this._oErrorDialog = new Dialog({
                title: sTitle,
                type: "Message",
                state: "Error",
                icon: IconPool.getIconURI("error"),
                content: new Text({
                    text: sMessage
                }),
                beginButton: new Button({
                    text: "OK",
                    press: function () {
                        this._oErrorDialog.close();
                        if (fnCallback) {
                            fnCallback();
                        }
                    }.bind(this)
                }),
                styleClass: this.getOwnerComponent().getContentDensityClass(),
                verticalScrolling: false
            });
            
            this._oErrorDialog.open();
        },
        
        /**
         * Replacement for showSuccessMessage method
         * @param {string} sMessage The message to show
         * @public
         */
        showSuccessMessage: function(sMessage) {
            this._showSuccessDialog("Success", sMessage);
        },
        
        /**
         * Replacement for showErrorMessage method
         * @param {string} sMessage The message to show
         * @param {object} oError Optional error object
         * @public
         */
        showErrorMessage: function(sMessage, oError) {
            let sErrorMessage = sMessage;
            if (oError) {
                sErrorMessage += ": " + (oError.message || JSON.stringify(oError));
            }
            this._showErrorDialog("Error", sErrorMessage);
        }
    });
});