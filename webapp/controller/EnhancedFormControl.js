sap.ui.define([
    "sap/ui/base/Object",
    "sap/m/Input",
    "sap/m/TextArea",
    "sap/m/CheckBox",
    "sap/m/DatePicker",
    "sap/m/DateTimePicker",
    "sap/m/ComboBox",
    "sap/m/MultiComboBox",
    "sap/m/Select",
    "sap/m/RadioButtonGroup",
    "sap/m/RadioButton",
    "sap/m/StepInput",
    "sap/m/Slider",
    "sap/m/Switch",
    "sap/m/ColorPicker",
    "sap/m/TimePicker",
    "sap/m/Link",
    "sap/m/Text",
    "sap/m/FormattedText",
    "sap/m/Label",
    "sap/m/HBox",
    "sap/m/VBox",
    "sap/m/Token",
    "sap/m/TokenizerRenderer",
    "sap/m/MultiInput",
    "sap/ui/core/Item",
    "sap/ui/core/ListItem",
    "sap/ui/layout/form/FormElement",
    "sap/ui/layout/form/FormContainer",
    "sap/ui/richtexteditor/RichTextEditor",
    "sap/ui/unified/FileUploader"
], function(
    BaseObject,
    Input, 
    TextArea, 
    CheckBox, 
    DatePicker,
    DateTimePicker,
    ComboBox,
    MultiComboBox,
    Select,
    RadioButtonGroup,
    RadioButton,
    StepInput,
    Slider,
    Switch,
    ColorPicker,
    TimePicker,
    Link,
    Text,
    FormattedText,
    Label,
    HBox,
    VBox,
    Token,
    TokenizerRenderer,
    MultiInput,
    Item,
    ListItem,
    FormElement,
    FormContainer,
    RichTextEditor,
    FileUploader
) {
    "use strict";

    return BaseObject.extend("com.supabase.easyui5.control.EnhancedFormControls", {
        /**
         * Constructor for the enhanced form controls
         * @param {Object} oDataService The enhanced data service
         */
        constructor: function(oDataService) {
            BaseObject.call(this);
            this._oDataService = oDataService;
        },
        
        /**
         * Create an input field based on enhanced column metadata
         * @param {Object} oColumnMetadata The column metadata
         * @param {string} sPath The binding path
         * @param {boolean} bEditMode Whether the field is in edit mode
         * @param {Object} oOptions Additional options
         * @returns {sap.ui.core.Control} The created control
         * @public
         */
        createField: function(oColumnMetadata, sPath, bEditMode, oOptions) {
            oOptions = oOptions || {};
            
            // Determine field type from metadata or options
            const sFieldType = oOptions.fieldType || oColumnMetadata.type || "string";
            
            // If in edit mode, create editable field
            if (bEditMode) {
                return this._createEditableField(oColumnMetadata, sPath, sFieldType, oOptions);
            } else {
                return this._createDisplayField(oColumnMetadata, sPath, sFieldType, oOptions);
            }
        },
        
        /**
         * Create an editable field based on field type
         * @param {Object} oColumnMetadata The column metadata
         * @param {string} sPath The binding path
         * @param {string} sFieldType The field type
         * @param {Object} oOptions Additional options
         * @returns {sap.ui.core.Control} The created control
         * @private
         */
        _createEditableField: function(oColumnMetadata, sPath, sFieldType, oOptions) {
            const bRequired = oColumnMetadata.required === true;
            const sValueState = "{= ${" + oOptions.errorsPath + "/" + oColumnMetadata.name + "} ? 'Error' : 'None' }";
            const sValueStateText = "{" + oOptions.errorsPath + "/" + oColumnMetadata.name + "}";
            
            // Standard properties for most input controls
            const oStandardProps = {
                required: bRequired,
                enabled: !(oColumnMetadata.editable === false),
                width: "100%",
                valueState: sValueState,
                valueStateText: sValueStateText
            };
            
            // Functions to create specific field types
            const fieldCreators = {
                // Standard text field
                "string": () => {
                    return new Input(Object.assign({
                        value: {
                            path: sPath,
                            mode: 'TwoWay'
                        }
                    }, oStandardProps));
                },
                
                // Text area for longer text
                "text": () => {
                    return new TextArea(Object.assign({
                        value: {
                            path: sPath,
                            mode: 'TwoWay'
                        },
                        rows: oOptions.rows || 3,
                        growing: true,
                        growingMaxLines: 15
                    }, oStandardProps));
                },
                
                // Rich text editor
                "richtext": () => {
                    return new RichTextEditor(Object.assign({
                        value: {
                            path: sPath,
                            mode: 'TwoWay'
                        },
                        editorType: oOptions.editorType || "TinyMCE",
                        width: "100%",
                        height: "300px",
                        customToolbar: true,
                        showGroupFont: true,
                        showGroupLink: true,
                        showGroupInsert: true
                    }, oOptions.editorOptions || {}));
                },
                
                // Boolean checkbox field
                "boolean": () => {
                    return new CheckBox(Object.assign({
                        selected: {
                            path: sPath,
                            mode: 'TwoWay'
                        },
                        text: oColumnMetadata.checkboxLabel
                    }, oStandardProps));
                },
                
                // Boolean switch field (alternative to checkbox)
                "switch": () => {
                    return new Switch(Object.assign({
                        state: {
                            path: sPath,
                            mode: 'TwoWay'
                        },
                        customTextOn: oOptions.textOn || "Yes",
                        customTextOff: oOptions.textOff || "No"
                    }, oStandardProps));
                },
                
                // Date picker
                "date": () => {
                    return new DatePicker(Object.assign({
                        value: {
                            path: sPath,
                            mode: 'TwoWay',
                            type: new sap.ui.model.type.Date({
                                pattern: oOptions.datePattern || "yyyy-MM-dd"
                            })
                        },
                        valueFormat: oOptions.valueFormat || "yyyy-MM-dd",
                        displayFormat: oOptions.displayFormat || "medium"
                    }, oStandardProps));
                },
                
                // Date and time picker
                "datetime": () => {
                    return new DateTimePicker(Object.assign({
                        value: {
                            path: sPath,
                            mode: 'TwoWay',
                            type: new sap.ui.model.type.DateTime({
                                pattern: oOptions.dateTimePattern || "yyyy-MM-dd'T'HH:mm:ss"
                            })
                        },
                        valueFormat: oOptions.valueFormat || "yyyy-MM-dd'T'HH:mm:ss",
                        displayFormat: oOptions.displayFormat || "medium"
                    }, oStandardProps));
                },
                
                // Time only picker
                "time": () => {
                    return new TimePicker(Object.assign({
                        value: {
                            path: sPath,
                            mode: 'TwoWay',
                            type: new sap.ui.model.type.Time({
                                pattern: oOptions.timePattern || "HH:mm:ss"
                            })
                        },
                        valueFormat: oOptions.valueFormat || "HH:mm:ss",
                        displayFormat: oOptions.displayFormat || "medium"
                    }, oStandardProps));
                },
                
                // Numeric input
                "number": () => {
                    return new Input(Object.assign({
                        value: {
                            path: sPath,
                            mode: 'TwoWay',
                            type: new sap.ui.model.type.Float({
                                minFractionDigits: oOptions.minFractionDigits || 0,
                                maxFractionDigits: oOptions.maxFractionDigits || 2
                            })
                        },
                        type: "Number"
                    }, oStandardProps));
                },
                
                // Integer only numeric input with stepping
                "integer": () => {
                    return new StepInput(Object.assign({
                        value: {
                            path: sPath,
                            mode: 'TwoWay',
                            type: new sap.ui.model.type.Integer()
                        },
                        min: oOptions.min !== undefined ? oOptions.min : 0,
                        max: oOptions.max !== undefined ? oOptions.max : 999999,
                        step: oOptions.step || 1
                    }, oStandardProps));
                },
                
                // Slider for number ranges
                "slider": () => {
                    return new Slider(Object.assign({
                        value: {
                            path: sPath,
                            mode: 'TwoWay'
                        },
                        min: oOptions.min !== undefined ? oOptions.min : 0,
                        max: oOptions.max !== undefined ? oOptions.max : 100,
                        step: oOptions.step || 1,
                        showAdvancedTooltip: true,
                        showHandleTooltip: true
                    }, oStandardProps));
                },
                
                // Email field
                "email": () => {
                    return new Input(Object.assign({
                        value: {
                            path: sPath,
                            mode: 'TwoWay'
                        },
                        type: "Email"
                    }, oStandardProps));
                },
                
                // URL field
                "url": () => {
                    return new Input(Object.assign({
                        value: {
                            path: sPath,
                            mode: 'TwoWay'
                        },
                        type: "Url"
                    }, oStandardProps));
                },
                
                // Phone field
                "phone": () => {
                    return new Input(Object.assign({
                        value: {
                            path: sPath,
                            mode: 'TwoWay'
                        },
                        type: "Tel"
                    }, oStandardProps));
                },
                
                // Password field
                "password": () => {
                    return new Input(Object.assign({
                        value: {
                            path: sPath,
                            mode: 'TwoWay'
                        },
                        type: "Password"
                    }, oStandardProps));
                },
                
                // Color picker
                "color": () => {
                    return new ColorPicker(Object.assign({
                        colorString: {
                            path: sPath,
                            mode: 'TwoWay'
                        },
                        mode: "HSL"
                    }, oStandardProps));
                },
                
                // ComboBox for relation fields
                "relation": () => {
                    const oComboBox = new ComboBox(Object.assign({
                        selectedKey: {
                            path: sPath,
                            mode: 'TwoWay'
                        },
                        showSecondaryValues: true,
                        filterSecondaryValues: true
                    }, oStandardProps));
                    
                    // Load relation options if data service is available
                    if (this._oDataService && oColumnMetadata.relation) {
                        this._loadRelationOptions(oComboBox, oColumnMetadata, oOptions);
                    }
                    
                    return oComboBox;
                },
                
                // Multi-selection ComboBox for many-to-many relations
                "multirelation": () => {
                    const oMultiComboBox = new MultiComboBox(Object.assign({
                        selectedKeys: {
                            path: sPath,
                            mode: 'TwoWay'
                        },
                        showSecondaryValues: true,
                        filterSecondaryValues: true
                    }, oStandardProps));
                    
                    // Load relation options if data service is available
                    if (this._oDataService && oColumnMetadata.relation) {
                        this._loadRelationOptions(oMultiComboBox, oColumnMetadata, oOptions);
                    }
                    
                    return oMultiComboBox;
                },
                
                // Multi-input field for tags or multiple values
                "tags": () => {
                    const oMultiInput = new MultiInput(Object.assign({
                        value: {
                            path: sPath,
                            mode: 'TwoWay'
                        },
                        showValueHelp: true,
                        enableMultiLineMode: true
                    }, oStandardProps));
                    
                    // Convert string to tokens on initialization
                    if (oOptions.tokensPath) {
                        const oTokensBinding = {
                            path: oOptions.tokensPath,
                            template: new Token({
                                key: "{key}",
                                text: "{text}"
                            })
                        };
                        oMultiInput.bindTokens(oTokensBinding);
                    }
                    
                    return oMultiInput;
                },
                
                // Select dropdown for predefined options
                "select": () => {
                    const oSelect = new Select(Object.assign({
                        selectedKey: {
                            path: sPath,
                            mode: 'TwoWay'
                        }
                    }, oStandardProps));
                    
                    // Add items if provided in options
                    if (oOptions.items && Array.isArray(oOptions.items)) {
                        oOptions.items.forEach(item => {
                            oSelect.addItem(new Item({
                                key: item.key,
                                text: item.text
                            }));
                        });
                    }
                    
                    return oSelect;
                },
                
                // Radio buttons for exclusive selection
                "radio": () => {
                    const oRadioGroup = new RadioButtonGroup(Object.assign({
                        selectedIndex: {
                            path: sPath,
                            mode: 'TwoWay',
                            formatter: function(value) {
                                if (oOptions.items && Array.isArray(oOptions.items)) {
                                    return oOptions.items.findIndex(item => item.key === value);
                                }
                                return -1;
                            }
                        },
                        columns: oOptions.columns || 1
                    }, oStandardProps));
                    
                    // Add radio buttons if provided in options
                    if (oOptions.items && Array.isArray(oOptions.items)) {
                        oOptions.items.forEach(item => {
                            oRadioGroup.addButton(new RadioButton({
                                text: item.text,
                                tooltip: item.tooltip
                            }));
                        });
                    }
                    
                    return oRadioGroup;
                },
                
                // File upload field
                "file": () => {
                    return new FileUploader(Object.assign({
                        value: {
                            path: sPath,
                            mode: 'TwoWay'
                        },
                        uploadUrl: oOptions.uploadUrl || "",
                        uploadOnChange: oOptions.uploadOnChange === true,
                        maximumFileSize: oOptions.maximumFileSize || 10, // 10 MB default
                        fileType: oOptions.fileTypes || ["jpg", "png", "pdf"],
                        buttonText: oOptions.buttonText || "Browse...",
                        placeholder: oOptions.placeholder || "Choose a file"
                    }, oStandardProps));
                }
            };
            
            // Check if we have a specific creator for this field type
            if (fieldCreators[sFieldType]) {
                return fieldCreators[sFieldType]();
            }
            
            // Fall back to string input for unknown types
            return fieldCreators["string"]();
        },
        
        /**
         * Create a display (read-only) field based on field type
         * @param {Object} oColumnMetadata The column metadata
         * @param {string} sPath The binding path
         * @param {string} sFieldType The field type
         * @param {Object} oOptions Additional options
         * @returns {sap.ui.core.Control} The created control
         * @private
         */
        _createDisplayField: function(oColumnMetadata, sPath, sFieldType, oOptions) {
            // Functions to create specific display fields
            const displayCreators = {
                // Standard text display
                "string": () => {
                    return new Text({
                        text: {
                            path: sPath
                        },
                        wrapping: true
                    });
                },
                
                // Long text display with more wrapping
                "text": () => {
                    return new Text({
                        text: {
                            path: sPath
                        },
                        wrapping: true,
                        maxLines: oOptions.maxLines || 5
                    });
                },
                
                // Rich text display
                "richtext": () => {
                    return new FormattedText({
                        htmlText: {
                            path: sPath
                        }
                    });
                },
                
                // Boolean display
                "boolean": () => {
                    return new Text({
                        text: {
                            path: sPath,
                            formatter: function(value) {
                                return value ? "Yes" : "No";
                            }
                        }
                    });
                },
                
                // Date display
                "date": () => {
                    return new Text({
                        text: {
                            path: sPath,
                            formatter: function(value) {
                                if (!value) return "";
                                try {
                                    const oDate = new Date(value);
                                    if (isNaN(oDate.getTime())) return "";
                                    
                                    // Format based on locale
                                    return oDate.toLocaleDateString();
                                } catch (e) {
                                    return "";
                                }
                            }
                        }
                    });
                },
                
                // DateTime display
                "datetime": () => {
                    return new Text({
                        text: {
                            path: sPath,
                            formatter: function(value) {
                                if (!value) return "";
                                try {
                                    const oDate = new Date(value);
                                    if (isNaN(oDate.getTime())) return "";
                                    
                                    // Format based on locale
                                    return oDate.toLocaleString();
                                } catch (e) {
                                    return "";
                                }
                            }
                        }
                    });
                },
                
                // Time display
                "time": () => {
                    return new Text({
                        text: {
                            path: sPath,
                            formatter: function(value) {
                                if (!value) return "";
                                try {
                                    // Handle different time formats
                                    let oDate;
                                    if (value.includes("T") || value.includes("-")) {
                                        // Full date with time
                                        oDate = new Date(value);
                                    } else {
                                        // Just time string like "13:45:00"
                                        const parts = value.split(":");
                                        oDate = new Date();
                                        oDate.setHours(parts[0] || 0);
                                        oDate.setMinutes(parts[1] || 0);
                                        oDate.setSeconds(parts[2] || 0);
                                    }
                                    
                                    if (isNaN(oDate.getTime())) return "";
                                    
                                    // Format time only
                                    return oDate.toLocaleTimeString();
                                } catch (e) {
                                    return value; // Return original if parsing fails
                                }
                            }
                        }
                    });
                },
                
                // Number display
                "number": () => {
                    return new Text({
                        text: {
                            path: sPath,
                            formatter: function(value) {
                                if (value === undefined || value === null) return "";
                                
                                const iDecimals = oOptions.decimals !== undefined ? 
                                    oOptions.decimals : 2;
                                
                                return parseFloat(value).toFixed(iDecimals);
                            }
                        }
                    });
                },
                
                // Integer display
                "integer": () => {
                    return new Text({
                        text: {
                            path: sPath,
                            formatter: function(value) {
                                if (value === undefined || value === null) return "";
                                return parseInt(value, 10);
                            }
                        }
                    });
                },
                
                // Email display as link
                "email": () => {
                    return new Link({
                        text: {
                            path: sPath
                        },
                        href: {
                            path: sPath,
                            formatter: function(value) {
                                return value ? "mailto:" + value : "";
                            }
                        },
                        target: "_blank"
                    });
                },
                
                // URL display as link
                "url": () => {
                    return new Link({
                        text: {
                            path: sPath
                        },
                        href: {
                            path: sPath
                        },
                        target: "_blank"
                    });
                },
                
                // Phone display as link
                "phone": () => {
                    return new Link({
                        text: {
                            path: sPath
                        },
                        href: {
                            path: sPath,
                            formatter: function(value) {
                                return value ? "tel:" + value : "";
                            }
                        }
                    });
                },
                
                // Relation display
                "relation": () => {
                    return new Text({
                        text: {
                            path: sPath + "_text"
                        }
                    });
                },
                
                // Tags display
                "tags": () => {
                    // Create HBox to contain the tags
                    const oHBox = new HBox({
                        wrap: sap.m.FlexWrap.Wrap,
                        renderType: sap.m.FlexRendertype.Bare
                    });
                    
                    // If we have a tokens path, bind tokens as Text controls
                    if (oOptions.tokensPath) {
                        const oBinding = {
                            path: oOptions.tokensPath,
                            templateShareable: false,
                            template: new Text({
                                text: "{text}"
                            }).addStyleClass("sapMTokenizer sapMToken sapUiTinyMarginEnd sapUiTinyMarginBottom")
                        };
                        
                        oHBox.bindAggregation("items", oBinding);
                    } else {
                        // Try to parse comma-separated string
                        const oTextBinding = {
                            path: sPath,
                            formatter: function(value) {
                                if (!value) return [];
                                
                                // Convert string to array
                                let aValues;
                                if (typeof value === 'string') {
                                    aValues = value.split(',').map(s => s.trim());
                                } else if (Array.isArray(value)) {
                                    aValues = value;
                                } else {
                                    return [];
                                }
                                
                                // Return array of tag objects
                                return aValues.map(tag => ({ text: tag }));
                            }
                        };
                        
                        const oItemsBinding = {
                            path: oTextBinding.path,
                            formatter: oTextBinding.formatter,
                            templateShareable: false,
                            template: new Text({
                                text: "{text}"
                            }).addStyleClass("sapMTokenizer sapMToken sapUiTinyMarginEnd sapUiTinyMarginBottom")
                        };
                        
                        oHBox.bindAggregation("items", oItemsBinding);
                    }
                    
                    return oHBox;
                },
                
                // Select/Dropdown display
                "select": () => {
                    // For select, we need to find the display text based on the key
                    return new Text({
                        text: {
                            path: sPath,
                            formatter: function(value) {
                                if (oOptions.items && Array.isArray(oOptions.items)) {
                                    const item = oOptions.items.find(item => item.key === value);
                                    return item ? item.text : value;
                                }
                                return value;
                            }
                        }
                    });
                },
                
                // Radio button display
                "radio": () => {
                    // Similar to select, find display text based on the key
                    return new Text({
                        text: {
                            path: sPath,
                            formatter: function(value) {
                                if (oOptions.items && Array.isArray(oOptions.items)) {
                                    const item = oOptions.items.find(item => item.key === value);
                                    return item ? item.text : value;
                                }
                                return value;
                            }
                        }
                    });
                },
                
                // File display
                "file": () => {
                    return new Link({
                        text: {
                            path: sPath,
                            formatter: function(value) {
                                if (!value) return "";
                                
                                // Extract filename from path
                                const parts = value.split('/');
                                return parts[parts.length - 1];
                            }
                        },
                        href: {
                            path: sPath
                        },
                        target: "_blank"
                    });
                }
            };
            
            // Check if we have a specific creator for this field type
            if (displayCreators[sFieldType]) {
                return displayCreators[sFieldType]();
            }
            
            // Fall back to string display for unknown types
            return displayCreators["string"]();
        },
        
        /**
         * Load relation options for a ComboBox or MultiComboBox
         * @param {sap.m.ComboBox|sap.m.MultiComboBox} oControl The combo box control
         * @param {Object} oColumnMetadata The column metadata
         * @param {Object} oOptions Additional options
         * @private
         */
        _loadRelationOptions: function(oControl, oColumnMetadata, oOptions) {
            // Get the related table info
            const sRelatedTable = oColumnMetadata.relation;
            
            // Get metadata for related table
            this._oDataService.getMetadata(sRelatedTable)
                .then(oMetadata => {
                    const sPrimaryKey = oMetadata.primaryKey || "id";
                    const sTitleField = oMetadata.titleField || sPrimaryKey;
                    
                    // Get relation options
                    return this._oDataService.getRelationOptions(sRelatedTable, sPrimaryKey, sTitleField);
                })
                .then(aOptions => {
                    // Clear existing items
                    oControl.removeAllItems();
                    
                    // Add empty item if not required
                    if (!oColumnMetadata.required) {
                        oControl.addItem(new Item({
                            key: "",
                            text: oOptions.emptyItemText || "- None -"
                        }));
                    }
                    
                    // Add items to ComboBox
                    aOptions.forEach(item => {
                        oControl.addItem(new Item({
                            key: item.key,
                            text: item.text
                        }));
                    });
                })
                .catch(error => {
                    console.error("Error loading relation options:", error);
                    
                    // Add error item to indicate the problem
                    oControl.removeAllItems();
                    oControl.addItem(new Item({
                        key: "",
                        text: "Error loading options"
                    }));
                });
        }
    });
});