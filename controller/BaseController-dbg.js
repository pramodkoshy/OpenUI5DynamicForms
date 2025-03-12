sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/ui/core/routing/History",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function(Controller, UIComponent, History, MessageBox, MessageToast) {
    "use strict";

    return Controller.extend("com.supabase.easyui5.controller.BaseController", {
        
        /**
         * Get the router for this component
         * @returns {sap.ui.core.routing.Router} The router instance
         */
        getRouter: function() {
            return UIComponent.getRouterFor(this);
        },
        
        /**
         * Get the model with the specified name
         * @param {string} [sName] The model name
         * @returns {sap.ui.model.Model} The model instance
         */
        getModel: function(sName) {
            return this.getView().getModel(sName) || this.getOwnerComponent().getModel(sName);
        },
        
        /**
         * Set the model for the view
         * @param {sap.ui.model.Model} oModel The model instance
         * @param {string} [sName] The model name
         * @returns {sap.ui.mvc.Controller} Reference to this to allow method chaining
         */
        setModel: function(oModel, sName) {
            this.getView().setModel(oModel, sName);
            return this;
        },
        
        /**
         * Get the resource bundle
         * @returns {sap.ui.model.resource.ResourceModel} The resource bundle
         */
        getResourceBundle: function() {
            return this.getOwnerComponent().getModel("i18n").getResourceBundle();
        },
        
        /**
         * Navigate back in the browser history
         * If there's no history entry, it replaces the current entry with the home route
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
         * Get the Supabase client instance
         * @returns {Object} The Supabase client instance
         */
        getSupabaseClient: function() {
            return window.supabaseClient;
        },
        
        /**
         * Show a success message
         * @param {string} sMessage The message text
         */
        showSuccessMessage: function(sMessage) {
            MessageToast.show(sMessage);
        },
        
        /**
         * Show an error message
         * @param {string} sMessage The error message
         * @param {Object} [oError] The error object
         */
        showErrorMessage: function(sMessage, oError) {
            let sErrorDetails = "";
            
            if (oError) {
                sErrorDetails = oError.message || JSON.stringify(oError);
            }
            
            MessageBox.error(sMessage, {
                details: sErrorDetails,
                styleClass: this.getOwnerComponent().getContentDensityClass()
            });
        },
        
        /**
         * Show a confirmation dialog
         * @param {string} sMessage The message text
         * @param {function} fnConfirm The function to call when confirmed
         * @param {string} [sTitle] The dialog title
         */
        showConfirmationDialog: function(sMessage, fnConfirm, sTitle) {
            MessageBox.confirm(sMessage, {
                title: sTitle || "Confirmation",
                styleClass: this.getOwnerComponent().getContentDensityClass(),
                onClose: function(sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        fnConfirm();
                    }
                }
            });
        },
        
        /**
         * Get the metadata for a Supabase table
         * @param {string} sTableName The table name
         * @returns {Promise} A promise that resolves with the table metadata
         */
        getTableMetadata: function(sTableName) {
            // This is a simplification since Supabase doesn't have a direct metadata API
            // In a real app, you might want to store this metadata in a separate JSON file or fetch it from the server
            
            const oMetadata = {
                suppliers: {
                    primaryKey: "supplier_id",
                    columns: [
                        { name: "supplier_id", label: "ID", type: "number", editable: false, visible: true },
                        { name: "company_name", label: "Company Name", type: "string", required: true, visible: true },
                        { name: "contact_name", label: "Contact Name", type: "string", visible: true },
                        { name: "contact_title", label: "Contact Title", type: "string", visible: true },
                        { name: "address", label: "Address", type: "string", visible: true },
                        { name: "city", label: "City", type: "string", visible: true },
                        { name: "region", label: "Region", type: "string", visible: true },
                        { name: "postal_code", label: "Postal Code", type: "string", visible: true },
                        { name: "country", label: "Country", type: "string", visible: true },
                        { name: "phone", label: "Phone", type: "string", visible: true },
                        { name: "email", label: "Email", type: "string", required: true, visible: true },
                        { name: "website", label: "Website", type: "string", visible: true },
                        { name: "created_at", label: "Created At", type: "date", editable: false, visible: false },
                        { name: "updated_at", label: "Updated At", type: "date", editable: false, visible: false }
                    ],
                    relations: [
                        { name: "products", table: "products", foreignKey: "supplier_id", label: "Products" }
                    ],
                    titleField: "company_name",
                    subtitleField: "contact_name"
                },
                products: {
                    primaryKey: "product_id",
                    columns: [
                        { name: "product_id", label: "ID", type: "number", editable: false, visible: true },
                        { name: "supplier_id", label: "Supplier", type: "relation", relation: "suppliers", required: true, visible: true },
                        { name: "product_name", label: "Product Name", type: "string", required: true, visible: true },
                        { name: "description", label: "Description", type: "text", visible: true },
                        { name: "unit_price", label: "Unit Price", type: "number", required: true, visible: true },
                        { name: "units_in_stock", label: "In Stock", type: "number", visible: true },
                        { name: "reorder_level", label: "Reorder Level", type: "number", visible: true },
                        { name: "discontinued", label: "Discontinued", type: "boolean", visible: true },
                        { name: "category", label: "Category", type: "string", visible: true },
                        { name: "created_at", label: "Created At", type: "date", editable: false, visible: false },
                        { name: "updated_at", label: "Updated At", type: "date", editable: false, visible: false }
                    ],
                    relations: [
                        { name: "order_items", table: "order_items", foreignKey: "product_id", label: "Order Items" }
                    ],
                    titleField: "product_name",
                    subtitleField: "category"
                },
                customers: {
                    primaryKey: "customer_id",
                    columns: [
                        { name: "customer_id", label: "ID", type: "number", editable: false, visible: true },
                        { name: "first_name", label: "First Name", type: "string", required: true, visible: true },
                        { name: "last_name", label: "Last Name", type: "string", required: true, visible: true },
                        { name: "email", label: "Email", type: "string", required: true, visible: true },
                        { name: "phone", label: "Phone", type: "string", visible: true },
                        { name: "address", label: "Address", type: "string", visible: true },
                        { name: "city", label: "City", type: "string", visible: true },
                        { name: "region", label: "Region", type: "string", visible: true },
                        { name: "postal_code", label: "Postal Code", type: "string", visible: true },
                        { name: "country", label: "Country", type: "string", visible: true },
                        { name: "company_name", label: "Company Name", type: "string", visible: true },
                        { name: "created_at", label: "Created At", type: "date", editable: false, visible: false },
                        { name: "updated_at", label: "Updated At", type: "date", editable: false, visible: false }
                    ],
                    relations: [
                        { name: "orders", table: "orders", foreignKey: "customer_id", label: "Orders" }
                    ],
                    titleField: "first_name",
                    subtitleField: "last_name"
                },
                orders: {
                    primaryKey: "order_id",
                    columns: [
                        { name: "order_id", label: "ID", type: "number", editable: false, visible: true },
                        { name: "customer_id", label: "Customer", type: "relation", relation: "customers", required: true, visible: true },
                        { name: "order_date", label: "Order Date", type: "date", editable: false, visible: true },
                        { name: "required_date", label: "Required Date", type: "date", visible: true },
                        { name: "shipped_date", label: "Shipped Date", type: "date", visible: true },
                        { name: "ship_via", label: "Ship Via", type: "string", visible: true },
                        { name: "shipping_fee", label: "Shipping Fee", type: "number", visible: true },
                        { name: "ship_name", label: "Ship Name", type: "string", visible: true },
                        { name: "ship_address", label: "Ship Address", type: "string", visible: true },
                        { name: "ship_city", label: "Ship City", type: "string", visible: true },
                        { name: "ship_region", label: "Ship Region", type: "string", visible: true },
                        { name: "ship_postal_code", label: "Ship Postal Code", type: "string", visible: true },
                        { name: "ship_country", label: "Ship Country", type: "string", visible: true },
                        { name: "order_status", label: "Order Status", type: "string", visible: true },
                        { name: "payment_method", label: "Payment Method", type: "string", visible: true },
                        { name: "payment_status", label: "Payment Status", type: "string", visible: true },
                        { name: "total_amount", label: "Total Amount", type: "number", visible: true }
                    ],
                    relations: [
                        { name: "order_items", table: "order_items", foreignKey: "order_id", label: "Order Items" }
                    ],
                    titleField: "order_id",
                    subtitleField: "order_date"
                },
                order_items: {
                    primaryKey: "order_item_id",
                    columns: [
                        { name: "order_item_id", label: "ID", type: "number", editable: false, visible: true },
                        { name: "order_id", label: "Order", type: "relation", relation: "orders", required: true, visible: true },
                        { name: "product_id", label: "Product", type: "relation", relation: "products", required: true, visible: true },
                        { name: "unit_price", label: "Unit Price", type: "number", required: true, visible: true },
                        { name: "quantity", label: "Quantity", type: "number", required: true, visible: true },
                        { name: "discount", label: "Discount", type: "number", visible: true },
                        { name: "subtotal", label: "Subtotal", type: "number", editable: false, visible: true }
                    ],
                    relations: [],
                    titleField: "order_item_id",
                    subtitleField: "product_id"
                }
            };
            
            return Promise.resolve(oMetadata[sTableName]);
        }
    });
});