sap.ui.define(["com/supabase/easyui5/controller/BaseController","sap/ui/model/json/JSONModel","sap/ui/model/Filter","sap/ui/model/FilterOperator","sap/m/MessageToast","sap/m/Button","sap/m/Text","sap/m/VBox","sap/m/HBox","sap/m/Title","sap/ui/core/Icon","sap/m/Panel","sap/ui/core/CustomData"],function(e,t,o,n,s,a,i,l,r,d,c,p,g){"use strict";return e.extend("com.supabase.easyui5.controller.Home",{onInit:function(){if(!this.getOwnerComponent().getModel("tables")){const e=new t({tables:[{id:"suppliers",title:"Suppliers",icon:"sap-icon://supplier",count:0},{id:"products",title:"Products",icon:"sap-icon://product",count:0},{id:"customers",title:"Customers",icon:"sap-icon://customer",count:0},{id:"orders",title:"Orders",icon:"sap-icon://sales-order",count:0},{id:"order_items",title:"Order Items",icon:"sap-icon://list",count:0}]});this.getOwnerComponent().setModel(e,"tables");console.log("Created fallback tables model")}const e=new t({selectedTab:"all",theme:"sap_horizon",compactDensity:true});this.getView().setModel(e,"settings");this.getView().byId("idIconTabBar").setSelectedKey("all");this._loadTableCounts();this._createCategoryCards()},onToggleNav:function(){try{const e=sap.ui.getCore().byId("content");let t=null;if(this.getOwnerComponent()&&this.getOwnerComponent().getSplitApp){t=this.getOwnerComponent().getSplitApp()}if(!t&&this.getOwnerComponent()&&this.getOwnerComponent().getRootControl){const e=this.getOwnerComponent().getRootControl();if(e){t=e.byId("app")}}if(!t){t=sap.ui.getCore().byId("__component0---app");if(!t){t=sap.ui.getCore().byId("__xmlview0--app")}}if(!t){const e=sap.ui.getCore().byFieldGroupId("").filter(function(e){return e instanceof sap.m.SplitApp});if(e.length>0){t=e[0]}}if(!t){console.error("SplitApp control not found!");return}const o=this.getOwnerComponent().getModel("appView");if(!o){console.error("AppView model not found!");return}const n=o.getProperty("/navExpanded");const s=this.getView().byId("navToggleButton");console.log("Home toggle nav button pressed. Current state:",n?"expanded":"collapsed");if(n){if(sap.ui.Device.system.phone){t.hideMaster()}else{const e=t.getMode();if(e!=="HideMode"&&e!=="ShowHideMode"){t.setMode("ShowHideMode")}t.hideMaster()}if(s){s.setIcon("sap-icon://menu2");s.setTooltip("Show Navigation")}o.setProperty("/navExpanded",false)}else{if(sap.ui.Device.system.phone){t.showMaster()}else{t.setMode("ShowHideMode");t.showMaster()}if(s){s.setIcon("sap-icon://navigation-left-arrow");s.setTooltip("Hide Navigation")}o.setProperty("/navExpanded",true)}}catch(e){console.error("Error in menu toggle:",e)}},_createCategoryCards:function(){const e=this.getView().byId("categoryGrid");const t=this.getOwnerComponent().getModel("tables");const o=t.getProperty("/tables");e.removeAllContent();o.forEach(t=>{const o=new p({expandable:false,expanded:true,backgroundDesign:"Solid"});o.addStyleClass("sapUiSmallMargin");o.addStyleClass("categoryCard");const n=new r;n.addStyleClass("sapUiSmallMargin");n.setAlignItems("Center");const s=new c({src:t.icon,size:"2rem",color:"#0854A0"});s.addStyleClass("sapUiSmallMarginEnd");n.addItem(s);const u=new d({text:t.title,level:"H3"});n.addItem(u);o.setHeaderText(t.title);const m=new l;m.addStyleClass("sapUiSmallMargin");const C=new i({text:"Manage your "+t.title+" data with full CRUD operations"});C.addStyleClass("sapUiTinyMarginBottom");m.addItem(C);const y=new i({text:"Search, filter, and edit records easily"});y.addStyleClass("sapUiTinyMarginBottom");m.addItem(y);if(t.count>0){const e=new i({text:"Total records: "+t.count});e.addStyleClass("sapUiTinyMarginTop");m.addItem(e)}const h=new r;h.addStyleClass("sapUiSmallMarginTop");h.setJustifyContent("End");h.setAlignItems("Center");const w=new a({text:"Open "+t.title,type:"Emphasized",press:this.onCategoryPress.bind(this)});w.addCustomData(new g({key:"table",value:t.id,writeToDom:true}));h.addItem(w);m.addItem(h);o.addContent(m);e.addContent(o)})},_loadTableCounts:function(){const e=setInterval(()=>{if(this.getSupabaseClient()){clearInterval(e);this._updateTableCounts()}},500);setTimeout(()=>{clearInterval(e)},1e4)},_updateTableCounts:function(){const e=this.getOwnerComponent().getModel("tables");const t=e.getProperty("/tables");t.forEach(o=>{this.getSupabaseClient().from(o.id).select("*",{count:"exact",head:true}).then(({count:n,error:s})=>{if(!s){const s=t.findIndex(e=>e.id===o.id);if(s!==-1){const t="/tables/"+s+"/count";e.setProperty(t,n||0)}}}).catch(e=>{console.error("Error getting count for table "+o.id,e)})});setTimeout(()=>{this._createCategoryCards()},1e3)},onCategoryPress:function(e){const t=e.getSource();let o="";const n=t.getCustomData();for(let e=0;e<n.length;e++){if(n[e].getKey()==="table"){o=n[e].getValue();break}}if(o){this.getRouter().navTo("entityList",{table:o})}else{s.show("Could not determine which table to open")}},onTabSelect:function(e){const t=e.getParameter("key");const o=this.getView().getModel("settings");o.setProperty("/selectedTab",t);if(t!=="all"){const e=this.getOwnerComponent().getModel("tables");const o=e.getProperty("/tables");const n=o.find(e=>e.id===t);if(n){s.show("Selected "+n.title+" category")}}},onSearch:function(e){const t=e.getParameter("query")||"";if(t.length>0){const e=this.getOwnerComponent().getModel("tables");const o=e.getProperty("/tables");const n=o.filter(e=>e.title.toLowerCase().includes(t.toLowerCase())||e.id.toLowerCase().includes(t.toLowerCase()));const u=this.getView().byId("categoryGrid");u.removeAllContent();n.forEach(e=>{const t=new p({expandable:false,expanded:true,backgroundDesign:"Solid"});t.addStyleClass("sapUiSmallMargin");t.addStyleClass("categoryCard");const o=new r;o.addStyleClass("sapUiSmallMargin");o.setAlignItems("Center");const n=new c({src:e.icon,size:"2rem",color:"#0854A0"});n.addStyleClass("sapUiSmallMarginEnd");o.addItem(n);const s=new d({text:e.title,level:"H3"});o.addItem(s);t.setHeaderText(e.title);const m=new l;m.addStyleClass("sapUiSmallMargin");const C=new i({text:"Manage your "+e.title+" data with full CRUD operations"});C.addStyleClass("sapUiTinyMarginBottom");m.addItem(C);const y=new i({text:"Search, filter, and edit records easily"});y.addStyleClass("sapUiTinyMarginBottom");m.addItem(y);if(e.count>0){const t=new i({text:"Total records: "+e.count});t.addStyleClass("sapUiTinyMarginTop");m.addItem(t)}const h=new r;h.addStyleClass("sapUiSmallMarginTop");h.setJustifyContent("End");h.setAlignItems("Center");const w=new a({text:"Open "+e.title,type:"Emphasized",press:this.onCategoryPress.bind(this)});w.addCustomData(new g({key:"table",value:e.id,writeToDom:true}));h.addItem(w);m.addItem(h);t.addContent(m);u.addContent(t)});if(n.length===0){s.show("No tables found matching: "+t)}else{s.show("Found "+n.length+" matching tables")}}else{this._createCategoryCards()}}})});
//# sourceMappingURL=Home.controller.js.map