import { useState, useEffect, createContext, useContext, useCallback, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts";
import { Package, Scale, CreditCard, LayoutDashboard, Plus, Search, Trash2, Edit3, Download, ChevronRight, TrendingUp, TrendingDown, AlertCircle, CheckCircle, Clock, X, ChevronDown, LogOut, Eye, EyeOff, User, Shield, Truck } from "lucide-react";

// ─── PDF GENERATOR ───────────────────────────────────────────────────────────
// Dynamically loads jsPDF from CDN and generates a branded invoice PDF
async function generateInvoicePDF(txn) {
  // Load jsPDF from CDN if not already loaded
  if (!window.jspdf) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  const { jsPDF } = window.jspdf;

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const PW = 210, PH = 297;

  // Colours
  const AMBER   = [245, 166,  35];
  const DARK    = [ 13,  14,  15];
  const CHAR    = [ 50,  55,  60];
  const MID     = [100, 110, 120];
  const MUTED   = [160, 165, 172];
  const BORDER  = [220, 222, 226];
  const WHITE   = [255, 255, 255];
  const AMB_LT  = [254, 243, 219];
  const GREY_BG = [248, 249, 250];

  const sf  = (c) => doc.setFillColor(...c);
  const sd  = (c) => doc.setDrawColor(...c);
  const st  = (c) => doc.setTextColor(...c);
  const fn  = (sz, style='normal') => { doc.setFont('helvetica', style); doc.setFontSize(sz); };
  const rta = (txt, x, y) => doc.text(txt, x - doc.getTextWidth(txt), y);
  const inr = (n) => '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  // ── HEADER BAND ────────────────────────────────────────────────────────────
  sf(AMBER); doc.rect(0, 0, PW, 38, 'F');
  fn(22, 'bold'); st(WHITE); doc.text('THE SCRAP CO.', 20, 15);
  fn(8); st([255,230,170]);
  doc.text('The Scrap Co. Pvt. Ltd', 20, 21);
  doc.text('GSTIN: 27AABCS1234D1Z5  |  support@thescrapco.in', 20, 26);
  doc.text('Plot 14, MIDC Industrial Area, Pune, Maharashtra - 411018', 20, 31);
  fn(26, 'bold'); st(WHITE); rta('INVOICE', PW-20, 17);
  fn(9); st([255,230,170]);
  rta(txn.invoiceId || txn.id, PW-20, 25);
  rta('TXN: ' + txn.id, PW-20, 31);

  // ── META ROW ───────────────────────────────────────────────────────────────
  sf(AMB_LT); sd(AMB_LT);
  doc.roundedRect(20, 44, 170, 22, 3, 3, 'FD');
  const metaFields = [
    { label: 'INVOICE DATE',  value: txn.date },
    { label: 'DUE DATE',      value: txn.date },
    { label: 'STATUS',        value: (txn.status || 'pending').toUpperCase() },
    { label: 'TRANSACTION',   value: txn.id },
  ];
  const statusColors = { PAID: [22,163,74], PENDING: [180,83,9], OVERDUE: [185,28,28] };
  metaFields.forEach((f, i) => {
    const fx = 25 + i * 43;
    fn(7); st(MUTED); doc.text(f.label, fx, 52);
    fn(9, 'bold');
    st(i === 2 ? (statusColors[f.value] || CHAR) : CHAR);
    doc.text(f.value, fx, 60);
  });

  // ── BILL TO ────────────────────────────────────────────────────────────────
  sf(GREY_BG); sd(BORDER); doc.setLineWidth(0.2);
  doc.roundedRect(20, 75, 80, 30, 2, 2, 'FD');
  fn(7, 'bold'); st(AMBER); doc.text('BILL TO', 25, 82);
  fn(11, 'bold'); st(DARK); doc.text((txn.supplier || txn.supplierName || 'Supplier').slice(0,28), 25, 90);
  fn(8); st(MID);
  if (txn.supplierPhone) doc.text('Ph: ' + txn.supplierPhone, 25, 96);
  if (txn.supplierEmail) doc.text(txn.supplierEmail, 25, 102);

  // ── PAYMENT BOX ────────────────────────────────────────────────────────────
  sf(GREY_BG); sd(BORDER);
  doc.roundedRect(108, 75, 82, 30, 2, 2, 'FD');
  fn(7, 'bold'); st(AMBER); doc.text('PAYMENT DETAILS', 113, 82);
  const prows = [
    ['Method', txn.paymentMethod || 'Cash / UPI'],
    ['Bank',   'HDFC Bank — HDFC0001234'],
    ['UPI ID', 'scrapco@hdfcbank'],
  ];
  prows.forEach(([lbl, val], i) => {
    fn(7); st(MUTED); doc.text(lbl, 113, 89 + i*7);
    st(CHAR); rta(val, 188, 89 + i*7);
  });

  // ── TABLE HEADER ───────────────────────────────────────────────────────────
  const tY = 117;
  sf(DARK); doc.rect(20, tY, 170, 10, 'F');
  fn(7.5, 'bold'); st(WHITE);
  doc.text('#', 25, tY+7);
  doc.text('DESCRIPTION', 33, tY+7);
  doc.text('MATERIAL', 100, tY+7);
  rta('QTY', 148, tY+7);
  rta('UNIT PRICE', 170, tY+7);
  rta('AMOUNT', 188, tY+7);

  // ── TABLE ROW ──────────────────────────────────────────────────────────────
  const rY = tY + 10;
  sf(WHITE); sd(BORDER); doc.rect(20, rY, 170, 14, 'FD');
  const matName = txn.material || txn.materialName || 'Scrap Material';
  const weight  = Number(txn.weight || 0);
  const unit    = txn.unit || 'kg';
  const ppu     = Number(txn.pricePerUnit || 0);
  const sub     = Number(txn.total || weight * ppu);

  fn(8.5); st(CHAR);
  doc.text('1', 25, rY+9);
  doc.text((matName + ' Scrap — Supplier Purchase').slice(0,40), 33, rY+9);
  fn(8.5, 'bold'); doc.text(matName, 100, rY+9);
  fn(8.5); rta(weight.toLocaleString('en-IN') + ' ' + unit, 148, rY+9);
  rta(inr(ppu), 170, rY+9);
  fn(8.5, 'bold'); rta(inr(sub), 188, rY+9);

  // ── TOTALS BLOCK ───────────────────────────────────────────────────────────
  const gstRate   = Number(txn.gstRate || 0);
  const gstAmt    = Number(txn.gstAmount || (sub * gstRate / 100));
  const total     = sub + gstAmt;
  const totY      = rY + 24;

  sf(GREY_BG); sd(BORDER);
  doc.roundedRect(108, totY, 82, 40, 2, 2, 'FD');

  fn(8.5); st(MID); doc.text('Subtotal', 113, totY+10);
  st(CHAR); rta(inr(sub), 188, totY+10);
  sd(BORDER); doc.setLineWidth(0.2); doc.line(113, totY+14, 188, totY+14);
  fn(8.5); st(MID); doc.text('GST (' + gstRate + '%)', 113, totY+21);
  st(CHAR); rta(inr(gstAmt), 188, totY+21);
  doc.line(113, totY+25, 188, totY+25);

  // Total due highlight
  sf(AMBER); doc.roundedRect(108, totY+27, 82, 13, 2, 2, 'F');
  fn(11, 'bold'); st(WHITE);
  doc.text('TOTAL DUE', 113, totY+36);
  rta(inr(total), 188, totY+36);

  // Amount in words
  fn(7.5); st(MUTED); doc.text('Amount in words:', 20, totY+12);
  fn(7.5, 'bold'); st(CHAR);
  const words = numToWords(Math.round(total));
  doc.text(words + ' Rupees Only', 20, totY+19);

  // ── TERMS ──────────────────────────────────────────────────────────────────
  const termY = totY + 52;
  sd(BORDER); doc.setLineWidth(0.3); doc.line(20, termY, 190, termY);
  fn(7, 'bold'); st(AMBER); doc.text('TERMS & CONDITIONS', 20, termY+7);
  fn(7); st(MID);
  ['1. Payment due within 7 days of invoice date.',
   '2. All scrap purchased as-is. No returns after weighing.',
   '3. Computer generated invoice — no signature required.',
   '4. Disputes: accounts@thescrapco.in within 24 hrs.']
  .forEach((l, i) => doc.text(l, 20, termY+14+i*5));

  if (txn.notes) {
    fn(7, 'bold'); st(CHAR); doc.text('Notes:', 20, termY+38);
    fn(7); st(MID); doc.text(txn.notes, 20, termY+44);
  }

  // ── FOOTER ─────────────────────────────────────────────────────────────────
  sf(DARK); doc.rect(0, PH-18, PW, 18, 'F');
  fn(7.5, 'bold'); st(AMBER); doc.text('THE SCRAP CO.', 20, PH-9);
  fn(7); st([140,145,150]);
  doc.text('Plot 14, MIDC Industrial Area, Pune  |  +91 98765 43210  |  support@thescrapco.in', 57, PH-9);
  rta('Page 1 of 1', PW-20, PH-9);

  // ── WATERMARK ──────────────────────────────────────────────────────────────
  if (txn.status === 'paid') {
    doc.setGState(doc.GState ? new doc.GState({opacity:0.07}) : {});
    fn(60, 'bold'); st([34,197,94]);
    doc.text('PAID', PW/2, PH/2, { align:'center', angle:45 });
  }
  if (txn.status === 'overdue') {
    fn(50, 'bold'); st([239,68,68]);
    doc.text('OVERDUE', PW/2, PH/2, { align:'center', angle:45 });
  }

  doc.save('Invoice_' + (txn.invoiceId || txn.id) + '_' + txn.date + '.pdf');
}

function numToWords(num) {
  if (num === 0) return 'Zero';
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  function convert(n) {
    if (n<20) return ones[n];
    if (n<100) return tens[Math.floor(n/10)] + (n%10?' '+ones[n%10]:'');
    return ones[Math.floor(n/100)]+' Hundred'+(n%100?' '+convert(n%100):'');
  }
  let r='';
  if(num>=10000000){r+=convert(Math.floor(num/10000000))+' Crore '; num%=10000000;}
  if(num>=100000){r+=convert(Math.floor(num/100000))+' Lakh '; num%=100000;}
  if(num>=1000){r+=convert(Math.floor(num/1000))+' Thousand '; num%=1000;}
  if(num>0)r+=convert(num);
  return r.trim();
}

const normReceipt = (r) => ({
  id:            r.id,
  receiptNumber: r.receipt_number,
  customerId:    r.customer_id   || null,
  customerName:  r.customer_name || "Walk-in Customer",
  customerPhone: r.customer_phone|| "",
  materialId:    r.material_id   || null,
  materialName:  r.material_name || "",
  weight:        parseFloat(r.weight)         || 0,
  unit:          r.unit          || "kg",
  pricePerUnit:  parseFloat(r.price_per_unit) || 0,
  total:         parseFloat(r.total_amount)   || 0,
  paymentMethod: r.payment_method|| "cash",
  notes:         r.notes         || "",
  created_at:    r.created_at,
  date:          r.created_at
    ? new Date(r.created_at).toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0],
});
// Receipt given to household customer when WE buy scrap from THEM
async function generateReceiptPDF(receipt) {
  if (!window.jspdf) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      script.onload = resolve; script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'portrait' });
  const PW = 148, PH = 210;

  const AMBER = [245,166,35]; const DARK = [13,14,15]; const WHITE = [255,255,255];
  const GREY  = [248,249,250]; const MID  = [100,110,120]; const BORDER = [220,222,226];
  const GREEN = [22,163,74];

  const sf = c => doc.setFillColor(...c);
  const st = c => doc.setTextColor(...c);
  const sd = c => doc.setDrawColor(...c);
  const fn = (sz, style='normal') => { doc.setFont('helvetica', style); doc.setFontSize(sz); };
  const inr = n => '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 });
  const rta = (txt, x, y) => doc.text(txt, x - doc.getTextWidth(txt), y);

  // Header
  sf(AMBER); doc.rect(0, 0, PW, 28, 'F');
  fn(16, 'bold'); st(WHITE); doc.text('THE SCRAP CO.', 12, 11);
  fn(7); st([255,230,170]);
  doc.text('Plot 14, MIDC Industrial Area, Pune — +91 98765 43210', 12, 17);
  fn(9, 'bold'); st(WHITE); rta('PAYMENT RECEIPT', PW - 10, 11);
  fn(8); st([255,230,170]); rta(receipt.receipt_number, PW - 10, 18);

  // Date + Payment method badge
  fn(8); st(MID);
  doc.text('Date: ' + new Date(receipt.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }), 12, 36);
  const pm = (receipt.payment_method || 'cash').toUpperCase();
  sf(GREY); sd(BORDER); doc.setLineWidth(0.2);
  doc.roundedRect(PW - 42, 30, 32, 9, 2, 2, 'FD');
  fn(7, 'bold'); st(DARK); rta(pm, PW - 11, 36);

  // Paid to box
  sf(GREY); sd(BORDER);
  doc.roundedRect(12, 42, PW - 24, 22, 2, 2, 'FD');
  fn(7, 'bold'); st([180,83,9]); doc.text('PAID TO', 17, 49);
  fn(11, 'bold'); st(DARK);
  doc.text(receipt.customer_name || 'Walk-in Customer', 17, 57);
  if (receipt.customer_phone) { fn(8); st(MID); doc.text('Ph: ' + receipt.customer_phone, 17, 63); }

  // Items table
  const ty = 72;
  sf(DARK); doc.rect(12, ty, PW - 24, 8, 'F');
  fn(7, 'bold'); st(AMBER);
  doc.text('Material', 16, ty + 5.5);
  doc.text('Weight', 72, ty + 5.5);
  rta('Rate/kg', PW - 36, ty + 5.5);
  rta('Amount', PW - 12, ty + 5.5);

  sf(GREY); sd(BORDER);
  doc.rect(12, ty + 8, PW - 24, 12, 'FD');
  fn(9, 'bold'); st(DARK);
  doc.text(receipt.material_name || '—', 16, ty + 16);
  fn(9); st(MID);
  doc.text(parseFloat(receipt.weight).toLocaleString() + ' ' + (receipt.unit || 'kg'), 72, ty + 16);
  rta(inr(receipt.price_per_unit), PW - 36, ty + 16);
  fn(10, 'bold'); st(DARK);
  rta(inr(receipt.total_amount), PW - 12, ty + 16);

  // Total box
  sf(AMBER); doc.roundedRect(PW - 70, ty + 26, 58, 16, 2, 2, 'F');
  fn(8); st(WHITE); doc.text('TOTAL PAID TO YOU', PW - 68, ty + 33);
  fn(14, 'bold'); rta(inr(receipt.total_amount), PW - 12, ty + 40);

  // PAID stamp
  fn(28, 'bold'); st([...GREEN, 0.06]);
  doc.text('PAID', PW / 2 - 8, ty + 38);

  if (receipt.notes) {
    fn(7); st(MID);
    doc.text('Note: ' + receipt.notes, 12, ty + 62);
  }

  // Footer
  sf(DARK); doc.rect(0, PH - 14, PW, 14, 'F');
  fn(7, 'bold'); st(AMBER); doc.text('THE SCRAP CO.', 12, PH - 6);
  fn(6.5); st([140,145,150]);
  doc.text('support@thescrapco.in  |  GSTIN: 27AABCS1234D1Z5', 50, PH - 6);

  doc.save('Receipt_' + receipt.receipt_number + '.pdf');
}

