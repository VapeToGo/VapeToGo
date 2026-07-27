// ======================================================
// 🚀 VapeToGo - Modern E-Commerce & Management System
// ======================================================

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwlhY82z2xK5-qrFY1nLtaGru2f35fibNnm0ql4pR1XditUZ3NFyfEv0woSiKx8u1uYug/exec';

// State Management
let products = [];
let cart = [];
let currentMerchant = null;
let currentMerchantName = '';
let isMasterAdmin = false;
let masterPasswordInput = ''; // Stored in session memory upon successful login
let merchantsCache = [];
let activeCategory = 'all';

// Default Fallback Image
const DEFAULT_PRODUCT_IMG = 'https://images.unsplash.com/photo-1527661591475-527312dd65f5?auto=format&fit=crop&w=400&q=80';

// ======================================================
// 🛡️ Security & Utility Helpers
// ======================================================

/**
 * Escape HTML to prevent Cross-Site Scripting (XSS)
 */
function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Toast Notification System
 */
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

  const icons = {
    success: '<i class="fa-solid fa-circle-check text-emerald-400"></i>',
    error: '<i class="fa-solid fa-triangle-exclamation text-red-400"></i>',
    warning: '<i class="fa-solid fa-circle-exclamation text-amber-400"></i>',
    info: '<i class="fa-solid fa-circle-info text-amber-400"></i>'
  };

  toast.className = `flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-2xl text-xs font-semibold backdrop-blur-md transition-all duration-300 transform translate-y-2 opacity-0 ${bgColors[type] || bgColors.info}`;
  toast.innerHTML = `${icons[type] || icons.info} <span>${escapeHTML(message)}</span>`;

  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  // Auto remove after 3.5s
  setTimeout(() => {
    toast.classList.add('opacity-0', '-translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ======================================================
// 🛍️ Store Front & Products API
// ======================================================

/**
 * Load products from Google Apps Script
 */
async function loadCloudProducts() {
  const grid = document.getElementById('products-grid');
  if (grid && products.length === 0) {
    grid.innerHTML = renderSkeletonGrid();
  }

  try {
    const response = await fetch(`${SCRIPT_URL}?action=getProducts`);
    if (!response.ok) throw new Error('خطأ في الاتصال بالخادم');
    const data = await response.json();
    products = Array.isArray(data) ? data : [];
    renderStoreProducts(activeCategory);
  } catch (error) {
    console.error('خطأ في جلب المنتجات:', error);
    showToast('تعذر تحميل المنتجات. يرجى محاولة التحديث.', 'error');
    if (grid) {
      grid.innerHTML = `<div class="col-span-full text-center py-12 text-red-400 text-xs flex flex-col items-center gap-2">
        <i class="fa-solid fa-triangle-exclamation text-2xl"></i>
        <span>فشل تحميل المنتجات من السحابة.</span>
        <button onclick="loadCloudProducts()" class="mt-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-1.5 rounded-xl border border-gray-700 text-xs">إعادة المحاولة</button>
      </div>`;
    }
  }
}

/**
 * Skeleton Loader HTML for store products grid
 */
function renderSkeletonGrid() {
  return Array(4).fill(0).map(() => `
    <div class="bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden animate-pulse">
      <div class="h-44 bg-gray-800/80"></div>
      <div class="p-3.5 space-y-2">
        <div class="h-3 bg-gray-800 rounded w-3/4"></div>
        <div class="h-2.5 bg-gray-800/60 rounded w-1/2"></div>
      </div>
      <div class="p-3.5 pt-0 flex justify-between items-center">
        <div class="h-4 bg-gray-800 rounded w-1/4"></div>
        <div class="h-7 bg-gray-800 rounded-lg w-20"></div>
      </div>
    </div>
  `).join('');
}

/**
 * Switch view section (store vs admin)
 */
function showSection(section) {
  const storeView = document.getElementById('store-view');
  const adminView = document.getElementById('admin-view');

  storeView.classList.add('hidden');
  adminView.classList.add('hidden');

  if (section === 'store') {
    storeView.classList.remove('hidden');
    loadCloudProducts();
  } else if (section === 'admin') {
    adminView.classList.remove('hidden');
    if (isMasterAdmin) {
      renderMasterPanel();
    } else if (currentMerchant) {
      renderMerchantPanel();
    } else {
      showLoginCard();
    }
  }
}

/**
 * Render Store Products with Security & Category Filtering
 */
function renderStoreProducts(filterCat = 'all') {
  activeCategory = filterCat;
  const grid = document.getElementById('products-grid');
  if (!grid) return;

  grid.innerHTML = '';

  const filtered = filterCat === 'all' 
    ? products 
    : products.filter(p => (p.category || '').trim().toLowerCase() === filterCat.trim().toLowerCase());

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="col-span-full text-center py-12 text-gray-500 text-xs">لا توجد منتجات متاحة في هذا القسم حالياً.</div>`;
    renderCategories();
    return;
  }

  filtered.forEach(p => {
    const safeName = escapeHTML(p.name);
    const safeDesc = escapeHTML(p.desc || '');
    const safeCategory = escapeHTML(p.category || 'عام');
    const safePrice = escapeHTML(p.price);
    const safeImg = escapeHTML(p.img || DEFAULT_PRODUCT_IMG);
    const safeId = escapeHTML(p.id);

    grid.innerHTML += `
      <div class="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-lg flex flex-col justify-between hover:border-amber-500/40 transition-all duration-300 group">
        <div>
          <div class="h-44 bg-gray-800/80 overflow-hidden relative">
            <img src="${safeImg}" alt="${safeName}" onerror="this.src='${DEFAULT_PRODUCT_IMG}'" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
            <span class="absolute top-2 right-2 bg-black/70 backdrop-blur-md text-amber-400 text-[10px] font-bold px-2.5 py-0.5 rounded-md border border-amber-500/20">${safeCategory}</span>
          </div>
          <div class="p-3.5 space-y-1.5">
            <h3 class="font-bold text-xs text-gray-100 line-clamp-1">${safeName}</h3>
            <p class="text-[10px] text-gray-400 line-clamp-2">${safeDesc}</p>
          </div>
        </div>
        <div class="p-3.5 pt-0 flex items-center justify-between gap-2">
          <span class="text-sm font-extrabold text-amber-400">${safePrice} <span class="text-[10px]">ج.م</span></span>
          <button onclick="addToCart('${safeId}')" class="bg-amber-500 hover:bg-amber-400 text-black px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-1">
            <i class="fa-solid fa-plus text-[10px]"></i>
            <span>إضافة للسلة</span>
          </button>
        </div>
      </div>
    `;
  });

  renderCategories();
}

/**
 * Dynamic Categories Navigation Bar
 */
function renderCategories() {
  const rawCats = products.map(p => (p.category || '').trim()).filter(Boolean);
  const categories = ['all', ...new Set(rawCats)];
  const container = document.getElementById('category-filters');
  if (!container) return;

  container.innerHTML = categories.map(cat => {
    const isSelected = activeCategory.toLowerCase() === cat.toLowerCase();
    const displayName = cat === 'all' ? 'الكل' : escapeHTML(cat);
    const activeClass = isSelected 
      ? 'bg-amber-500 text-black font-bold border-amber-500 shadow-lg shadow-amber-500/10' 
      : 'bg-gray-900 hover:bg-gray-800 text-gray-300 border-gray-800 hover:border-gray-700';

    return `
      <button onclick="renderStoreProducts('${escapeHTML(cat)}')" class="${activeClass} text-xs px-4 py-2 rounded-xl whitespace-nowrap border transition-all duration-200">
        ${displayName}
      </button>
    `;
  }).join('');
}

// ======================================================
// 🛒 Cart Operations
// ======================================================

function addToCart(productId) {
  const prod = products.find(p => String(p.id) === String(productId));
  if (!prod) return;

  const existing = cart.find(item => String(item.id) === String(productId));
  if (existing) {
    existing.qty = (existing.qty || 1) + 1;
  } else {
    cart.push({ ...prod, qty: 1 });
  }

  updateCartUI();
  toggleCart(true);
  showToast(`تمت إضافة "${prod.name}" للسلة`, 'success');
}

function updateCartQty(productId, delta) {
  const item = cart.find(i => String(i.id) === String(productId));
  if (!item) return;

  item.qty = (Number(item.qty) || 1) + delta;
  if (item.qty <= 0) {
    removeFromCart(productId);
  } else {
    updateCartUI();
  }
}

function removeFromCart(id) {
  const item = cart.find(i => String(i.id) === String(id));
  cart = cart.filter(i => String(i.id) !== String(id));
  updateCartUI();
  if (item) showToast(`تم إزالة "${item.name}" من السلة`, 'info');
}

function updateCartUI() {
  const cartContainer = document.getElementById('cart-items');
  const countSpan = document.getElementById('cart-count');
  const totalSpan = document.getElementById('cart-total-price');
  if (!cartContainer) return;

  const totalCount = cart.reduce((acc, item) => acc + (Number(item.qty) || 1), 0);
  countSpan.innerText = totalCount;

  if (cart.length === 0) {
    cartContainer.innerHTML = `
      <div class="text-center py-12 space-y-2 text-gray-500">
        <i class="fa-solid fa-basket-shopping text-3xl text-gray-700"></i>
        <p class="text-xs">السلة فارغة حالياً.</p>
      </div>`;
    totalSpan.innerText = '0 ج.م';
    return;
  }

  let total = 0;
  cartContainer.innerHTML = cart.map(item => {
    const itemPrice = Number(item.price) || 0;
    const itemQty = Number(item.qty) || 1;
    const subtotal = itemPrice * itemQty;
    total += subtotal;

    const safeName = escapeHTML(item.name);
    const safeImg = escapeHTML(item.img || DEFAULT_PRODUCT_IMG);
    const safeId = escapeHTML(item.id);

    return `
      <div class="flex items-center justify-between bg-gray-800/50 p-3 rounded-2xl border border-gray-800/80 text-xs">
        <div class="flex items-center gap-3">
          <img src="${safeImg}" alt="${safeName}" onerror="this.src='${DEFAULT_PRODUCT_IMG}'" class="w-11 h-11 object-cover rounded-xl border border-gray-700/50">
          <div>
            <div class="font-bold text-gray-100">${safeName}</div>
            <div class="text-amber-400 font-extrabold mt-0.5">${itemPrice} ج.م</div>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <div class="flex items-center bg-gray-900 rounded-lg border border-gray-700/60 p-0.5">
            <button onclick="updateCartQty('${safeId}', -1)" class="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white rounded hover:bg-gray-800 transition-all">-</button>
            <span class="px-2 font-bold text-gray-200 text-xs">${itemQty}</span>
            <button onclick="updateCartQty('${safeId}', 1)" class="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white rounded hover:bg-gray-800 transition-all">+</button>
          </div>
          <button onclick="removeFromCart('${safeId}')" class="text-red-400 hover:text-red-300 p-1.5 rounded-lg hover:bg-red-500/10 transition-all" title="حذف">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');

  totalSpan.innerText = `${total} ج.م`;
}

function toggleCart(forceOpen = false) {
  const drawer = document.getElementById('cart-drawer');
  if (!drawer) return;

  if (forceOpen) {
    drawer.classList.remove('hidden');
    drawer.classList.add('flex');
  } else {
    drawer.classList.toggle('hidden');
    drawer.classList.toggle('flex');
  }
  updateCartUI();
}

function openCheckoutModal() {
  if (cart.length === 0) {
    showToast('السلة فارغة! أضف منتجات أولاً.', 'warning');
    return;
  }
  toggleCart(false);
  const modal = document.getElementById('checkout-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeCheckoutModal() {
  const modal = document.getElementById('checkout-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

/**
 * Submit Order & Send formatted message via WhatsApp
 */
function submitOrder(event) {
  if (event) event.preventDefault();

  const name = document.getElementById('cust-name').value.trim();
  const phone = document.getElementById('cust-phone').value.trim();
  const address = document.getElementById('cust-address').value.trim();

  if (!name || !phone || !address) {
    showToast('يرجى ملء جميع بيانات الشحن (الاسم، الهاتف، العنوان)!', 'warning');
    return;
  }

  if (cart.length === 0) {
    showToast('السلة فارغة!', 'warning');
    return;
  }

  // Format WhatsApp Order Message
  let total = 0;
  let itemsText = cart.map((item, idx) => {
    const qty = Number(item.qty) || 1;
    const price = Number(item.price) || 0;
    const itemTotal = qty * price;
    total += itemTotal;
    return `${idx + 1}. *${item.name}* \n   الكمية: ${qty} × ${price} ج.م = *${itemTotal} ج.م*`;
  }).join('\n\n');

  const message = `🛍️ *طلب شراء جديد من متجر VapeToGo*\n` +
    `----------------------------------------\n` +
    `👤 *بيانات العميل:*\n` +
    `• الاسم: ${name}\n` +
    `• الهاتف: ${phone}\n` +
    `• العنوان: ${address}\n\n` +
    `📦 *المنتجات المطلوبة:*\n${itemsText}\n` +
    `----------------------------------------\n` +
    `💰 *الإجمالي الكلي:* *${total} ج.م*\n` +
    `📅 *التاريخ:* ${new Date().toLocaleString('ar-EG')}`;

  const encodedMsg = encodeURIComponent(message);
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodedMsg}`;

  // Open WhatsApp in new tab
  window.open(whatsappUrl, '_blank');

  showToast(`🎉 شكراً ${name}! تم تجهيز طلبك وسيتم إرساله عبر الواتساب.`, 'success');

  // Reset cart and close modal
  cart = [];
  closeCheckoutModal();
  updateCartUI();

  // Clear form fields
  document.getElementById('cust-name').value = '';
  document.getElementById('cust-phone').value = '';
  document.getElementById('cust-address').value = '';
}

// ======================================================
// 🔐 Admin & Merchant Authentication Logic
// ======================================================

function showLoginCard() {
  document.getElementById('admin-login-card').classList.remove('hidden');
  document.getElementById('master-panel').classList.add('hidden');
  document.getElementById('merchant-panel').classList.add('hidden');
}

async function loginAdmin(event) {
  if (event) event.preventDefault();

  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const loginBtn = document.getElementById('login-submit-btn');

  if (!password) {
    showToast('يرجى إدخال كلمة المرور!', 'warning');
    return;
  }

  // Set Button Loading State
  if (loginBtn) {
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري التحقق...';
  }

  try {
    // If username is empty, attempt Master Admin Login via Apps Script API
    const authUrl = !username 
      ? `${SCRIPT_URL}?action=getMerchants&masterPassword=${encodeURIComponent(password)}`
      : `${SCRIPT_URL}?action=loginMerchant&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;

    const response = await fetch(authUrl);
    const result = await response.json();

    if (!username) {
      if (Array.isArray(result)) {
        isMasterAdmin = true;
        masterPasswordInput = password; // Save password in session for master admin API calls
        currentMerchant = null;
        merchantsCache = result;
        showToast('تم تسجيل الدخول كأدمن رئيسي بنجاح', 'success');
        document.getElementById('login-username').value = '';
        document.getElementById('login-password').value = '';
        renderMasterPanel();
      } else {
        showToast('كلمة سر الأدمن الرئيسي غير صحيحة!', 'error');
      }
    } else {
      if (result.status === 'success') {
        isMasterAdmin = false;
        masterPasswordInput = '';
        currentMerchant = result.username;
        currentMerchantName = result.merchantName || result.username;
        showToast(`أهلاً بك، ${currentMerchantName}!`, 'success');
        document.getElementById('login-username').value = '';
        document.getElementById('login-password').value = '';
        renderMerchantPanel();
      } else if (result.status === 'held') {
        showToast('⛔ حسابك موقوف مؤقتاً، يرجى التواصل مع الإدارة.', 'error');
      } else {
        showToast('بيانات الدخول غير صحيحة!', 'error');
      }
    }
  } catch (error) {
    console.error('خطأ في تسجيل الدخول:', error);
    showToast('حدث خطأ أثناء الاتصال بالسيرفر!', 'error');
  } finally {
    if (loginBtn) {
      loginBtn.disabled = false;
      loginBtn.innerHTML = 'دخول';
    }
  }
}

function logoutAdmin() {
  isMasterAdmin = false;
  masterPasswordInput = '';
  currentMerchant = null;
  currentMerchantName = '';
  showLoginCard();
  showToast('تم تسجيل الخروج بنجاح', 'info');
}

// ======================================================
// 👑 Master Admin Functions
// ======================================================

function renderMasterPanel() {
  document.getElementById('admin-login-card').classList.add('hidden');
  document.getElementById('merchant-panel').classList.add('hidden');
  document.getElementById('master-panel').classList.remove('hidden');
  loadMerchantsList();
}

async function loadMerchantsList() {
  const tableBody = document.getElementById('merchants-table-body');
  if (tableBody) {
    tableBody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-gray-500"><i class="fa-solid fa-spinner fa-spin"></i> جاري تحميل قائمة التجار...</td></tr>`;
  }

  try {
    const response = await fetch(`${SCRIPT_URL}?action=getMerchants&masterPassword=${encodeURIComponent(masterPasswordInput)}`);
    const data = await response.json();
    merchantsCache = Array.isArray(data) ? data : [];

    if (tableBody) {
      if (merchantsCache.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-gray-500">لا يوجد تجار حالياً.</td></tr>`;
      } else {
        tableBody.innerHTML = merchantsCache.map(m => {
          const isHeld = m.status === 'hold';
          const safeName = escapeHTML(m.merchantName);
          const safeUser = escapeHTML(m.username);

          return `
            <tr class="hover:bg-gray-800/40 border-b border-gray-800/60">
              <td class="p-3 font-bold text-gray-200">${safeName}</td>
              <td class="p-3 text-gray-300">${safeUser}</td>
              <td class="p-3">
                <span class="px-2.5 py-1 rounded-md text-[10px] font-bold border ${isHeld ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'}">
                  ${isHeld ? 'موقوف' : 'نشط'}
                </span>
              </td>
              <td class="p-3 flex flex-wrap gap-2">
                <button onclick="toggleMerchantHold('${safeUser}')" class="px-2.5 py-1 rounded text-[10px] font-bold transition-all ${isHeld ? 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white' : 'bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600 hover:text-white'}">
                  ${isHeld ? 'تفعيل' : 'تعليق'}
                </button>
                <button onclick="deleteMerchantAdmin('${safeUser}')" class="bg-red-600/20 text-red-400 px-2.5 py-1 rounded hover:bg-red-600 hover:text-white transition-all text-[10px] font-bold">
                  حذف
                </button>
              </td>
            </tr>`;
        }).join('');
      }
    }

    const options = merchantsCache.map(m => `<option value="${escapeHTML(m.username)}">${escapeHTML(m.merchantName)} (${escapeHTML(m.username)})</option>`).join('');
    const selectMerchant = document.getElementById('admin-p-merchant');
    const selectFilter = document.getElementById('admin-merchant-filter');

    if (selectMerchant) selectMerchant.innerHTML = options || '<option value="">لا يوجد تجار</option>';
    if (selectFilter) selectFilter.innerHTML = `<option value="all">كل التجار</option>${options}`;

    loadAllProductsAdmin('all');
  } catch (error) {
    console.error('خطأ في جلب التجار:', error);
    showToast('فشل تحميل قائمة التجار', 'error');
  }
}

async function addNewMerchant(event) {
  if (event) event.preventDefault();

  const merchantName = document.getElementById('new-m-name').value.trim();
  const username = document.getElementById('new-m-username').value.trim();
  const password = document.getElementById('new-m-password').value;

  if (!merchantName || !username || !password) {
    showToast('يرجى ملء كافة بيانات التاجر!', 'warning');
    return;
  }

  try {
    const url = `${SCRIPT_URL}?action=addMerchant&masterPassword=${encodeURIComponent(masterPasswordInput)}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&merchantName=${encodeURIComponent(merchantName)}`;
    const response = await fetch(url);
    const result = await response.json();

    if (result.status === 'success') {
      showToast('✅ تم إنشاء حساب التاجر بنجاح!', 'success');
      document.getElementById('new-m-name').value = '';
      document.getElementById('new-m-username').value = '';
      document.getElementById('new-m-password').value = '';
      loadMerchantsList();
    } else {
      showToast(result.message || 'فشل إنشاء الحساب!', 'error');
    }
  } catch (error) {
    console.error('خطأ إضافة تاجر:', error);
    showToast('حدث خطأ أثناء الاتصال بالخادم!', 'error');
  }
}

async function toggleMerchantHold(username) {
  if (!confirm(`هل تريد تغيير حالة التاجر (${username})؟`)) return;
  try {
    const response = await fetch(`${SCRIPT_URL}?action=toggleMerchantStatus&masterPassword=${encodeURIComponent(masterPasswordInput)}&username=${encodeURIComponent(username)}`);
    const result = await response.json();
    if (result.status === 'success') {
      showToast('تم تغيير حالة التاجر بنجاح', 'success');
      loadMerchantsList();
    } else {
      showToast('فشلت العملية!', 'error');
    }
  } catch (error) {
    showToast('حدث خطأ أثناء الاتصال بالخادم!', 'error');
  }
}

async function deleteMerchantAdmin(username) {
  if (!confirm(`تحذير: حذف التاجر (${username}) سيؤدي لحذف حسابه وكافة منتجاته. هل أنت متأكد؟`)) return;
  try {
    const response = await fetch(`${SCRIPT_URL}?action=deleteMerchant&masterPassword=${encodeURIComponent(masterPasswordInput)}&username=${encodeURIComponent(username)}`);
    const result = await response.json();
    if (result.status === 'deleted') {
      showToast('تم حذف التاجر بنجاح', 'info');
      loadMerchantsList();
    } else {
      showToast(result.message || 'فشل الحذف!', 'error');
    }
  } catch (error) {
    showToast('حدث خطأ أثناء الاتصال بالخادم!', 'error');
  }
}

async function loadAllProductsAdmin(merchantFilter = 'all') {
  const tableBody = document.getElementById('admin-all-products-table-body');
  if (tableBody) {
    tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-gray-500"><i class="fa-solid fa-spinner fa-spin"></i> جاري جلب المنتجات...</td></tr>`;
  }

  try {
    const url = merchantFilter === 'all'
      ? `${SCRIPT_URL}?action=getProducts&all=1`
      : `${SCRIPT_URL}?action=getProducts&merchant=${encodeURIComponent(merchantFilter)}`;
    const response = await fetch(url);
    const data = await response.json();
    const list = Array.isArray(data) ? data : [];

    const nameByUsername = {};
    merchantsCache.forEach(m => { nameByUsername[m.username] = m.merchantName; });

    if (tableBody) {
      if (list.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-gray-500">لا توجد منتجات لهذه التصفية.</td></tr>`;
      } else {
        tableBody.innerHTML = list.map(p => {
          const safeName = escapeHTML(p.name);
          const safeCat = escapeHTML(p.category || '-');
          const safePrice = escapeHTML(p.price);
          const safeMerchant = escapeHTML(nameByUsername[p.merchant] || p.merchant || '-');
          const safeImg = escapeHTML(p.img || DEFAULT_PRODUCT_IMG);
          const safeId = escapeHTML(p.id);

          return `
            <tr class="hover:bg-gray-800/40 border-b border-gray-800/60">
              <td class="p-3 flex items-center gap-2.5">
                <img src="${safeImg}" alt="${safeName}" onerror="this.src='${DEFAULT_PRODUCT_IMG}'" class="w-8 h-8 rounded-lg object-cover border border-gray-700/50">
                <span class="font-bold text-gray-200">${safeName}</span>
              </td>
              <td class="p-3 text-gray-300">${safeMerchant}</td>
              <td class="p-3 text-gray-300">${safeCat}</td>
              <td class="p-3 font-bold text-amber-400">${safePrice} ج.م</td>
              <td class="p-3">
                <button onclick="deleteProductAsAdmin('${safeId}')" class="bg-red-600/20 text-red-400 px-2.5 py-1 rounded hover:bg-red-600 hover:text-white transition-all text-xs">حذف</button>
              </td>
            </tr>
          `;
        }).join('');
      }
    }
  } catch (error) {
    console.error('خطأ في جلب كافة المنتجات:', error);
    showToast('فشل تحميل المنتجات', 'error');
  }
}

async function addNewProductAsAdmin(event) {
  if (event) event.preventDefault();

  const merchant = document.getElementById('admin-p-merchant').value;
  const name = document.getElementById('admin-p-name').value.trim();
  const price = document.getElementById('admin-p-price').value;
  const category = document.getElementById('admin-p-category').value.trim() || 'عام';
  const img = document.getElementById('admin-p-img').value.trim() || DEFAULT_PRODUCT_IMG;
  const desc = document.getElementById('admin-p-desc').value.trim();

  if (!merchant) {
    showToast('يرجى اختيار التاجر!', 'warning');
    return;
  }

  if (!name || isNaN(price) || price === '') {
    showToast('يرجى كتابة اسم المنتج والسعر بصورة صحيحة!', 'warning');
    return;
  }

  try {
    const params = new URLSearchParams({
      action: 'addProduct',
      masterPassword: masterPasswordInput,
      name: name,
      price: price,
      category: category,
      img: img,
      desc: desc,
      merchant: merchant
    });

    const response = await fetch(`${SCRIPT_URL}?${params.toString()}`);
    const result = await response.json();

    if (result.status === 'success') {
      showToast('✅ تم حفظ المنتج للتاجر بنجاح!', 'success');
      document.getElementById('admin-p-name').value = '';
      document.getElementById('admin-p-price').value = '';
      document.getElementById('admin-p-category').value = '';
      document.getElementById('admin-p-img').value = '';
      document.getElementById('admin-p-desc').value = '';
      loadAllProductsAdmin(document.getElementById('admin-merchant-filter').value);
    } else {
      showToast('فشل حفظ المنتج!', 'error');
    }
  } catch (error) {
    console.error('خطأ إضافة منتج كأدمن:', error);
    showToast('حدث خطأ أثناء الاتصال بالخادم!', 'error');
  }
}

async function deleteProductAsAdmin(id) {
  if (!confirm('هل ترغب بحذف هذا المنتج نهائياً؟')) return;
  try {
    const response = await fetch(`${SCRIPT_URL}?action=deleteProduct&masterPassword=${encodeURIComponent(masterPasswordInput)}&id=${encodeURIComponent(id)}`);
    const result = await response.json();
    if (result.status === 'deleted') {
      showToast('تم حذف المنتج بنجاح', 'info');
      loadAllProductsAdmin(document.getElementById('admin-merchant-filter').value);
    } else {
      showToast(result.message || 'فشل الحذف!', 'error');
    }
  } catch (error) {
    showToast('خطأ أثناء الحذف!', 'error');
  }
}

// ======================================================
// 🏪 Merchant Functions
// ======================================================

function renderMerchantPanel() {
  document.getElementById('admin-login-card').classList.add('hidden');
  document.getElementById('master-panel').classList.add('hidden');
  document.getElementById('merchant-panel').classList.remove('hidden');
  document.getElementById('merchant-display-name').innerText = escapeHTML(currentMerchantName);
  loadMerchantProducts();
}

async function loadMerchantProducts() {
  const tableBody = document.getElementById('admin-products-table-body');
  if (tableBody) {
    tableBody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-gray-500"><i class="fa-solid fa-spinner fa-spin"></i> جاري تحميل منتجاتك...</td></tr>`;
  }

  try {
    const response = await fetch(`${SCRIPT_URL}?action=getProducts&merchant=${encodeURIComponent(currentMerchant)}`);
    const data = await response.json();
    products = Array.isArray(data) ? data : [];

    if (tableBody) {
      if (products.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-gray-500">لا توجد منتجات خاصة بك حالياً.</td></tr>`;
      } else {
        tableBody.innerHTML = products.map(p => {
          const safeName = escapeHTML(p.name);
          const safeCat = escapeHTML(p.category || '-');
          const safePrice = escapeHTML(p.price);
          const safeImg = escapeHTML(p.img || DEFAULT_PRODUCT_IMG);
          const safeId = escapeHTML(p.id);

          return `
            <tr class="hover:bg-gray-800/40 border-b border-gray-800/60">
              <td class="p-3 flex items-center gap-2.5">
                <img src="${safeImg}" alt="${safeName}" onerror="this.src='${DEFAULT_PRODUCT_IMG}'" class="w-8 h-8 rounded-lg object-cover border border-gray-700/50">
                <span class="font-bold text-gray-200">${safeName}</span>
              </td>
              <td class="p-3 text-gray-300">${safeCat}</td>
              <td class="p-3 font-bold text-amber-400">${safePrice} ج.م</td>
              <td class="p-3">
                <button onclick="deleteProductAdmin('${safeId}')" class="bg-red-600/20 text-red-400 px-2.5 py-1 rounded hover:bg-red-600 hover:text-white transition-all text-xs">حذف</button>
              </td>
            </tr>
          `;
        }).join('');
      }
    }
  } catch (error) {
    console.error('خطأ في جلب منتجات التاجر:', error);
    showToast('فشل تحميل منتجاتك', 'error');
  }
}

async function addNewProduct(event) {
  if (event) event.preventDefault();

  if (!currentMerchant) {
    showToast('يجب تسجيل الدخول كتاجر أولاً!', 'warning');
    return;
  }

  const name = document.getElementById('new-p-name').value.trim();
  const price = document.getElementById('new-p-price').value;
  const category = document.getElementById('new-p-category').value.trim() || 'عام';
  const img = document.getElementById('new-p-img').value.trim() || DEFAULT_PRODUCT_IMG;
  const desc = document.getElementById('new-p-desc').value.trim();

  if (!name || isNaN(price) || price === '') {
    showToast('يرجى كتابة اسم المنتج والسعر بصورة صحيحة!', 'warning');
    return;
  }

  try {
    const params = new URLSearchParams({
      action: 'addProduct',
      name: name,
      price: price,
      category: category,
      img: img,
      desc: desc,
      merchant: currentMerchant
    });

    const response = await fetch(`${SCRIPT_URL}?${params.toString()}`);
    const result = await response.json();

    if (result.status === 'success') {
      showToast('✅ تم حفظ المنتج في ملف الإكسيل بنجاح!', 'success');
      document.getElementById('new-p-name').value = '';
      document.getElementById('new-p-price').value = '';
      document.getElementById('new-p-category').value = '';
      document.getElementById('new-p-img').value = '';
      document.getElementById('new-p-desc').value = '';
      loadMerchantProducts();
    } else {
      showToast('فشل حفظ المنتج!', 'error');
    }
  } catch (error) {
    console.error('خطأ إضافة منتج:', error);
    showToast('حدث خطأ أثناء الاتصال بالخادم!', 'error');
  }
}

async function deleteProductAdmin(id) {
  if (!confirm('هل ترغب بحذف هذا المنتج نهائياً من ملف الإكسيل؟')) return;
  try {
    const response = await fetch(`${SCRIPT_URL}?action=deleteProduct&id=${encodeURIComponent(id)}&merchant=${encodeURIComponent(currentMerchant)}`);
    const result = await response.json();
    if (result.status === 'deleted') {
      showToast('تم حذف المنتج بنجاح', 'info');
      loadMerchantProducts();
    } else {
      showToast(result.message || 'فشل الحذف!', 'error');
    }
  } catch (error) {
    showToast('خطأ أثناء الحذف!', 'error');
  }
}

// ======================================================
// 🚀 Page Initialization
// ======================================================

document.addEventListener('DOMContentLoaded', () => {
  loadCloudProducts();
});
