import frappe
from frappe.model.document import Document


class Proposal(Document):

    def before_save(self):
        self.calculate_totals()

    def on_submit(self):
        self.status = "Submitted"

    def calculate_totals(self):
        subtotal = 0.0
        for item in self.items:
            item.amount = (item.qty or 0) * (item.rate or 0)
            subtotal += item.amount

        self.subtotal        = subtotal
        discount             = subtotal * ((self.discount_percentage or 0) / 100)
        self.discount_amount = discount
        after_discount       = subtotal - discount
        tax                  = after_discount * ((self.tax_percentage or 0) / 100)
        self.tax_amount      = tax
        self.grand_total     = after_discount + tax

    @frappe.whitelist()
    def mark_accepted(self):
        self.status = "Accepted"
        self.save()
        frappe.msgprint("Proposal marked as Accepted.", alert=True)