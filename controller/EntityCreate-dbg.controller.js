sap.ui.define([
    "com/supabase/easyui5/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/m/Text",
    "sap/m/Input",
    "sap/m/TextArea",
    "sap/m/CheckBox",
    "sap/m/DatePicker", 
    "sap/m/ComboBox",
    "sap/ui/core/Item"
], function(
    BaseController, 
    JSONModel, 
    Text, 
    Input, 
    TextArea, 
    CheckBox, 
    DatePicker, 
    ComboBox, 
    Item
) {
    "use strict";

    return BaseController.extend("com.supabase.easyui5.controller.EntityCreate", {
        
        /**
         * Initialize the controller
         */
        onInit: function() {
            console.log("EntityCreate controller initializing");
            
            const oViewModel = new JSONModel({
                tableName: "",
                tableId: "",
                entity: {},
                busy: false,
                validationErrors: {},
                parentInfo: null
            });
            
            this.setModel(oViewModel, "viewModel");
            
            // Debug view initialization
            console.log("EntityCreate view:", this.getView());
            console.log("EntityCreate view ID:", this.getView().getId());
            
            // Register for the correct routes
            const oRouter = this.getRouter();
            if (oRouter) {
                // Attach to both routes since they both target the same view
                const oEntityCreateRoute = oRouter.getRoute("entityCreate");
                if (oEntityCreateRoute) {
                    oEntityCreateRoute.attachPatternMatched(this._onRouteMatched, this);
                }
                
                const oCreateRoute = oRouter.getRoute("create");
                if (oCreateRoute) {
                    oCreateRoute.attachPatternMatched(this._onRouteMatched, this);
                }
                
                if (!oEntityCreateRoute && !oCreateRoute) {
                    console.error("Could not find create/entityCreate route");
                }
            }
            
            // Load parent entity info immediately
            this._loadParentEntityInfo();
        },
        
        /**
         * Called when the view is displayed
         */
        onBeforeShow: function() {
            console.log("EntityCreate view onBeforeShow called");
        },
        
        /**
         * Called after the view is rendered
         */
        onAfterRendering: function() {
            console.log("EntityCreate view onAfterRendering called");
            const oPage = this.getView().byId("entityCreatePage");
            if (oPage) {
                console.log("EntityCreate page found, visible:", oPage.getVisible());
            }
        },

        /**
         * Route matched handler with proper cleanup and ID management
         */
        _onRouteMatched: function(oEvent) {
            try {
                const oArgs = oEvent.getParameter("arguments");
                const sTableId = oArgs.table;
                
                console.log("EntityCreate._onRouteMatched called");
                console.log("Route name:", oEvent.getParameter("name"));
                console.log("Table ID:", sTableId);
                
                // Clean up existing controls to prevent duplicate IDs
                this._cleanupFormControls();
                
                // CRITICAL: Store table name in controller property
                this._sTableName = sTableId;
                
                // Store the table ID in the view model
                const oViewModel = this.getModel("viewModel");
                oViewModel.setProperty("/tableId", sTableId);
                
                // Set table name based on the ID (capitalize first letter)
                const sTableName = sTableId.charAt(0).toUpperCase() + sTableId.slice(1).replace(/_/g, " ");
                oViewModel.setProperty("/tableName", sTableName);
                
                // Set the page title and ensure visibility
                const oPage = this.getView().byId("entityCreatePage");
                if (oPage) {
                    oPage.setTitle("Create New " + sTableName);
                    // Ensure the page is visible
                    oPage.setVisible(true);
                    console.log("EntityCreate page title set and made visible");
                } else {
                    console.error("EntityCreate page not found!");
                }
                
                // Reset entity data and validation errors
                oViewModel.setProperty("/entity", {});
                oViewModel.setProperty("/validationErrors", {});
                
                // Re-load parent info to ensure it's available
                this._loadParentEntityInfo();
                
                // Load metadata for the table
                this.getTableMetadata(sTableId).then((oMetadata) => {
                    console.log("Table metadata loaded for", sTableId);
                    console.log("Metadata columns:", oMetadata.columns.length);
                    
                    // Initialize entity data with default values
                    this._initializeEntityData(oMetadata);
                    
                    // Configure form with unique IDs
                    this._configureForm(oMetadata);
                    
                    // Force a page update
                    const oPage = this.getView().byId("entityCreatePage");
                    if (oPage) {
                        oPage.rerender();
                    }
                }).catch(error => {
                    console.error("Error loading metadata:", error);
                    this.showErrorMessage("Error loading metadata: " + error.message);
                });
            } catch (routeError) {
                console.error("Error in route matched handler:", routeError);
                this.showErrorMessage("An unexpected error occurred: " + routeError.message);
            }
        },

        /**
         * Clean up existing form controls to prevent duplicate IDs
         */
        _cleanupFormControls: function() {
            console.log("Cleaning up existing form controls");
            
            const oFormContainer = this.getView().byId("entityCreateContainer");
            if (oFormContainer) {
                // Get all form elements
                const aFormElements = oFormContainer.getFormElements();
                
                // Destroy each form element and its controls
                aFormElements.forEach(oElement => {
                    // Destroy all fields in the form element
                    const aFields = oElement.getFields();
                    aFields.forEach(oField => {
                        if (oField && oField.destroy) {
                            console.log("Destroying control with ID:", oField.getId());
                            oField.destroy();
                        }
                    });
                    
                    // Destroy the form element itself
                    if (oElement && oElement.destroy) {
                        oElement.destroy();
                    }
                });
                
                // Clear the container
                oFormContainer.removeAllFormElements();
            }
        },

        /**
         * Configure form fields with unique ID generation
         */
        _configureForm: function(oMetadata) {
            console.log("Configuring form with metadata");
            
            // First check if the view is ready
            const oView = this.getView();
            if (!oView) {
                console.error("View not available!");
                return;
            }
            
            // Try to get the form container
            const oFormContainer = oView.byId("entityCreateContainer");
            if (!oFormContainer) {
                console.error("Form container 'entityCreateContainer' not found!");
                console.log("Available view controls:", Object.keys(oView.mAggregations || {}));
                
                // Try to find the form
                const oForm = oView.byId("entityCreateForm");
                if (oForm) {
                    console.log("Form found, containers:", oForm.getFormContainers().length);
                }
                return;
            }
            
            // Ensure container is clean
            this._cleanupFormControls();
            
            const oViewModel = this.getModel("viewModel");
            const oParentInfo = oViewModel.getProperty("/parentInfo");
            
            // Generate a unique timestamp for this form configuration
            const sUniquePrefix = "createForm_" + Date.now() + "_";
            console.log("Using unique prefix:", sUniquePrefix);
            
            // Process each field
            oMetadata.columns.forEach((oColumnMetadata, index) => {
                // Skip non-editable fields and keys
                if (oColumnMetadata.editable === false || 
                    oColumnMetadata.name === oMetadata.primaryKey ||
                    oColumnMetadata.name === 'created_at' ||
                    oColumnMetadata.name === 'updated_at') {
                    return;
                }
                
                console.log(`Processing column: ${oColumnMetadata.name}`);
                
                // Create form element
                const bIsRequired = oColumnMetadata.required === true;
                const oFormElement = new sap.ui.layout.form.FormElement({
                    label: new sap.m.Label({
                        text: oColumnMetadata.label || oColumnMetadata.name,
                        required: bIsRequired
                    })
                });
                
                // Determine the control based on column type
                const sPath = "viewModel>/entity/" + oColumnMetadata.name;
                
                // Generate a truly unique ID
                const sUniqueId = sUniquePrefix + oColumnMetadata.name + "_" + index;
                console.log(`Creating control with ID: ${sUniqueId}`);
                
                // Check if this is a parent foreign key
                const bIsParentForeignKey = oParentInfo && 
                    oColumnMetadata.name === oParentInfo.foreignKey;
                
                // Create appropriate input control
                const oControl = this._createInputField(
                    oColumnMetadata, 
                    sPath, 
                    bIsRequired, 
                    sUniqueId, 
                    bIsParentForeignKey
                );
                
                if (oControl) {
                    oFormElement.addField(oControl);
                    oFormContainer.addFormElement(oFormElement);
                    console.log(`Added form element for field: ${oColumnMetadata.name}`);
                }
            });
            
            // Log summary
            const nElements = oFormContainer.getFormElements().length;
            console.log(`Form configuration complete. Total form elements: ${nElements}`);
            
            // Force update
            oFormContainer.invalidate();
        },

        /**
         * Create an input field with unique ID
         */
        _createInputField: function(oColumnMetadata, sPath, bIsRequired, sUniqueId, bIsParentForeignKey) {
            let oControl;
            
            // Generate a unique ID for the control
            const sControlId = this.getView().createId(sUniqueId);
            console.log(`Creating control type '${oColumnMetadata.type}' with ID: ${sControlId}`);
            
            switch (oColumnMetadata.type) {
                case "relation":
                    if (bIsParentForeignKey) {
                        oControl = new sap.m.Text({
                            id: sControlId,
                            text: `Connected to parent ${this.getModel("viewModel").getProperty("/parentInfo/parentTable")} (ID: ${this.getModel("viewModel").getProperty("/parentInfo/parentId")})`
                        });
                    } else {
                        oControl = new sap.m.ComboBox({
                            id: sControlId,
                            selectedKey: { path: sPath },
                            width: "100%",
                            required: bIsRequired,
                            valueState: "{= ${viewModel>/validationErrors/" + oColumnMetadata.name + "} ? 'Error' : 'None' }",
                            valueStateText: "{viewModel>/validationErrors/" + oColumnMetadata.name + "}"
                        });
                        
                        this._loadRelationOptions(
                            oControl, 
                            oColumnMetadata.relation, 
                            oColumnMetadata.name
                        );
                    }
                    break;
                
                case "boolean":
                    oControl = new sap.m.CheckBox({
                        id: sControlId,
                        selected: { path: sPath },
                        width: "100%"
                    });
                    break;
                
                case "date":
                    oControl = new sap.m.DatePicker({
                        id: sControlId,
                        value: {
                            path: sPath,
                            type: new sap.ui.model.type.Date({
                                pattern: "yyyy-MM-dd"
                            })
                        },
                        valueFormat: "yyyy-MM-dd",
                        displayFormat: "medium",
                        width: "100%",
                        required: bIsRequired,
                        valueState: "{= ${viewModel>/validationErrors/" + oColumnMetadata.name + "} ? 'Error' : 'None' }",
                        valueStateText: "{viewModel>/validationErrors/" + oColumnMetadata.name + "}"
                    });
                    break;
                
                case "number":
                    oControl = new sap.m.Input({
                        id: sControlId,
                        value: { path: sPath },
                        type: "Number",
                        width: "100%",
                        required: bIsRequired,
                        valueState: "{= ${viewModel>/validationErrors/" + oColumnMetadata.name + "} ? 'Error' : 'None' }",
                        valueStateText: "{viewModel>/validationErrors/" + oColumnMetadata.name + "}"
                    });
                    break;
                
                case "email":
                    oControl = new sap.m.Input({
                        id: sControlId,
                        value: { path: sPath },
                        type: "Email",
                        width: "100%",
                        required: bIsRequired,
                        valueState: "{= ${viewModel>/validationErrors/" + oColumnMetadata.name + "} ? 'Error' : 'None' }",
                        valueStateText: "{viewModel>/validationErrors/" + oColumnMetadata.name + "}"
                    });
                    break;
                    
                case "text":
                    oControl = new sap.m.TextArea({
                        id: sControlId,
                        value: { path: sPath },
                        rows: 3,
                        width: "100%",
                        required: bIsRequired,
                        valueState: "{= ${viewModel>/validationErrors/" + oColumnMetadata.name + "} ? 'Error' : 'None' }",
                        valueStateText: "{viewModel>/validationErrors/" + oColumnMetadata.name + "}"
                    });
                    break;
                
                default:
                    oControl = new sap.m.Input({
                        id: sControlId,
                        value: { path: sPath },
                        width: "100%",
                        required: bIsRequired,
                        valueState: "{= ${viewModel>/validationErrors/" + oColumnMetadata.name + "} ? 'Error' : 'None' }",
                        valueStateText: "{viewModel>/validationErrors/" + oColumnMetadata.name + "}"
                    });
                    break;
            }
            
            // Store column name for later reference using custom data
            if (oControl) {
                oControl.data("columnName", oColumnMetadata.name);
            }
            
            return oControl;
        },

        /**
         * Fixed onSavePress with proper entity type and field validation
         */
        onSavePress: async function() {
            try {
                // Use the global supabase client directly
                const supabase = window.supabaseClient;
                
                if (!supabase) {
                    throw new Error("Supabase client not initialized");
                }
                
                // Ensure table name is set
                if (!this._sTableName) {
                    throw new Error("Table name is not set. Please navigate back and try again.");
                }
                
                console.log("Creating entity for table:", this._sTableName);
                
                // Show busy indicator
                const oViewModel = this.getModel("viewModel");
                oViewModel.setProperty("/busy", true);
                
                // 1. Collect form data from the view model
                const oEntityData = oViewModel.getProperty("/entity");
                const oMetadata = await this.getTableMetadata(this._sTableName);
                
                // Create clean form data
                const oFormData = {};
                
                // Validate and collect form data
                let hasValidationError = false;
                const oValidationErrors = {};
                
                // Process each field from the entity data
                for (const sFieldName in oEntityData) {
                    // Skip auto-generated fields
                    if (sFieldName === 'created_at' || sFieldName === 'updated_at') {
                        continue;
                    }
                    
                    // Find the column metadata
                    const oColumn = oMetadata.columns.find(col => col.name === sFieldName);
                    
                    // Skip non-editable fields
                    if (oColumn && oColumn.editable === false && sFieldName !== oMetadata.primaryKey) {
                        continue;
                    }
                    
                    // Skip the primary key for create operations
                    if (sFieldName === oMetadata.primaryKey) {
                        continue;
                    }
                    
                    // Get the field value
                    const value = oEntityData[sFieldName];
                    
                    // Validate required fields
                    if (oColumn && oColumn.required === true) {
                        if (value === undefined || value === null || value === "") {
                            oValidationErrors[sFieldName] = `${oColumn.label || sFieldName} is required`;
                            hasValidationError = true;
                        }
                    }
                    
                    // Add the field value
                    if (value !== undefined && value !== null && value !== "") {
                        oFormData[sFieldName] = value;
                    } else if (oColumn && oColumn.required === true) {
                        // For required fields, we need to include them even if empty to trigger DB validation
                        oFormData[sFieldName] = null;
                    }
                }
                
                // If validation errors, show them and stop
                if (hasValidationError) {
                    oViewModel.setProperty("/validationErrors", oValidationErrors);
                    oViewModel.setProperty("/busy", false);
                    sap.m.MessageToast.show("Please fill in all required fields");
                    return;
                }
                
                console.log("Form data collected:", oFormData);
                
                // 2. Get parent info
                const oParentInfo = oViewModel.getProperty("/parentInfo");
                
                // If we have parent info, set the foreign key
                if (oParentInfo && oParentInfo.foreignKey && oParentInfo.parentId) {
                    console.log(`Setting foreign key ${oParentInfo.foreignKey} = ${oParentInfo.parentId}`);
                    oFormData[oParentInfo.foreignKey] = oParentInfo.parentId;
                }
                
                // 3. Check if this table needs an entity record
                const aTablesWithEntities = ['customers', 'products', 'lead', 'campaigns', 'contacts', 'activities'];
                let aTableResult;
                
                if (aTablesWithEntities.includes(this._sTableName)) {
                    // Create entity record first
                    let entityType = this._sTableName;
                    // Remove trailing 's' for entity type (e.g., "customers" -> "customer")
                    if (entityType.endsWith('s')) {
                        entityType = entityType.substring(0, entityType.length - 1);
                    }
                    
                    const oEntityData = {
                        entity_type: entityType,
                        name: oFormData.name || oFormData.company_name || oFormData.product_name || oFormData.subject || "New " + entityType,
                        description: oFormData.description || ""
                    };
                    
                    console.log("Creating entity with data:", oEntityData);
                    
                    const { data: aEntityResult, error: oEntityError } = await supabase
                        .from("entities")
                        .insert(oEntityData)
                        .select()
                        .single();
                        
                    if (oEntityError) {
                        throw oEntityError;
                    }
                    
                    console.log("Entity created:", aEntityResult);
                    
                    // Add entity_id to form data
                    oFormData.entity_id = aEntityResult.entity_id;
                }
                
                // 4. Insert into the specific table
                console.log("Inserting into " + this._sTableName + " table:", oFormData);
                
                const { data: insertResult, error: oTableError } = await supabase
                    .from(this._sTableName)
                    .insert(oFormData)
                    .select()
                    .single();
                    
                if (oTableError) {
                    console.error("Error inserting into " + this._sTableName + ":", oTableError);
                    
                    // Clean up the entity record if it was created
                    if (oFormData.entity_id) {
                        await supabase
                            .from("entities")
                            .delete()
                            .eq("entity_id", oFormData.entity_id);
                    }
                        
                    throw oTableError;
                }
                
                aTableResult = insertResult;
                
                console.log("Table record created:", aTableResult);
                
                // Hide busy indicator
                oViewModel.setProperty("/busy", false);
                
                // 5. Navigate based on parent info or to detail view
                this._navigateAfterSave(oParentInfo, aTableResult, oMetadata);
                
                // 6. Show success message
                const sTableName = this._sTableName.charAt(0).toUpperCase() + this._sTableName.slice(1).replace(/_/g, " ");
                sap.m.MessageToast.show("Successfully created " + sTableName);
                
            } catch (error) {
                console.error("Error creating entity:", error);
                
                // Hide busy indicator
                const oViewModel = this.getModel("viewModel");
                oViewModel.setProperty("/busy", false);
                
                // Show specific error messages
                let errorMessage = "Error creating record: ";
                
                if (error.code === 'PGRST204') {
                    errorMessage += "Column not found in database schema";
                } else if (error.code === '23502') {
                    errorMessage += "Required field missing";
                } else {
                    errorMessage += (error.message || "Unknown error");
                }
                
                sap.m.MessageToast.show(errorMessage);
            }
        },

        /**
         * Load parent entity info from session storage
         */
        _loadParentEntityInfo: function() {
            try {
                const sParentInfo = sessionStorage.getItem("parentEntityInfo");
                console.log("Loading parent entity info from session storage:", sParentInfo);
                
                if (sParentInfo) {
                    const oParentInfo = JSON.parse(sParentInfo);
                    console.log("Parsed parent info:", JSON.stringify(oParentInfo, null, 2));
                    
                    // Verify all required fields are present
                    if (oParentInfo.parentTable && oParentInfo.parentId && oParentInfo.foreignKey) {
                        console.log("Setting parent info in view model");
                        
                        // Set parent info in view model
                        const oViewModel = this.getModel("viewModel");
                        oViewModel.setProperty("/parentInfo", oParentInfo);
                        
                        // Create a backup copy of parent info as a safeguard
                        this._parentInfoBackup = JSON.parse(JSON.stringify(oParentInfo));
                        console.log("Parent info backup created");
                    } else {
                        console.warn("Parent info is incomplete:", JSON.stringify(oParentInfo));
                    }
                } else {
                    console.log("No parent info found in session storage");
                }
            } catch (e) {
                console.error("Error loading parent entity info:", e);
            }
        },

        /**
         * Initialize entity data with default values
         */
        _initializeEntityData: function(oMetadata) {
            const oEntityData = {};
            const oViewModel = this.getModel("viewModel");
            const oParentInfo = oViewModel.getProperty("/parentInfo");
            
            console.log("Initializing entity data for table:", this._sTableName);
            
            // Set default values for all fields
            oMetadata.columns.forEach((oColumnMetadata) => {
                // If we have parent info and this is the foreign key, set it
                if (oParentInfo && oColumnMetadata.name === oParentInfo.foreignKey) {
                    console.log(`Setting foreign key ${oColumnMetadata.name} to parent ID ${oParentInfo.parentId}`);
                    oEntityData[oColumnMetadata.name] = oParentInfo.parentId;
                } else if (oColumnMetadata.type === "boolean") {
                    oEntityData[oColumnMetadata.name] = false;
                } else if (oColumnMetadata.type === "number") {
                    oEntityData[oColumnMetadata.name] = null;
                } else if (oColumnMetadata.type === "date") {
                    oEntityData[oColumnMetadata.name] = null;
                } else {
                    oEntityData[oColumnMetadata.name] = "";
                }
            });
            
            console.log("Initialized entity data:", JSON.stringify(oEntityData, null, 2));
            
            // Update entity in model
            oViewModel.setProperty("/entity", oEntityData);
        },

        /**
         * Load options for relation fields
         */
        _loadRelationOptions: function(oComboBox, sRelatedTable, sFieldName) {
            console.log(`Loading relation options for ${sFieldName} from table ${sRelatedTable}`);
            
            this.getTableMetadata(sRelatedTable).then(function(oMetadata) {
                const sPrimaryKey = oMetadata.primaryKey;
                const sTitleField = oMetadata.titleField || sPrimaryKey;
                
                // Load related entities
                this.getSupabaseClient()
                    .from(sRelatedTable)
                    .select('*')
                    .then(({ data, error }) => {
                        if (error) {
                            console.error("Error loading relation options", error);
                            return;
                        }
                        
                        // Clear existing items
                        oComboBox.removeAllItems();
                        
                        // Add items to ComboBox
                        if (data) {
                            data.forEach(item => {
                                const displayText = item[sTitleField] || item.name || `ID: ${item[sPrimaryKey]}`;
                                oComboBox.addItem(new sap.ui.core.Item({
                                    key: item[sPrimaryKey],
                                    text: displayText
                                }));
                            });
                        }
                    });
            }.bind(this));
        },


        /**
         * Navigate after successful save
         */
        _navigateAfterSave: function(oParentInfo, aTableResult, oMetadata) {
            console.log("Navigating after save");
            
            // Clear session storage
            try {
                sessionStorage.removeItem("parentEntityInfo");
            } catch (e) {
                console.warn("Could not clear session storage:", e);
            }
            
            // Navigate based on parent info
            if (oParentInfo && oParentInfo.parentTable && oParentInfo.parentId) {
                // Navigate back to parent detail
                console.log("Navigating to parent detail", oParentInfo.parentTable, oParentInfo.parentId);
                this.getRouter().navTo("detail", {
                    table: oParentInfo.parentTable,
                    id: oParentInfo.parentId
                });
            } else {
                // Navigate back to list view (changed from detail to list)
                console.log("Navigating to list view", this._sTableName);
                
                // Use try-catch for navigation
                try {
                    // Adjust route name based on your manifest configuration
                    const sListRoute = "list" || "entityList";  // Try common route names
                    
                    this.getRouter().navTo(sListRoute, {
                        table: this._sTableName
                    }, true); // Use true to replace current history entry
                } catch (navError) {
                    console.error("Navigation to list failed:", navError);
                    
                    // Fallback: try alternative route names
                    try {
                        this.getRouter().navTo("entityList", {
                            table: this._sTableName
                        });
                    } catch (fallbackError) {
                        console.error("Fallback navigation also failed:", fallbackError);
                        
                        // Last resort: navigate to home
                        this.getRouter().navTo("home");
                    }
                }
            }
        },

        /**
         * Cancel action handler
         */
        onCancelPress: function() {
            const oViewModel = this.getModel("viewModel");
            const oParentInfo = oViewModel.getProperty("/parentInfo");
            
            // Clear session storage
            try {
                sessionStorage.removeItem("parentEntityInfo");
            } catch (e) {
                console.warn("Could not clear session storage:", e);
            }
            
            // Navigate based on parent info
            if (oParentInfo && oParentInfo.parentTable && oParentInfo.parentId) {
                // Navigate back to parent detail
                this.getRouter().navTo("detail", {
                    table: oParentInfo.parentTable,
                    id: oParentInfo.parentId
                });
            } else {
                // Navigate back to list view
                this.getRouter().navTo("list", {
                    table: this._sTableName
                });
            }
        },

        /**
         * Toggle navigation
         */
        onToggleNav: function() {
            const oSplitApp = this.getOwnerComponent().getSplitApp();
            if (oSplitApp) {
                if (oSplitApp.isMasterShown()) {
                    oSplitApp.hideMaster();
                } else {
                    oSplitApp.showMaster();
                }
            }
        }
    });
});