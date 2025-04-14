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

        /**
         * Lifecycle hook when the controller is initialized
         */
        onInit: function() {
            console.log("🔍 APP DEBUG: App controller initializing");
            
            try {
                // Apply content density mode
                if (this.getView() && this.getOwnerComponent() && this.getOwnerComponent().getContentDensityClass) {
                    this.getView().addStyleClass(this.getOwnerComponent().getContentDensityClass());
                }
                
                // Setup router event handler
                const oRouter = this.getRouter();
                if (oRouter && typeof this._onRouteMatched === "function") {
                    oRouter.attachRouteMatched(this._onRouteMatched, this);
                }
                
                // Create app view model for managing state
                const oAppViewModel = new sap.ui.model.json.JSONModel({
                    navExpanded: true
                });
                this.setModel(oAppViewModel, "appView");
                
                // Share the app view model with the component
                if (this.getOwnerComponent()) {
                    this.getOwnerComponent().setModel(oAppViewModel, "appView");
                }
                
                // Initialize responsive behavior
                this._initResponsiveBehavior();
                
                // Wait for tables model to be available
                this._waitForTablesModel();
                
            } catch (err) {
                console.error("🔍 APP DEBUG: Error in App controller init:", err);
            }
        },
        
        /**
         * Wait for tables model to be available before initializing nav list
         * @private
         */
        _waitForTablesModel: function() {
            console.log("🔍 APP DEBUG: Waiting for tables model...");
            
            // Check if model is available
            const oTablesModel = this.getOwnerComponent().getModel("tables");
            
            if (!oTablesModel) {
                console.log("🔍 APP DEBUG: Tables model not yet available, waiting...");
                setTimeout(this._waitForTablesModel.bind(this), 500);
                return;
            }
            
            const aTables = oTablesModel.getProperty("/tables");
            
            if (!aTables || aTables.length === 0) {
                console.log("🔍 APP DEBUG: Tables data not yet available, waiting...");
                setTimeout(this._waitForTablesModel.bind(this), 500);
                return;
            }
            
            console.log("🔍 APP DEBUG: Tables model available, initializing navigation list");
            this._initializeNavigationList();
        },
        
        /**
         * Handle route matched events
         * @param {sap.ui.base.Event} oEvent The route matched event
         * @private
         */
        _onRouteMatched: function(oEvent) {
            const sRouteName = oEvent.getParameter("name");
            const oArguments = oEvent.getParameter("arguments");
            
            // Rest of your route matched code
            console.log("Route matched:", sRouteName, oArguments);
        },
        
        

        /**
         * Adjust SplitApp mode based on device type
         * @param {sap.m.SplitApp} oSplitApp The SplitApp control
         * @param {sap.ui.model.Model} oDeviceModel The device model
         * @private
         */
        _adjustSplitAppMode: function(oSplitApp, oDeviceModel) {
            try {
                const bPhone = oDeviceModel.getProperty("/system/phone");
                const bTablet = oDeviceModel.getProperty("/system/tablet");
                const oAppViewModel = this.getModel("appView");
                
                console.log("Adjusting SplitApp mode. Phone:", bPhone, "Tablet:", bTablet);
                
                if (bPhone) {
                    // Phone: Use PopoverMode for compact UI
                    oSplitApp.setMode("PopoverMode");
                    oSplitApp.hideMaster();
                    
                    // Update model state
                    if (oAppViewModel) {
                        oAppViewModel.setProperty("/navExpanded", false);
                    }
                    
                    // Update collapse button
                    const oCollapseButton = this.byId("collapseNavButton");
                    if (oCollapseButton) {
                        oCollapseButton.setIcon("sap-icon://menu2");
                        oCollapseButton.setTooltip("Show Navigation");
                    }
                } else if (bTablet) {
                    // Tablet: Use ShowHideMode for flexible UI
                    oSplitApp.setMode("ShowHideMode");
                    
                    // Default to hidden on tablets in portrait
                    if (window.innerHeight > window.innerWidth) { // Portrait mode
                        oSplitApp.hideMaster();
                        
                        // Update model state
                        if (oAppViewModel) {
                            oAppViewModel.setProperty("/navExpanded", false);
                        }
                        
                        // Update collapse button
                        const oCollapseButton = this.byId("collapseNavButton");
                        if (oCollapseButton) {
                            oCollapseButton.setIcon("sap-icon://menu2");
                            oCollapseButton.setTooltip("Show Navigation");
                        }
                    }
                } else {
                    // Desktop: Use ShowHideMode with expanded menu
                    oSplitApp.setMode("ShowHideMode");
                    oSplitApp.showMaster();
                    
                    // Update model state
                    if (oAppViewModel) {
                        oAppViewModel.setProperty("/navExpanded", true);
                    }
                    
                    // Update collapse button
                    const oCollapseButton = this.byId("collapseNavButton");
                    if (oCollapseButton) {
                        oCollapseButton.setIcon("sap-icon://navigation-left-arrow");
                        oCollapseButton.setTooltip("Hide Navigation");
                    }
                }
            } catch (err) {
                console.error("Error adjusting SplitApp mode:", err);
            }
        },

        /**
         * Toggle navigation panel visibility
         */
        onCollapseNav: function() {
            try {
                // Get SplitApp control
                const oSplitApp = this.byId("app");
                
                if (!oSplitApp) {
                    console.error("SplitApp control not found!");
                    return;
                }
                
                // Get app view model
                const oAppViewModel = this.getModel("appView");
                
                // Get current expansion state
                const bExpanded = oAppViewModel.getProperty("/navExpanded");
                
                // Get collapse button
                const oCollapseButton = this.byId("collapseNavButton");
                
                console.log("Toggle nav button pressed. Current state:", bExpanded ? "expanded" : "collapsed");
                
                // Toggle collapsed state
                if (bExpanded) {
                    oSplitApp.hideMaster();
                    
                    // Update button icon and tooltip for expand action
                    if (oCollapseButton) {
                        oCollapseButton.setIcon("sap-icon://navigation-right-arrow");
                        oCollapseButton.setTooltip("Show Navigation");
                    }
                    
                    // Update model state
                    oAppViewModel.setProperty("/navExpanded", false);
                } else {
                    oSplitApp.showMaster();
                    
                    // Update button icon and tooltip for collapse action
                    if (oCollapseButton) {
                        oCollapseButton.setIcon("sap-icon://navigation-left-arrow");
                        oCollapseButton.setTooltip("Hide Navigation");
                    }
                    
                    // Update model state
                    oAppViewModel.setProperty("/navExpanded", true);
                }
            } catch (error) {
                console.error("Error in menu toggle:", error);
            }
        },

        /**
         * Handler for afterMasterOpen event of SplitApp
         */
        onAfterMasterOpen: function() {
            // Update view model
            const oAppViewModel = this.getModel("appView");
            if (oAppViewModel) {
                oAppViewModel.setProperty("/navExpanded", true);
            }
            
            // Update button
            const oCollapseButton = this.byId("collapseNavButton");
            if (oCollapseButton) {
                oCollapseButton.setIcon("sap-icon://navigation-left-arrow");
                oCollapseButton.setTooltip("Hide Navigation");
            }
            
            console.log("Master panel opened");
        },

        /**
         * Handler for afterMasterClose event of SplitApp
         */
        onAfterMasterClose: function() {
            // Update view model
            const oAppViewModel = this.getModel("appView");
            if (oAppViewModel) {
                oAppViewModel.setProperty("/navExpanded", false);
            }
            
            // Update button
            const oCollapseButton = this.byId("collapseNavButton");
            if (oCollapseButton) {
                oCollapseButton.setIcon("sap-icon://navigation-right-arrow");
                oCollapseButton.setTooltip("Show Navigation");
            }
            
            console.log("Master panel closed");
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
            console.log("🔍 MENU DEBUG: Menu item pressed:", oItem);
            
            // Try to get table ID from custom data
            let sTableId = null;
            
            // Method 1: data() API
            if (oItem.data) {
                sTableId = oItem.data("tableId");
                console.log("🔍 MENU DEBUG: Table ID from data() API:", sTableId);
            }
            
            // Method 2: getCustomData
            if (!sTableId && oItem.getCustomData) {
                const aCustomData = oItem.getCustomData();
                console.log("🔍 MENU DEBUG: Custom data entries:", aCustomData.length);
                
                if (aCustomData && aCustomData.length > 0) {
                    for (let i = 0; i < aCustomData.length; i++) {
                        if (aCustomData[i].getKey() === "tableId") {
                            sTableId = aCustomData[i].getValue();
                            console.log("🔍 MENU DEBUG: Table ID from custom data:", sTableId);
                            break;
                        }
                    }
                }
            }
            
            if (sTableId) {
                console.log("🔍 MENU DEBUG: Navigating to entity list for:", sTableId);
                this.getRouter().navTo("entityList", {
                    table: sTableId
                });
            } else {
                console.error("🔍 MENU DEBUG: No table ID found for navigation!");
            }
        },
        
        /**
         * List selection change handler
         * @param {sap.ui.base.Event} oEvent The selection change event
         */
        onNavListItemSelect: function(oEvent) {
            const oItem = oEvent.getParameter("listItem");
            
            // Check if this is the home item
            if (oItem.getId() === this.byId("homeItem").getId()) {
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

        
        _initResponsiveBehavior: function() {
            try {
                const oSplitApp = this.byId("app");
                if (!oSplitApp) {
                    console.error("SplitApp control not found in view!");
                    return;
                }
                
                // Create device model if not already available
                let oDeviceModel = this.getModel("device");
                if (!oDeviceModel) {
                    // Try to get from component
                    oDeviceModel = this.getOwnerComponent().getModel("device");
                    
                    // If still not available, create a new one
                    if (!oDeviceModel) {
                        console.warn("Device model not found, creating a new one");
                        oDeviceModel = new sap.ui.model.json.JSONModel(sap.ui.Device);
                        this.getOwnerComponent().setModel(oDeviceModel, "device");
                        this.setModel(oDeviceModel, "device");
                    }
                }
                
                // Handle initial resize
                this._adjustSplitAppMode(oSplitApp, oDeviceModel);
                
                // Add resize handler
                const fnResponsiveHandler = function() {
                    this._adjustSplitAppMode(oSplitApp, oDeviceModel);
                }.bind(this);
                
                // Attach to resize event
                sap.ui.Device.resize.attachHandler(fnResponsiveHandler);
                
                // Store handler reference for cleanup
                this._fnResponsiveHandler = fnResponsiveHandler;
            } catch (err) {
                console.error("Error initializing responsive behavior:", err);
            }
        },

       /**
         * Initialize the navigation list with database tables
         * @private
         */
        _initializeNavigationList: function() {
            console.log("🔍 MENU DEBUG: Starting navigation list initialization");
            
            try {
                // Get the tables model
                const oTablesModel = this.getOwnerComponent().getModel("tables");
                
                if (!oTablesModel) {
                    console.error("🔍 MENU DEBUG: Tables model not available!");
                    
                    // Try again in a second
                    setTimeout(this._initializeNavigationList.bind(this), 1000);
                    return;
                }
                
                // Get tables data
                const aTables = oTablesModel.getProperty("/tables");
                console.log("🔍 MENU DEBUG: Tables from model:", aTables);
                
                if (!aTables || aTables.length === 0) {
                    console.error("🔍 MENU DEBUG: No tables found in model");
                    
                    // Try again in a second
                    setTimeout(this._initializeNavigationList.bind(this), 1000);
                    return;
                }
                
                // Get the navigation list control
                const oNavList = this.byId("navigationList");
                console.log("🔍 MENU DEBUG: Navigation list control:", oNavList);
                
                if (!oNavList) {
                    console.error("🔍 MENU DEBUG: Navigation list control not found!");
                    return;
                }
                
                // Get home item if it exists
                const oHomeItem = this.byId("homeItem");
                console.log("🔍 MENU DEBUG: Home item:", oHomeItem);
                
                // Clear existing items
                console.log("🔍 MENU DEBUG: Clearing existing items");
                oNavList.removeAllItems();
                
                // Add home item first - FIXED: Only create a new one if we don't have one
                if (oHomeItem) {
                    console.log("🔍 MENU DEBUG: Re-adding existing home item");
                    oNavList.addItem(oHomeItem);
                } else {
                    console.log("🔍 MENU DEBUG: Creating new home item");
                    const oNewHomeItem = new sap.m.StandardListItem({
                        id: this.createId("homeItem"),
                        title: "Home",
                        icon: "sap-icon://home",
                        type: "Navigation"
                    });
                    
                    oNewHomeItem.attachPress(this.onNavHome, this);
                    oNavList.addItem(oNewHomeItem);
                }
                
                // Add table items
                console.log("🔍 MENU DEBUG: Adding table items, count:", aTables.length);
                
                aTables.forEach((oTable, index) => {
                    console.log(`🔍 MENU DEBUG: Adding item ${index+1}:`, oTable.id, oTable.title);
                    
                    const oListItem = new sap.m.StandardListItem({
                        id: this.createId("navItem_" + oTable.id),
                        title: oTable.title,
                        icon: oTable.icon || "sap-icon://table-view",
                        type: "Navigation"
                    });
                    
                    // Store table ID in custom data
                    oListItem.addCustomData(new sap.ui.core.CustomData({
                        key: "tableId",
                        value: oTable.id,
                        writeToDom: true
                    }));
                    
                    // Attach press handler
                    oListItem.attachPress(this.onNavToEntityList, this);
                    
                    // Add to list
                    oNavList.addItem(oListItem);
                    console.log(`🔍 MENU DEBUG: Added item for ${oTable.title}`);
                });
                
                console.log("🔍 MENU DEBUG: Navigation list initialization complete!");
                
                // Force a re-rendering
                oNavList.invalidate();
                
            } catch (error) {
                console.error("🔍 MENU DEBUG: Error in initialization:", error);
            }
        }
    });
});