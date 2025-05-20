// Copyright (c) 20201 Youssef Restom and contributors
// For license information, please see license.txt

frappe.ui.form.on('POS Profile', {
    setup: function (frm) {
        frm.set_query("posa_cash_mode_of_payment", function (doc) {
            return {
                filters: { 'type': 'Cash' }
            };
        });
        frm.set_query("custom_discount_account", function () {
            return {
                filters: {
                    company: frm.doc.company,
                    is_group: 0,
                    report_type: "Profit and Loss",
                },
            };
        })
    },
});