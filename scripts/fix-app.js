// scripts/fix-app.js
const fs = require('fs');
const path = require('path');

console.log("Starting comprehensive app fixes...");

// 1. Create folders if they don't exist
const directoriesToCreate = [
    '../webapp',
    '../webapp/controller',
    '../webapp/view',
    '../webapp/model',
    '../webapp/i18n',
    '../webapp/css'
];

directoriesToCreate.forEach(dir => {
    const dirPath = path.join(__dirname, dir);
    if (!fs.existsSync(dirPath)) {
        console.log(`Creating directory: ${dirPath}`);
        fs.mkdirSync(dirPath, { recursive: true });
    }
});

// 2. Add a simple Component-preload.js file
const preloadPath = path.join(__dirname, '../webapp/Component-preload.js');
const preloadContent = `// Component-preload.js
sap.ui.define([], function() {
    "use strict";
    
    console.log("Component-preload.js loaded");
    
    // This is just a placeholder for development
    // The real preload file will be generated during build
    return {};
});`;

if (!fs.existsSync(preloadPath)) {
    console.log('Creating Component-preload.js...');
    fs.writeFileSync(preloadPath, preloadContent);
    console.log('Created Component-preload.js');
} else {
    console.log('Component-preload.js already exists.');
}

// 3. Update App.view.xml to remove masterButtonPress
const appViewPath = path.join(__dirname, '../webapp/view/App.view.xml');
if (fs.existsSync(appViewPath)) {
    let appViewContent = fs.readFileSync(appViewPath, 'utf8');
    
    if (appViewContent.includes('masterButtonPress=".onMasterButtonPress"')) {
        console.log('Removing masterButtonPress property from App.view.xml...');
        appViewContent = appViewContent.replace('masterButtonPress=".onMasterButtonPress"', '');
        fs.writeFileSync(appViewPath, appViewContent);
        console.log('Fixed App.view.xml');
    } else {
        console.log('App.view.xml does not contain masterButtonPress property.');
    }
}

// 4. Fix index.html
const indexPath = path.join(__dirname, '../webapp/index.html');
if (fs.existsSync(indexPath)) {
    let indexContent = fs.readFileSync(indexPath, 'utf8');
    
    if (!indexContent.includes('data-sap-ui-xx-componentPreload="off"')) {
        console.log('Adding componentPreload="off" to index.html...');
        
        // Add the data-sap-ui-xx-componentPreload="off" attribute
        indexContent = indexContent.replace(
            'data-sap-ui-frameOptions="trusted"',
            'data-sap-ui-frameOptions="trusted"\n\t\t\tdata-sap-ui-xx-componentPreload="off"'
        );
        
        // Add explicit require of core modules
        if (!indexContent.includes('sap.ui.require')) {
            const scriptTagToAdd = `
		<!-- Explicitly add the Component.js file -->
		<script>
			// Manual loading - This ensures the file is loaded correctly
			sap.ui.require([
				'com/supabase/easyui5/Component',
				'com/supabase/easyui5/controller/BaseController'
			], function(Component, BaseController) {
				console.log('Core modules pre-loaded successfully');
			});
		</script>`;
            
            // Insert before </head>
            indexContent = indexContent.replace('</head>', scriptTagToAdd + '\n\t</head>');
        }
        
        fs.writeFileSync(indexPath, indexContent);
        console.log('Fixed index.html');
    } else {
        console.log('index.html already has componentPreload turned off.');
    }
}

// 5. Fix App.controller.js
const appControllerPath = path.join(__dirname, '../webapp/controller/App.controller.js');
if (fs.existsSync(appControllerPath)) {
    let appControllerContent = fs.readFileSync(appControllerPath, 'utf8');
    
    // Check and fix _initializeNavigationList calls
    if (appControllerContent.includes('this._initializeNavigationList()') && 
        !appControllerContent.includes('_initializeNavigationList: function()')) {
        console.log('Adding _initializeNavigationList function to App.controller.js...');
        
        // Find the last method
        const lastMethodPosition = appControllerContent.lastIndexOf('function(');
        
        // Define the function
        const navigationListFunction = `
        /**
         * Initialize the navigation list with database tables
         * @private
         */
        _initializeNavigationList: function() {
            try {
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
                const oNavList = this.byId("navigationList");
                if (!oNavList) {
                    console.error("Navigation list not found in view");
                    return;
                }
                
                // Clear existing items except for the home item
                const oHomeItem = this.byId("homeItem");
                oNavList.removeAllItems();
                oNavList.addItem(oHomeItem);
                
                // Add table items to the navigation list
                aTables.forEach(oTable => {
                    const oListItem = new sap.m.StandardListItem({
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
            } catch (error) {
                console.error("Error initializing navigation list:", error);
            }
        },`;
        
        // Insert the function at appropriate position
        const updatedContent = [
            appControllerContent.slice(0, lastMethodPosition),
            navigationListFunction,
            appControllerContent.slice(lastMethodPosition)
        ].join('');
        
        fs.writeFileSync(appControllerPath, updatedContent);
        console.log('Added _initializeNavigationList function to App.controller.js');
    }
}

console.log('All fixes applied successfully!');