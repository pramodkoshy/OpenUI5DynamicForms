sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function(Controller, History, MessageBox, MessageToast) {
    "use strict";

    return Controller.extend("com.supabase.easyui5.controller.BaseController", {
        /**
         * Convenience method for accessing the router
         * @returns {sap.ui.core.routing.Router} The router instance
         * @public
         */
        getRouter: function() {
            return this.getOwnerComponent().getRouter();
        },

        /**
         * Convenience method for getting the view model by name
         * @param {string} [sName] The model name
         * @returns {sap.ui.model.Model} The model instance
         * @public
         */
        getModel: function(sName) {
            return this.getView().getModel(sName);
        },

        /**
         * Convenience method for setting the view model
         * @param {sap.ui.model.Model} oModel The model instance
         * @param {string} [sName] The model name
         * @returns {sap.ui.mvc.View} The view instance
         * @public
         */
        setModel: function(oModel, sName) {
            return this.getView().setModel(oModel, sName);
        },

        /**
         * Convenience method for getting the resource bundle
         * @returns {sap.ui.model.resource.ResourceModel} The resource bundle
         * @public
         */
        getResourceBundle: function() {
            return this.getOwnerComponent().getModel("i18n").getResourceBundle();
        },

        /**
         * Navigate back in history or to the home page if no history exists
         * @public
         */
        navBack: function() {
            const oHistory = History.getInstance();
            const sPreviousHash = oHistory.getPreviousHash();

            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                this.getRouter().navTo("home", {}, true);
            }
        },

        /**
         * Get Supabase client instance from the window
         * @returns {Object} The Supabase client
         * @public
         */
        getSupabaseClient: function() {
            return window.supabaseClient;
        },

        /**
         * Show error message
         * @param {string} sMessage Error message
         * @param {Object} [oError] Error object with details
         * @public
         */
        showErrorMessage: function(sMessage, oError) {
            let sErrorDetails = "";
            
            if (oError) {
                sErrorDetails = oError.message || JSON.stringify(oError);
                console.error(sMessage, oError);
            }
            
            MessageBox.error(sMessage + (sErrorDetails ? ": " + sErrorDetails : ""));
        },

        /**
         * Show success message
         * @param {string} sMessage Success message
         * @public
         */
        showSuccessMessage: function(sMessage) {
            MessageToast.show(sMessage);
        },

        
        /**
         * Get table metadata - convenience method for all controllers
         * @param {string} sTableId The table ID
         * @returns {Promise} A promise resolving with the table metadata
         */
        getTableMetadata: function(sTableId) {
            return this.getOwnerComponent().getTableMetadata(sTableId);
        },

        /**
         * Show confirmation dialog
         * @param {string} sMessage Confirmation message
         * @param {Function} fnConfirm Callback function for confirmation
         * @param {string} [sTitle] Dialog title
         * @public
         */
        showConfirmationDialog: function(sMessage, fnConfirm, sTitle) {
            MessageBox.confirm(
                sMessage, 
                {
                    title: sTitle || "Confirmation",
                    onClose: function(oAction) {
                        if (oAction === MessageBox.Action.OK) {
                            fnConfirm();
                        }
                    }
                }
            );
        }
    });
});