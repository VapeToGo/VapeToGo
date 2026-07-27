const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwlhY82z2xK5-qrFY1nLtaGru2f35fibNnm0ql4pR1XditUZ3NFyfEv0woSiKx8u1uYug/exec';
const MASTER_PASSWORD = '123456';

let products = [];
let cart = [];
let currentMerchant = null;
let currentMerchantName = '';
let isMasterAdmin = false;
let merchantsCache = [];
let activeCategory = 'all';

const DEFAULT_PRODUCT_IMG = 'https://images.unsplash.com/photo-1527661591475-527312dd65f5?auto=format&fit=crop&w=400&q=80';

function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  const bgColors = {
    success: 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200',
    error: 'bg-red-950/90 border-red-500/50 text-red-200',
    warning: 'bg-amber-950/90 border-amber-500/50 text-amber-200',
    info: 'bg-gray-900/95 border-amber-500/30 text-gray-100'
  };
  toast.className = `flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-2xl text-xs font-semibold backdrop-blur-md transition-all duration-300 ${bgColors[type] || bgColors.info}`;
  toast.innerHTML = `<span>${escapeHTML(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// دالة تحويل الصورة لرابط آمن أو استخدام الرابط المباشر
function getProductImgUrl(inputElementId) {
  const urlInput = document.getElementById(inputElementId + '-url');
  if (urlInput && urlInput.value.trim() !== '') {
    return urlInput.value.trim();
  }
  return DEFAULT_PRODUCT_IMG;
}

async function loadCloudProducts() {
  try {
    const response = await fetch(`${SCRIPT_URL}?action=getProducts`);
    const data = await response.json();
    products = Array.isArray(data) ? data : [];
    renderStoreProducts(activeCategory);
  } catch (error) {
    products = [];
    renderStoreProducts(activeCategory);
  }
}

function showSection(section) {
  ['store-view', 'admin-view', 'track-view'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  if (section === 'store') {
    document.getElementById('store-view').classList.remove('hidden');
    loadCloudProducts();
  } else if (section === 'admin') {
    document.getElementById('admin-view').classList.remove('hidden');
    if (isMasterAdmin) renderMasterPanel();
    else if (currentMerchant) renderMerchantPanel();
    else showLoginCard();
  } else if (section === 'track') {
    document.getElementById('track-view').classList.remove('hidden');
  }
}

function renderStoreProducts(filterCat = 'all') {
  activeCategory = filterCat;
  const grid = document.getElementById('products-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const filtered = filterCat === 'all' ? products : products.filter(p => (p.category || '').trim().toLowerCase() === filterCat.trim().toLowerCase());

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="col-span-full text-center py-12 text-gray-500 text-xs">لا توجد منتجات متاحة.</div>`;
    return;
  }

  filtered.forEach(p => {
    grid.innerHTML += `
      <div class="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-lg flex flex-col justify-between">
        <div>
          <div class="h-44 bg-gray-800 relative">
            <img src="${escapeHTML(p.img || DEFAULT_PRODUCT_IMG)}" onerror="this.src='${DEFAULT_PRODUCT_IMG}'" class="w-full h-full object-cover">
          </div>
          <div class="p-3.5 space-y-1">
            <h3 class="font-bold text-xs text-gray-100 line-clamp-1">${escapeHTML(p.name)}</h3>
            <p class="text-[10px] text-gray-400 line-clamp-2">${escapeHTML(p.desc)}</p>
          </div>
        </div>
        <div class="p-3.5 pt-0 flex items-center justify-between">
          <span class="text-sm font-extrabold text-amber-400">${escapeHTML(p.price)} ج.م</span>
          <button onclick="addToCart('${escapeHTML(p.id)}')" class="bg-amber-500 hover:bg-amber-400 text-black px-3 py-1.5 rounded-lg text-xs font-bold">إضافة للسلة</button>
        </div>
      </div>
    `;
  });
}

function addToCart(productId) {
  const prod = products.find(p => String(p.id) === String(productId));
  if (!prod) return;
  const existing = cart.find(item => String(item.id) === String(productId));
  if (existing) existing.qty = (existing.qty || 1) + 1;
  else cart.push({ ...prod, qty: 1 });
  updateCartUI();
  toggleCart(true);
  showToast('تمت الإضافة للسلة', 'success');
}

