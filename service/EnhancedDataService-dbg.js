sap.ui.define([
    "sap/ui/base/Object",
    "sap/ui/model/json/JSONModel"
], function(BaseObject, JSONModel) {
    "use strict";

    return BaseObject.extend("com.supabase.easyui5.service.EnhancedDataService", {
        /**
         * Constructor for the enhanced data service
         * @param {Object} oSupabaseClient The Supabase client
         * @param {Object} oMetadataProvider The metadata provider
         */
        constructor: function(oSupabaseClient, oMetadataProvider) {
            BaseObject.call(this);
            
            this._oSupabaseClient = oSupabaseClient;
            this._oMetadataProvider = oMetadataProvider;
            
            // Initialize caches
            this._mMetadataCache = {};
            this._mRelationCache = {};
            this._mEntityCache = {};
            
            // Set up response cache duration (5 minutes by default)
            this._iCacheDuration = 5 * 60 * 1000; // 5 minutes
        },
        
        /**
         * Set the cache duration
         * @param {number} iDurationMs The cache duration in milliseconds
         */
        setCacheDuration: function(iDurationMs) {
            this._iCacheDuration = iDurationMs;
        },
        
        /**
         * Get enhanced metadata with caching
         * @param {string} sTableId The table ID
         * @returns {Promise} A promise resolving with the metadata
         */
        getMetadata: function(sTableId) {
            // Check if cached metadata is available and not expired
            const oCachedMetadata = this._mMetadataCache[sTableId];
            if (oCachedMetadata && (Date.now() - oCachedMetadata.timestamp < this._iCacheDuration)) {
                return Promise.resolve(oCachedMetadata.data);
            }
            
            // Get fresh metadata
            return this._oMetadataProvider.getEnhancedTableMetadata(sTableId)
                .then(oMetadata => {
                    // Store in cache with timestamp
                    this._mMetadataCache[sTableId] = {
                        data: oMetadata,
                        timestamp: Date.now()
                    };
                    
                    return oMetadata;
                });
        },
        
        /**
         * Get relation options for a field with caching
         * @param {string} sRelatedTable The related table
         * @param {string} sPrimaryKey The primary key field
         * @param {string} sTitleField The title field
         * @returns {Promise} A promise resolving with relation options
         */
        getRelationOptions: function(sRelatedTable, sPrimaryKey, sTitleField) {
            const sCacheKey = `${sRelatedTable}_${sPrimaryKey}_${sTitleField}`;
            
            // Check if cached options are available and not expired
            const oCachedOptions = this._mRelationCache[sCacheKey];
            if (oCachedOptions && (Date.now() - oCachedOptions.timestamp < this._iCacheDuration)) {
                return Promise.resolve(oCachedOptions.data);
            }
            
            // Get fresh relation options
            return this._oSupabaseClient
                .from(sRelatedTable)
                .select('*')
                .then(({ data, error }) => {
                    if (error) {
                        return Promise.reject(error);
                    }
                    
                    // Map the data to options format
                    const aOptions = (data || []).map(item => ({
                        key: item[sPrimaryKey],
                        text: item[sTitleField] || item[sPrimaryKey]
                    }));
                    
                    // Store in cache with timestamp
                    this._mRelationCache[sCacheKey] = {
                        data: aOptions,
                        timestamp: Date.now()
                    };
                    
                    return aOptions;
                });
        },
        
        /**
         * Get entity by ID with enhanced primary key handling and caching
         * @param {string} sTableId The table ID
         * @param {string} sEntityId The entity ID
         * @returns {Promise} A promise resolving with the entity
         */
        getEntityById: function(sTableId, sEntityId) {
            const sCacheKey = `${sTableId}_${sEntityId}`;
            
            // Check if cached entity is available and not expired
            const oCachedEntity = this._mEntityCache[sCacheKey];
            if (oCachedEntity && (Date.now() - oCachedEntity.timestamp < this._iCacheDuration)) {
                return Promise.resolve(oCachedEntity.data);
            }
            
            // Get metadata first
            return this.getMetadata(sTableId)
                .then(oMetadata => {
                    // Build query with proper primary key
                    return this._oMetadataProvider.buildPrimaryKeyQuery(
                        this._oSupabaseClient, sTableId, sEntityId, oMetadata
                    );
                })
                .then(query => query.single())
                .then(({ data, error }) => {
                    if (error) {
                        return Promise.reject(error);
                    }
                    
                    if (!data) {
                        return Promise.reject(new Error("Entity not found"));
                    }
                    
                    // Store in cache with timestamp
                    this._mEntityCache[sCacheKey] = {
                        data: data,
                        timestamp: Date.now()
                    };
                    
                    return data;
                });
        },
        
        /**
         * List entities with filtering and caching
         * @param {string} sTableId The table ID
         * @param {Object} oFilter Optional filter criteria
         * @returns {Promise} A promise resolving with the entities
         */
        listEntities: function(sTableId, oFilter) {
            // Create cache key from table and filter
            const sFilterString = oFilter ? JSON.stringify(oFilter) : "";
            const sCacheKey = `${sTableId}_list_${sFilterString}`;
            
            // Check if cached list is available and not expired
            const oCachedList = this._mEntityCache[sCacheKey];
            if (oCachedList && (Date.now() - oCachedList.timestamp < this._iCacheDuration)) {
                return Promise.resolve(oCachedList.data);
            }
            
            // Build query
            let query = this._oSupabaseClient.from(sTableId).select('*');
            
            // Add filters if provided
            if (oFilter) {
                Object.keys(oFilter).forEach(sKey => {
                    const vValue = oFilter[sKey];
                    if (vValue !== undefined && vValue !== null) {
                        query = query.eq(sKey, vValue);
                    }
                });
            }
            
            // Execute query
            return query.then(({ data, error }) => {
                if (error) {
                    return Promise.reject(error);
                }
                
                // Store in cache with timestamp
                this._mEntityCache[sCacheKey] = {
                    data: data || [],
                    timestamp: Date.now()
                };
                
                return data || [];
            });
        },
        
        /**
         * Create a new entity
         * @param {string} sTableId The table ID
         * @param {Object} oData The entity data
         * @returns {Promise} A promise resolving with the created entity
         */
        createEntity: function(sTableId, oData) {
            return this._oSupabaseClient
                .from(sTableId)
                .insert(oData)
                .select()
                .then(({ data, error }) => {
                    if (error) {
                        return Promise.reject(error);
                    }
                    
                    // Invalidate list cache for this table
                    this._invalidateListCache(sTableId);
                    
                    return data && data.length > 0 ? data[0] : null;
                });
        },
        
        /**
         * Update an entity
         * @param {string} sTableId The table ID
         * @param {string} sEntityId The entity ID
         * @param {Object} oData The entity data
         * @returns {Promise} A promise resolving with the updated entity
         */
        updateEntity: function(sTableId, sEntityId, oData) {
            // Get metadata first
            return this.getMetadata(sTableId)
                .then(oMetadata => {
                    // Build query with proper primary key
                    const query = this._oMetadataProvider.buildPrimaryKeyQuery(
                        this._oSupabaseClient, sTableId, sEntityId, oMetadata
                    );
                    
                    // Execute update
                    return query.update(oData).select();
                })
                .then(({ data, error }) => {
                    if (error) {
                        return Promise.reject(error);
                    }
                    
                    // Invalidate entity cache
                    const sCacheKey = `${sTableId}_${sEntityId}`;
                    delete this._mEntityCache[sCacheKey];
                    
                    // Invalidate list cache for this table
                    this._invalidateListCache(sTableId);
                    
                    return data && data.length > 0 ? data[0] : null;
                });
        },
        
        /**
         * Delete an entity
         * @param {string} sTableId The table ID
         * @param {string} sEntityId The entity ID
         * @returns {Promise} A promise resolving when the entity is deleted
         */
        deleteEntity: function(sTableId, sEntityId) {
            // Get metadata first
            return this.getMetadata(sTableId)
                .then(oMetadata => {
                    // Build query with proper primary key
                    const query = this._oMetadataProvider.buildPrimaryKeyQuery(
                        this._oSupabaseClient, sTableId, sEntityId, oMetadata
                    );
                    
                    // Execute delete
                    return query.delete();
                })
                .then(({ error }) => {
                    if (error) {
                        return Promise.reject(error);
                    }
                    
                    // Invalidate entity cache
                    const sCacheKey = `${sTableId}_${sEntityId}`;
                    delete this._mEntityCache[sCacheKey];
                    
                    // Invalidate list cache for this table
                    this._invalidateListCache(sTableId);
                    
                    return true;
                });
        },
        
        /**
         * Invalidate list cache for a table
         * @param {string} sTableId The table ID
         * @private
         */
        _invalidateListCache: function(sTableId) {
            // Remove all list cache entries for this table
            Object.keys(this._mEntityCache).forEach(sKey => {
                if (sKey.startsWith(`${sTableId}_list_`)) {
                    delete this._mEntityCache[sKey];
                }
            });
        },
        
        /**
         * Clear all caches
         * @public
         */
        clearCaches: function() {
            this._mMetadataCache = {};
            this._mRelationCache = {};
            this._mEntityCache = {};
        }
    });
});