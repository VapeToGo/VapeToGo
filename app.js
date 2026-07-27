// ======================================================
// 🚀 VapeToGo - Modern E-Commerce & Management System
// ======================================================

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
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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

  const icons = {
    success: '<i class="fa-solid fa-circle-check text-emerald-400"></i>',
    error: '<i class="fa-solid fa-triangle-exclamation text-red-400"></i>',
    warning: '<i class="fa-solid fa-circle-exclamation text-amber-400"></i>',
    info: '<i class="fa-solid fa-circle-info text-amber-400"></i>'
  };

  toast.className = `flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-2xl text-xs font-semibold backdrop-blur-md transition-all duration-300 transform translate-y-2 opacity-0 ${bgColors[type] || bgColors.info}`;
  toast.innerHTML = `${icons[type] || icons.info} <span>${escapeHTML(message)}</span>`;

  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.remove('translate-y-2', 'opacity-0'));

  setTimeout(() => {
    toast.classList.add('opacity-0', '-translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// دالة ذكية لضغط وضبط الصورة وتحويلها لـ Base64 لضمان عدم فشل السيرفر
function convertImageToBase64(fileInputId) {
  return new Promise((resolve, reject) => {
    const fileInput = document.getElementById(fileInputId);
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      resolve(DEFAULT_PRODUCT_IMG); // صورة افتراضية في حال لم يتم اختيار صورة
      return;
    }
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => resolve(e.target.result);
    };
    reader.onerror = () => reject('فشل قراءة ملف الصورة');
    reader.readAsDataURL(file);
  });
}

// ======================================================
// 🛍️ Store Front & Products API
// ======================================================

async function loadCloudProducts() {
  const grid = document.getElementById('products-grid');
  if (grid && products.length === 0) {
    grid.innerHTML = renderSkeletonGrid();
  }

  try {
    const response = await fetch(`${SCRIPT_URL}?action=getProducts`);
    const data = await response.json();
    products = Array.isArray(data) ? data : [];
    renderStoreProducts(activeCategory);
  } catch (error) {
    console.error('خطأ في جلب المنتجات:', error);
    products = [];
    renderStoreProducts(activeCategory);
  }
}

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

function submitOrder(event) {
  if (event) event.preventDefault();

  const name = document.getElementById('cust-name').value.trim();
  const phone = document.getElementById('cust-phone').value.trim();
  const address = document.getElementById('cust-address').value.trim();

  if (!name || !phone || !address) {
    showToast('يرجى ملء جميع بيانات الشحن (الاسم، الهاتف، العنوان)!', 'warning');
    return;
  }

  // حفظ تفاصيل الطلب محلياً لكل تاجر لحساب المبيعات
  let merchantSalesMap = JSON.parse(localStorage.getItem('vape_merchant_sales') || '{}');

  let total = 0;
  let itemsText = cart.map((item, idx) => {
    const qty = Number(item.qty) || 1;
    const price = Number(item.price) || 0;
    const itemTotal = qty * price;
    total += itemTotal;

    const mKey = item.merchant || 'admin';
    if (!merchantSalesMap[mKey]) {
      merchantSalesMap[mKey] = { totalSales: 0, itemsSold: 0, ordersCount: 0 };
    }
    merchantSalesMap[mKey].totalSales += itemTotal;
    merchantSalesMap[mKey].itemsSold += qty;

    return `${idx + 1}. *${item.name}* \n   الكمية: ${qty} × ${price} ج.م = *${itemTotal} ج.م*`;
  }).join('\n\n');

  // زيادة عداد الطلبات لكل تاجر شارك في هذه السلة
  const uniqueMerchants = [...new Set(cart.map(i => i.merchant || 'admin'))];
  uniqueMerchants.forEach(mKey => {
    if (merchantSalesMap[mKey]) {
      merchantSalesMap[mKey].ordersCount += 1;
    }
  });

  localStorage.setItem('vape_merchant_sales', JSON.stringify(merchantSalesMap));

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

  window.open(whatsappUrl, '_blank');
  showToast(`🎉 شكراً ${name}! تم تجهيز طلبك وإرساله عبر الواتساب وتسجيل المبيعات.`, 'success');

  cart = [];
  closeCheckoutModal();
  updateCartUI();

  document.getElementById('cust-name').value = '';
  document.getElementById('cust-phone').value = '';
  document.getElementById('cust-address').value = '';
}

// ======================================================
// 🔐 Authentication Logic
// ======================================================

function showLoginCard() {
  document.getElementById('admin-login-card').classList.remove('hidden');
  document.getElementById('master-panel').classList.add('hidden');
  document.getElementById('merchant-panel').classList.add('hidden');
  switchLoginTab('merchant');
}

function switchLoginTab(tab) {
  const tabMerchant = document.getElementById('tab-merchant');
  const tabAdmin = document.getElementById('tab-admin');
  const usernameField = document.getElementById('login-username');

  if (tab === 'admin') {
    tabAdmin.className = 'flex-1 py-2 rounded-lg text-xs font-bold transition-all bg-amber-500 text-black';
    tabMerchant.className = 'flex-1 py-2 rounded-lg text-xs font-bold transition-all text-gray-400 hover:text-white';
    usernameField.classList.add('hidden');
    usernameField.value = '';
    document.getElementById('login-password').placeholder = 'كلمة سر الأدمن الرئيسي';
  } else {
    tabMerchant.className = 'flex-1 py-2 rounded-lg text-xs font-bold transition-all bg-amber-500 text-black';
    tabAdmin.className = 'flex-1 py-2 rounded-lg text-xs font-bold transition-all text-gray-400 hover:text-white';
    usernameField.classList.remove('hidden');
    document.getElementById('login-password').placeholder = 'كلمة المرور';
  }
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

  if (loginBtn) {
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري التحقق...';
  }

  try {
    if (!username) {
      if (password === MASTER_PASSWORD) {
        isMasterAdmin = true;
        currentMerchant = null;
        showToast('تم تسجيل الدخول كأدمن رئيسي بنجاح', 'success');
        document.getElementById('login-username').value = '';
        document.getElementById('login-password').value = '';
        renderMasterPanel();
      } else {
        showToast('كلمة سر الأدمن الرئيسي غير صحيحة!', 'error');
      }
      return;
    }

    // محاولة جلب ومعالجة تسجيل الدخول بطرق متعددة لتجنب أي مشاكل في السيرفر
    let result = null;
    try {
      const formData = new FormData();
      formData.append('action', 'loginMerchant');
      formData.append('username', username);
      formData.append('password', password);
      const response = await fetch(SCRIPT_URL, { method: 'POST', body: formData });
      const text = await response.text();
      result = JSON.parse(text);
    } catch(e) {
      const authUrl = `${SCRIPT_URL}?action=loginMerchant&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
      const resp2 = await fetch(authUrl);
      const text2 = await resp2.text();
      result = JSON.parse(text2);
    }

    if (result && result.status === 'success') {
      isMasterAdmin = false;
      currentMerchant = result.username;
      currentMerchantName = result.merchantName || result.username;
      showToast(`أهلاً بك، ${currentMerchantName}!`, 'success');
      document.getElementById('login-username').value = '';
      document.getElementById('login-password').value = '';
      renderMerchantPanel();
    } else if (result && result.status === 'held') {
      showToast('⛔ حسابك موقوف مؤقتاً، يرجى التواصل مع الإدارة.', 'error');
    } else {
      showToast((result && result.message) ? result.message : 'بيانات الدخول غير صحيحة!', 'error');
    }
  } catch (error) {
    console.error('خطأ في تسجيل الدخول:', error);
    showToast('حدث خطأ أثناء الاتصال بالسيرفر! تحقق من الإنترنت.', 'error');
  } finally {
    if (loginBtn) {
      loginBtn.disabled = false;
      loginBtn.innerHTML = 'دخول';
    }
  }
}

function logoutAdmin() {
  isMasterAdmin = false;
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
    const response = await fetch(`${SCRIPT_URL}?action=getMerchants&masterPassword=${encodeURIComponent(MASTER_PASSWORD)}`);
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch(e) { data = []; }
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

    // تحديث قائمة اختيار التجار (مع إتاحة خيار "بدون تاجر / منتج للأدمن العام")
    const options = `<option value="">بدون تاجر (منتج عام للمنصة)</option>` + 
      merchantsCache.map(m => `<option value="${escapeHTML(m.username)}">${escapeHTML(m.merchantName)} (${escapeHTML(m.username)})</option>`).join('');
    
    const filterOptions = `<option value="all">كل التجار</option><option value="">المنتجات العامة (بدون تاجر)</option>` + 
      merchantsCache.map(m => `<option value="${escapeHTML(m.username)}">${escapeHTML(m.merchantName)}</option>`).join('');

    const selectMerchant = document.getElementById('admin-p-merchant');
    const selectFilter = document.getElementById('admin-merchant-filter');

    if (selectMerchant) selectMerchant.innerHTML = options;
    if (selectFilter) selectFilter.innerHTML = filterOptions;

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
    let result;
    try {
      const formData = new FormData();
      formData.append('action', 'addMerchant');
      formData.append('masterPassword', MASTER_PASSWORD);
      formData.append('username', username);
      formData.append('password', password);
      formData.append('merchantName', merchantName);
      const response = await fetch(SCRIPT_URL, { method: 'POST', body: formData });
      result = await response.json();
    } catch(postErr) {
      const url = `${SCRIPT_URL}?action=addMerchant&masterPassword=${encodeURIComponent(MASTER_PASSWORD)}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&merchantName=${encodeURIComponent(merchantName)}`;
      const response = await fetch(url);
      result = await response.json();
    }

    if (result && result.status === 'success') {
      showToast('✅ تم إنشاء حساب التاجر بنجاح!', 'success');
      document.getElementById('new-m-name').value = '';
      document.getElementById('new-m-username').value = '';
      document.getElementById('new-m-password').value = '';
      loadMerchantsList();
    } else {
      showToast((result && result.message) ? result.message : 'فشل إنشاء الحساب!', 'error');
    }
  } catch (error) {
    showToast('حدث خطأ أثناء الاتصال بالخادم', 'error');
  }
}

async function toggleMerchantHold(username) {
  if (!confirm(`هل تريد تغيير حالة التاجر (${username})؟`)) return;
  try {
    const response = await fetch(`${SCRIPT_URL}?action=toggleMerchantStatus&masterPassword=${encodeURIComponent(MASTER_PASSWORD)}&username=${encodeURIComponent(username)}`);
    const result = await response.json();
    if (result.status === 'success') {
      showToast('تم تغيير حالة التاجر بنجاح', 'success');
      loadMerchantsList();
    } else {
      showToast(result.message || 'فشلت العملية!', 'error');
    }
  } catch (error) {
    showToast('خطأ بالاتصال بالسيرفر', 'error');
  }
}

async function deleteMerchantAdmin(username) {
  if (!confirm(`تحذير: حذف التاجر (${username}) سيؤدي لحذف حسابه. هل أنت متأكد؟`)) return;
  try {
    const response = await fetch(`${SCRIPT_URL}?action=deleteMerchant&masterPassword=${encodeURIComponent(MASTER_PASSWORD)}&username=${encodeURIComponent(username)}`);
    const result = await response.json();
    if (result.status === 'deleted') {
      showToast('تم حذف التاجر بنجاح', 'info');
      loadMerchantsList();
    } else {
      showToast(result.message || 'فشل الحذف!', 'error');
    }
  } catch (error) {
    showToast('خطأ بالاتصال بالسيرفر', 'error');
  }
}

async function loadAllProductsAdmin(merchantFilter = 'all') {
  const tableBody = document.getElementById('admin-all-products-table-body');
  if (tableBody) {
    tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-gray-500"><i class="fa-solid fa-spinner fa-spin"></i> جاري جلب المنتجات...</td></tr>`;
  }

  try {
    let url = `${SCRIPT_URL}?action=getProducts&all=1`;
    const response = await fetch(url);
    const data = await response.json();
    let list = Array.isArray(data) ? data : [];

    if (merchantFilter !== 'all') {
      list = list.filter(p => String(p.merchant || '') === String(merchantFilter));
    }

    const nameByUsername = {};
    merchantsCache.forEach(m => { nameByUsername[m.username] = m.merchantName; });

    if (tableBody) {
      if (list.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-gray-500">لا توجد منتجات مطابقة لهذه التصفية.</td></tr>`;
      } else {
        tableBody.innerHTML = list.map(p => {
          const safeName = escapeHTML(p.name);
          const safeCat = escapeHTML(p.category || '-');
          const safePrice = escapeHTML(p.price);
          const rawM = p.merchant;
          const safeMerchant = rawM ? escapeHTML(nameByUsername[rawM] || rawM) : '<span class="text-amber-400">بدون تاجر (عام)</span>';
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
    showToast('فشل تحميل المنتجات', 'error');
  }
}

async function addNewProductAsAdmin(event) {
  if (event) event.preventDefault();

  const merchant = document.getElementById('admin-p-merchant').value; // يمكن أن تكون فارغة (بدون تاجر)
  const name = document.getElementById('admin-p-name').value.trim();
  const price = document.getElementById('admin-p-price').value;
  const category = document.getElementById('admin-p-category').value.trim() || 'عام';
  const desc = document.getElementById('admin-p-desc').value.trim();

  if (!name || isNaN(price) || price === '') {
    showToast('يرجى كتابة اسم المنتج والسعر بصورة صحيحة!', 'warning');
    return;
  }

  try {
    const imgBase64 = await convertImageToBase64('admin-p-img-file');

    const formData = new FormData();
    formData.append('action', 'addProduct');
    formData.append('masterPassword', MASTER_PASSWORD);
    formData.append('name', name);
    formData.append('price', price);
    formData.append('category', category);
    formData.append('img', imgBase64);
    formData.append('desc', desc);
    formData.append('merchant', merchant); // إذا كانت فارغة سيرسلها السيرفر كمنتج بدون تاجر

    const response = await fetch(SCRIPT_URL, { method: 'POST', body: formData });
    const result = await response.json();

    if (result.status === 'success') {
      showToast('✅ تم حفظ المنتج بنجاح!', 'success');
      document.getElementById('admin-p-name').value = '';
      document.getElementById('admin-p-price').value = '';
      document.getElementById('admin-p-category').value = '';
      document.getElementById('admin-p-img-file').value = '';
      document.getElementById('admin-p-desc').value = '';
      loadAllProductsAdmin(document.getElementById('admin-merchant-filter').value);
    } else {
      showToast(result.message || 'فشل حفظ المنتج!', 'error');
    }
  } catch (error) {
    showToast('حدث خطأ أثناء رفع الصورة أو حفظ المنتج.', 'error');
  }
}

async function deleteProductAsAdmin(id) {
  if (!confirm('هل ترغب بحذف هذا المنتج نهائياً؟')) return;
  try {
    const response = await fetch(`${SCRIPT_URL}?action=deleteProduct&masterPassword=${encodeURIComponent(MASTER_PASSWORD)}&id=${encodeURIComponent(id)}`);
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
// 🏪 Merchant Functions & Sales Analytics
// ======================================================

function renderMerchantPanel() {
  document.getElementById('admin-login-card').classList.add('hidden');
  document.getElementById('master-panel').classList.add('hidden');
  document.getElementById('merchant-panel').classList.remove('hidden');
  document.getElementById('merchant-display-name').innerText = escapeHTML(currentMerchantName);
  
  loadMerchantProducts();
  loadMerchantSalesStats();
}

function loadMerchantSalesStats() {
  const merchantSalesMap = JSON.parse(localStorage.getItem('vape_merchant_sales') || '{}');
  const stats = merchantSalesMap[currentMerchant] || { totalSales: 0, itemsSold: 0, ordersCount: 0 };

  document.getElementById('merchant-total-sales').innerText = `${stats.totalSales} ج.م`;
  document.getElementById('merchant-items-sold').innerText = stats.itemsSold;
  document.getElementById('merchant-orders-count').innerText = stats.ordersCount;
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
  const desc = document.getElementById('new-p-desc').value.trim();

  if (!name || isNaN(price) || price === '') {
    showToast('يرجى كتابة اسم المنتج والسعر بصورة صحيحة!', 'warning');
    return;
  }

  try {
    const imgBase64 = await convertImageToBase64('new-p-img-file');

    const formData = new FormData();
    formData.append('action', 'addProduct');
    formData.append('name', name);
    formData.append('price', price);
    formData.append('category', category);
    formData.append('img', imgBase64);
    formData.append('desc', desc);
    formData.append('merchant', currentMerchant);

    const response = await fetch(SCRIPT_URL, { method: 'POST', body: formData });
    const result = await response.json();

    if (result.status === 'success') {
      showToast('✅ تم حفظ المنتج في ملف الإكسيل بنجاح!', 'success');
      document.getElementById('new-p-name').value = '';
      document.getElementById('new-p-price').value = '';
      document.getElementById('new-p-category').value = '';
      document.getElementById('new-p-img-file').value = '';
      document.getElementById('new-p-desc').value = '';
      loadMerchantProducts();
    } else {
      showToast(result.message || 'فشل حفظ المنتج!', 'error');
    }
  } catch (error) {
    showToast('حدث خطأ أثناء رفع الصورة أو حفظ المنتج.', 'error');
  }
}

async function deleteProductAdmin(id) {
  if (!confirm('هل ترغب بحذف هذا المنتج نهائياً؟')) return;
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

document.addEventListener('DOMContentLoaded', () => {
  loadCloudProducts();
});
