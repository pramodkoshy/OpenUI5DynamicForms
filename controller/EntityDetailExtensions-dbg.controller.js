sap.ui.define([
    "com/supabase/easyui5/controller/EntityDetailForm",
    "com/supabase/easyui5/controller/EntityDetailRelatedItems",
    "com/supabase/easyui5/controller/EntityDetailActions"
], function(
    EntityDetailForm,
    EntityDetailRelatedItems,
    EntityDetailActions
) {
    "use strict";
    
    console.log("EntityDetailExtensions module loaded");
    
    return function() {
        console.log("EntityDetailExtensions function called");
        
        const formExtension = new EntityDetailForm();
        const relatedItemsExtension = new EntityDetailRelatedItems();
        const actionsExtension = new EntityDetailActions();
        
        console.log("Extensions instantiated:", {
            formExtension, 
            relatedItemsExtension, 
            actionsExtension
        });
        
        return {
            form: {
                _configureForm: function(oMetadata, oEntityData) {
                    console.log("Form configuration called", oMetadata, oEntityData);
                    return formExtension._configureForm.call(this, oMetadata, oEntityData);
                }
            },
            relatedItems: {
                _loadRelatedItems: function(oMetadata, oData) {
                    console.log("Related items loading called", oMetadata, oData);
                    return relatedItemsExtension._loadRelatedItems.call(this, oMetadata, oData);
                }
            },
            actions: {
                onEditPress: function() {
                    console.log("Edit press called in extensions");
                    return actionsExtension.onEditPress.call(this);
                },
                onSavePress: function() {
                    console.log("Save press called in extensions");
                    return actionsExtension.onSavePress.call(this);
                }
            }
        };
    };
});