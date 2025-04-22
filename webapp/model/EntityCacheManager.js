sap.ui.define([
    "sap/ui/base/Object",
    "sap/ui/model/json/JSONModel"
], function(BaseObject, JSONModel) {
    "use strict";
    
    return BaseObject.extend("com.supabase.easyui5.model.EntityCacheManager", {
        
        constructor: function() {
            // Initialize cache storage
            this._entityCache = {};
            
            // Cache metadata for tracking
            this._cacheMetadata = {};
            
            // Default cache settings
            this._defaultSettings = {
                enabled: true,
                maxAgeSeconds: 300, // 5 minutes default cache lifetime (only for reference)
                enforceMaxAge: false // Disabled by default as requested
            };
        },
        
        /**
         * Check if data for a specific entity is cached
         * @param {string} sEntityType - The entity type/table name
         * @param {object} [mParams] - Optional parameters for cache checking
         * @param {boolean} [mParams.ignoreCache=false] - Whether to ignore cache completely
         * @returns {boolean} Whether valid cached data exists
         */
        isCached: function(sEntityType, mParams) {
            mParams = mParams || {};
            const bIgnoreCache = mParams.ignoreCache || false;
            
            // If we're ignoring cache, always return false
            if (bIgnoreCache) {
                return false;
            }
            
            // Check if data exists in cache
            return !!this._entityCache[sEntityType];
        },
        
        /**
         * Get cached data for a specific entity
         * @param {string} sEntityType - The entity type/table name
         * @param {object} [mParams] - Optional parameters
         * @param {boolean} [mParams.ignoreCache=false] - Whether to ignore cache and force server fetch
         * @param {function} fnLoadCallback - Callback function to load data if not cached
         * @returns {Promise} Promise that resolves with the cached or freshly loaded data
         */
        getEntityData: function(sEntityType, mParams, fnLoadCallback) {
            mParams = mParams || {};
            const bIgnoreCache = mParams.ignoreCache || false;
            
            // Check if we need to load fresh data
            const bShouldUseCache = !bIgnoreCache && this.isCached(sEntityType);
            
            if (bShouldUseCache) {
                console.log(`Using cached data for ${sEntityType}`);
                return Promise.resolve(this._entityCache[sEntityType]);
            } else {
                console.log(`Loading fresh data for ${sEntityType}`);
                
                // Make sure callback is provided
                if (typeof fnLoadCallback !== "function") {
                    return Promise.reject(new Error("Load callback function is required when data is not cached"));
                }
                
                // Call the loading function
                return fnLoadCallback().then(data => {
                    // Cache the result
                    this.setEntityCache(sEntityType, data);
                    return data;
                });
            }
        },
        
        /**
         * Update the cache with new data for a specific entity
         * @param {string} sEntityType - The entity type/table name
         * @param {Array|Object} aData - The data to cache
         * @param {object} [mParams] - Optional parameters (for compatibility)
         */
        setEntityCache: function(sEntityType, aData, mParams) {
            // Store the data
            this._entityCache[sEntityType] = aData;
            
            // Update metadata - we still track timestamps for reporting
            this._cacheMetadata[sEntityType] = {
                timestamp: new Date().getTime(),
                count: Array.isArray(aData) ? aData.length : (aData ? 1 : 0),
                lastUpdated: new Date().toLocaleString()
            };
            
            console.log(`Updated cache for ${sEntityType} with ${this._cacheMetadata[sEntityType].count} records`);
        },
        
        /**
         * Clear cache for a specific entity
         * @param {string} sEntityType - The entity type/table name to clear from cache
         */
        clearEntityCache: function(sEntityType) {
            if (this._entityCache[sEntityType]) {
                delete this._entityCache[sEntityType];
                delete this._cacheMetadata[sEntityType];
                console.log(`Cleared cache for ${sEntityType}`);
            }
        },
        
        /**
         * Clear the entire cache
         */
        clearAllCache: function() {
            this._entityCache = {};
            this._cacheMetadata = {};
            console.log("Cleared all entity caches");
        },
        
        /**
         * Get cache statistics
         * @returns {Object} Cache statistics object
         */
        getCacheStats: function() {
            const stats = {
                entityCount: Object.keys(this._entityCache).length,
                entities: {}
            };
            
            // Collect stats for each cached entity
            Object.keys(this._cacheMetadata).forEach(sEntityType => {
                const metadata = this._cacheMetadata[sEntityType];
                const cacheAge = (new Date().getTime() - metadata.timestamp) / 1000;
                
                stats.entities[sEntityType] = {
                    recordCount: metadata.count,
                    ageSeconds: Math.round(cacheAge),
                    lastUpdated: metadata.lastUpdated
                };
            });
            
            return stats;
        }
    });
});