// ─── API SERVICE LAYER ────────────────────────────────────────────────────────
// Change this to your backend URL when deployed
const API_BASE = "https://scrapco-backend-production.up.railway.app/api";

const api = {
  // Auth
  login: (email, password) =>
    fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }).then(r => r.json()),

  me: (token) =>
    fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json()),

  // Materials
  getMaterials: (token) =>
    fetch(`${API_BASE}/materials`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json()),

  createMaterial: (data, token) =>
    fetch(`${API_BASE}/materials`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }).then(r => r.json()),

  updateMaterial: (id, data, token) =>
    fetch(`${API_BASE}/materials/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }).then(r => r.json()),

  deleteMaterial: (id, token) =>
    fetch(`${API_BASE}/materials/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json()),

  // Transactions
  getTransactions: (token, params = {}) => {
    const q = new URLSearchParams(params).toString();
    return fetch(`${API_BASE}/transactions?${q}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json());
  },

  createTransaction: (data, token) =>
    fetch(`${API_BASE}/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }).then(r => r.json()),

  deleteTransaction: (id, token) =>
    fetch(`${API_BASE}/transactions/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json()),

  // Customers (household — we BUY from them)
  getCustomers: (token, params = {}) => {
    const q = new URLSearchParams(params).toString();
    return fetch(`${API_BASE}/customers?${q}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json());
  },

  createCustomer: (data, token) =>
    fetch(`${API_BASE}/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }).then(r => r.json()),

  updateCustomer: (id, data, token) =>
    fetch(`${API_BASE}/customers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }).then(r => r.json()),

  deleteCustomer: (id, token) =>
    fetch(`${API_BASE}/customers/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json()),

  // Purchase Receipts (buying from households)
  getPurchaseReceipts: (token, params = {}) => {
    const q = new URLSearchParams(params).toString();
    return fetch(`${API_BASE}/purchase-receipts?${q}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json());
  },

  createPurchaseReceipt: (data, token) =>
    fetch(`${API_BASE}/purchase-receipts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }).then(r => r.json()),

  deletePurchaseReceipt: (id, token) =>
    fetch(`${API_BASE}/purchase-receipts/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json()),

  // Invoices
  getInvoices: (token, params = {}) => {
    const q = new URLSearchParams(params).toString();
    return fetch(`${API_BASE}/invoices?${q}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json());
  },

  payInvoice: (id, payment_method, token) =>
    fetch(`${API_BASE}/invoices/${id}/pay`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ payment_method }),
    }).then(r => r.json()),

  // Dashboard
  getDashboard: (token) =>
    fetch(`${API_BASE}/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json()),

  // Suppliers
  getSuppliers: (token) =>
    fetch(`${API_BASE}/suppliers`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json()),

  // Users (admin)
  getUsers: (token) =>
    fetch(`${API_BASE}/auth/users`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json()),

  registerUser: (data, token) =>
    fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }).then(r => r.json()),

  createSupplier: (data, token) =>
    fetch(`${API_BASE}/suppliers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }).then(r => r.json()),

  updateSupplier: (id, data, token) =>
    fetch(`${API_BASE}/suppliers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }).then(r => r.json()),

  deleteSupplier: (id, token) =>
    fetch(`${API_BASE}/suppliers/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json()),

  sendWhatsApp: (transactionId, token) =>
    fetch(`${API_BASE}/whatsapp/send/${transactionId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json()),

  getWhatsAppLogs: (token) =>
    fetch(`${API_BASE}/whatsapp/logs`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json()),
};

// ─── DATA NORMALIZERS ─────────────────────────────────────────────────────────
// Convert backend snake_case shapes → frontend camelCase shapes used by components

const normMaterial = (m) => ({
  id:        m.id,
  name:      m.name,
  category:  m.category  || "Non-Ferrous",
  unit:      m.unit      || "kg",
  basePrice: parseFloat(m.buy_price)     || 0,
  sellPrice: parseFloat(m.sell_price)    || 0,
  stock:     parseFloat(m.stock_qty)     || 0,
  threshold: parseFloat(m.min_threshold) || 0,
  color:     m.color_hex || "#f5a623",
  isLowStock: !!m.is_low_stock,
});

const normTransaction = (t) => ({
  id:           t.txn_number  || t.id,
  _uuid:        t.id,                          // real UUID for API calls
  _invoiceUuid: t.invoice_id  || null,         // invoice UUID for payInvoice
  date:         t.created_at
    ? new Date(t.created_at).toISOString().split("T")[0]
    : t.date || new Date().toISOString().split("T")[0],
  supplier:     t.supplier_name || t.supplier || "",
  supplierId:   t.supplier_id  || null,
  supplierPhone:t.supplier_phone || "",
  supplierEmail:t.supplier_email || "",
  material:     t.material_name || t.material || "",
  materialId:   t.material_id  || null,
  weight:       parseFloat(t.weight)         || 0,
  unit:         t.unit         || "kg",
  pricePerUnit: parseFloat(t.price_per_unit) || 0,
  total:        parseFloat(t.total_amount || t.total) || 0,
  status:       t.invoice_status || t.status || "pending",
  invoiceId:    t.invoice_number || t.invoiceId || "",
  notes:        t.notes || "",
});

// ─── AUTH CONTEXT ─────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

function useAuth() {
  return useContext(AuthContext);
}

