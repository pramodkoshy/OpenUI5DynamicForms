sap.ui.define(["sap/ui/base/Object","sap/m/Dialog","sap/m/Button","sap/ui/layout/form/SimpleForm","sap/m/Label","sap/m/Input","sap/m/TextArea","sap/m/CheckBox","sap/m/DatePicker","sap/m/ComboBox","sap/ui/core/Item","sap/m/MessageBox","sap/ui/model/json/JSONModel"],function(e,t,a,r,i,o,s,l,n,d,u,h,c){"use strict";return e.extend("com.supabase.easyui5.control.FormDialog",{constructor:function(t,a){e.call(this);this._oController=t;this._oDialog=null;this._oForm=null;this._oFormControls={};this._fnSuccessCallback=null;this._oParams={title:"Entity Form",mode:"create",tableId:"",entityId:"",metadata:null,entity:{},parentInfo:null,successCallback:null,cancelCallback:null};if(a){for(var r in a){if(a.hasOwnProperty(r)){this._oParams[r]=a[r]}}}this._oDialogModel=new c({title:this._oParams.title,entity:this._oParams.entity||{},validationErrors:{},busy:false});this._fnSuccessCallback=this._oParams.successCallback;this._fnCancelCallback=this._oParams.cancelCallback},open:function(){if(!this._oDialog){this._createDialog()}this._oDialogModel.setProperty("/validationErrors",{});this._oDialog.open();return this},close:function(){if(this._oDialog){this._oDialog.close()}return this},getDialog:function(){if(!this._oDialog){this._createDialog()}return this._oDialog},getModel:function(){return this._oDialogModel},_createDialog:function(){this._oForm=new r({editable:true,layout:"ResponsiveGridLayout",labelSpanXL:4,labelSpanL:4,labelSpanM:4,labelSpanS:12,adjustLabelSpan:false,emptySpanXL:0,emptySpanL:0,emptySpanM:0,emptySpanS:0,columnsXL:1,columnsL:1,columnsM:1,singleContainerFullSize:false});this._oDialog=new t({title:"{/title}",contentWidth:"40rem",contentHeight:"auto",resizable:true,draggable:true,modal:true,verticalScrolling:true,horizontalScrolling:false,stretch:sap.ui.Device.system.phone,content:[this._oForm],beginButton:new a({text:this._oParams.mode==="create"?"Create":"Save",type:"Emphasized",press:this._onSavePress.bind(this)}),endButton:new a({text:"Cancel",press:this._onCancelPress.bind(this)}),afterClose:this._onAfterClose.bind(this),escapeHandler:this._handleEscapeKey.bind(this),busyIndicatorDelay:0});this._oDialog.setModel(this._oDialogModel);this._oController.getView().addDependent(this._oDialog);if(this._oParams.metadata){this._createFormFields(this._oParams.metadata,this._oParams.entity)}else if(this._oParams.tableId){this._loadMetadata(this._oParams.tableId)}},_handleEscapeKey:function(e){if(this._hasChanges()){e.preventDefault();h.confirm("Are you sure you want to discard your changes?",{title:"Discard Changes",onClose:function(e){if(e===h.Action.OK){this.close()}}.bind(this)})}else{return true}},_hasChanges:function(){return true},_loadMetadata:function(e){this._oDialogModel.setProperty("/busy",true);this._oController.getTableMetadata(e).then(function(e){this._oParams.metadata=e;this._createFormFields(e,this._oParams.entity);this._oDialogModel.setProperty("/busy",false)}.bind(this)).catch(function(e){console.error("Error loading metadata:",e);this._oDialogModel.setProperty("/busy",false);h.error("Error loading form: "+e.message)}.bind(this))},_createFormFields:function(e,t){this._oForm.removeAllContent();this._oFormControls={};var a=this._oParams.parentInfo;e.columns.forEach(function(t){if(t.editable===false||t.name===e.primaryKey||t.name==="created_at"||t.name==="updated_at"){return}var r=a&&t.name===a.foreignKey;var o=new i({text:t.label,required:t.required===true});this._oForm.addContent(o);var s=this._createField(t,"/entity/"+t.name,r);this._oForm.addContent(s);this._oFormControls[t.name]=s}.bind(this))},_createField:function(e,t,a){var r;var i=e.name;var u=e.required===true;var h="{= ${/validationErrors/"+i+"} ? 'Error' : 'None' }";var c="{/validationErrors/"+i+"}";switch(e.type){case"relation":if(a){r=new o({value:{path:this._oParams.parentInfo.parentId},description:"Connected to parent "+this._oParams.parentInfo.parentTable,editable:false})}else{r=new d({selectedKey:{path:t,mode:"TwoWay"},valueState:h,valueStateText:c,width:"100%",required:u,showSecondaryValues:true,enabled:true});this._loadRelationOptions(r,e.relation,u)}break;case"boolean":r=new l({selected:{path:t,mode:"TwoWay"},enabled:true});break;case"date":r=new n({value:{path:t,mode:"TwoWay",type:new sap.ui.model.type.Date({pattern:"yyyy-MM-dd"})},valueFormat:"yyyy-MM-dd",displayFormat:"medium",valueState:h,valueStateText:c,width:"100%",required:u,change:this._createValidationHandler.bind(this,e)});break;case"text":r=new s({value:{path:t,mode:"TwoWay"},valueState:h,valueStateText:c,rows:3,growing:true,growingMaxLines:10,width:"100%",required:u});break;case"number":r=new o({value:{path:t,mode:"TwoWay",type:new sap.ui.model.type.Float({minFractionDigits:0,maxFractionDigits:2})},type:"Number",valueState:h,valueStateText:c,width:"100%",required:u,liveChange:this._createValidationHandler.bind(this,e)});break;case"email":r=new o({value:{path:t,mode:"TwoWay"},type:"Email",valueState:h,valueStateText:c,width:"100%",required:u,liveChange:this._createValidationHandler.bind(this,e)});break;default:r=new o({value:{path:t,mode:"TwoWay"},valueState:h,valueStateText:c,width:"100%",required:u,liveChange:this._createValidationHandler.bind(this,e)})}return r},_createValidationHandler:function(e,t){var a=e.name;var r=t.getSource();var i=t.getParameter("value");var o=this._oDialogModel.getProperty("/validationErrors")||{};switch(e.type){case"number":if(i&&isNaN(parseFloat(i))){o[a]="Please enter a valid number";r.setValueState("Error");r.setValueStateText("Please enter a valid number")}else{delete o[a];r.setValueState("None")}break;case"email":var s=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;if(i&&!s.test(i)){o[a]="Please enter a valid email address";r.setValueState("Error");r.setValueStateText("Please enter a valid email address")}else{delete o[a];r.setValueState("None")}break;case"date":var l=t.getParameter("valid");if(!l){o[a]="Please enter a valid date";r.setValueState("Error");r.setValueStateText("Please enter a valid date")}else{delete o[a];r.setValueState("None")}break;default:if(e.required&&(!i||i.trim()==="")){o[a]="This field is required";r.setValueState("Error");r.setValueStateText("This field is required")}else{delete o[a];r.setValueState("None")}}this._oDialogModel.setProperty("/validationErrors",o)},_loadRelationOptions:function(e,t,a){this._oController.getTableMetadata(t).then(function(r){var i=r.primaryKey;var o=r.titleField||i;this._oController.getSupabaseClient().from(t).select("*").then(function({data:t,error:r}){if(r){console.error("Error loading relation options:",r);return}e.removeAllItems();if(!a){e.addItem(new u({key:"",text:"- None -"}))}if(t&&t.length>0){t.forEach(function(t){e.addItem(new u({key:t[i],text:t[o]}))})}})}.bind(this)).catch(function(e){console.error("Error getting metadata for relation:",e)})},_validateForm:function(){var e=this._oDialogModel.getProperty("/entity");var t=this._oParams.metadata;var a={};var r=true;t.columns.forEach(function(i){if(i.editable===false||i.name===t.primaryKey||i.name==="created_at"||i.name==="updated_at"){return}var o=i.name;var s=e[o];var l=this._oFormControls[o];if(this._oParams.parentInfo&&o===this._oParams.parentInfo.foreignKey){return}if(i.required===true&&(s===undefined||s===null||s==="")){r=false;a[o]="This field is required";if(l&&l.setValueState){l.setValueState("Error");l.setValueStateText("This field is required")}console.log("Validation failed for",o,": Required field is empty")}else if(s!==undefined&&s!==null&&s!==""){var n=true;var d="";switch(i.type){case"number":if(isNaN(parseFloat(s))||!isFinite(s)){n=false;d="Please enter a valid number"}break;case"date":var u=new Date(s);if(isNaN(u.getTime())){n=false;d="Please enter a valid date"}break;case"email":var h=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;if(!h.test(s)){n=false;d="Please enter a valid email address"}break}if(!n){r=false;a[o]=d;if(l&&l.setValueState){l.setValueState("Error");l.setValueStateText(d)}console.log("Validation failed for",o,":",d)}}}.bind(this));this._oDialogModel.setProperty("/validationErrors",a);return r},_onSavePress:function(){var e=this._oDialogModel.getProperty("/entity");var t=this._oParams.tableId;var a=this._oParams.entityId;var r=this._oParams.mode;if(!this._validateForm()){h.error("Please correct the errors in the form");return}this._oDialog.setBusy(true);var i=Object.assign({},e);if(r==="create"&&this._oParams.parentInfo){var o=this._oParams.parentInfo.foreignKey;var s=this._oParams.parentInfo.parentId;i[o]=s}if(r==="create"){this._oController.getSupabaseClient().from(t).insert(i).then(({data:e,error:t})=>{this._oDialog.setBusy(false);if(t){console.error("Error creating entity:",t);h.error("Error creating entity: "+t.message);return}this._oDialog.close();if(this._fnSuccessCallback){var a=e&&e.length>0?e[0]:i;this._fnSuccessCallback(a)}}).catch(e=>{this._oDialog.setBusy(false);console.error("Error in Supabase query:",e);h.error("Error creating entity: "+e.message)})}else if(r==="edit"){var l=this._oParams.metadata;var n=l.primaryKey;this._oController.getSupabaseClient().from(t).update(i).eq(n,a).then(({data:e,error:t})=>{this._oDialog.setBusy(false);if(t){console.error("Error updating entity:",t);h.error("Error updating entity: "+t.message);return}this._oDialog.close();if(this._fnSuccessCallback){var a=e&&e.length>0?e[0]:i;this._fnSuccessCallback(a)}}).catch(e=>{this._oDialog.setBusy(false);console.error("Error in Supabase query:",e);h.error("Error updating entity: "+e.message)})}},_onCancelPress:function(){if(this._hasChanges()){h.confirm("Are you sure you want to discard your changes?",{title:"Discard Changes",onClose:function(e){if(e===h.Action.OK){this._oDialog.close()}}.bind(this)})}else{this._oDialog.close()}},_onAfterClose:function(){if(this._fnCancelCallback){this._fnCancelCallback()}},destroy:function(){if(this._oDialog){this._oDialog.destroy();this._oDialog=null}this._oFormControls={};this._oForm=null;this._fnSuccessCallback=null;this._fnCancelCallback=null}})});
//# sourceMappingURL=FormDialog.js.map