function updateCartQty(productId, delta) {
  const item = cart.find(i => String(i.id) === String(productId));
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter(i => String(i.id) !== String(productId));
  updateCartUI();
}

function removeFromCart(id) {
  cart = cart.filter(i => String(i.id) !== String(id));
  updateCartUI();
}

function updateCartUI() {
  const cartContainer = document.getElementById('cart-items');
  const countSpan = document.getElementById('cart-count');
  const totalSpan = document.getElementById('cart-total-price');
  if (!cartContainer) return;
  countSpan.innerText = cart.reduce((acc, i) => acc + i.qty, 0);

  if (cart.length === 0) {
    cartContainer.innerHTML = `<div class="text-center py-12 text-gray-500 text-xs">السلة فارغة</div>`;
    totalSpan.innerText = '0 ج.م';
    return;
  }

  let total = 0;
  cartContainer.innerHTML = cart.map(item => {
    total += Number(item.price) * item.qty;
    return `
      <div class="flex items-center justify-between bg-gray-800/50 p-3 rounded-xl text-xs">
        <div>
          <div class="font-bold text-gray-100">${escapeHTML(item.name)}</div>
          <div class="text-amber-400">${item.price} ج.م</div>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="updateCartQty('${item.id}', -1)" class="px-2 bg-gray-900 rounded">-</button>
          <span>${item.qty}</span>
          <button onclick="updateCartQty('${item.id}', 1)" class="px-2 bg-gray-900 rounded">+</button>
          <button onclick="removeFromCart('${item.id}')" class="text-red-400">حذف</button>
        </div>
      </div>
    `;
  }).join('');
  totalSpan.innerText = `${total} ج.م`;
}

function toggleCart(forceOpen = false) {
  const drawer = document.getElementById('cart-drawer');
  if (forceOpen) drawer.classList.remove('hidden');
  else drawer.classList.toggle('hidden');
  updateCartUI();
}

function openCheckoutModal() {
  if (cart.length === 0) return showToast('السلة فارغة', 'warning');
  toggleCart(false);
  document.getElementById('checkout-modal').classList.remove('hidden');
}

function closeCheckoutModal() {
  document.getElementById('checkout-modal').classList.add('hidden');
}

async function submitOrder(event) {
  event.preventDefault();
  const name = document.getElementById('cust-name').value.trim();
  const phone = document.getElementById('cust-phone').value.trim();
  const address = document.getElementById('cust-address').value.trim();

  let total = 0;
  let itemsText = cart.map(i => {
    total += Number(i.price) * i.qty;
    return `${i.name} (×${i.qty})`;
  }).join(', ');

  const merchantKey = cart[0]?.merchant || 'admin';

  try {
    const formData = new FormData();
    formData.append('action', 'saveOrder');
    formData.append('custName', name);
    formData.append('custPhone', phone);
    formData.append('custAddress', address);
    formData.append('items', itemsText);
    formData.append('total', total);
    formData.append('merchant', merchantKey);

    const response = await fetch(SCRIPT_URL, { method: 'POST', body: formData });
    const res = await response.json();

    if (res.status === 'success') {
      showToast(`تم إرسال الطلب بنجاح! رقم الطلب: ${res.orderId}`, 'success');
      cart = [];
      closeCheckoutModal();
      updateCartUI();
    } else {
      showToast('فشل حفظ الطلب', 'error');
    }
  } catch (e) {
    showToast('حدث خطأ بالاتصال', 'error');
  }
}

