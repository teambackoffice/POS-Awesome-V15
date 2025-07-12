# -*- coding: utf-8 -*-
from __future__ import unicode_literals

__version__ = "15.2.2"

try:
    import frappe
    
    def console(*data):
        frappe.publish_realtime("toconsole", data, user=frappe.session.user)
except ImportError:
    # frappe not available during build/installation
    def console(*data):
        pass
