sap.ui.define(["sap/ui/test/opaQunit","./pages/Main"],function(e){"use strict";QUnit.module("Sample Hello Journey");e("Should open the Hello dialog",function(e,o,n){e.iStartMyUIComponent({componentConfig:{name:"com.supabase.easyui5"}});o.onTheMainPage.iPressTheSayHelloButton();n.onTheMainPage.iShouldSeeTheHelloDialog();o.onTheMainPage.iPressTheOkButtonInTheDialog();n.onTheMainPage.iShouldNotSeeTheHelloDialog();n.iTeardownMyApp()});e("Should close the Hello dialog",function(e,o,n){e.iStartMyUIComponent({componentConfig:{name:"com.supabase.easyui5"}});o.onTheMainPage.iPressTheSayHelloButton();o.onTheMainPage.iPressTheOkButtonInTheDialog();n.onTheMainPage.iShouldNotSeeTheHelloDialog();n.iTeardownMyApp()})});
//# sourceMappingURL=HelloJourney.js.map