// 🔍 تتبع الطلبات
async function trackOrder() {
  const query = document.getElementById('track-input').value.trim();
  const resultBox = document.getElementById('track-result');
  if (!query) return showToast('أدخل رقم الهاتف أو رقم الطلب', 'warning');

  resultBox.innerHTML = `<div class="text-center py-4 text-gray-400"><i class="fa-solid fa-spinner fa-spin"></i> جاري البحث...</div>`;

  try {
    const response = await fetch(`${SCRIPT_URL}?action=getOrders`);
    const orders = await response.json();
    const found = orders.filter(o => String(o.custPhone) === query || String(o.orderId).toLowerCase() === query.toLowerCase());

    if (found.length === 0) {
      resultBox.innerHTML = `<div class="text-center py-4 text-red-400 text-xs">لم يتم العثور على أي طلبات مطابقة.</div>`;
      return;
    }

    resultBox.innerHTML = found.map(o => `
      <div class="bg-black border border-gray-800 p-4 rounded-xl space-y-2 text-xs">
        <div class="flex justify-between font-bold text-amber-400">
          <span>رقم الطلب: ${escapeHTML(o.orderId)}</span>
          <span class="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded">${escapeHTML(o.status)}</span>
        </div>
        <div class="text-gray-300">المنتجات: ${escapeHTML(o.items)}</div>
        <div class="text-gray-400">الإجمالي: ${escapeHTML(o.total)} ج.م</div>
        <div class="text-[10px] text-gray-500">التاريخ: ${escapeHTML(o.date)}</div>
      </div>
    `).join('');
  } catch (e) {
    resultBox.innerHTML = `<div class="text-center py-4 text-red-400 text-xs">حدث خطأ في الاتصال.</div>`;
  }
}

// 🔐 Login & Admin Systems
function showLoginCard() {
  document.getElementById('admin-login-card').classList.remove('hidden');
  document.getElementById('master-panel').classList.add('hidden');
  document.getElementById('merchant-panel').classList.add('hidden');
}

function switchLoginTab(tab) {
  const usernameField = document.getElementById('login-username');
  if (tab === 'admin') {
    usernameField.classList.add('hidden');
    usernameField.value = '';
    document.getElementById('login-password').placeholder = 'كلمة سر الأدمن الرئيسي';
  } else {
    usernameField.classList.remove('hidden');
    document.getElementById('login-password').placeholder = 'كلمة المرور';
  }
}

async function loginAdmin(event) {
  event.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;

  if (!username) {
    if (password === MASTER_PASSWORD) {
      isMasterAdmin = true;
      currentMerchant = null;
      showToast('مرحباً بالأدمن الرئيسي', 'success');
      renderMasterPanel();
    } else {
      showToast('كلمة السر غير صحيحة', 'error');
    }
    return;
  }

  try {
    const res = await fetch(`${SCRIPT_URL}?action=loginMerchant&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`);
    const data = await res.json();
    if (data.status === 'success') {
      isMasterAdmin = false;
      currentMerchant = data.username;
      currentMerchantName = data.merchantName;
      showToast(`أهلاً بك يا ${currentMerchantName}`, 'success');
      renderMerchantPanel();
    } else {
      showToast('بيانات الدخول غير صحيحة', 'error');
    }
  } catch (e) {
    showToast('خطأ في الاتصال', 'error');
  }
}

function logoutAdmin() {
  isMasterAdmin = false;
  currentMerchant = null;
  showLoginCard();
  showToast('تم تسجيل الخروج', 'info');
}

async function renderMasterPanel() {
  document.getElementById('admin-login-card').classList.add('hidden');
  document.getElementById('master-panel').classList.remove('hidden');
  
  // جلب التجار والأوردرات للأدمن
  try {
    const mRes = await fetch(`${SCRIPT_URL}?action=getMerchants&masterPassword=${MASTER_PASSWORD}`);
    merchantsCache = await mRes.json();
    
    const oRes = await fetch(`${SCRIPT_URL}?action=getOrders`);
    const orders = await oRes.json();

    const filterSelect = document.getElementById('admin-sales-merchant-filter');
    filterSelect.innerHTML = `<option value="all">كل المبيعات والأوردرات (الكل)</option>` + 
      merchantsCache.map(m => `<option value="${m.username}">${m.merchantName}</option>`).join('');

    renderAdminOrdersTable(orders, 'all');
  } catch (e) {
    console.error(e);
  }
}

function filterAdminOrders(merchantVal) {
  fetch(`${SCRIPT_URL}?action=getOrders`)
    .then(res => res.json())
    .then(orders => renderAdminOrdersTable(orders, merchantVal));
}

