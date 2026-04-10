/**
 * McKay Bay Lodge — Room Charges
 * Handles adding/viewing/deleting extra charges on a reservation
 */

const Charges = (() => {

  // Tax profiles
  const TAX_PROFILES = {
    gas:         { label: "GST 5%",                    rate: 0.05  },
    tackle:      { label: "GST 5% + PST 7%",           rate: 0.12  },
    wine_beer:   { label: "GST 5% + PST 10% (liquor)", rate: 0.15  },
    vac_bags:    { label: "GST 5% + PST 7%",           rate: 0.12  },
    merchandise: { label: "GST 5% + PST 7%",           rate: 0.12  },
    meals:       { label: "GST 5% + Hotel Tax 4.8%",   rate: 0.098 },
    charter:     { label: "GST 5%",                    rate: 0.05  },
    misc:        { label: "GST 5%",                    rate: 0.05  },
  };

  // Quick-add product buttons
  const QUICK_PRODUCTS = [
    { label: "⛽ Gas",          category: "gas",         price: null  },
    { label: "🎣 Tackle",       category: "tackle",      price: null  },
    { label: "🍷 Wine/Beer",    category: "wine_beer",   price: null  },
    { label: "🧊 Vac Pack Bags",category: "vac_bags",    price: 3.00  },
    { label: "👕 Merchandise",  category: "merchandise", price: null  },
    { label: "🍽 Meals",        category: "meals",       price: null  },
    { label: "🚤 Charter",      category: "charter",     price: null  },
    { label: "📦 Misc",         category: "misc",        price: null  },
  ];

  let charges = [];
  let currentResId = null;

  async function load(resId) {
    currentResId = resId;
    try {
      const resp = await fetch(`/api/charges?reservation_id=${resId}`);
      const data = await resp.json();
      charges = Array.isArray(data) ? data : [];
    } catch(e) {
      charges = [];
    }
  }

  async function addCharge(category, description, qty, unitPrice) {
    const tax    = TAX_PROFILES[category] || TAX_PROFILES.misc;
    const sub    = qty * unitPrice;
    const taxAmt = sub * tax.rate;
    try {
      const resp = await fetch("/api/charges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservation_id: currentResId,
          category, description, qty,
          unit_price: unitPrice,
          tax_rate: tax.rate,
          tax_label: tax.label,
          subtotal: sub,
          tax_amount: taxAmt,
          total: sub + taxAmt,
        })
      });
      const charge = await resp.json();
      charges.push(charge);
      return charge;
    } catch(e) {
      console.error("Failed to add charge:", e);
    }
  }

  async function deleteCharge(chargeId) {
    try {
      await fetch(`/api/charges/${chargeId}`, { method: "DELETE" });
      charges = charges.filter(c => c.id !== chargeId);
    } catch(e) {
      console.error("Failed to delete charge:", e);
    }
  }

  function totalCharges() {
    return charges.reduce((s, c) => s + parseFloat(c.total || 0), 0);
  }

  function renderChargesSection(resId) {
    const subtotal = charges.reduce((s,c) => s + (c.subtotal||0), 0);
    const taxTotal = charges.reduce((s,c) => s + (c.tax_amount||0), 0);
    const total    = subtotal + taxTotal;

    return `
    <div id="charges-section" style="margin-top:20px;padding-top:16px;border-top:2px solid #e5e7eb;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <h3 style="font-size:14px;font-weight:700;color:#1a535c;margin:0;">🛒 Room Charges</h3>
        <button onclick="Charges.showAddCharge(${resId})"
          style="background:#1a535c;color:white;border:none;border-radius:6px;
                 padding:5px 12px;font-size:12px;font-weight:600;cursor:pointer;">
          + Add Charge
        </button>
      </div>

      <!-- Quick add buttons -->
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">
        ${QUICK_PRODUCTS.map(p => `
          <button onclick="Charges.quickAdd(${resId},'${p.category}','${p.label.replace(/'/g,"\\'")}',${p.price||'null'})"
            style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;
                   padding:4px 10px;font-size:12px;cursor:pointer;white-space:nowrap;"
            onmouseover="this.style.background='#e2e8f0'"
            onmouseout="this.style.background='#f1f5f9'">
            ${p.label}
          </button>`).join("")}
      </div>

      <!-- Charges list -->
      <div id="charges-list-${resId}">
        ${renderChargesList(resId)}
      </div>

      <!-- Charges total -->
      ${charges.length > 0 ? `
      <div style="background:#f8fafc;border-radius:8px;padding:10px 12px;margin-top:8px;font-size:13px;">
        <div style="display:flex;justify-content:space-between;color:#6b7280;">
          <span>Charges subtotal</span><span>$${subtotal.toFixed(2)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;color:#6b7280;">
          <span>Taxes on charges</span><span>$${taxTotal.toFixed(2)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-weight:700;color:#1a535c;
                    border-top:1px solid #e2e8f0;margin-top:6px;padding-top:6px;">
          <span>Room charges total</span><span>$${total.toFixed(2)}</span>
        </div>
      </div>` : `<p style="font-size:13px;color:#9ca3af;">No charges added yet.</p>`}
    </div>`;
  }

  function renderChargesList(resId) {
    if (!charges.length) return "";
    return `<table style="width:100%;font-size:12px;border-collapse:collapse;">
      <thead>
        <tr style="background:#f1f5f9;color:#6b7280;font-size:11px;text-transform:uppercase;">
          <th style="text-align:left;padding:5px 8px;border-radius:4px 0 0 4px;">Item</th>
          <th style="text-align:center;padding:5px 4px;">Qty</th>
          <th style="text-align:right;padding:5px 4px;">Unit</th>
          <th style="text-align:right;padding:5px 4px;">Sub</th>
          <th style="text-align:right;padding:5px 4px;">Tax</th>
          <th style="text-align:right;padding:5px 8px;">Total</th>
          <th style="padding:5px 4px;"></th>
        </tr>
      </thead>
      <tbody>
        ${charges.map(c => {
          const desc     = c.description || c.item || "—";
          const qty      = parseFloat(c.qty || c.quantity || 1);
          const unit     = parseFloat(c.unit_price || c.price || 0);
          const sub      = parseFloat(c.subtotal || (qty * unit) || 0);
          const taxAmt   = parseFloat(c.tax_amount || c.tax || 0);
          const total    = parseFloat(c.total || (sub + taxAmt) || 0);
          const taxLabel = c.tax_label || c.tax_desc || "";
          return `
        <tr style="border-bottom:1px solid #f3f4f6;">
          <td style="padding:6px 8px;">
            <div style="font-weight:600;">${desc}</div>
            <div style="color:#9ca3af;font-size:10px;">${taxLabel}</div>
          </td>
          <td style="text-align:center;padding:6px 4px;">${qty}</td>
          <td style="text-align:right;padding:6px 4px;">$${unit.toFixed(2)}</td>
          <td style="text-align:right;padding:6px 4px;">$${sub.toFixed(2)}</td>
          <td style="text-align:right;padding:6px 4px;color:#6b7280;">$${taxAmt.toFixed(2)}</td>
          <td style="text-align:right;padding:6px 8px;font-weight:700;color:#1a535c;">$${total.toFixed(2)}</td>
          <td style="padding:6px 4px;">
            <button onclick="Charges.deleteAndRefresh(${c.id},${resId})"
              style="color:#d1d5db;border:none;background:none;cursor:pointer;font-size:15px;padding:0;"
              onmouseover="this.style.color='#ef4444'"
              onmouseout="this.style.color='#d1d5db'">×</button>
          </td>
        </tr>`;}).join("")}
      </tbody>
    </table>`;
  }

  function showAddCharge(resId) {
    const overlay = document.createElement("div");
    overlay.id = "charge-overlay";
    overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.5);
      z-index:9999;display:flex;align-items:center;justify-content:center;`;
    overlay.innerHTML = `
      <div style="background:white;border-radius:12px;padding:24px;width:360px;
                  box-shadow:0 20px 60px rgba(0,0,0,0.3);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h3 style="margin:0;font-size:16px;font-weight:700;">Add Room Charge</h3>
          <button onclick="document.getElementById('charge-overlay').remove()"
            style="border:none;background:none;font-size:22px;cursor:pointer;color:#9ca3af;">&times;</button>
        </div>
        <div style="margin-bottom:12px;">
          <label style="font-size:12px;font-weight:600;color:#6b7280;display:block;margin-bottom:4px;">Category</label>
          <select id="charge-category" onchange="Charges.updateTaxPreview()"
            style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;">
            ${Object.entries(TAX_PROFILES).map(([k,v]) =>
              `<option value="${k}">${k.replace("_"," ").replace(/\b\w/g,l=>l.toUpperCase())} — ${v.label}</option>`
            ).join("")}
          </select>
        </div>
        <div style="margin-bottom:12px;">
          <label style="font-size:12px;font-weight:600;color:#6b7280;display:block;margin-bottom:4px;">Description</label>
          <input id="charge-desc" placeholder="e.g. Gas — 45L, Shiraz bottle, Rapala lure"
            style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;box-sizing:border-box;" />
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
          <div>
            <label style="font-size:12px;font-weight:600;color:#6b7280;display:block;margin-bottom:4px;">Qty</label>
            <input id="charge-qty" type="number" min="1" value="1"
              oninput="Charges.updateTaxPreview()"
              style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;box-sizing:border-box;" />
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;color:#6b7280;display:block;margin-bottom:4px;">Unit Price ($)</label>
            <input id="charge-price" type="number" min="0" step="0.01" placeholder="0.00"
              oninput="Charges.updateTaxPreview()"
              style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;box-sizing:border-box;" />
          </div>
        </div>
        <div id="charge-tax-preview" style="background:#f8fafc;border-radius:6px;padding:8px 12px;
             font-size:12px;color:#6b7280;margin-bottom:16px;">
          Enter qty and price to see total
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button onclick="document.getElementById('charge-overlay').remove()"
            style="padding:8px 16px;border:1px solid #d1d5db;border-radius:6px;
                   background:white;cursor:pointer;font-size:14px;">Cancel</button>
          <button onclick="Charges.confirmAdd(${resId})"
            style="padding:8px 16px;background:#1a535c;color:white;border:none;
                   border-radius:6px;cursor:pointer;font-size:14px;font-weight:600;">Add Charge</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  }

  function updateTaxPreview() {
    const cat   = document.getElementById("charge-category")?.value;
    const qty   = parseFloat(document.getElementById("charge-qty")?.value) || 0;
    const price = parseFloat(document.getElementById("charge-price")?.value) || 0;
    const el    = document.getElementById("charge-tax-preview");
    if (!el) return;
    if (!qty || !price) { el.textContent = "Enter qty and price to see total"; return; }
    const tax    = TAX_PROFILES[cat] || TAX_PROFILES.misc;
    const sub    = qty * price;
    const taxAmt = sub * tax.rate;
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;">
        <span>Subtotal</span><span>$${sub.toFixed(2)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;">
        <span>${tax.label}</span><span>$${taxAmt.toFixed(2)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-weight:700;color:#1a535c;
                  border-top:1px solid #e2e8f0;margin-top:4px;padding-top:4px;">
        <span>Total</span><span>$${(sub+taxAmt).toFixed(2)}</span>
      </div>`;
  }

  async function confirmAdd(resId) {
    const cat   = document.getElementById("charge-category")?.value;
    const desc  = document.getElementById("charge-desc")?.value.trim();
    const qty   = parseFloat(document.getElementById("charge-qty")?.value) || 1;
    const price = parseFloat(document.getElementById("charge-price")?.value);
    if (!desc)  { alert("Please enter a description."); return; }
    if (!price) { alert("Please enter a price."); return; }
    await addCharge(cat, desc, qty, price);
    document.getElementById("charge-overlay")?.remove();
    refreshChargesUI(resId);
  }

  async function quickAdd(resId, category, label, defaultPrice) {
    const desc  = prompt(`${label}\nDescription (e.g. "45L regular", "Shiraz bottle"):`, label.replace(/^[^ ]+ /, ""));
    if (desc === null) return;
    const priceStr = prompt(`Unit price ($):`, defaultPrice != null ? defaultPrice.toFixed(2) : "");
    if (priceStr === null) return;
    const price = parseFloat(priceStr);
    if (isNaN(price) || price <= 0) { alert("Invalid price."); return; }
    const qtyStr = prompt("Quantity:", "1");
    if (qtyStr === null) return;
    const qty = parseInt(qtyStr) || 1;
    await addCharge(category, desc || label, qty, price);
    refreshChargesUI(resId);
  }

  async function deleteAndRefresh(chargeId, resId) {
    if (!confirm("Remove this charge?")) return;
    await deleteCharge(chargeId);
    refreshChargesUI(resId);
  }

  async function refreshChargesUI(resId) {
    await load(resId);
    const section = document.getElementById("charges-section");
    if (section) section.outerHTML = renderChargesSection(resId);
  }

  return {
    load, addCharge, deleteCharge, totalCharges,
    renderChargesSection, showAddCharge, updateTaxPreview,
    confirmAdd, quickAdd, deleteAndRefresh,
  };
})();
