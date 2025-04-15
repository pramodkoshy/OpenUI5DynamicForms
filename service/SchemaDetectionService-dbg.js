sap.ui.define([
    "sap/ui/base/Object"
], function(BaseObject) {
    "use strict";

    return BaseObject.extend("com.supabase.easyui5.service.SchemaDetectionService", {
        /**
         * Constructor for the schema detection service
         * @param {Object} oSupabaseClient The Supabase client
         */
        constructor: function(oSupabaseClient) {
            BaseObject.call(this);
            this._oSupabaseClient = oSupabaseClient;
            
            // Cache for detected schemas
            this._mSchemaCache = {};
        },
        
        /**
         * Detect schema for a table
         * @param {string} sTableId The table ID
         * @returns {Promise} A promise resolving with the detected schema
         * @public
         */
        detectSchema: function(sTableId) {
            // Check if we have a cached schema
            if (this._mSchemaCache[sTableId]) {
                return Promise.resolve(this._mSchemaCache[sTableId]);
            }
            
            // Get sample data to detect schema
            return this._fetchSampleData(sTableId)
                .then(aSampleData => {
                    if (!aSampleData || aSampleData.length === 0) {
                        // If no sample data, try to fetch table definition from Supabase
                        return this._fetchTableDefinition(sTableId);
                    }
                    
                    // Detect schema from sample data
                    const oDetectedSchema = this._detectSchemaFromSample(sTableId, aSampleData);
                    
                    // Cache the schema
                    this._mSchemaCache[sTableId] = oDetectedSchema;
                    
                    return oDetectedSchema;
                });
        },
        
        /**
         * Fetch sample data from a table
         * @param {string} sTableId The table ID
         * @returns {Promise} A promise resolving with sample data
         * @private
         */
        _fetchSampleData: function(sTableId) {
            return this._oSupabaseClient
                .from(sTableId)
                .select('*')
                .limit(10)
                .then(({ data, error }) => {
                    if (error) {
                        console.error("Error fetching sample data:", error);
                        return [];
                    }
                    return data || [];
                })
                .catch(error => {
                    console.error("Error in Supabase query:", error);
                    return [];
                });
        },
        
        /**
         * Fetch table definition from Supabase
         * @param {string} sTableId The table ID
         * @returns {Promise} A promise resolving with the table schema
         * @private
         */
        _fetchTableDefinition: function(sTableId) {
            // Try to get table structure using the system tables
            // Note: This requires privileges to access postgres introspection tables
            // If this isn't possible, return a default schema
            
            // Since direct schema access may be limited, fall back to default schema
            const oDefaultSchema = this._createDefaultSchema(sTableId);
            
            // Cache the schema
            this._mSchemaCache[sTableId] = oDefaultSchema;
            
            return Promise.resolve(oDefaultSchema);
        },
        
        /**
         * Detect schema from sample data
         * @param {string} sTableId The table ID
         * @param {Array} aSampleData Sample data records
         * @returns {Object} The detected schema
         * @private
         */
        _detectSchemaFromSample: function(sTableId, aSampleData) {
            // Start with a basic schema structure
            const oSchema = {
                primaryKey: null,
                titleField: null,
                subtitleField: null,
                columns: [],
                relations: []
            };
            
            // No sample data provided
            if (!aSampleData || aSampleData.length === 0) {
                return this._createDefaultSchema(sTableId);
            }
            
            // Use the first record to detect fields
            const oFirstRecord = aSampleData[0];
            const aFieldNames = Object.keys(oFirstRecord);
            
            // Detect primary key - common patterns
            const aPrimaryKeyPatterns = [
                'id',
                `${sTableId}_id`,
                'uuid',
                'key',
                'code'
            ];
            
            // Find the first matching pattern for primary key
            for (const sPattern of aPrimaryKeyPatterns) {
                if (aFieldNames.includes(sPattern)) {
                    oSchema.primaryKey = sPattern;
                    break;
                }
            }
            
            // If no primary key found, use the first field
            if (!oSchema.primaryKey && aFieldNames.length > 0) {
                oSchema.primaryKey = aFieldNames[0];
            }
            
            // Detect title field - common patterns
            const aTitlePatterns = [
                'name',
                'title',
                'label',
                'description',
                'summary'
            ];
            
            // Find the first matching pattern for title field
            for (const sPattern of aTitlePatterns) {
                if (aFieldNames.includes(sPattern)) {
                    oSchema.titleField = sPattern;
                    break;
                }
            }
            
            // If no title field found, use the primary key
            if (!oSchema.titleField) {
                oSchema.titleField = oSchema.primaryKey;
            }
            
            // Detect subtitle field - common patterns
            const aSubtitlePatterns = [
                'description',
                'summary',
                'subtitle',
                'details',
                'status'
            ];
            
            // Find the first matching pattern for subtitle field that isn't already used as title
            for (const sPattern of aSubtitlePatterns) {
                if (aFieldNames.includes(sPattern) && sPattern !== oSchema.titleField) {
                    oSchema.subtitleField = sPattern;
                    break;
                }
            }
            
            // Process each field to determine column properties
            aFieldNames.forEach(sFieldName => {
                // Get values across all sample data
                const aFieldValues = aSampleData
                    .map(oRecord => oRecord[sFieldName])
                    .filter(value => value !== null && value !== undefined);
                
                // Detect field type and properties
                const oColumn = this._detectColumnProperties(sFieldName, aFieldValues, sTableId);
                
                // Add column to schema
                oSchema.columns.push(oColumn);
                
                // Check if this might be a relation field
                if (this._isLikelyRelationField(sFieldName, aFieldValues)) {
                    // Determine related table name
                    const sRelatedTable = this._detectRelatedTable(sFieldName);
                    
                    if (sRelatedTable && sRelatedTable !== sTableId) {
                        oColumn.type = "relation";
                        oColumn.relation = sRelatedTable;
                        
                        // Add to relations list
                        oSchema.relations.push({
                            table: sRelatedTable,
                            foreignKey: sFieldName
                        });
                    }
                }
            });
            
            // Cache and return the detected schema
            this._mSchemaCache[sTableId] = oSchema;
            return oSchema;
        },
        
        /**
         * Detect column properties from field values
         * @param {string} sFieldName The field name
         * @param {Array} aFieldValues Sample values for the field
         * @param {string} sTableId The table ID
         * @returns {Object} The column properties
         * @private
         */
        _detectColumnProperties: function(sFieldName, aFieldValues, sTableId) {
            // Start with basic column structure
            const oColumn = {
                name: sFieldName,
                label: this._generateLabel(sFieldName),
                type: "string",
                visible: true,
                editable: true,
                required: false
            };
            
            // If no values, return default
            if (!aFieldValues || aFieldValues.length === 0) {
                return oColumn;
            }
            
            // Check for common field name patterns
            if (this._matchesPattern(sFieldName, ["id", `${sTableId}_id`, "code", "uuid"])) {
                oColumn.editable = false;
                oColumn.required = false;
            } else if (this._matchesPattern(sFieldName, ["created_at", "created", "creation_date"])) {
                oColumn.type = "date";
                oColumn.editable = false;
                oColumn.required = false;
            } else if (this._matchesPattern(sFieldName, ["updated_at", "modified", "modified_date"])) {
                oColumn.type = "date";
                oColumn.editable = false;
                oColumn.required = false;
            } else if (this._matchesPattern(sFieldName, ["name", "title"])) {
                oColumn.type = "string";
                oColumn.required = true;
            } else if (this._matchesPattern(sFieldName, ["description", "details", "notes"])) {
                oColumn.type = "text";
            } else if (this._matchesPattern(sFieldName, ["email"])) {
                oColumn.type = "email";
            } else if (this._matchesPattern(sFieldName, ["url", "website", "link"])) {
                oColumn.type = "url";
            } else if (this._matchesPattern(sFieldName, ["phone", "telephone", "mobile"])) {
                oColumn.type = "phone";
            } else if (this._matchesPattern(sFieldName, ["password", "pwd"])) {
                oColumn.type = "password";
            } else if (this._matchesPattern(sFieldName, ["color", "colour"])) {
                oColumn.type = "color";
            } else if (this._matchesPattern(sFieldName, ["date", "day"])) {
                oColumn.type = "date";
            } else if (this._matchesPattern(sFieldName, ["time"])) {
                oColumn.type = "time";
            } else if (this._matchesPattern(sFieldName, ["datetime", "timestamp"])) {
                oColumn.type = "datetime";
            } else if (this._matchesPattern(sFieldName, ["enabled", "active", "is_", "has_"])) {
                oColumn.type = "boolean";
            } else if (this._matchesPattern(sFieldName, ["price", "amount", "total", "cost", "fee"])) {
                oColumn.type = "number";
            } else if (this._matchesPattern(sFieldName, ["quantity", "count", "number", "age", "duration"])) {
                oColumn.type = "integer";
            } else if (this._matchesPattern(sFieldName, ["tags", "categories", "keywords"])) {
                oColumn.type = "tags";
            } else if (this._endsWithPattern(sFieldName, ["_id"])) {
                // Likely a relation field
                oColumn.type = "relation";
                oColumn.relation = sFieldName.replace(/_id$/, "");
                oColumn.required = true;
            }
            
            // Check actual values if we need more type detection
            if (oColumn.type === "string") {
                // Find the first non-null value to sample
                const vSampleValue = aFieldValues.find(v => v !== null && v !== undefined);
                
                if (vSampleValue !== undefined) {
                    // Detect type from value
                    const sType = this._detectTypeFromValue(vSampleValue);
                    
                    // Update column type if detected
                    if (sType !== "string") {
                        oColumn.type = sType;
                    }
                }
            }
            
            return oColumn;
        },
        
        /**
         * Check if a field name matches any pattern in the array
         * @param {string} sFieldName The field name
         * @param {Array} aPatterns Array of pattern strings
         * @returns {boolean} True if field name matches any pattern
         * @private
         */
        _matchesPattern: function(sFieldName, aPatterns) {
            const sFieldLower = sFieldName.toLowerCase();
            
            return aPatterns.some(sPattern => {
                const sPatternLower = sPattern.toLowerCase();
                return sFieldLower === sPatternLower || 
                       sFieldLower.includes(sPatternLower) ||
                       sFieldLower.startsWith(sPatternLower);
            });
        },
        
        /**
         * Check if a field name ends with any pattern in the array
         * @param {string} sFieldName The field name
         * @param {Array} aPatterns Array of pattern strings
         * @returns {boolean} True if field name ends with any pattern
         * @private
         */
        _endsWithPattern: function(sFieldName, aPatterns) {
            const sFieldLower = sFieldName.toLowerCase();
            
            return aPatterns.some(sPattern => {
                const sPatternLower = sPattern.toLowerCase();
                return sFieldLower.endsWith(sPatternLower);
            });
        },
        
        /**
         * Generate a human-readable label from a field name
         * @param {string} sFieldName The field name
         * @returns {string} The generated label
         * @private
         */
        _generateLabel: function(sFieldName) {
            // Remove common prefixes/suffixes
            let sLabel = sFieldName
                .replace(/^(fk_|pk_|r_|tbl_|col_)/i, "")
                .replace(/_id$/i, "");
            
            // Convert snake_case to Title Case
            sLabel = sLabel
                .split("_")
                .map(s => s.charAt(0).toUpperCase() + s.slice(1))
                .join(" ");
            
            // Convert camelCase to Title Case
            sLabel = sLabel.replace(/([a-z])([A-Z])/g, "$1 $2");
            
            return sLabel;
        },
        
        /**
         * Detect data type from a value
         * @param {*} vValue The value to check
         * @returns {string} The detected data type
         * @private
         */
        _detectTypeFromValue: function(vValue) {
            // Handle nulls and undefined
            if (vValue === null || vValue === undefined) {
                return "string";
            }
            
            // Check type based on JavaScript type
            const sJsType = typeof vValue;
            
            switch (sJsType) {
                case "boolean":
                    return "boolean";
                    
                case "number":
                    return Number.isInteger(vValue) ? "integer" : "number";
                    
                case "string":
                    // Check for date patterns
                    if (this._isDateString(vValue)) {
                        return "date";
                    }
                    
                    // Check for time patterns
                    if (this._isTimeString(vValue)) {
                        return "time";
                    }
                    
                    // Check for datetime patterns
                    if (this._isDateTimeString(vValue)) {
                        return "datetime";
                    }
                    
                    // Check for email pattern
                    if (this._isEmailString(vValue)) {
                        return "email";
                    }
                    
                    // Check for URL pattern
                    if (this._isUrlString(vValue)) {
                        return "url";
                    }
                    
                    // Check for color code pattern
                    if (this._isColorString(vValue)) {
                        return "color";
                    }
                    
                    // Check for long text
                    if (vValue.length > 100) {
                        return "text";
                    }
                    
                    // Default to string
                    return "string";
                    
                case "object":
                    // If it's a Date object
                    if (vValue instanceof Date) {
                        return "datetime";
                    }
                    
                    // If it's an array, maybe it's tags
                    if (Array.isArray(vValue)) {
                        return "tags";
                    }
                    
                    // Default to string for other objects
                    return "string";
                    
                default:
                    return "string";
            }
        },
        
        /**
         * Check if a string is a date format
         * @param {string} sValue The string value
         * @returns {boolean} True if string appears to be a date
         * @private
         */
        _isDateString: function(sValue) {
            // Common date formats: YYYY-MM-DD, MM/DD/YYYY, DD.MM.YYYY
            const aDatePatterns = [
                /^\d{4}-\d{2}-\d{2}$/,                  // YYYY-MM-DD
                /^\d{1,2}\/\d{1,2}\/\d{4}$/,            // MM/DD/YYYY or DD/MM/YYYY
                /^\d{1,2}\.\d{1,2}\.\d{4}$/,            // DD.MM.YYYY
                /^\d{4}\/\d{1,2}\/\d{1,2}$/             // YYYY/MM/DD
            ];
            
            return aDatePatterns.some(pattern => pattern.test(sValue));
        },
        
        /**
         * Check if a string is a time format
         * @param {string} sValue The string value
         * @returns {boolean} True if string appears to be a time
         * @private
         */
        _isTimeString: function(sValue) {
            // Common time formats: HH:MM, HH:MM:SS
            const aTimePatterns = [
                /^\d{1,2}:\d{2}(:\d{2})?$/                // HH:MM or HH:MM:SS
            ];
            
            return aTimePatterns.some(pattern => pattern.test(sValue));
        },
        
        /**
         * Check if a string is a datetime format
         * @param {string} sValue The string value
         * @returns {boolean} True if string appears to be a datetime
         * @private
         */
        _isDateTimeString: function(sValue) {
            // Common datetime formats with T or space separator between date and time
            const aDateTimePatterns = [
                /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,  // ISO format: YYYY-MM-DDTHH:MM:SS
                /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}/  // SQL format: YYYY-MM-DD HH:MM:SS
            ];
            
            return aDateTimePatterns.some(pattern => pattern.test(sValue));
        },
        
        /**
         * Check if a string is an email format
         * @param {string} sValue The string value
         * @returns {boolean} True if string appears to be an email
         * @private
         */
        _isEmailString: function(sValue) {
            // Simple email validation
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailPattern.test(sValue);
        },
        
        /**
         * Check if a string is a URL format
         * @param {string} sValue The string value
         * @returns {boolean} True if string appears to be a URL
         * @private
         */
        _isUrlString: function(sValue) {
            // Simple URL validation
            const urlPattern = /^(https?:\/\/)/i;
            return urlPattern.test(sValue);
        },
        
        /**
         * Check if a string is a color code
         * @param {string} sValue The string value
         * @returns {boolean} True if string appears to be a color code
         * @private
         */
        _isColorString: function(sValue) {
            // Check for hex color codes
            const colorPattern = /^#([0-9A-F]{3}|[0-9A-F]{6})$/i;
            return colorPattern.test(sValue);
        },
        
        /**
         * Check if a field is likely a relation field
         * @param {string} sFieldName The field name
         * @param {Array} aFieldValues Sample values for the field
         * @returns {boolean} True if field appears to be a relation
         * @private
         */
        _isLikelyRelationField: function(sFieldName, aFieldValues) {
            // Check name patterns first
            if (sFieldName.endsWith('_id') || 
                sFieldName.endsWith('Id') || 
                sFieldName.endsWith('_key') ||
                sFieldName.startsWith('fk_')) {
                return true;
            }
            
            // Check if values look like IDs (all strings or integers)
            if (aFieldValues.length > 0) {
                const allValuesAreIdLike = aFieldValues.every(value => {
                    // If it's a number or a string that looks like an ID
                    return (typeof value === 'number') || 
                           (typeof value === 'string' && /^[a-zA-Z0-9_-]+$/.test(value));
                });
                
                if (allValuesAreIdLike) {
                    return true;
                }
            }
            
            return false;
        },
        
        /**
         * Detect related table name from a field name
         * @param {string} sFieldName The field name
         * @returns {string} The detected related table name
         * @private
         */
        _detectRelatedTable: function(sFieldName) {
            // Common patterns for relation fields
            
            // Check for _id suffix
            if (sFieldName.endsWith('_id')) {
                return sFieldName.substring(0, sFieldName.length - 3);
            }
            
            // Check for Id suffix (camelCase)
            if (sFieldName.endsWith('Id') && sFieldName.length > 2) {
                // Convert camelCase to snake_case for table name
                const baseName = sFieldName.substring(0, sFieldName.length - 2);
                return baseName.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
            }
            
            // Check for fk_ prefix
            if (sFieldName.startsWith('fk_') && sFieldName.length > 3) {
                return sFieldName.substring(3);
            }
            
            // If no pattern matched, just remove common suffixes
            return sFieldName
                .replace(/_key$/, '')
                .replace(/_code$/, '')
                .replace(/_ref$/, '');
        },
        
        /**
         * Create a default schema for a table
         * @param {string} sTableId The table ID
         * @returns {Object} The default schema
         * @private
         */
        _createDefaultSchema: function(sTableId) {
            return {
                primaryKey: "id",
                titleField: "name",
                subtitleField: "description",
                columns: [
                    { name: "id", label: "ID", type: "string", visible: true, editable: false, required: false },
                    { name: "name", label: "Name", type: "string", visible: true, editable: true, required: true },
                    { name: "description", label: "Description", type: "text", visible: true, editable: true, required: false },
                    { name: "created_at", label: "Created At", type: "date", visible: true, editable: false, required: false },
                    { name: "updated_at", label: "Updated At", type: "date", visible: true, editable: false, required: false }
                ],
                relations: []
            };
        }
    });
});