sap.ui.define([
    "sap/ui/core/mvc/ControllerExtension",
    "sap/m/MessageBox"
], function(
    ControllerExtension, 
    MessageBox
) {
    "use strict";

    return ControllerExtension.extend("com.supabase.easyui5.controller.EntityDetailActions", {
        
        /**
         * Handler for save button press
         */
        onSavePress: function() {
           
             // Set busy state
            oViewModel.setProperty("/busy", true);

            console.log("Save button pressed in extensions");
            
            const oViewModel = this.getModel("viewModel");
            const sTableId = oViewModel.getProperty("/tableId");
            const sEntityId = oViewModel.getProperty("/entityId");
            
            // Get the current entity data directly from the model
            const oEntityData = JSON.parse(JSON.stringify(oViewModel.getProperty("/entity")));
            
            console.log("Full Entity Data:", JSON.stringify(oEntityData, null, 2));
            
            // Set busy state
            oViewModel.setProperty("/busy", true);
            
            // Validate the data
            this.getTableMetadata(sTableId).then((oMetadata) => {
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
                oDataToUpdate['updated_at'] = new Date().toISOString();
                
                // Update entity
                this.getSupabaseClient()
                    .from(sTableId)
                    .update(oDataToUpdate)
                    .eq(sPrimaryKey, sEntityId)
                    .then(({ data, error }) => {
                        oViewModel.setProperty("/busy", false);
                        
                        if (error) {
                            console.error("Update error:", error);
                            this.showErrorMessage("Error updating entity", error);
                            return;
                        }
                        
                        // Reset edit mode
                        oViewModel.setProperty("/editMode", false);
                        
                        // Show success message
                        this.showSuccessMessage("Entity updated successfully");
                        
                        // Reload entity to refresh data
                        this._loadEntity(sTableId, sEntityId);
                    })
                    .catch(error => {
                        console.error("Error in Supabase query:", error);
                        this.showErrorMessage("Error updating entity: " + error.message);
                        oViewModel.setProperty("/busy", false);
                    });
            }).catch(error => {
                console.error("Error getting table metadata:", error);
                this.showErrorMessage("Error getting table metadata: " + error.message);
                oViewModel.setProperty("/busy", false);
            });
        },
        
        /**
         * Handler for cancel button press
         */
        onCancelPress: function() {

            // Reset busy state
            oViewModel.setProperty("/busy", false);

            console.log("Cancel button pressed in extensions");
            
            const oViewModel = this.getModel("viewModel");
            const sTableId = oViewModel.getProperty("/tableId");
            const sEntityId = oViewModel.getProperty("/entityId");
            
            // Reset edit mode
            oViewModel.setProperty("/editMode", false);
            
            // Reload the original entity data to discard changes
            this._loadEntity(sTableId, sEntityId);
        }
    });
});