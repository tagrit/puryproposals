frappe.ui.form.on("Proposal", {

    refresh(frm) {

        if (frm.doc.docstatus === 0) {
            frm.set_intro(__("Submit this proposal to enable sending and actions."), "yellow");
        }

        if (frm.doc.docstatus === 1) {

            // Mark Accepted
            if (frm.doc.status !== "Accepted") {
                frm.add_custom_button(__("Mark Accepted"), () => {
                    frappe.confirm("Mark this proposal as Accepted?", () => {
                        frm.call("mark_accepted").then(() => frm.reload_doc());
                    });
                }, __("Status"));
            }

            // Send Proposal
            frm.add_custom_button(__("Send Proposal"), () => {
                frm.events.send_proposal(frm);
            }, __("Actions"));

            // Convert to Quotation
            frm.add_custom_button(__("Convert to Quotation"), () => {
                convert_to_quotation(frm);
            }, __("Actions"));
        }
    },

    send_proposal(frm) {
        frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: "Contact",
                filters: [
                    ["Dynamic Link", "link_doctype", "=", "Customer"],
                    ["Dynamic Link", "link_name",    "=", frm.doc.customer]
                ],
                fields: ["name", "email_id"],
                limit: 1
            },
            callback(r) {
                let recipient = "";
                if (r.message && r.message.length > 0) {
                    recipient = r.message[0].email_id || "";
                }

                new frappe.views.CommunicationComposer({
                    doc: frm.doc,
                    frm: frm,
                    subject: `Proposal: ${frm.doc.proposal_title} [${frm.doc.name}]`,
                    recipients: recipient,
                    message: `<p>Dear ${frm.doc.customer},</p>
<p>Please find attached our proposal <strong>${frm.doc.name}</strong> – <em>${frm.doc.proposal_title}</em>.</p>
<p>Kindly review and revert at your earliest convenience.</p>
<p>This proposal is valid until <strong>${frm.doc.valid_till || "30 days from date of issue"}</strong>.</p>
<br>
<p>Regards,</p>
<p><strong>${frm.doc.company}</strong></p>`,
                    attach_document_print: true,
                    print_format: "Proposal Print Format",
                    cc: "",
                    bcc: ""
                });
            }
        });
    },

    customer(frm) {
        if (frm.doc.customer) {
            frappe.db.get_value("Customer", frm.doc.customer, "default_currency", (r) => {
                if (r && r.default_currency) frm.set_value("currency", r.default_currency);
            });
        }
    },

    discount_percentage(frm) { recalculate(frm); },
    tax_percentage(frm)      { recalculate(frm); },
});

frappe.ui.form.on("Proposal Item", {
    item_code(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        if (row.item_code) {
            frappe.db.get_value("Item", row.item_code,
                ["item_name", "description", "standard_rate"],
                (r) => {
                    if (r) {
                        frappe.model.set_value(cdt, cdn, "item_name",   r.item_name || "");
                        frappe.model.set_value(cdt, cdn, "description", r.description || "");
                        frappe.model.set_value(cdt, cdn, "rate",        r.standard_rate || 0);
                        recalculate(frm);
                    }
                }
            );
        }
    },
    qty(frm)          { recalculate(frm); },
    rate(frm)         { recalculate(frm); },
    items_remove(frm) { recalculate(frm); }
});

function recalculate(frm) {
    let subtotal = 0;
    (frm.doc.items || []).forEach(row => {
        const amount = (row.qty || 0) * (row.rate || 0);
        frappe.model.set_value(row.doctype, row.name, "amount", amount);
        subtotal += amount;
    });
    const disc  = subtotal * ((frm.doc.discount_percentage || 0) / 100);
    const after = subtotal - disc;
    const tax   = after   * ((frm.doc.tax_percentage || 0) / 100);
    frm.set_value("subtotal",        subtotal);
    frm.set_value("discount_amount", disc);
    frm.set_value("tax_amount",      tax);
    frm.set_value("grand_total",     after + tax);
}

function convert_to_quotation(frm) {
    frappe.confirm(__("Convert this Proposal to a Quotation?"), () => {
        frappe.new_doc("Quotation", {
            party_name: frm.doc.customer,
            valid_till: frm.doc.valid_till,
            items: (frm.doc.items || []).map(i => ({
                item_code:   i.item_code,
                item_name:   i.item_name,
                description: i.description,
                qty:         i.qty,
                rate:        i.rate,
                uom:         i.uom
            }))
        });
    });
}