function renderAdminOrdersTable(orders, merchantFilter) {
  const tableBody = document.getElementById('admin-orders-table-body');
  const totalSalesEl = document.getElementById('admin-total-sales-val');
  
  let filtered = orders;
  if (merchantFilter !== 'all') {
    filtered = orders.filter(o => String(o.merchant) === String(merchantFilter));
  }

  let totalRevenue = filtered.reduce((acc, o) => acc + Number(o.total || 0), 0);
  if (totalSalesEl) totalSalesEl.innerText = `${totalRevenue} ج.م`;

  if (!tableBody) return;
  if (filtered.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-gray-500">لا توجد أوردرات.</td></tr>`;
    return;
  }

  tableBody.innerHTML = filtered.map(o => `
    <tr class="border-b border-gray-800">
      <td class="p-3">${escapeHTML(o.orderId)}</td>
      <td class="p-3">${escapeHTML(o.custName)} (${escapeHTML(o.custPhone)})</td>
      <td class="p-3">${escapeHTML(o.items)}</td>
      <td class="p-3 text-amber-400">${escapeHTML(o.total)} ج.م</td>
      <td class="p-3">${escapeHTML(o.date)}</td>
    </tr>
  `).join('');
}

async function renderMerchantPanel() {
  document.getElementById('admin-login-card').classList.add('hidden');
  document.getElementById('merchant-panel').classList.remove('hidden');
  document.getElementById('merchant-display-name').innerText = currentMerchantName;

  try {
    const res = await fetch(`${SCRIPT_URL}?action=getOrders`);
    const orders = await res.json();
    const myOrders = orders.filter(o => String(o.merchant) === String(currentMerchant));
    
    let totalSales = myOrders.reduce((acc, o) => acc + Number(o.total || 0), 0);
    document.getElementById('merchant-total-sales').innerText = `${totalSales} ج.م`;
    document.getElementById('merchant-orders-count').innerText = myOrders.length;
  } catch (e) {}
}

async function addNewProductAsAdmin(event) {
  event.preventDefault();
  const name = document.getElementById('admin-p-name').value.trim();
  const price = document.getElementById('admin-p-price').value;
  const category = document.getElementById('admin-p-category').value.trim() || 'عام';
  const desc = document.getElementById('admin-p-desc').value.trim();
  const imgUrl = getProductImgUrl('admin-p-img');

  try {
    const formData = new FormData();
    formData.append('action', 'addProduct');
    formData.append('name', name);
    formData.append('price', price);
    formData.append('category', category);
    formData.append('img', imgUrl);
    formData.append('desc', desc);
    formData.append('merchant', document.getElementById('admin-p-merchant')?.value || '');

    const res = await fetch(SCRIPT_URL, { method: 'POST', body: formData });
    const result = await res.json();
    if (result.status === 'success') {
      showToast('تم حفظ المنتج بنجاح', 'success');
      event.target.reset();
    } else {
      showToast('فشل حفظ المنتج', 'error');
    }
  } catch (e) {
    showToast('خطأ في الاتصال', 'error');
  }
}

async function addNewProduct(event) {
  event.preventDefault();
  const name = document.getElementById('new-p-name').value.trim();
  const price = document.getElementById('new-p-price').value;
  const category = document.getElementById('new-p-category').value.trim() || 'عام';
  const desc = document.getElementById('new-p-desc').value.trim();
  const imgUrl = getProductImgUrl('new-p-img');

  try {
    const formData = new FormData();
    formData.append('action', 'addProduct');
    formData.append('name', name);
    formData.append('price', price);
    formData.append('category', category);
    formData.append('img', imgUrl);
    formData.append('desc', desc);
    formData.append('merchant', currentMerchant);

    const res = await fetch(SCRIPT_URL, { method: 'POST', body: formData });
    const result = await res.json();
    if (result.status === 'success') {
      showToast('تم اضافة المنتج لمتجرك بنجاح', 'success');
      event.target.reset();
    } else {
      showToast('فشل الحفظ', 'error');
    }
  } catch (e) {
    showToast('خطأ بالاتصال', 'error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadCloudProducts();
});