function AuthProvider({ children }) {
  const [user, setUser]   = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("scrapco_token"));
  const [loading, setLoading] = useState(true);

  // Verify token on mount
  useEffect(() => {
    const storedToken = localStorage.getItem("scrapco_token");
    if (!storedToken) { setLoading(false); return; }
    api.me(storedToken)
      .then(res => {
        if (res.success) {
          setUser(res.user);
          setToken(storedToken);
        } else {
          localStorage.removeItem("scrapco_token");
          setToken(null);
        }
      })
      .catch(() => {
        localStorage.removeItem("scrapco_token");
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await api.login(email, password);
    if (res.success) {
      localStorage.setItem("scrapco_token", res.token);
      setToken(res.token);
      setUser(res.user);
    }
    return res;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("scrapco_token");
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading, isAdmin: user?.role === "admin" }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── THEME & CONSTANTS ───────────────────────────────────────────────────────
const MATERIALS = [
  { id: 1, name: "Copper", category: "Non-Ferrous", unit: "kg", basePrice: 752, color: "#b87333", stock: 1240, threshold: 200 },
  { id: 2, name: "Aluminium", category: "Non-Ferrous", unit: "kg", basePrice: 197, color: "#a8a9ad", stock: 3800, threshold: 500 },
  { id: 3, name: "Steel", category: "Ferrous", unit: "kg", basePrice: 42, color: "#71797e", stock: 12000, threshold: 1000 },
  { id: 4, name: "Brass", category: "Non-Ferrous", unit: "kg", basePrice: 380, color: "#cd9b1d", stock: 520, threshold: 100 },
  { id: 5, name: "Iron", category: "Ferrous", unit: "kg", basePrice: 28, color: "#8b4513", stock: 6500, threshold: 800 },
  { id: 6, name: "Stainless Steel", category: "Ferrous", unit: "kg", basePrice: 110, color: "#c0c0c0", stock: 2100, threshold: 300 },
  { id: 7, name: "Lead", category: "Non-Ferrous", unit: "kg", basePrice: 166, color: "#708090", stock: 380, threshold: 50 },
  { id: 8, name: "Zinc", category: "Non-Ferrous", unit: "kg", basePrice: 248, color: "#7b9b9b", stock: 450, threshold: 80 },
];

const INITIAL_TRANSACTIONS = [
  { id: "TXN-001", date: "2026-02-25", supplier: "Sharma Metals Ltd", material: "Copper", weight: 120, unit: "kg", pricePerUnit: 752, total: 90240, status: "paid", invoiceId: "INV-001" },
  { id: "TXN-002", date: "2026-02-25", supplier: "Green Recycle Co", material: "Aluminium", weight: 540, unit: "kg", pricePerUnit: 197, total: 106380, status: "pending", invoiceId: "INV-002" },
  { id: "TXN-003", date: "2026-02-24", supplier: "Metro Scrap Yard", material: "Steel", weight: 2000, unit: "kg", pricePerUnit: 42, total: 84000, status: "paid", invoiceId: "INV-003" },
  { id: "TXN-004", date: "2026-02-24", supplier: "Rahul Kumar", material: "Brass", weight: 85, unit: "kg", pricePerUnit: 380, total: 32300, status: "overdue", invoiceId: "INV-004" },
  { id: "TXN-005", date: "2026-02-23", supplier: "City Iron Works", material: "Iron", weight: 1500, unit: "kg", pricePerUnit: 28, total: 42000, status: "paid", invoiceId: "INV-005" },
];


// ─── STYLES ──────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@300;400;500&family=Sora:wght@300;400;500;600;700&display=swap');
  
  * { box-sizing: border-box; margin: 0; padding: 0; }
  
  :root {
    --bg: #0d0e0f;
    --surface: #141618;
    --surface2: #1c1f22;
    --surface3: #252a2e;
    --border: #2a2e32;
    --amber: #f5a623;
    --amber-dim: #c47e0e;
    --amber-glow: rgba(245,166,35,0.12);
    --text: #e8eaed;
    --text-dim: #8a9099;
    --text-muted: #4a5058;
    --green: #4ade80;
    --red: #f87171;
    --blue: #60a5fa;
    --radius: 8px;
    --radius-lg: 14px;
  }

  body { background: var(--bg); font-family: 'Sora', sans-serif; color: var(--text); }

  .app { display: flex; height: 100vh; overflow: hidden; }

  /* Sidebar */
  .sidebar {
    width: 220px;
    min-width: 220px;
    background: var(--surface);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    padding: 0;
  }
  .sidebar-logo {
    padding: 24px 20px 20px;
    border-bottom: 1px solid var(--border);
  }
  .logo-text {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 28px;
    letter-spacing: 2px;
    color: var(--amber);
    line-height: 1;
  }
  .logo-sub {
    font-size: 9px;
    letter-spacing: 3px;
    color: var(--text-muted);
    text-transform: uppercase;
    margin-top: 2px;
    font-family: 'DM Mono', monospace;
  }
  .nav { padding: 16px 10px; flex: 1; }
  .nav-section-label {
    font-size: 9px;
    letter-spacing: 2px;
    color: var(--text-muted);
    text-transform: uppercase;
    font-family: 'DM Mono', monospace;
    padding: 0 10px;
    margin: 16px 0 8px;
  }
  .nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: var(--radius);
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-dim);
    transition: all 0.15s;
    margin-bottom: 2px;
    border: 1px solid transparent;
  }
  .nav-item:hover { background: var(--surface2); color: var(--text); }
  .nav-item.active {
    background: var(--amber-glow);
    color: var(--amber);
    border-color: rgba(245,166,35,0.2);
  }
  .nav-item .icon { opacity: 0.7; }
  .nav-item.active .icon { opacity: 1; }
  .sidebar-footer {
    padding: 16px;
    border-top: 1px solid var(--border);
    font-size: 11px;
    color: var(--text-muted);
    font-family: 'DM Mono', monospace;
  }

  /* Main */
  .main { flex: 1; overflow-y: auto; background: var(--bg); }
  .topbar {
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    padding: 16px 28px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: sticky;
    top: 0;
    z-index: 10;
  }
  .topbar-title { font-size: 18px; font-weight: 700; letter-spacing: -0.3px; }
  .topbar-actions { display: flex; gap: 10px; align-items: center; }
  .content { padding: 28px; }

  /* Cards */
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 20px;
  }
  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 18px;
  }
  .card-title { font-size: 14px; font-weight: 600; letter-spacing: -0.2px; }
  .card-subtitle { font-size: 12px; color: var(--text-dim); margin-top: 2px; }

  /* Stats Grid */
  .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
  .stat-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 18px 20px;
  }
  .stat-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1.5px; font-family: 'DM Mono', monospace; margin-bottom: 8px; }
  .stat-value { font-size: 26px; font-weight: 700; letter-spacing: -0.5px; font-family: 'Bebas Neue', sans-serif; }
  .stat-change { display: flex; align-items: center; gap: 4px; font-size: 11px; margin-top: 6px; font-family: 'DM Mono', monospace; }
  .stat-change.up { color: var(--green); }
  .stat-change.down { color: var(--red); }

  /* Buttons */
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 9px 16px;
    border-radius: var(--radius);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: all 0.15s;
    font-family: 'Sora', sans-serif;
  }
  .btn-primary { background: var(--amber); color: #0d0e0f; }
  .btn-primary:hover { background: #fbb83a; }
  .btn-ghost { background: var(--surface2); color: var(--text); border: 1px solid var(--border); }
  .btn-ghost:hover { background: var(--surface3); }
  .btn-danger { background: rgba(248,113,113,0.12); color: var(--red); border: 1px solid rgba(248,113,113,0.2); }
  .btn-sm { padding: 6px 12px; font-size: 12px; }

  /* Table */
  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th {
    padding: 10px 14px;
    text-align: left;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: var(--text-muted);
    font-family: 'DM Mono', monospace;
    font-weight: 400;
    border-bottom: 1px solid var(--border);
  }
  td {
    padding: 13px 14px;
    border-bottom: 1px solid var(--border);
    color: var(--text);
  }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: var(--surface2); }

  /* Badges */
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 9px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
    font-family: 'DM Mono', monospace;
  }
  .badge-paid { background: rgba(74,222,128,0.1); color: var(--green); }
  .badge-pending { background: rgba(245,166,35,0.12); color: var(--amber); }
  .badge-overdue { background: rgba(248,113,113,0.12); color: var(--red); }
  .badge-ferrous { background: rgba(113,121,126,0.15); color: #9aa0a6; }
  .badge-nonferrous { background: rgba(245,166,35,0.1); color: var(--amber); }

  /* Grid layouts */
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }

  /* Search */
  .search-wrap { position: relative; }
  .search-wrap input {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 9px 14px 9px 38px;
    color: var(--text);
    font-size: 13px;
    font-family: 'Sora', sans-serif;
    width: 240px;
    outline: none;
    transition: border-color 0.15s;
  }
  .search-wrap input:focus { border-color: var(--amber); }
  .search-wrap input::placeholder { color: var(--text-muted); }
  .search-icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--text-muted); width: 15px; }

  /* Material bars */
  .material-bar { margin-bottom: 14px; }
  .material-bar-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 13px; }
  .material-bar-track { height: 6px; background: var(--surface3); border-radius: 3px; overflow: hidden; }
  .material-bar-fill { height: 100%; border-radius: 3px; transition: width 0.5s; }

  /* Price cards */
  .price-card {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 16px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .price-card:hover { border-color: var(--amber); background: var(--surface3); }
  .price-card.selected { border-color: var(--amber); background: var(--amber-glow); }
  .price-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 8px; }

  /* Modal */
  .modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.7);
    display: flex; align-items: center; justify-content: center;
    z-index: 100; backdrop-filter: blur(4px);
  }
  .modal {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 28px;
    width: 520px;
    max-width: 95vw;
    max-height: 90vh;
    overflow-y: auto;
  }
  .modal-title { font-size: 18px; font-weight: 700; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }

  /* Form */
  .form-group { margin-bottom: 16px; }
  .form-label { font-size: 11px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 1px; font-family: 'DM Mono', monospace; margin-bottom: 6px; display: block; }
  .form-input {
    width: 100%;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 10px 14px;
    color: var(--text);
    font-size: 13px;
    font-family: 'Sora', sans-serif;
    outline: none;
    transition: border-color 0.15s;
  }
  .form-input:focus { border-color: var(--amber); }
  .form-input::placeholder { color: var(--text-muted); }
  select.form-input { appearance: none; cursor: pointer; }
  .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

  /* Invoice */
  .invoice-card {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 24px;
    margin-bottom: 16px;
  }
  .invoice-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
  .invoice-id { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--text-muted); }
  .invoice-total { font-family: 'Bebas Neue', sans-serif; font-size: 32px; color: var(--amber); }
  .invoice-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 13px; }
  .invoice-row:last-child { border-bottom: none; }

  /* Progress ring accent */
  .amber-accent { color: var(--amber); }
  .dim { color: var(--text-dim); }
  .muted { color: var(--text-muted); font-family: 'DM Mono', monospace; font-size: 11px; }

  /* Inventory cards */
  .inv-card {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 16px;
    transition: border-color 0.15s;
  }
  .inv-card:hover { border-color: var(--border); }
  .inv-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
  .inv-material-dot { width: 12px; height: 12px; border-radius: 3px; }
  .inv-stock { font-family: 'Bebas Neue', sans-serif; font-size: 22px; }
  .inv-threshold { font-size: 10px; color: var(--text-muted); font-family: 'DM Mono', monospace; }
  .inv-bar { height: 4px; background: var(--surface3); border-radius: 2px; overflow: hidden; margin-top: 10px; }
  .inv-bar-fill { height: 100%; border-radius: 2px; }
  .low-stock { border-color: rgba(248,113,113,0.3) !important; }
  .low-badge { background: rgba(248,113,113,0.12); color: var(--red); font-size: 10px; padding: 2px 7px; border-radius: 10px; font-family: 'DM Mono', monospace; }

  /* Tabs */
  .tabs { display: flex; gap: 4px; background: var(--surface2); padding: 4px; border-radius: 8px; margin-bottom: 20px; width: fit-content; }
  .tab {
    padding: 7px 16px; border-radius: 6px; font-size: 12px; font-weight: 600;
    cursor: pointer; transition: all 0.15s; color: var(--text-dim);
  }
  .tab.active { background: var(--surface3); color: var(--text); }

  /* Divider */
  .divider { border: none; border-top: 1px solid var(--border); margin: 20px 0; }


  /* ── WhatsApp ────────────────────────────────────────────────────────────── */
  .wa-btn { background: #25D366 !important; color: #fff !important; }
  .wa-btn:hover { background: #1ebe5d !important; }
  .wa-btn:disabled { background: #3a6b4a !important; cursor: not-allowed; opacity: 0.7; }
  .wa-sent { background: rgba(37,211,102,0.1); border: 1px solid rgba(37,211,102,0.25); color: #25D366; border-radius: 6px; padding: 8px 12px; font-size: 12px; display: flex; align-items: center; gap: 6px; }
  .wa-failed { background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.25); color: var(--red); border-radius: 6px; padding: 8px 12px; font-size: 12px; display: flex; align-items: center; gap: 6px; cursor: pointer; }
  .wa-badge { display: inline-flex; align-items: center; gap: 4px; background: rgba(37,211,102,0.12); color: #25D366; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-family: 'DM Mono', monospace; }

  /* ── Login Screen ───────────────────────────────────────────────────────── */
  .login-screen {
    min-height: 100vh;
    background: var(--bg);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
  }
  .login-bg-grid {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(245,166,35,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(245,166,35,0.04) 1px, transparent 1px);
    background-size: 40px 40px;
    pointer-events: none;
  }
  .login-bg-glow {
    position: absolute;
    width: 600px; height: 600px;
    background: radial-gradient(circle, rgba(245,166,35,0.06) 0%, transparent 70%);
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
  }
  .login-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 44px 40px;
    width: 420px;
    max-width: 95vw;
    position: relative;
    z-index: 1;
    animation: fadeIn 0.4s ease;
  }
  .login-logo { text-align: center; margin-bottom: 32px; }
  .login-logo-text {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 42px;
    letter-spacing: 3px;
    color: var(--amber);
    line-height: 1;
  }
  .login-logo-sub {
    font-size: 10px;
    letter-spacing: 3px;
    color: var(--text-muted);
    text-transform: uppercase;
    font-family: 'DM Mono', monospace;
    margin-top: 4px;
  }
  .login-divider { width: 40px; height: 2px; background: var(--amber); margin: 16px auto; border-radius: 1px; }
  .login-title { font-size: 20px; font-weight: 700; margin-bottom: 6px; text-align: center; }
  .login-subtitle { font-size: 13px; color: var(--text-dim); text-align: center; margin-bottom: 28px; }
  .login-error {
    background: rgba(248,113,113,0.1);
    border: 1px solid rgba(248,113,113,0.25);
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 13px;
    color: var(--red);
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .login-hint {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px 14px;
    margin-top: 20px;
  }
  .login-hint-title {
    font-size: 10px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: var(--text-muted);
    font-family: 'DM Mono', monospace;
    margin-bottom: 8px;
  }
  .login-hint-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--text-dim);
    margin-bottom: 6px;
    font-family: 'DM Mono', monospace;
  }
  .login-hint-row:last-child { margin-bottom: 0; }
  .role-badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-family: 'DM Mono', monospace; font-weight: 600; }
  .role-admin   { background: rgba(245,166,35,0.15); color: var(--amber); }
  .role-cashier { background: rgba(96,165,250,0.15); color: var(--blue); }
  .role-driver  { background: rgba(74,222,128,0.15); color: var(--green); }
  .password-wrap { position: relative; }
  .password-wrap .form-input { padding-right: 42px; }
  .password-toggle { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 0; display: flex; align-items: center; }
  .password-toggle:hover { color: var(--text-dim); }
  .user-menu { position: relative; }
  .user-avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--amber); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; color: #000; cursor: pointer; border: 2px solid transparent; transition: border-color 0.15s; }
  .user-avatar:hover { border-color: rgba(245,166,35,0.5); }
  .user-dropdown { position: absolute; right: 0; top: 40px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 8px; min-width: 200px; z-index: 50; animation: fadeIn 0.15s ease; box-shadow: 0 8px 32px rgba(0,0,0,0.4); }
  .user-dropdown-header { padding: 8px 10px 12px; border-bottom: 1px solid var(--border); margin-bottom: 6px; }
  .user-dropdown-name { font-weight: 600; font-size: 13px; }
  .user-dropdown-email { font-size: 11px; color: var(--text-muted); font-family: 'DM Mono', monospace; margin-top: 2px; }
  .user-dropdown-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 6px; font-size: 13px; cursor: pointer; color: var(--text-dim); transition: all 0.1s; }
  .user-dropdown-item:hover { background: var(--surface2); color: var(--text); }
  .user-dropdown-item.danger { color: var(--red); }
  .user-dropdown-item.danger:hover { background: rgba(248,113,113,0.1); }
  .loading-screen { min-height: 100vh; background: var(--bg); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; }
  .spinner { width: 36px; height: 36px; border: 3px solid var(--border); border-top-color: var(--amber); border-radius: 50%; animation: spin 0.7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .api-banner { background: rgba(96,165,250,0.08); border: 1px solid rgba(96,165,250,0.2); border-radius: 8px; padding: 10px 14px; font-size: 12px; color: var(--blue); margin-bottom: 20px; display: flex; align-items: center; gap: 8px; font-family: 'DM Mono', monospace; }
  .user-card { background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px 16px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; transition: border-color 0.15s; }
  .user-card:hover { border-color: var(--amber); }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--surface3); }

  /* Tooltip */
  .custom-tooltip {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 10px 14px;
    font-size: 12px;
    font-family: 'DM Mono', monospace;
  }
  
  .chart-label { font-size: 10px; fill: var(--text-muted); }
  
  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  .fade-in { animation: fadeIn 0.25s ease; }
`;

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip">
        <div style={{ color: "var(--text-dim)", marginBottom: 6 }}>{label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ color: p.color }}>
            {p.name}: ₹{p.value.toLocaleString()}
          </div>
        ))}
      </div>
    );
  }
  return null;
};



// ─── WHATSAPP COMPONENTS ──────────────────────────────────────────────────────
const WhatsAppIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.849L.057 23.535a.75.75 0 00.918.919l5.735-1.464A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.703 9.703 0 01-4.98-1.37l-.356-.212-3.692.943.974-3.617-.232-.372A9.718 9.718 0 012.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z"/>
  </svg>
);

function WhatsAppButton({ txn, style = {} }) {
  const authCtx = useContext(AuthContext);
  const token   = authCtx?.token || null;
  const [status, setStatus] = useState("idle");
  const [msgId,  setMsgId]  = useState(null);
  const hasPhone = !!(txn.supplierPhone || txn.supplier_phone);

  const handleSend = async () => {
    if (!hasPhone) { setStatus("no_phone"); return; }
    setStatus("sending");
    try {
      if (token) {
        // Use the real UUID (_uuid) for the API call, not the display ID
        const txnId = txn._uuid || txn.id;
        const res = await fetch(`http://localhost:5000/api/whatsapp/send/${txnId}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }).then(r => r.json());
        if (res.success) { setStatus("sent"); setMsgId(res.whatsapp?.messageId); }
        else setStatus("failed");
      } else {
        // Demo mode
        await new Promise(r => setTimeout(r, 1800));
        setStatus("sent");
        setMsgId("DEMO-" + Date.now().toString().slice(-6));
      }
    } catch { setStatus("failed"); }
  };

  if (status === "sent") return (
    <div className="wa-sent" style={style}>
      <CheckCircle size={13} /> Receipt sent{msgId && <span style={{ opacity: 0.6, fontSize: 10 }}>· {msgId}</span>}
    </div>
  );
  if (status === "failed") return (
    <div className="wa-failed" style={style} onClick={() => setStatus("idle")}>
      <AlertCircle size={13} /> Failed — tap to retry
    </div>
  );
  if (status === "no_phone") return (
    <div className="wa-failed" style={style}>
      <AlertCircle size={13} /> No phone number on supplier record
    </div>
  );

  return (
    <button className="btn wa-btn" style={{ ...style, display: "flex", alignItems: "center", gap: 7 }}
      disabled={status === "sending"} onClick={handleSend}>
      <WhatsAppIcon size={13} />
      {status === "sending" ? "Sending…" : "WhatsApp"}
    </button>
  );
}

