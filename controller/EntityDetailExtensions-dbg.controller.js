// This file contains fixes for the EntityDetailExtensions.controller.js
// to ensure proper registration and loading of extensions

sap.ui.define([
    "com/supabase/easyui5/controller/EntityDetailForm.controller",
    "com/supabase/easyui5/controller/EntityDetailRelatedItems.controller",
    "com/supabase/easyui5/controller/EntityDetailActions.controller",
    "com/supabase/easyui5/controller/EntityForm.utils.controller" // Add this import
], function(
    EntityDetailForm,
    EntityDetailRelatedItems,
    EntityDetailActions
) {
    "use strict";
    
    return function() {
        // Create extension instances
        const formExtension = new EntityDetailForm();
        const relatedItemsExtension = new EntityDetailRelatedItems();
        const actionsExtension = new EntityDetailActions();
        const formUtilsExtension = new EntityFormUtils(); // Create instance
        
        
        return {
            form: {
                _configureForm: function(oMetadata, oEntityData) {
                    return formExtension.configureForm.call(this, oMetadata, oEntityData);
                },
                configureForm: function(oMetadata, oEntityData) {
                    return formExtension.configureForm.call(this, oMetadata, oEntityData);
                },
                configureGridForm: function(oMetadata, oEntityData) {
                    return formExtension.configureGridForm.call(this, oMetadata, oEntityData);
                },
                validateForm: function() {
                    return formExtension.validateForm.call(this);
                },
                // Add the missing function
                  createDisplayField: function(oColumnMetadata, oEntityData) {
                    return formUtilsExtension.createDisplayField.call(this, oColumnMetadata, oEntityData);
                },
                createFieldChangeHandler: function(oColumnMetadata) {
                    return formExtension.createFieldChangeHandler.call(this, oColumnMetadata);
                },
                setFieldError: function(sFieldName, sErrorMessage) {
                    return formExtension.setFieldError.call(this, sFieldName, sErrorMessage);
                },
                clearFieldError: function(sFieldName) {
                    return formExtension.clearFieldError.call(this, sFieldName);
                }
            },
            relatedItems: {
                _loadRelatedItems: function(oMetadata, oData) {
                    return relatedItemsExtension._loadRelatedItems.call(this, oMetadata, oData);
                },
                loadRelatedItems: function(oMetadata, oData) {
                    return relatedItemsExtension._loadRelatedItems.call(this, oMetadata, oData);
                },
                _configureRelatedItemsTable: function(sTableId) {
                    return relatedItemsExtension._configureRelatedItemsTable.call(this, sTableId);
                },
                configureRelatedItemsTable: function(sTableId) {
                    return relatedItemsExtension._configureRelatedItemsTable.call(this, sTableId);
                },
                onRelatedItemsSearch: function(oEvent) {
                    return relatedItemsExtension.onRelatedItemsSearch.call(this, oEvent);
                },
                onRelatedItemPress: function(oEvent) {
                    return relatedItemsExtension.onRelatedItemPress.call(this, oEvent);
                },
                onEditRelatedItemPress: function(oEvent) {
                    return relatedItemsExtension.onEditRelatedItemPress.call(this, oEvent);
                },
                onDeleteRelatedItemPress: function(oEvent) {
                    return relatedItemsExtension.onDeleteRelatedItemPress.call(this, oEvent);
                },
                onAddRelatedItemPress: function() {
                    return relatedItemsExtension.onAddRelatedItemPress.call(this);
                }
            },
            actions: {
                onSavePress: function() {
                    return actionsExtension.onSavePress.call(this);
                },
                onCancelPress: function() {
                    return actionsExtension.onCancelPress.call(this);
                },
                onEditPress: function() {
                    return actionsExtension.onEditPress.call(this);
                },
                onDeletePress: function() {
                    return actionsExtension.onDeletePress.call(this);
                }
            }
        };
    };
});