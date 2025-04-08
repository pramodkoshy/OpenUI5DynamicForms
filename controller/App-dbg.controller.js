sap.ui.define([
    "com/supabase/easyui5/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/Text",
    "sap/m/List",
    "sap/m/StandardListItem",
    "sap/m/ResponsivePopover"
], function(
    BaseController, 
    JSONModel,
    MessageBox, 
    Dialog, 
    Button, 
    Text, 
    List, 
    StandardListItem, 
    ResponsivePopover
) {
    "use strict";

    return BaseController.extend("com.supabase.easyui5.controller.App", {
        onInit: function() {
            // Apply content density mode
            this.getView().addStyleClass(this.getOwnerComponent().getContentDensityClass());
            
            // Setup event handler for router display events
            const oRouter = this.getRouter();
            oRouter.attachRouteMatched(this._onRouteMatched, this);
            
            // Create app view model for managing state
            const oAppViewModel = new JSONModel({
                navExpanded: true
            });
            this.setModel(oAppViewModel, "appView");
            
            // Share the app view model with the component so other controllers can access it
            this.getOwnerComponent().setModel(oAppViewModel, "appView");
            
            // Initialize the navigation list if tables model is available
            this._initializeNavigationList();
            
            // If tables model is not immediately available, set a timer to try again
            if (!this._bTablesInitialized) {
                const iTimer = setInterval(() => {
                    if (this.getOwnerComponent().getModel("tables")) {
                        this._initializeNavigationList();
                        clearInterval(iTimer);
                    }
                }, 500);
                
                // Clear the timer after 10 seconds if tables model doesn't become available
                setTimeout(() => {
                    clearInterval(iTimer);
                }, 10000);
            }
        },
        
        /**
         * Initialize the navigation list with database tables
         * @private
         */
        _initializeNavigationList: function() {
            const oTablesModel = this.getOwnerComponent().getModel("tables");
            if (!oTablesModel) {
                console.log("Tables model not yet available");
                return;
            }
            
            // Get tables data from model
            const aTables = oTablesModel.getProperty("/tables");
            if (!aTables || aTables.length === 0) {
                console.log("No tables data available");
                return;
            }
            
            // Get the navigation list
            const oNavList = this.getView().byId("navigationList");
            
            // Clear existing items except for the home item
            const oHomeItem = this.getView().byId("homeItem");
            oNavList.removeAllItems();
            oNavList.addItem(oHomeItem);
            
            // Add table items to the navigation list
            aTables.forEach(oTable => {
                const oListItem = new StandardListItem({
                    title: oTable.title,
                    icon: oTable.icon,
                    type: "Navigation",
                    press: [this.onNavToEntityList, this]
                });
                
                // Store table ID as custom data
                oListItem.data("tableId", oTable.id);
                
                // Add to the list
                oNavList.addItem(oListItem);
            });
            
            // Mark as initialized
            this._bTablesInitialized = true;
        },
        
        /**
         * Handle route matched events
         * @param {sap.ui.base.Event} oEvent The route matched event
         * @private
         */
        _onRouteMatched: function(oEvent) {
            const sRouteName = oEvent.getParameter("name");
            const oArguments = oEvent.getParameter("arguments");
            
            // Select the corresponding item in the navigation list
            const oNavList = this.getView().byId("navigationList");
            
            if (sRouteName === "home") {
                // Select home item
                const oHomeItem = this.getView().byId("homeItem");
                oNavList.setSelectedItem(oHomeItem);
            } 
            else if (sRouteName === "entityList" && oArguments.table) {
                // Find and select the list item for this table
                const aItems = oNavList.getItems();
                for (let i = 0; i < aItems.length; i++) {
                    if (aItems[i].data("tableId") === oArguments.table) {
                        oNavList.setSelectedItem(aItems[i]);
                        break;
                    }
                }
            }
            
            // For detail and create routes, keep the previous selection
        },
        
        /**
         * Toggle the navigation panel visibility (collapse/expand)
         */
        onCollapseNav: function() {
            // Get SplitApp control directly from the view
            const oSplitApp = this.getView().byId("app");
            
            // Get app view model
            const oAppViewModel = this.getModel("appView");
            
            // Get current expansion state
            const bExpanded = oAppViewModel.getProperty("/navExpanded");
            
            // Get collapse button
            const oCollapseButton = this.getView().byId("collapseNavButton");
            
            // Log current state for debugging
            console.log("Toggle nav button pressed. Current state:", bExpanded ? "expanded" : "collapsed");
            console.log("SplitApp reference:", oSplitApp);
            
            // Ensure we have the SplitApp control
            if (!oSplitApp) {
                console.error("SplitApp control not found!");
                return;
            }
            
            // Toggle collapsed state
            if (bExpanded) {
                // Hide the master panel
                console.log("Hiding master");
                
                // Force mode to HideMode before hiding
                oSplitApp.setMode("HideMode");
                
                // Use setTimeout to ensure the mode change is applied
                setTimeout(function() {
                    oSplitApp.hideMaster();
                    
                    // Update button icon and tooltip for expand action
                    if (oCollapseButton) {
                        oCollapseButton.setIcon("sap-icon://navigation-right-arrow");
                        oCollapseButton.setTooltip("Show Navigation");
                    }
                    
                    // Update model state
                    oAppViewModel.setProperty("/navExpanded", false);
                }, 0);
            } else {
                // Show the master panel
                console.log("Showing master");
                
                // Force mode to ShowHideMode before showing
                oSplitApp.setMode("ShowHideMode");
                
                // Use setTimeout to ensure the mode change is applied
                setTimeout(function() {
                    oSplitApp.showMaster();
                    
                    // Update button icon and tooltip for collapse action
                    if (oCollapseButton) {
                        oCollapseButton.setIcon("sap-icon://navigation-left-arrow");
                        oCollapseButton.setTooltip("Hide Navigation");
                    }
                    
                    // Update model state
                    oAppViewModel.setProperty("/navExpanded", true);
                }.bind(this), 0);
            }
        },
        
        /**
         * Navigate to home
         */
        onNavHome: function() {
            this.getRouter().navTo("home");
        },
        
        /**
         * Navigate to entity list when a table is selected
         * @param {sap.ui.base.Event} oEvent The list item press event
         */
        onNavToEntityList: function(oEvent) {
            const oItem = oEvent.getSource();
            const sTableId = oItem.data("tableId");
            
            if (sTableId) {
                this.getRouter().navTo("entityList", {
                    table: sTableId
                });
            }
        },
        
        /**
         * List selection change handler
         * @param {sap.ui.base.Event} oEvent The selection change event
         */
        onNavListItemSelect: function(oEvent) {
            const oItem = oEvent.getParameter("listItem");
            
            // Check if this is the home item
            if (oItem.getId() === this.getView().byId("homeItem").getId()) {
                this.onNavHome();
                return;
            }
            
            // Otherwise, it's a table item
            const sTableId = oItem.data("tableId");
            if (sTableId) {
                this.getRouter().navTo("entityList", {
                    table: sTableId
                });
            }
        },
        
        /**
         * Show about dialog
         */
        onShowAbout: function() {
            // Create and show about dialog
            if (!this._oAboutDialog) {
                this._oAboutDialog = new Dialog({
                    title: "About Supabase Management",
                    contentWidth: "26rem",
                    content: [
                        new Text({
                            text: "This application provides a user-friendly interface for managing your Supabase data. It's built with OpenUI5 and supports full CRUD operations on your tables."
                        }).addStyleClass("sapUiSmallMargin")
                    ],
                    beginButton: new Button({
                        text: "Close",
                        press: function() {
                            this._oAboutDialog.close();
                        }.bind(this)
                    })
                });
                
                this.getView().addDependent(this._oAboutDialog);
            }
            
            this._oAboutDialog.open();
        },
        
        /**
         * Show settings dialog
         */
        onShowSettings: function() {
            // Show settings dialog
            if (!this._oSettingsDialog) {
                this._oSettingsDialog = new Dialog({
                    title: "Settings",
                    contentWidth: "20rem",
                    content: new List({
                        items: [
                            new StandardListItem({
                                title: "Theme: Horizon",
                                type: "Active",
                                press: function() {
                                    sap.ui.getCore().applyTheme("sap_horizon");
                                    this._oSettingsDialog.close();
                                }.bind(this)
                            }),
                            new StandardListItem({
                                title: "Theme: Horizon Dark",
                                type: "Active",
                                press: function() {
                                    sap.ui.getCore().applyTheme("sap_horizon_dark");
                                    this._oSettingsDialog.close();
                                }.bind(this)
                            }),
                            new StandardListItem({
                                title: "Theme: Horizon High Contrast Black",
                                type: "Active",
                                press: function() {
                                    sap.ui.getCore().applyTheme("sap_horizon_hcb");
                                    this._oSettingsDialog.close();
                                }.bind(this)
                            }),
                            new StandardListItem({
                                title: "Theme: Horizon High Contrast White",
                                type: "Active",
                                press: function() {
                                    sap.ui.getCore().applyTheme("sap_horizon_hcw");
                                    this._oSettingsDialog.close();
                                }.bind(this)
                            })
                        ]
                    }),
                    beginButton: new Button({
                        text: "Close",
                        press: function() {
                            this._oSettingsDialog.close();
                        }.bind(this)
                    })
                });
                
                this.getView().addDependent(this._oSettingsDialog);
            }
            
            this._oSettingsDialog.open();
        },

        _registerExtensions: function() {
            console.log("Registering controller extensions");
            try {
                const extensions = sap.ui.require("com/supabase/easyui5/controller/EntityDetailExtensions");
                console.log("Extensions loaded:", extensions);
            } catch (error) {
                console.error("Error registering extensions:", error);
            }
        },

        // Modified onShowSettings method for the App.controller.js

        /**
         * Show settings dialog
         */
        onShowSettings: function() {
            // Show settings dialog
            if (!this._oSettingsDialog) {
                this._oSettingsDialog = new sap.m.Dialog({
                    title: "Settings",
                    contentWidth: "20rem",
                    content: new sap.m.List({
                        items: [
                            new sap.m.StandardListItem({
                                title: "Theme: Horizon (Default)",
                                type: "Active",
                                press: function() {
                                    this.applyTheme("sap_horizon");
                                    this._oSettingsDialog.close();
                                }.bind(this)
                            }),
                            new sap.m.StandardListItem({
                                title: "Theme: Horizon Dark",
                                type: "Active",
                                press: function() {
                                    this.applyTheme("sap_horizon_dark");
                                    this._oSettingsDialog.close();
                                }.bind(this)
                            }),
                            new sap.m.StandardListItem({
                                title: "Theme: Horizon High Contrast Black",
                                type: "Active",
                                press: function() {
                                    this.applyTheme("sap_horizon_hcb");
                                    this._oSettingsDialog.close();
                                }.bind(this)
                            }),
                            new sap.m.StandardListItem({
                                title: "Theme: Horizon High Contrast White",
                                type: "Active",
                                press: function() {
                                    this.applyTheme("sap_horizon_hcw");
                                    this._oSettingsDialog.close();
                                }.bind(this)
                            })
                        ]
                    }),
                    beginButton: new sap.m.Button({
                        text: "Close",
                        press: function() {
                            this._oSettingsDialog.close();
                        }.bind(this)
                    })
                });
                
                this.getView().addDependent(this._oSettingsDialog);
            }
            
            this._oSettingsDialog.open();
        }
    });
});