function WhatsAppLogs() {
  const authCtx = useContext(AuthContext);
  const token   = authCtx?.token || null;
  const [logs, setLogs]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [testPhone, setTestPhone] = useState("");
  const [testStatus, setTestStatus] = useState("idle");

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetch("http://localhost:5000/api/whatsapp/logs", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(res => { if (res.success) setLogs(res.logs); }).catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const sendTest = async () => {
    if (!testPhone) return;
    setTestStatus("sending");
    try {
      const res = await fetch("http://localhost:5000/api/whatsapp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phone: testPhone }),
      }).then(r => r.json());
      setTestStatus(res.success ? "sent" : "failed");
    } catch { setTestStatus("failed"); }
  };

  const sentCount = logs.filter(l => l.status === "sent").length;
  const failedCount = logs.filter(l => l.status === "failed").length;

  return (
    <div className="fade-in">
      <div className="grid-3" style={{ marginBottom: 24 }}>
        {[
          { label: "Total Sent",    val: sentCount,   color: "#25D366"        },
          { label: "Failed",        val: failedCount, color: "var(--red)"     },
          { label: "Success Rate",  val: (logs.length > 0 ? Math.round((sentCount/logs.length)*100) : 0) + "%", color: "var(--amber)" },
        ].map(s => (
          <div className="stat-card" key={s.label}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title" style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <WhatsAppIcon size={16} /> Send Test Message
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="form-group" style={{ margin: 0, flex: 1, maxWidth: 280 }}>
            <label className="form-label">Phone Number</label>
            <input className="form-input" placeholder="+91 98765 43210"
              value={testPhone} onChange={e => setTestPhone(e.target.value)} />
          </div>
          <button className="btn wa-btn" onClick={sendTest}
            disabled={testStatus === "sending" || !testPhone} style={{ marginBottom: 0 }}>
            <WhatsAppIcon size={13} />
            {testStatus === "sending" ? "Sending…" : "Send Test"}
          </button>
          {testStatus === "sent"   && <span className="wa-badge"><CheckCircle size={10} /> Sent!</span>}
          {testStatus === "failed" && <span style={{ color: "var(--red)", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}><AlertCircle size={12} /> Check Twilio credentials</span>}
        </div>
        <div className="muted" style={{ marginTop: 10 }}>
          Configure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in your .env file first
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Send History</div>
          <span className="muted">Last 100 messages</span>
        </div>
        {loading ? (
          <div style={{ textAlign: "center", padding: 30, color: "var(--text-muted)" }}>Loading…</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Time</th><th>Supplier</th><th>Phone</th><th>Transaction</th><th>Provider</th><th>PDF</th><th>Status</th></tr>
              </thead>
              <tbody>
                {logs.length === 0
                  ? <tr><td colSpan={7} style={{ textAlign: "center", padding: 28, color: "var(--text-muted)" }}>No messages sent yet</td></tr>
                  : logs.map(l => (
                    <tr key={l.id}>
                      <td className="muted">{new Date(l.sent_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</td>
                      <td style={{ fontWeight: 500 }}>{l.supplier_name || "—"}</td>
                      <td className="muted">{l.supplier_phone}</td>
                      <td className="muted">{l.txn_number || "—"}</td>
                      <td><span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--amber)" }}>{l.provider}</span></td>
                      <td>{l.pdf_url ? <a href={l.pdf_url} target="_blank" rel="noreferrer" style={{ color: "var(--blue)", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}><Download size={11} /> PDF</a> : <span className="muted">—</span>}</td>
                      <td>
                        {l.status === "sent"
                          ? <span className="wa-badge"><CheckCircle size={10} /> Sent</span>
                          : l.status === "failed"
                          ? <span className="badge badge-overdue"><AlertCircle size={10} /> Failed</span>
                          : <span className="badge badge-pending"><Clock size={10} /> {l.status}</span>}
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── LOGIN SCREEN ─────────────────────────────────────────────────────────────
function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail]       = useState("admin@thescrapco.in");
  const [password, setPassword] = useState("admin123");
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [useDemo, setUseDemo]   = useState(true);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await login(email, password);
      if (!res.success) setError(res.message || "Invalid email or password.");
    } catch {
      setError("Could not connect to server. Running in demo mode.");
    } finally {
      setLoading(false);
    }
  };

  // Demo login — bypasses backend for offline preview
  const handleDemo = () => {
    // This triggers a fake auth in the root component
    window.__demoLogin && window.__demoLogin();
  };

  return (
    <div className="login-screen">
      <div className="login-bg-grid" />
      <div className="login-bg-glow" />
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-text">THE SCRAP CO.</div>
          <div className="login-logo-sub">Scrap Management System</div>
          <div className="login-divider" />
        </div>

        <div className="login-title">Welcome Back</div>
        <div className="login-subtitle">Sign in to access your dashboard</div>

        {error && (
          <div className="login-error">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              className="form-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@thescrapco.in"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="password-wrap">
              <input
                className="form-input"
                type={showPw ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
              <button type="button" className="password-toggle" onClick={() => setShowPw(!showPw)}>
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", justifyContent: "center", padding: "12px", fontSize: 14, marginTop: 4 }}
            disabled={loading}
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <button
          className="btn btn-ghost"
          style={{ width: "100%", justifyContent: "center", marginTop: 10, fontSize: 13 }}
          onClick={handleDemo}
        >
          Continue in Demo Mode (No Backend)
        </button>

        <div className="login-hint">
          <div className="login-hint-title">Default Credentials</div>
          <div className="login-hint-row">
            <span className="role-badge role-admin"><Shield size={9} /> Admin</span>
            <span>admin@thescrapco.in / admin123</span>
          </div>
          <div className="login-hint-row">
            <span className="role-badge role-cashier"><User size={9} /> Cashier</span>
            <span>cashier@thescrapco.in / cashier123</span>
          </div>
          <div className="login-hint-row">
            <span className="role-badge role-driver"><Truck size={9} /> Driver</span>
            <span>driver@thescrapco.in / driver123</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── USER MENU (topbar) ───────────────────────────────────────────────────────
function UserMenu({ user, onLogout, onManageUsers }) {
  const [open, setOpen] = useState(false);
  const initials = user.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  const roleColors = { admin: "var(--amber)", cashier: "var(--blue)", driver: "var(--green)" };
  const bgColor = roleColors[user.role] || "var(--amber)";

  return (
    <div className="user-menu">
      <div
        className="user-avatar"
        style={{ background: bgColor }}
        onClick={() => setOpen(!open)}
        title={user.name}
      >
        {initials}
      </div>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setOpen(false)} />
          <div className="user-dropdown">
            <div className="user-dropdown-header">
              <div className="user-dropdown-name">{user.name}</div>
              <div className="user-dropdown-email">{user.email}</div>
              <div style={{ marginTop: 6 }}>
                <span className={`role-badge role-${user.role}`}>
                  {user.role === "admin" ? <Shield size={9} /> : user.role === "cashier" ? <User size={9} /> : <Truck size={9} />}
                  {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </span>
              </div>
            </div>
            {user.role === "admin" && (
              <div className="user-dropdown-item" onClick={() => { setOpen(false); onManageUsers(); }}>
                <User size={14} /> Manage Users
              </div>
            )}
            <div className="user-dropdown-item danger" onClick={() => { setOpen(false); onLogout(); }}>
              <LogOut size={14} /> Sign Out
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── MANAGE USERS (admin only) ────────────────────────────────────────────────
function ManageUsers() {
  const { token, isAdmin } = useAuth();
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]         = useState({ name: "", email: "", password: "", role: "cashier" });
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    api.getUsers(token)
      .then(res => { if (res.success) setUsers(res.users); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, isAdmin]);

  const addUser = async () => {
    setError(""); setSaving(true);
    try {
      const res = await api.registerUser(form, token);
      if (res.success) {
        setUsers(prev => [res.user, ...prev]);
        setSuccess(`User "${res.user.name}" created.`);
        setShowModal(false);
        setForm({ name: "", email: "", password: "", role: "cashier" });
      } else {
        setError(res.message || "Failed to create user.");
      }
    } catch {
      setError("Could not connect to server.");
    } finally {
      setSaving(false);
    }
  };

  const roleIcon = (role) => role === "admin" ? <Shield size={11} /> : role === "cashier" ? <User size={11} /> : <Truck size={11} />;

  return (
    <div className="fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 13, color: "var(--text-dim)" }}>Manage staff accounts and access roles</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={14} /> Add Staff</button>
      </div>

      {success && (
        <div style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 8, padding: "10px 14px", color: "var(--green)", fontSize: 13, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <CheckCircle size={14} /> {success}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Loading users…</div>
      ) : (
        <>
          {/* Role info cards */}
          <div className="grid-3" style={{ marginBottom: 20 }}>
            {[
              { role: "admin", icon: <Shield size={18} />, desc: "Full access to all modules, can manage users and delete records", color: "var(--amber)" },
              { role: "cashier", icon: <User size={18} />, desc: "Can record transactions, manage materials, suppliers and mark invoices paid", color: "var(--blue)" },
              { role: "driver", icon: <Truck size={18} />, desc: "Read-only access — can view transactions and inventory but cannot edit", color: "var(--green)" },
            ].map(({ role, icon, desc, color }) => (
              <div key={role} style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ color }}>{icon}</div>
                  <span className={`role-badge role-${role}`}>{role.charAt(0).toUpperCase() + role.slice(1)}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.5 }}>{desc}</div>
                <div style={{ marginTop: 10, fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color }}>
                  {users.filter(u => u.role === role).length}
                  <span style={{ fontFamily: "'Sora', sans-serif", fontSize: 11, color: "var(--text-muted)", fontWeight: 400, marginLeft: 6 }}>staff</span>
                </div>
              </div>
            ))}
          </div>

          {/* Users list */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">All Staff ({users.length})</div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th></tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 600 }}>{u.name}</td>
                      <td className="muted">{u.email}</td>
                      <td><span className={`role-badge role-${u.role}`}>{roleIcon(u.role)} {u.role}</span></td>
                      <td>
                        {u.is_active
                          ? <span className="badge badge-paid"><CheckCircle size={10} /> Active</span>
                          : <span className="badge badge-overdue">Inactive</span>}
                      </td>
                      <td className="muted">{new Date(u.created_at).toLocaleDateString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              Add Staff Member
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}><X size={14} /></button>
            </div>
            {error && <div className="login-error" style={{ marginBottom: 14 }}><AlertCircle size={13} /> {error}</div>}
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Priya Sharma" />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input className="form-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="priya@thescrapco.in" />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Minimum 6 characters" />
            </div>
            <div className="form-group">
              <label className="form-label">Role</label>
              <select className="form-input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                <option value="admin">Admin — Full access</option>
                <option value="cashier">Cashier — Can record transactions</option>
                <option value="driver">Driver — Read only</option>
              </select>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addUser} disabled={saving}>
                <Plus size={14} /> {saving ? "Creating…" : "Create User"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
function Dashboard({ transactions, materials, token }) {
  const [dash,    setDash]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    api.getDashboard(token)
      .then(r => { if (r.success) setDash(r.dashboard); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  // Fallback: derive stats from local transactions when API dash not ready
  const totalRevenue = dash?.revenue?.revenue_this_month
    ?? transactions.reduce((s, t) => s + t.total, 0);
  const pendingAmt   = dash?.invoice_summary?.pending_amount
    ?? transactions.filter(t => t.status === "pending").reduce((s, t) => s + t.total, 0);
  const totalWeight  = dash?.revenue?.weight_this_month
    ?? transactions.reduce((s, t) => s + t.weight, 0);
  const lowStock     = materials.filter(m => m.stock <= m.threshold);
  const overdueAmt   = dash?.invoice_summary?.overdue_amount ?? 0;

  // ── Build chart data from real transactions ──────────────────────────────
  const chartData = useMemo(() => {
    // Get last 6 months labels
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString("en-IN", { month: "short" }),
      });
    }

    // Get unique material names from transactions
    const materialNames = [...new Set(transactions.map(t => t.material).filter(Boolean))];

    // Build month → material → total map
    const map = {};
    months.forEach(m => { map[m.key] = { month: m.label }; });
    transactions.forEach(t => {
      const d = new Date(t.date || t.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (map[key] && t.material) {
        const mk = t.material.toLowerCase().replace(/\s+/g, "_");
        map[key][mk] = (map[key][mk] || 0) + (t.total || 0);
      }
    });

    return {
      data: Object.values(map),
      materials: materialNames.map((name, i) => ({
        name,
        key: name.toLowerCase().replace(/\s+/g, "_"),
        color: materials.find(m => m.name === name)?.color
          || ["#b87333","#a8a9ad","#71797e","#f5a623","#4ade80","#60a5fa","#f87171","#c084fc"][i % 8],
      })),
    };
  }, [transactions, materials]);

  return (
    <div className="fade-in">
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Revenue (This Month)</div>
          <div className="stat-value amber-accent">₹{Number(totalRevenue).toLocaleString("en-IN")}</div>
          <div className="stat-change up"><TrendingUp size={12} /> {dash?.revenue?.txn_count_this_month ?? transactions.length} transactions</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending Payments</div>
          <div className="stat-value" style={{ color: "var(--amber)" }}>₹{Number(pendingAmt).toLocaleString("en-IN")}</div>
          <div className="stat-change" style={{ color: "var(--text-dim)" }}><Clock size={12} /> {dash?.invoice_summary?.pending_count ?? transactions.filter(t => t.status === "pending").length} invoices outstanding</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Weight Collected</div>
          <div className="stat-value">{Number(totalWeight).toLocaleString("en-IN")} kg</div>
          <div className="stat-change up"><TrendingUp size={12} /> This month</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Low Stock Alerts</div>
          <div className="stat-value" style={{ color: lowStock.length > 0 ? "var(--red)" : "var(--green)" }}>{lowStock.length}</div>
          <div className="stat-change" style={{ color: lowStock.length > 0 ? "var(--red)" : "var(--green)" }}>
            <AlertCircle size={12} /> {lowStock.length > 0 ? lowStock.map(m => m.name).join(", ") : "All materials healthy"}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Revenue by Material</div>
              <div className="card-subtitle">Past 6 months (INR) — live data</div>
            </div>
          </div>
          {chartData.materials.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)", fontSize: 13 }}>
              No transactions yet — chart will populate as you record sales
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 100000 ? `₹${(v/100000).toFixed(1)}L` : `₹${(v/1000).toFixed(0)}K`} />
                  <Tooltip content={<CustomTooltip />} />
                  {chartData.materials.map(m => (
                    <Line key={m.key} type="monotone" dataKey={m.key} stroke={m.color} strokeWidth={2} dot={false} name={m.name} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 12 }}>
                {chartData.materials.map(m => (
                  <div key={m.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-dim)" }}>
                    <div style={{ width: 20, height: 2, background: m.color, borderRadius: 1 }} />
                    {m.name}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Material Stock Overview</div>
              <div className="card-subtitle">Current inventory levels</div>
            </div>
          </div>
          {materials.slice(0, 6).map(m => {
            const pct = Math.min(100, (m.stock / (m.threshold * 10)) * 100);
            const low = m.stock <= m.threshold;
            return (
              <div className="material-bar" key={m.id}>
                <div className="material-bar-header">
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="price-dot" style={{ background: m.color }} />
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{m.name}</span>
                    {low && <span className="low-badge">LOW</span>}
                  </div>
                  <span className="muted">{m.stock.toLocaleString()} {m.unit}</span>
                </div>
                <div className="material-bar-track">
                  <div className="material-bar-fill" style={{ width: `${pct}%`, background: low ? "var(--red)" : m.color }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <div className="card-title">Recent Transactions</div>
          <span className="muted">Last 5 transactions</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th><th>Supplier</th><th>Material</th><th>Weight</th><th>Total</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.slice(0, 5).map(t => (
                <tr key={t.id}>
                  <td><span className="muted">{t.id}</span></td>
                  <td style={{ fontWeight: 500 }}>{t.supplier}</td>
                  <td>{t.material}</td>
                  <td className="muted">{t.weight.toLocaleString()} {t.unit}</td>
                  <td style={{ fontWeight: 600 }}>₹{t.total.toLocaleString()}</td>
                  <td>
                    <span className={`badge badge-${t.status}`}>
                      {t.status === "paid" ? <CheckCircle size={10} /> : t.status === "overdue" ? <AlertCircle size={10} /> : <Clock size={10} />}
                      {t.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── INVENTORY ────────────────────────────────────────────────────────────────
function Inventory({ materials, setMaterials, token }) {
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [form, setForm] = useState({ name: "", category: "Non-Ferrous", unit: "kg", basePrice: "", stock: "", threshold: "", color: "#f5a623" });

  const filtered = materials.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.category.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd  = () => { setEditItem(null); setSaveError(""); setForm({ name: "", category: "Non-Ferrous", unit: "kg", basePrice: "", stock: "", threshold: "", color: "#f5a623" }); setShowModal(true); };
  const openEdit = (m) => { setEditItem(m); setSaveError(""); setForm({ ...m, basePrice: m.basePrice, stock: m.stock, threshold: m.threshold }); setShowModal(true); };

  const save = async () => {
    setSaveError(""); setSaving(true);
    const payload = {
      name:          form.name,
      category:      form.category,
      unit:          form.unit,
      buy_price:     parseFloat(form.basePrice) || 0,
      sell_price:    parseFloat(form.sellPrice  || form.basePrice) || 0,
      stock_qty:     parseFloat(form.stock)     || 0,
      min_threshold: parseFloat(form.threshold) || 0,
      color_hex:     form.color || "#f5a623",
    };
    try {
      const res = editItem
        ? await api.updateMaterial(editItem.id, payload, token)
        : await api.createMaterial(payload, token);
      if (res.success) {
        const norm = normMaterial(res.material);
        setMaterials(prev => editItem
          ? prev.map(m => m.id === editItem.id ? norm : m)
          : [...prev, norm]
        );
        setShowModal(false);
      } else {
        setSaveError(res.message || "Save failed.");
      }
    } catch (e) {
      setSaveError(e.message || "Network error.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Deactivate this material?")) return;
    try {
      await api.deleteMaterial(id, token);
      setMaterials(prev => prev.filter(m => m.id !== id));
    } catch (e) {
      alert("Delete failed: " + e.message);
    }
  };

  return (
    <div className="fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div className="search-wrap">
          <Search className="search-icon" />
          <input placeholder="Search materials…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={15} /> Add Material</button>
      </div>

      <div className="grid-3" style={{ marginBottom: 24 }}>
        {filtered.map(m => {
          const low = m.stock <= m.threshold;
          const pct = Math.min(100, (m.stock / (m.threshold * 8)) * 100);
          return (
            <div key={m.id} className={`inv-card ${low ? "low-stock" : ""}`}>
              <div className="inv-card-top">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div className="inv-material-dot" style={{ background: m.color }} />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{m.name}</span>
                </div>
                <span className={`badge ${m.category === "Ferrous" ? "badge-ferrous" : "badge-nonferrous"}`}>{m.category}</span>
              </div>
              <div className="inv-stock">{m.stock.toLocaleString()} <span style={{ fontSize: 13, color: "var(--text-dim)" }}>{m.unit}</span></div>
              <div className="inv-threshold">Min threshold: {m.threshold.toLocaleString()} {m.unit}</div>
              {low && <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--red)", fontSize: 11, marginTop: 6 }}><AlertCircle size={11} /> Below minimum stock level</div>}
              <div className="inv-bar">
                <div className="inv-bar-fill" style={{ width: `${pct}%`, background: low ? "var(--red)" : m.color }} />
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
                <button className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => openEdit(m)}><Edit3 size={12} /> Edit</button>
                <button className="btn btn-danger btn-sm" onClick={() => remove(m.id)}><Trash2 size={12} /></button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Full Material Register</div>
          <button className="btn btn-ghost btn-sm"><Download size={13} /> Export CSV</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Material</th><th>Category</th><th>Unit</th><th>Buy Price (₹/kg)</th><th>Current Stock</th><th>Threshold</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map(m => {
                const low = m.stock <= m.threshold;
                return (
                  <tr key={m.id}>
                    <td><div style={{ display: "flex", alignItems: "center", gap: 8 }}><span className="price-dot" style={{ background: m.color }} />{m.name}</div></td>
                    <td><span className={`badge ${m.category === "Ferrous" ? "badge-ferrous" : "badge-nonferrous"}`}>{m.category}</span></td>
                    <td className="muted">{m.unit}</td>
                    <td style={{ fontWeight: 600, color: "var(--amber)" }}>₹{m.basePrice.toFixed(2)}</td>
                    <td style={{ fontWeight: 500 }}>{m.stock.toLocaleString()}</td>
                    <td className="muted">{m.threshold.toLocaleString()}</td>
                    <td>
                      {low
                        ? <span className="badge badge-overdue"><AlertCircle size={10} /> Low Stock</span>
                        : <span className="badge badge-paid"><CheckCircle size={10} /> OK</span>}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(m)}><Edit3 size={12} /></button>
                        <button className="btn btn-danger btn-sm" onClick={() => remove(m.id)}><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              {editItem ? "Edit Material" : "Add New Material"}
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}><X size={14} /></button>
            </div>
            {saveError && (
              <div className="login-error" style={{ marginBottom: 12 }}><AlertCircle size={13} /> {saveError}</div>
            )}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Material Name</label>
                <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Copper" />
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  <option>Non-Ferrous</option>
                  <option>Ferrous</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Unit</label>
                <select className="form-input" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}>
                  <option>kg</option><option>tonne</option><option>lb</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Buy Price (₹ per unit)</label>
                <input className="form-input" type="number" value={form.basePrice} onChange={e => setForm({ ...form, basePrice: e.target.value })} placeholder="0.00" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Current Stock</label>
                <input className="form-input" type="number" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} placeholder="0" />
              </div>
              <div className="form-group">
                <label className="form-label">Min Threshold</label>
                <input className="form-input" type="number" value={form.threshold} onChange={e => setForm({ ...form, threshold: e.target.value })} placeholder="0" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Colour Tag</label>
              <input type="color" className="form-input" value={form.color} style={{ height: 42, padding: 4, cursor: "pointer" }} onChange={e => setForm({ ...form, color: e.target.value })} />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}><CheckCircle size={14} /> {saving ? "Saving…" : editItem ? "Save Changes" : "Add Material"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── WEIGHING & PRICING ───────────────────────────────────────────────────────
function WeighingPricing({ materials, setMaterials, suppliers, onTransaction, token }) {
  const [selected, setSelected] = useState(materials[0]);
  const [weight, setWeight] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [priceTab, setPriceTab] = useState("buy");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [result, setResult] = useState(null);

  // Keep selected in sync if materials reload
  useEffect(() => {
    if (!selected && materials.length) setSelected(materials[0]);
  }, [materials]);

  const effectivePrice = customPrice !== "" ? +customPrice : (selected?.basePrice || 0);
  const total = (parseFloat(weight) || 0) * effectivePrice;

  const handleWeigh = async () => {
    setSubmitError("");
    if (!weight || !supplierId || !selected) {
      setSubmitError("Please select a material, supplier and enter a weight.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.createTransaction({
        supplier_id:    supplierId,
        material_id:    selected.id,
        weight:         parseFloat(weight),
        price_per_unit: effectivePrice,
      }, token);

      if (res.success) {
        const txn = normTransaction({
          ...res.transaction,
          invoice_number: res.invoice?.invoice_number,
          invoice_id:     res.invoice?.id,
          invoice_status: "pending",
          supplier_name:  suppliers.find(s => s.id === supplierId)?.name || "",
          material_name:  selected.name,
        });
        onTransaction(txn);
        setResult(txn);
        setWeight("");
        setSupplierId("");
        setCustomPrice("");
      } else {
        setSubmitError(res.message || "Failed to record transaction.");
      }
    } catch (e) {
      setSubmitError(e.message || "Network error.");
    } finally {
      setSubmitting(false);
    }
  };

  const updatePrice = async (id, val) => {
    // Optimistic update, persist to backend
    setMaterials(prev => prev.map(m => m.id === id ? { ...m, basePrice: +val } : m));
    await api.updateMaterial(id, { buy_price: parseFloat(val) }, token).catch(() => {});
  };

  return (
    <div className="fade-in">
      <div className="grid-2">
        {/* Weighing Panel */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: 20 }}>⚖ New Weighing Transaction</div>

          <div className="form-group">
            <label className="form-label">Select Material</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {materials.slice(0, 6).map(m => (
                <div key={m.id} className={`price-card ${selected?.id === m.id ? "selected" : ""}`} onClick={() => { setSelected(m); setCustomPrice(""); }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span className="price-dot" style={{ background: m.color }} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</span>
                  </div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: "var(--amber)" }}>
                    ₹{m.basePrice.toFixed(2)}
                  </div>
                  <div className="muted">per {m.unit}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Supplier</label>
              <select className="form-input" value={supplierId} onChange={e => setSupplierId(e.target.value)}>
                <option value="">— Select supplier —</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}{s.phone ? ` · ${s.phone}` : ""}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Weight ({selected?.unit || "kg"})</label>
              <input className="form-input" type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder="0.00" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Override Price (₹/{selected?.unit || "kg"}) — optional</label>
            <input className="form-input" type="number" value={customPrice} onChange={e => setCustomPrice(e.target.value)} placeholder={`Default: ₹${effectivePrice.toFixed(2)}`} />
          </div>

          {weight && selected && (
            <div style={{ background: "var(--amber-glow)", border: "1px solid rgba(245,166,35,0.25)", borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <div className="muted" style={{ marginBottom: 6 }}>Calculated Payout</div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                <span>{weight} {selected.unit} × ₹{effectivePrice.toFixed(2)}</span>
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "var(--amber)" }}>₹{total.toFixed(2)}</span>
              </div>
              <div className="muted">Material: {selected.name} · Supplier: {suppliers.find(s => s.id === supplierId)?.name || "—"}</div>
            </div>
          )}

          {submitError && (
            <div className="login-error" style={{ marginBottom: 12 }}><AlertCircle size={13} /> {submitError}</div>
          )}

          <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={handleWeigh} disabled={submitting}>
            <Scale size={15} /> {submitting ? "Recording…" : "Record Weighing & Generate Invoice"}
          </button>

          {result && (
            <div style={{ marginTop: 14, padding: 14, background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--green)", fontWeight: 600, marginBottom: 4 }}>
                <CheckCircle size={14} /> Transaction recorded: {result.id}
              </div>
              <div className="muted">Invoice {result.invoiceId} created · Status: Pending</div>
            </div>
          )}
        </div>

        {/* Price Management */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: 16 }}>Price Management</div>
          <div className="tabs">
            <div className={`tab ${priceTab === "buy" ? "active" : ""}`} onClick={() => setPriceTab("buy")}>Buy Prices</div>
            <div className={`tab ${priceTab === "sell" ? "active" : ""}`} onClick={() => setPriceTab("sell")}>Sell Prices</div>
          </div>

          <div style={{ marginBottom: 12, padding: "10px 14px", background: "var(--surface2)", borderRadius: 8, fontSize: 12, color: "var(--text-dim)", fontFamily: "'DM Mono', monospace" }}>
            {priceTab === "buy" ? "Prices paid to suppliers when collecting scrap" : "Prices charged when selling bulk to processors"}
          </div>

          <table style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ padding: "8px 0", fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1.5, fontFamily: "'DM Mono', monospace" }}>Material</th>
                <th style={{ padding: "8px 0", fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1.5, fontFamily: "'DM Mono', monospace" }}>Current (₹/kg)</th>
                <th style={{ padding: "8px 0", fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1.5, fontFamily: "'DM Mono', monospace" }}>Update</th>
              </tr>
            </thead>
            <tbody>
              {materials.map(m => {
                const currentPrice = m.basePrice;
                const sellPrice = +(currentPrice * 1.15).toFixed(2);
                const displayPrice = priceTab === "buy" ? currentPrice : sellPrice;
                return (
                  <tr key={m.id}>
                    <td style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className="price-dot" style={{ background: m.color }} />
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{m.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 0", borderBottom: "1px solid var(--border)", fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: "var(--amber)" }}>
                      ₹{displayPrice.toFixed(2)}
                    </td>
                    <td style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                      {priceTab === "buy" && (
                        <input
                          className="form-input"
                          type="number"
                          style={{ padding: "6px 10px", fontSize: 12, width: 90 }}
                          placeholder={m.basePrice.toFixed(2)}
                          onChange={e => updatePrice(m.id, e.target.value)}
                        />
                      )}
                      {priceTab === "sell" && <span className="muted">Auto (+15%)</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ marginTop: 16, padding: "12px 14px", background: "var(--surface2)", borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 6 }}>Market Reference</div>
            <div style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: "var(--text-muted)", lineHeight: 1.8 }}>
              Copper LME: ₹7,842/t · Aluminium: ₹1,623/t<br />
              Steel HRC: ₹298/t · Lead: ₹1,378/t<br />
              <span style={{ color: "var(--amber)" }}>Last updated: 27 Feb 2026, 09:00</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PAYMENTS & INVOICING ─────────────────────────────────────────────────────
function PaymentsInvoicing({ transactions, setTransactions, token }) {
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [viewInv, setViewInv] = useState(null);
  const [payMethod, setPayMethod] = useState("cash");

  const filtered = transactions.filter(t => {
    const matchSearch = (t.supplier || "").toLowerCase().includes(search.toLowerCase()) ||
      (t.material || "").toLowerCase().includes(search.toLowerCase()) ||
      (t.id || "").toLowerCase().includes(search.toLowerCase()) ||
      (t.invoiceId || "").toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || t.status === filter;
    return matchSearch && matchFilter;
  });

  const markPaid = async (t) => {
    const invoiceId = t._invoiceUuid || t._uuid;
    try {
      const res = await api.payInvoice(invoiceId, payMethod, token);
      if (res.success) {
        setTransactions(prev => prev.map(tx =>
          (tx._uuid === t._uuid || tx.id === t.id)
            ? { ...tx, status: "paid" }
            : tx
        ));
        if (viewInv?._uuid === t._uuid) setViewInv({ ...viewInv, status: "paid" });
      } else {
        alert("Payment failed: " + (res.message || "Unknown error"));
      }
    } catch (e) {
      alert("Payment error: " + e.message);
    }
  };

  const deleteTransaction = async (t) => {
    if (!window.confirm(`Delete transaction ${t.id} (${t.supplier} — ₹${t.total.toLocaleString("en-IN")})?\n\nThis will also delete the linked invoice. This cannot be undone.`)) return;
    try {
      const res = await api.deleteTransaction(t._uuid, token);
      if (res.success) {
        setTransactions(prev => prev.filter(tx => tx._uuid !== t._uuid));
        if (viewInv?._uuid === t._uuid) setViewInv(null);
      } else {
        alert("Delete failed: " + (res.message || "Unknown error"));
      }
    } catch (e) {
      alert("Delete error: " + e.message);
    }
  };

  const totalPaid = transactions.filter(t => t.status === "paid").reduce((s, t) => s + t.total, 0);
  const totalPending = transactions.filter(t => t.status === "pending").reduce((s, t) => s + t.total, 0);
  const totalOverdue = transactions.filter(t => t.status === "overdue").reduce((s, t) => s + t.total, 0);

  const Invoice = ({ t }) => (
    <div className="modal-overlay" onClick={() => setViewInv(null)}>
      <div className="modal" style={{ width: 580 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 2, color: "var(--amber)" }}>INVOICE</div>
            <div className="muted">{t.invoiceId}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24 }}>THE SCRAP CO.</div>
            <div className="muted">The Scrap Co. Pvt. Ltd</div>
            <div className="muted">GSTIN: IN27GSTIN1234Z</div>
          </div>
        </div>
        <hr className="divider" />
        <div className="form-row" style={{ marginBottom: 20 }}>
          <div>
            <div className="muted" style={{ marginBottom: 4 }}>Bill To</div>
            <div style={{ fontWeight: 600 }}>{t.supplier}</div>
            <div className="muted">Transaction: {t.id}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="muted" style={{ marginBottom: 4 }}>Invoice Date</div>
            <div style={{ fontWeight: 600 }}>{t.date}</div>
            <div>
              <span className={`badge badge-${t.status}`}>{t.status.toUpperCase()}</span>
            </div>
          </div>
        </div>

        <div style={{ background: "var(--surface2)", borderRadius: 8, overflow: "hidden", marginBottom: 20 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--surface3)" }}>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-muted)", fontFamily: "'DM Mono', monospace" }}>Description</th>
                <th style={{ padding: "10px 14px", textAlign: "right", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-muted)", fontFamily: "'DM Mono', monospace" }}>Qty</th>
                <th style={{ padding: "10px 14px", textAlign: "right", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-muted)", fontFamily: "'DM Mono', monospace" }}>Unit Price</th>
                <th style={{ padding: "10px 14px", textAlign: "right", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-muted)", fontFamily: "'DM Mono', monospace" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: "12px 14px", fontSize: 13 }}>{t.material} Scrap</td>
                <td style={{ padding: "12px 14px", textAlign: "right", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>{t.weight} {t.unit}</td>
                <td style={{ padding: "12px 14px", textAlign: "right", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>₹{t.pricePerUnit.toFixed(2)}</td>
                <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 600, fontSize: 13 }}>₹{t.total.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <div style={{ width: 220 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, borderBottom: "1px solid var(--border)" }}>
              <span className="dim">Subtotal</span><span>₹{t.total.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, borderBottom: "1px solid var(--border)" }}>
              <span className="dim">GST (0%)</span><span>₹0.00</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "var(--amber)" }}>
              <span>TOTAL DUE</span><span>₹{t.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button className="btn btn-ghost" style={{ flex: 1, justifyContent: "center" }} onClick={() => setViewInv(null)}><X size={14} /> Close</button>
          <button className="btn btn-ghost" style={{ flex: 1, justifyContent: "center" }} onClick={() => generateInvoicePDF(t)}><Download size={14} /> Download PDF</button>
          <WhatsAppButton txn={t} style={{ flex: 1, justifyContent: "center" }} />
          {t.status !== "paid" && (
            <button className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }} onClick={() => { markPaid(t); setViewInv(null); }}><CheckCircle size={14} /> Mark as Paid</button>
          )}
          {isAdmin && (
            <button className="btn btn-danger" style={{ flex: 1, justifyContent: "center" }} onClick={() => deleteTransaction(t)}><Trash2 size={14} /> Delete</button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="fade-in">
      <div className="grid-3" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Total Paid</div>
          <div className="stat-value" style={{ color: "var(--green)" }}>₹{totalPaid.toLocaleString()}</div>
          <div className="muted" style={{ marginTop: 6 }}>{transactions.filter(t => t.status === "paid").length} invoices</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Awaiting Payment</div>
          <div className="stat-value amber-accent">₹{totalPending.toLocaleString()}</div>
          <div className="muted" style={{ marginTop: 6 }}>{transactions.filter(t => t.status === "pending").length} invoices</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Overdue</div>
          <div className="stat-value" style={{ color: "var(--red)" }}>₹{totalOverdue.toLocaleString()}</div>
          <div className="muted" style={{ marginTop: 6 }}>{transactions.filter(t => t.status === "overdue").length} invoices</div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div className="search-wrap">
              <Search className="search-icon" />
              <input placeholder="Search invoices…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="form-input" style={{ width: 130 }} value={filter} onChange={e => setFilter(e.target.value)}>
              <option value="all">All Status</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
          <button className="btn btn-ghost btn-sm"><Download size={13} /> Export</button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Transaction</th>
                <th>Date</th>
                <th>Supplier</th>
                <th>Material</th>
                <th>Weight</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id}>
                  <td><span className="muted">{t.invoiceId}</span></td>
                  <td><span className="muted">{t.id}</span></td>
                  <td className="muted">{t.date}</td>
                  <td style={{ fontWeight: 500 }}>{t.supplier}</td>
                  <td>{t.material}</td>
                  <td className="muted">{t.weight.toLocaleString()} {t.unit}</td>
                  <td style={{ fontWeight: 700 }}>₹{t.total.toFixed(2)}</td>
                  <td>
                    <span className={`badge badge-${t.status}`}>
                      {t.status === "paid" ? <CheckCircle size={10} /> : t.status === "overdue" ? <AlertCircle size={10} /> : <Clock size={10} />}
                      {t.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setViewInv(t)}>View</button>
                      <button className="btn btn-ghost btn-sm" title="Download PDF" onClick={() => generateInvoicePDF(t)}><Download size={12} /></button>
                      {t.status !== "paid" && (
                        <button className="btn btn-primary btn-sm" onClick={() => markPaid(t)}>Mark Paid</button>
                      )}
                      {isAdmin && (
                        <button className="btn btn-danger btn-sm" title="Delete transaction" onClick={() => deleteTransaction(t)}><Trash2 size={12} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: "center", padding: 30, color: "var(--text-muted)" }}>No transactions found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewInv && <Invoice t={viewInv} />}
    </div>
  );
}

// ─── BUY FROM CUSTOMER ───────────────────────────────────────────────────────
// Records when we BUY scrap from a household customer and issues them a receipt
function BuyFromCustomer({ materials, customers, setCustomers, onReceiptSaved, token }) {
  const [selected,    setSelected]    = useState(materials[0]);
  const [customerId,  setCustomerId]  = useState("");
  const [walkinName,  setWalkinName]  = useState("");
  const [walkinPhone, setWalkinPhone] = useState("");
  const [weight,      setWeight]      = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [payMethod,   setPayMethod]   = useState("cash");
  const [notes,       setNotes]       = useState("");
  const [saving,      setSaving]      = useState(false);
  const [saveError,   setSaveError]   = useState("");
  const [receipt,     setReceipt]     = useState(null);
  const [isWalkin,    setIsWalkin]    = useState(false);
  const [receipts,    setReceipts]    = useState([]);
  const [loadingR,    setLoadingR]    = useState(true);

  useEffect(() => {
    if (!selected && materials.length) setSelected(materials[0]);
  }, [materials]);

  useEffect(() => {
    api.getPurchaseReceipts(token, { limit: 50 })
      .then(r => { if (r.success) setReceipts(r.receipts.map(normReceipt)); })
      .catch(() => {})
      .finally(() => setLoadingR(false));
  }, [token]);

  const effectivePrice = customPrice !== "" ? +customPrice : (selected?.basePrice || 0);
  const total = (parseFloat(weight) || 0) * effectivePrice;

  const handleBuy = async () => {
    setSaveError("");
    if (!selected)     { setSaveError("Select a material."); return; }
    if (!weight || parseFloat(weight) <= 0) { setSaveError("Enter a valid weight."); return; }

    setSaving(true);
    try {
      let finalCustomerId = customerId || null;

      // If walk-in with a name, create customer on the fly
      if (isWalkin && walkinName.trim()) {
        const cRes = await api.createCustomer({
          name: walkinName.trim(), phone: walkinPhone.trim() || null,
        }, token);
        if (cRes.success) {
          finalCustomerId = cRes.customer.id;
          setCustomers(prev => [cRes.customer, ...prev]);
        }
      }

      const res = await api.createPurchaseReceipt({
        customer_id:    finalCustomerId,
        material_id:    selected.id,
        weight:         parseFloat(weight),
        price_per_unit: effectivePrice,
        payment_method: payMethod,
        notes:          notes || null,
      }, token);

      if (res.success) {
        const nr = normReceipt(res.receipt);
        setReceipts(prev => [nr, ...prev]);
        setReceipt(nr);
        onReceiptSaved();
        // Reset form
        setWeight(""); setCustomPrice(""); setNotes("");
        setCustomerId(""); setWalkinName(""); setWalkinPhone(""); setIsWalkin(false);
      } else {
        setSaveError(res.message || "Failed to record purchase.");
      }
    } catch (e) { setSaveError(e.message || "Network error."); }
    finally { setSaving(false); }
  };

  const deleteReceipt = async (r) => {
    if (!window.confirm(`Delete receipt ${r.receiptNumber}?`)) return;
    try {
      await api.deletePurchaseReceipt(r.id, token);
      setReceipts(prev => prev.filter(x => x.id !== r.id));
      onReceiptSaved();
    } catch (e) { alert("Delete failed: " + e.message); }
  };

  const { isAdmin } = useAuth();

  return (
    <div className="fade-in">
      <div className="grid-2">
        {/* ── LEFT: Record Purchase ─────────────────────────────────────────── */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: 20 }}>
            🏠 Buy Scrap from Customer
          </div>

          {/* Material selector */}
          <div className="form-group">
            <label className="form-label">Select Material</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {materials.slice(0, 6).map(m => (
                <div key={m.id}
                  className={`price-card ${selected?.id === m.id ? "selected" : ""}`}
                  onClick={() => { setSelected(m); setCustomPrice(""); }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span className="price-dot" style={{ background: m.color }} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</span>
                  </div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: "var(--amber)" }}>
                    ₹{m.basePrice.toFixed(2)}
                  </div>
                  <div className="muted">per {m.unit}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Customer selection */}
          <div className="form-group">
            <label className="form-label">Customer</label>
            <div style={{ display: "flex", gap: 8, marginBottom: isWalkin ? 10 : 0 }}>
              <select className="form-input" style={{ flex: 1 }}
                value={isWalkin ? "__walkin__" : customerId}
                onChange={e => {
                  if (e.target.value === "__walkin__") { setIsWalkin(true); setCustomerId(""); }
                  else { setIsWalkin(false); setCustomerId(e.target.value); }
                }}>
                <option value="">— Select existing customer —</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ""}</option>
                ))}
                <option value="__walkin__">➕ Walk-in / New customer</option>
              </select>
            </div>
            {isWalkin && (
              <div className="form-row" style={{ marginTop: 8 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <input className="form-input" placeholder="Customer name (optional)"
                    value={walkinName} onChange={e => setWalkinName(e.target.value)} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <input className="form-input" placeholder="Phone (optional)"
                    value={walkinPhone} onChange={e => setWalkinPhone(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Weight ({selected?.unit || "kg"})</label>
              <input className="form-input" type="number" value={weight}
                onChange={e => setWeight(e.target.value)} placeholder="0.00" />
            </div>
            <div className="form-group">
              <label className="form-label">Override Price (₹/{selected?.unit || "kg"})</label>
              <input className="form-input" type="number" value={customPrice}
                onChange={e => setCustomPrice(e.target.value)}
                placeholder={`Default: ₹${effectivePrice.toFixed(2)}`} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Payment Method</label>
              <select className="form-input" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Notes (optional)</label>
              <input className="form-input" value={notes}
                onChange={e => setNotes(e.target.value)} placeholder="Any remarks…" />
            </div>
          </div>

          {/* Payout preview */}
          {weight && selected && (
            <div style={{ background: "var(--amber-glow)", border: "1px solid rgba(245,166,35,0.25)", borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <div className="muted" style={{ marginBottom: 6 }}>We will pay the customer</div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                <span>{weight} {selected.unit} × ₹{effectivePrice.toFixed(2)}</span>
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "var(--amber)" }}>₹{total.toFixed(2)}</span>
              </div>
              <div className="muted">via {payMethod.replace("_", " ").toUpperCase()}</div>
            </div>
          )}

          {saveError && (
            <div className="login-error" style={{ marginBottom: 12 }}><AlertCircle size={13} /> {saveError}</div>
          )}

          <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}
            onClick={handleBuy} disabled={saving}>
            <Scale size={15} /> {saving ? "Recording…" : "Record Purchase & Generate Receipt"}
          </button>

          {receipt && (
            <div style={{ marginTop: 14, padding: 14, background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--green)", fontWeight: 600, marginBottom: 8 }}>
                <CheckCircle size={14} /> Purchase recorded: {receipt.receiptNumber}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: "center" }}
                  onClick={() => generateReceiptPDF(receipt)}>
                  <Download size={12} /> Download Receipt
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Recent Purchases ────────────────────────────────────────── */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Recent Purchases</div>
            <span className="muted">Last 50</span>
          </div>
          {loadingR ? (
            <div style={{ textAlign: "center", padding: 30, color: "var(--text-muted)" }}>Loading…</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Receipt</th><th>Customer</th><th>Material</th><th>Weight</th><th>Paid</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {receipts.length === 0
                    ? <tr><td colSpan={6} style={{ textAlign: "center", padding: 28, color: "var(--text-muted)" }}>No purchases yet</td></tr>
                    : receipts.map(r => (
                      <tr key={r.id}>
                        <td><span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--amber)" }}>{r.receiptNumber}</span></td>
                        <td style={{ fontWeight: 500 }}>{r.customerName}</td>
                        <td className="muted">{r.materialName}</td>
                        <td className="muted">{r.weight} {r.unit}</td>
                        <td style={{ fontWeight: 600, color: "var(--green)" }}>₹{r.total.toLocaleString("en-IN")}</td>
                        <td>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => generateReceiptPDF(r)} title="Download PDF">
                              <Download size={11} />
                            </button>
                            {isAdmin && (
                              <button className="btn btn-danger btn-sm" onClick={() => deleteReceipt(r)} title="Delete">
                                <Trash2 size={11} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── CUSTOMERS PAGE ───────────────────────────────────────────────────────────
function Customers({ customers, setCustomers, token }) {
  const { isAdmin, user } = useAuth();
  const isCashier = user?.role === "cashier" || isAdmin;
  const [search,    setSearch]    = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editItem,  setEditItem]  = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", address: "", id_type: "Aadhaar", id_number: "", notes: "" });

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || "").includes(search)
  );

  const openAdd = () => {
    setEditItem(null); setSaveError("");
    setForm({ name: "", phone: "", address: "", id_type: "Aadhaar", id_number: "", notes: "" });
    setShowModal(true);
  };
  const openEdit = (c) => {
    setEditItem(c); setSaveError("");
    setForm({ name: c.name||"", phone: c.phone||"", address: c.address||"", id_type: c.id_type||"Aadhaar", id_number: c.id_number||"", notes: c.notes||"" });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.name.trim()) { setSaveError("Name is required."); return; }
    setSaving(true); setSaveError("");
    try {
      const res = editItem
        ? await api.updateCustomer(editItem.id, form, token)
        : await api.createCustomer(form, token);
      if (res.success) {
        setCustomers(prev => editItem
          ? prev.map(c => c.id === editItem.id ? res.customer : c)
          : [res.customer, ...prev]);
        setShowModal(false);
      } else { setSaveError(res.message || "Save failed."); }
    } catch (e) { setSaveError(e.message); }
    finally { setSaving(false); }
  };

  const remove = async (c) => {
    if (!window.confirm(`Remove "${c.name}"?`)) return;
    try {
      await api.deleteCustomer(c.id, token);
      setCustomers(prev => prev.filter(x => x.id !== c.id));
    } catch (e) { alert("Delete failed: " + e.message); }
  };

  const initials = (name) => name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div className="search-wrap">
          <Search className="search-icon" />
          <input placeholder="Search by name or phone…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {isCashier && <button className="btn btn-primary" onClick={openAdd}><Plus size={15} /> Add Customer</button>}
      </div>

      <div className="grid-3" style={{ marginBottom: 24 }}>
        {[
          { label: "Total Customers",  value: customers.length,                                       color: "var(--amber)" },
          { label: "Total Paid Out",   value: "₹" + customers.reduce((s, c) => s + (parseFloat(c.total_paid||c.lifetime_paid)||0), 0).toLocaleString("en-IN"), color: "var(--green)" },
          { label: "Total Visits",     value: customers.reduce((s, c) => s + (parseInt(c.total_visits||c.visit_count)||0), 0), color: "var(--blue)" },
        ].map(s => (
          <div className="stat-card" key={s.label}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Customer Register ({filtered.length})</div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Customer</th><th>Phone</th><th>ID</th><th>Visits</th><th>Total Paid</th><th>Address</th>{isCashier && <th>Actions</th>}</tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={isCashier ? 7 : 6} style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>
                  {search ? "No customers match your search" : "No customers yet"}
                </td></tr>
              ) : filtered.map(c => (
                <tr key={c.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 11, color: "var(--amber)", flexShrink: 0 }}>
                        {initials(c.name)}
                      </div>
                      <span style={{ fontWeight: 600 }}>{c.name}</span>
                    </div>
                  </td>
                  <td className="muted">{c.phone || "—"}</td>
                  <td>
                    {c.id_number
                      ? <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11 }}>{c.id_type}: {c.id_number}</span>
                      : <span className="muted">—</span>}
                  </td>
                  <td style={{ textAlign: "center", fontWeight: 600 }}>{c.total_visits || c.visit_count || 0}</td>
                  <td style={{ fontWeight: 600, color: "var(--green)" }}>
                    ₹{parseFloat(c.total_paid || c.lifetime_paid || 0).toLocaleString("en-IN")}
                  </td>
                  <td className="muted" style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.address || "—"}</td>
                  {isCashier && (
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}><Edit3 size={12} /> Edit</button>
                        {isAdmin && <button className="btn btn-danger btn-sm" onClick={() => remove(c)}><Trash2 size={12} /></button>}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              {editItem ? "Edit Customer" : "Add Customer"}
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}><X size={14} /></button>
            </div>
            {saveError && <div className="login-error" style={{ marginBottom: 12 }}><AlertCircle size={13} /> {saveError}</div>}
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Ramesh Kumar" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" />
              </div>
              <div className="form-group">
                <label className="form-label">Address</label>
                <input className="form-input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Area / Street" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">ID Type</label>
                <select className="form-input" value={form.id_type} onChange={e => setForm({ ...form, id_type: e.target.value })}>
                  <option>Aadhaar</option><option>PAN</option><option>Voter ID</option><option>Driving Licence</option><option>Passport</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">ID Number</label>
                <input className="form-input" value={form.id_number} onChange={e => setForm({ ...form, id_number: e.target.value.toUpperCase() })} placeholder="e.g. 1234 5678 9012" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <input className="form-input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Any remarks…" />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                <CheckCircle size={14} /> {saving ? "Saving…" : editItem ? "Save Changes" : "Add Customer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SUPPLIERS (now renamed BUYERS in nav) ────────────────────────────────────
function Suppliers({ suppliers, setSuppliers, token }) {
  const { isAdmin, user } = useAuth();
  const isCashier = user?.role === "cashier" || isAdmin;
  const [search,    setSearch]    = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editItem,  setEditItem]  = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState("");
  const [form, setForm] = useState({
    name: "", phone: "", email: "", address: "",
    id_type: "PAN", id_number: "",
  });

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.phone || "").includes(search) ||
    (s.email || "").toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => {
    setEditItem(null);
    setSaveError("");
    setForm({ name: "", phone: "", email: "", address: "", id_type: "PAN", id_number: "" });
    setShowModal(true);
  };

  const openEdit = (s) => {
    setEditItem(s);
    setSaveError("");
    setForm({
      name:      s.name      || "",
      phone:     s.phone     || "",
      email:     s.email     || "",
      address:   s.address   || "",
      id_type:   s.id_type   || "PAN",
      id_number: s.id_number || "",
    });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.name.trim()) { setSaveError("Supplier name is required."); return; }
    setSaving(true); setSaveError("");
    try {
      const res = editItem
        ? await api.updateSupplier(editItem.id, form, token)
        : await api.createSupplier(form, token);
      if (res.success) {
        setSuppliers(prev => editItem
          ? prev.map(s => s.id === editItem.id ? res.supplier : s)
          : [res.supplier, ...prev]
        );
        setShowModal(false);
      } else {
        setSaveError(res.message || "Save failed.");
      }
    } catch (e) { setSaveError(e.message || "Network error."); }
    finally { setSaving(false); }
  };

  const remove = async (s) => {
    if (!window.confirm(`Remove "${s.name}" from suppliers?`)) return;
    try {
      await api.deleteSupplier(s.id, token);
      setSuppliers(prev => prev.filter(x => x.id !== s.id));
    } catch (e) { alert("Delete failed: " + e.message); }
  };

  const initials = (name) => name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="fade-in">
      {/* Toolbar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div className="search-wrap">
          <Search className="search-icon" />
          <input
            placeholder="Search by name, phone or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {isCashier && (
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={15} /> Add Supplier
          </button>
        )}
      </div>

      {/* Summary */}
      <div className="grid-3" style={{ marginBottom: 24 }}>
        {[
          { label: "Total Suppliers", value: suppliers.length, color: "var(--amber)" },
          { label: "With Phone",      value: suppliers.filter(s => s.phone).length, color: "var(--green)" },
          { label: "With GST / PAN",  value: suppliers.filter(s => s.id_number).length, color: "var(--blue)" },
        ].map(s => (
          <div className="stat-card" key={s.label}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Supplier Register ({filtered.length})</div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Phone</th>
                <th>Email</th>
                <th>ID Type</th>
                <th>ID Number</th>
                <th>Address</th>
                {isCashier && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={isCashier ? 7 : 6} style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>
                    {search ? "No suppliers match your search" : "No suppliers yet — add your first one"}
                  </td>
                </tr>
              ) : filtered.map(s => (
                <tr key={s.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: "50%",
                        background: "var(--amber-glow)", border: "1px solid var(--amber-border)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontWeight: 700, fontSize: 12, color: "var(--amber)", flexShrink: 0,
                      }}>
                        {initials(s.name)}
                      </div>
                      <span style={{ fontWeight: 600 }}>{s.name}</span>
                    </div>
                  </td>
                  <td className="muted">{s.phone || "—"}</td>
                  <td className="muted">{s.email || "—"}</td>
                  <td>
                    {s.id_type
                      ? <span className="badge badge-pending">{s.id_type}</span>
                      : <span className="muted">—</span>}
                  </td>
                  <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{s.id_number || "—"}</td>
                  <td className="muted" style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.address || "—"}
                  </td>
                  {isCashier && (
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(s)}>
                          <Edit3 size={12} /> Edit
                        </button>
                        {isAdmin && (
                          <button className="btn btn-danger btn-sm" onClick={() => remove(s)}>
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              {editItem ? "Edit Supplier" : "Add New Supplier"}
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}><X size={14} /></button>
            </div>

            {saveError && (
              <div className="login-error" style={{ marginBottom: 12 }}>
                <AlertCircle size={13} /> {saveError}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Full Name / Business Name *</label>
              <input className="form-input" value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Sharma Metals Ltd" />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input className="form-input" value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  placeholder="+91 98765 43210" />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="supplier@example.com" />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Address</label>
              <input className="form-input" value={form.address}
                onChange={e => setForm({ ...form, address: e.target.value })}
                placeholder="Shop / Area / City" />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">ID Type</label>
                <select className="form-input" value={form.id_type}
                  onChange={e => setForm({ ...form, id_type: e.target.value })}>
                  <option>PAN</option>
                  <option>Aadhaar</option>
                  <option>GSTIN</option>
                  <option>Passport</option>
                  <option>Driving Licence</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">ID Number</label>
                <input className="form-input" value={form.id_number}
                  onChange={e => setForm({ ...form, id_number: e.target.value.toUpperCase() })}
                  placeholder="e.g. ABCDE1234F" />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                <CheckCircle size={14} /> {saving ? "Saving…" : editItem ? "Save Changes" : "Add Supplier"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
// ─── APP SHELL (authenticated) ───────────────────────────────────────────────
function AppShell() {
  const { user, token, logout, isAdmin } = useAuth();
  const [page, setPage] = useState("dashboard");
  const [materials,    setMaterials]    = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [suppliers,    setSuppliers]    = useState([]);
  const [customers,    setCustomers]    = useState([]);
  const [dataLoading,  setDataLoading]  = useState(true);
  const [dataError,    setDataError]    = useState("");

  // ── Load all app data from backend ───────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setDataLoading(true);
    setDataError("");
    try {
      const [mRes, tRes, sRes, cRes] = await Promise.all([
        api.getMaterials(token),
        api.getTransactions(token, { limit: 100 }),
        api.getSuppliers(token),
        api.getCustomers(token),
      ]);
      if (mRes.success) setMaterials(mRes.materials.map(normMaterial));
      if (tRes.success) setTransactions(tRes.transactions.map(normTransaction));
      if (sRes.success) setSuppliers(sRes.suppliers);
      if (cRes.success) setCustomers(cRes.customers);
    } catch (err) {
      setDataError(err.message || "Could not reach backend.");
    } finally {
      setDataLoading(false);
    }
  }, [token]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const addTransaction = (t) => {
    setTransactions(prev => [t, ...prev]);
    api.getMaterials(token)
      .then(r => { if (r.success) setMaterials(r.materials.map(normMaterial)); })
      .catch(() => {});
  };

  const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  const navItems = [
    { id: "dashboard",  label: "Dashboard",            icon: LayoutDashboard },
    { id: "inventory",  label: "Inventory",            icon: Package },
    { id: "buy",        label: "Buy from Customer",    icon: Scale },
    { id: "weighing",   label: "Sell to Buyer",        icon: Scale },
    { id: "payments",   label: "Payments & Invoicing", icon: CreditCard },
    { id: "customers",  label: "Customers",            icon: User },
    { id: "buyers",     label: "Buyers",               icon: Truck },
    ...(isAdmin ? [{ id: "users", label: "Manage Users", icon: Shield }, { id: "whatsapp", label: "WhatsApp Logs", icon: Scale }] : []),
  ];

  const titles = {
    dashboard:  "Overview",
    inventory:  "Inventory & Materials",
    buy:        "Buy from Customer",
    weighing:   "Sell to Buyer",
    payments:   "Payments & Invoicing",
    customers:  "Customers",
    buyers:     "Buyers",
    users:      "Manage Users",
    whatsapp:   "WhatsApp Receipts",
  };

  const lowStockCount = materials.filter(m => m.stock <= m.threshold).length;
  const pendingCount  = transactions.filter(t => t.status === "pending").length;

  return (
    <div className="app">
      <div className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-text">THE SCRAP CO.</div>
          <div className="logo-sub">Scrap Management System</div>
        </div>
        <nav className="nav">
          <div className="nav-section-label">Main</div>
          {navItems.map(item => (
            <div key={item.id} className={`nav-item ${page === item.id ? "active" : ""}`} onClick={() => setPage(item.id)}>
              <item.icon size={16} className="icon" />
              {item.label}
              {item.id === "inventory" && lowStockCount > 0 && (
                <span style={{ marginLeft: "auto", background: "var(--red)", color: "#fff", fontSize: 10, padding: "1px 6px", borderRadius: 10, fontFamily: "'DM Mono', monospace" }}>{lowStockCount}</span>
              )}
              {item.id === "payments" && pendingCount > 0 && (
                <span style={{ marginLeft: "auto", background: "var(--amber)", color: "#000", fontSize: 10, padding: "1px 6px", borderRadius: 10, fontFamily: "'DM Mono', monospace" }}>{pendingCount}</span>
              )}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          v1.0.0 · Feb 2026<br />
          <span style={{ color: "var(--amber)" }}>● </span>System Online
        </div>
      </div>

      <div className="main">
        <div className="topbar">
          <div>
            <div className="topbar-title">{titles[page]}</div>
            <div className="muted" style={{ marginTop: 2 }}>The Scrap Co. Management Platform</div>
          </div>
          <div className="topbar-actions">
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "var(--text-dim)" }}>{today}</div>
            <UserMenu user={user} onLogout={logout} onManageUsers={() => setPage("users")} />
          </div>
        </div>

        <div className="content">
          {dataError && (
            <div className="api-banner" style={{ marginBottom: 16 }}>
              <AlertCircle size={13} /> Backend error: {dataError} —{" "}
              <span style={{ textDecoration: "underline", cursor: "pointer" }} onClick={loadAll}>retry</span>
            </div>
          )}
          {dataLoading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, flexDirection: "column", gap: 16 }}>
              <div className="spinner" />
              <div className="muted">Loading data from backend…</div>
            </div>
          ) : (
            <>
              {page === "dashboard" && <Dashboard transactions={transactions} materials={materials} token={token} />}
              {page === "inventory" && <Inventory materials={materials} setMaterials={setMaterials} token={token} />}
              {page === "buy"       && <BuyFromCustomer materials={materials} customers={customers} setCustomers={setCustomers} onReceiptSaved={() => api.getMaterials(token).then(r => r.success && setMaterials(r.materials.map(normMaterial)))} token={token} />}
              {page === "weighing"  && <WeighingPricing materials={materials} setMaterials={setMaterials} suppliers={suppliers} onTransaction={addTransaction} token={token} />}
              {page === "payments"  && <PaymentsInvoicing transactions={transactions} setTransactions={setTransactions} token={token} />}
              {page === "customers" && <Customers customers={customers} setCustomers={setCustomers} token={token} />}
              {page === "buyers"    && <Suppliers suppliers={suppliers} setSuppliers={setSuppliers} token={token} />}
              {page === "users"     && isAdmin && <ManageUsers />}
              {page === "whatsapp"  && isAdmin && <WhatsAppLogs />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function TheScrapCo() {
  const [demoUser, setDemoUser] = useState(null);

  // Demo mode — skips backend entirely
  useEffect(() => {
    window.__demoLogin = () => {
      setDemoUser({ id: "demo", name: "Demo Admin", email: "demo@thescrapco.in", role: "admin" });
    };
    return () => { delete window.__demoLogin; };
  }, []);

  return (
    <>
      <style>{css}</style>
      <AuthProvider>
        <AuthGate demoUser={demoUser} />
      </AuthProvider>
    </>
  );
}

// ─── AUTH GATE — decides what to render ──────────────────────────────────────
function AuthGate({ demoUser }) {
  const { user, loading } = useAuth();
  const effectiveUser = demoUser || user;

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <div className="muted">Loading The Scrap Co…</div>
      </div>
    );
  }

  if (!effectiveUser) return <LoginScreen />;

  // Inject demo user into context if needed
  if (demoUser && !user) {
    return <AppShellDemo demoUser={demoUser} />;
  }

  return <AppShell />;
}

// Demo shell with no auth context (uses demoUser directly)
function AppShellDemo({ demoUser }) {
  const [page, setPage] = useState("dashboard");
  const [materials, setMaterials]       = useState(MATERIALS);
  const [transactions, setTransactions] = useState(INITIAL_TRANSACTIONS);
  const addTransaction = (t) => setTransactions(prev => [t, ...prev]);

  const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  const navItems = [
    { id: "dashboard", label: "Dashboard",            icon: LayoutDashboard },
    { id: "inventory", label: "Inventory",            icon: Package },
    { id: "weighing",  label: "Weighing & Pricing",   icon: Scale },
    { id: "payments",  label: "Payments & Invoicing", icon: CreditCard },
    { id: "users",     label: "Manage Users",         icon: User },
  ];

  const titles = { dashboard: "Overview", inventory: "Inventory & Materials", weighing: "Weighing & Pricing", payments: "Payments & Invoicing", users: "Manage Users" };
  const lowStockCount = materials.filter(m => m.stock <= m.threshold).length;
  const pendingCount  = transactions.filter(t => t.status === "pending").length;

  return (
    <div className="app">
      <div className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-text">THE SCRAP CO.</div>
          <div className="logo-sub">Scrap Management System</div>
        </div>
        <nav className="nav">
          <div className="nav-section-label">Main</div>
          {navItems.map(item => (
            <div key={item.id} className={`nav-item ${page === item.id ? "active" : ""}`} onClick={() => setPage(item.id)}>
              <item.icon size={16} className="icon" />
              {item.label}
              {item.id === "inventory" && lowStockCount > 0 && <span style={{ marginLeft: "auto", background: "var(--red)", color: "#fff", fontSize: 10, padding: "1px 6px", borderRadius: 10, fontFamily: "'DM Mono', monospace" }}>{lowStockCount}</span>}
              {item.id === "payments" && pendingCount > 0 && <span style={{ marginLeft: "auto", background: "var(--amber)", color: "#000", fontSize: 10, padding: "1px 6px", borderRadius: 10, fontFamily: "'DM Mono', monospace" }}>{pendingCount}</span>}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">v1.0.0 · Demo Mode<br /><span style={{ color: "var(--amber)" }}>● </span>No Backend</div>
      </div>
      <div className="main">
        <div className="topbar">
          <div>
            <div className="topbar-title">{titles[page]}</div>
            <div className="muted" style={{ marginTop: 2 }}>The Scrap Co. Management Platform · Demo Mode</div>
          </div>
          <div className="topbar-actions">
            <div className="api-banner" style={{ margin: 0, padding: "5px 12px" }}>⚡ Demo Mode</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "var(--text-dim)" }}>{today}</div>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--amber)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, color: "#000" }}>D</div>
          </div>
        </div>
        <div className="content">
          {page === "dashboard" && <Dashboard transactions={transactions} materials={materials} />}
          {page === "inventory" && <Inventory materials={materials} setMaterials={setMaterials} />}
          {page === "weighing"  && <WeighingPricing materials={materials} setMaterials={setMaterials} onTransaction={addTransaction} />}
          {page === "payments"  && <PaymentsInvoicing transactions={transactions} setTransactions={setTransactions} />}
          {page === "users"     && (
            <div className="card">
              <div className="card-title" style={{ marginBottom: 12 }}>Manage Users</div>
              <div className="api-banner"><AlertCircle size={13} /> Connect backend to manage users. Backend is not running in demo mode.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
