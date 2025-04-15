sap.ui.define([
    "sap/ui/core/mvc/ControllerExtension"
], function(ControllerExtension) {
    "use strict";

    return ControllerExtension.extend("com.supabase.easyui5.enhanced.EnhancedMetadataProvider", {
        /**
         * Get enhanced metadata for a table with improved primary key handling
         * @param {string} sTableId The table ID
         * @returns {Promise} A promise resolving with the enhanced table metadata
         * @public
         */
        getEnhancedTableMetadata: function(sTableId) {
            // First get the original metadata from the component
            return this.getOwnerComponent().getTableMetadata(sTableId)
                .then(oMetadata => {
                    // Create a clone of the metadata to avoid modifying original
                    const oEnhancedMetadata = JSON.parse(JSON.stringify(oMetadata));
                    
                    // Add enhanced properties
                    oEnhancedMetadata._enhanced = true;
                    
                    // Fix primary key to use table_id pattern
                    const sPrimaryKey = oEnhancedMetadata.primaryKey;
                    
                    // If primary key is 'id', replace it with table_id pattern
                    if (sPrimaryKey === "id") {
                        // Update the primary key to use the table_id pattern
                        oEnhancedMetadata.primaryKey = `${sTableId}_id`;
                        
                        // Update the primary key column definition
                        const iPrimaryKeyIndex = oEnhancedMetadata.columns.findIndex(col => col.name === sPrimaryKey);
                        if (iPrimaryKeyIndex >= 0) {
                            // Change the column name to the new pattern
                            oEnhancedMetadata.columns[iPrimaryKeyIndex].name = `${sTableId}_id`;
                            
                            // Update the label
                            oEnhancedMetadata.columns[iPrimaryKeyIndex].label = `${sTableId.charAt(0).toUpperCase() + sTableId.slice(1)} ID`;
                        }
                    }
                    
                    return oEnhancedMetadata;
                });
        },

        /**
         * Get the primary key value using a flexible approach that tries different key patterns
         * @param {string} sTableId The table ID
         * @param {Object} oItemData The item data
         * @param {Object} oMetadata The metadata object (optional)
         * @returns {Promise<string>} A promise resolving with the primary key value
         * @public
         */
        getPrimaryKeyValue: function(sTableId, oItemData, oMetadata) {
            // If metadata is not provided, get it
            const metadataPromise = oMetadata ? 
                Promise.resolve(oMetadata) : 
                this.getEnhancedTableMetadata(sTableId);
            
            return metadataPromise.then(oMeta => {
                const sPrimaryKey = oMeta.primaryKey;
                const sCompositePrimaryKey = oMeta.compositePrimaryKey;
                
                // Try different key patterns
                const possibleKeys = [
                    sPrimaryKey,                  // id
                    sCompositePrimaryKey,         // table_id
                    `${sTableId}_${sPrimaryKey}`, // table_id
                    'ID',
                    'key',
                    'uuid'
                ];
                
                // Find the first key that has a value
                for (const sKey of possibleKeys) {
                    if (sKey && oItemData[sKey] !== undefined) {
                        return oItemData[sKey];
                    }
                }
                
                // Default to the first property if no key found
                const firstKey = Object.keys(oItemData)[0];
                return oItemData[firstKey];
            });
        },
        
        /**
         * Build a query with the correct primary key
         * @param {Object} oSupabase The Supabase client
         * @param {string} sTableId The table ID
         * @param {string} sEntityId The entity ID
         * @param {Object} oMetadata Optional metadata
         * @returns {Promise<Object>} A promise resolving with the query object
         * @public
         */
        buildPrimaryKeyQuery: function(oSupabase, sTableId, sEntityId, oMetadata) {
            if (!oSupabase) {
                return Promise.reject(new Error("Supabase client is required"));
            }
            
            // Start with a base query
            let query = oSupabase.from(sTableId).select('*');
            
            // If metadata is not provided, get it
            const metadataPromise = oMetadata ? 
                Promise.resolve(oMetadata) : 
                this.getEnhancedTableMetadata(sTableId);
            
            return metadataPromise.then(oMeta => {
                // Use tablename_id pattern as default if not explicitly defined in metadata
                const sPrimaryKey = oMeta.primaryKey || `${sTableId}_id`;
                
                // Use the primary key for the query
                return query.eq(sPrimaryKey, sEntityId);
            });
        }
    });
});