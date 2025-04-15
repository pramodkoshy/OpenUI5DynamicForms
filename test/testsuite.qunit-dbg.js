sap.ui.define(function () {
	"use strict";

	return {
		name: "QUnit test suite for the UI5 Application: com.supabase.easyui5",
		defaults: {
			page: "ui5://test-resources/com/supabase/easyui5/Test.qunit.html?testsuite={suite}&test={name}",
			qunit: {
				version: 2
			},
			sinon: {
				version: 1
			},
			ui5: {
				language: "EN",
				theme: "sap_horizon"
			},
			coverage: {
				only: "com/supabase/easyui5/",
				never: "test-resources/com/supabase/easyui5/"
			},
			loader: {
				paths: {
					"com/supabase/easyui5": "../"
				}
			}
		},
		tests: {
			"unit/unitTests": {
				title: "Unit tests for com.supabase.easyui5"
			},
			"integration/opaTests": {
				title: "Integration tests for com.supabase.easyui5"
			}
		}
	};
});
