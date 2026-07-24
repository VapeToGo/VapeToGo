// ==========================================
// 1️⃣ إعدادات واتصال Supabase
// ==========================================
const SUPABASE_URL = 'حط_هنا_الـ_Project_URL_بتاعك';
const SUPABASE_ANON_KEY = 'حط_هنا_الـ_Publishable_key_بتاعك';

const { createClient } = supabase;
const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// متغيرات عامة
let products = []; // هتتملى من Supabase تلقائياً
let cart = JSON.parse(localStorage.getItem('my_store_cart')) || [];
let orders = JSON.parse(localStorage.getItem('my_store_orders')) || [];

function saveData() {
  localStorage.setItem('my_store_cart', JSON.stringify(cart));
  localStorage.setItem('my_store_orders', JSON.stringify(orders));
}

// ==========================================
// 2️⃣ التنقل بين الواجهات (Store / Admin)
// ==========================================

function showSection(section) {
  document.getElementById('store-view').classList.add('hidden');
  document.getElementById('admin-view').classList.add('hidden');

  if (section === 'store') {
    document.getElementById('store-view').classList.remove('hidden');
    loadProductsFromSupabase(); // جلب أحدث منتجات من القاعدة عند فتح المتجر
  } else if (section === 'admin') {
    document.getElementById('admin-view').classList.remove('hidden');
  }
}

// ==========================================
// 3️⃣ جلب وعرض المنتجات من Supabase
// ==========================================

async function loadProductsFromSupabase(filterCat = 'all') {
  const { data, error } = await _supabase.from('Products').select('*');
  
  if (error) {
    console.error('خطأ في جلب المنتجات:', error);
    return;
  }
  
  // تحديث مصفوفة المنتجات بالبيانات الحقيقية من السيرفر
  products = data || [];
  renderStoreProducts(filterCat);
}

function renderStoreProducts(filterCat = 'all') {
  const grid = document.getElementById('products-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const filtered = filterCat === 'all' ? products : products.filter(p => p.category === filterCat);

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="col-span-full text-center py-10 text-gray-500 text-xs">لا توجد منتجات في هذا القسم.</div>`;
    renderCategories();
    return;
  }

  filtered.forEach(p => {
    grid.innerHTML += `
      <div class="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-lg flex flex-col justify-between hover:border-amber-500/40 transition-all group">
        <div>
          <div class="h-44 bg-gray-800 overflow-hidden relative">
            <img src="${p.img || 'https://via.placeholder.com/300'}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
            <span class="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-md border border-amber-500/20">${p.category || 'عام'}</span>
          </div>
          <div class="p-3.5 space-y-1.5">
            <h3 class="font-bold text-xs text-gray-100 line-clamp-1">${p.name}</h3>
            <p class="text-[10px] text-gray-400 line-clamp-2">${p.description || p.desc || ''}</p>
          </div>
        </div>
        <div class="p-3.5 pt-0 flex items-center justify-between">
          <span class="text-sm font-extrabold text-amber-400">${p.price} <span class="text-[10px]">ج.م</span></span>
          <button onclick="addToCart('${p.id}')" class="bg-amber-500 hover:bg-amber-400 text-black px-3 py-1.5 rounded-lg text-xs font-bold transition-all">
            + إضافة للسلة
          </button>
        </div>
      </div>
    `;
  });

  renderCategories();
}

function renderCategories() {
  const categories = ['all', ...new Set(products.map(p => p.category).filter(Boolean))];
  const container = document.getElementById('category-filters');
  if (!container) return;
  container.innerHTML = categories.map(cat => `
    <button onclick="renderStoreProducts('${cat}')" class="bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold px-4 py-2 rounded-xl whitespace-nowrap border border-gray-700">
      ${cat === 'all' ? 'الكل' : cat}
    </button>
  `).join('');
}

// ==========================================
// 4️⃣ إدارة السلة وتأكيد الشراء (محلياً)
// ==========================================

function addToCart(productId) {
  const prod = products.find(p => p.id == productId);
  if (!prod) return;

  const item = cart.find(c => c.id == productId);
  if (item) {
    item.qty++;
  } else {
    cart.push({ ...prod, qty: 1 });
  }

  saveData();
  updateCartUI();
  toggleCart(true);
}

function updateCartUI() {
  const cartContainer = document.getElementById('cart-items');
  const countSpan = document.getElementById('cart-count');
  const totalSpan = document.getElementById('cart-total-price');
  if (!cartContainer) return;

  countSpan.innerText = cart.reduce((acc, item) => acc + item.qty, 0);

  if (cart.length === 0) {
    cartContainer.innerHTML = `<p class="text-center text-xs text-gray-500 py-8">السلة فارغة حالياً.</p>`;
    totalSpan.innerText = '0 ج.م';
    return;
  }

  let total = 0;
  cartContainer.innerHTML = cart.map(item => {
    total += item.price * item.qty;
    return `
      <div class="flex items-center justify-between bg-gray-800/60 p-2.5 rounded-xl border border-gray-700 text-xs">
        <div class="flex items-center gap-2">
          <img src="${item.img}" class="w-10 h-10 object-cover rounded-lg">
          <div>
            <div class="font-bold text-gray-200">${item.name}</div>
            <div class="text-amber-400 font-bold">${item.price} ج.م × ${item.qty}</div>
          </div>
        </div>
        <button onclick="removeFromCart('${item.id}')" class="text-red-400 hover:text-red-300 p-1"><i class="fa-solid fa-trash"></i></button>
      </div>
    `;
  }).join('');

  totalSpan.innerText = `${total} ج.م`;
}

function removeFromCart(id) {
  cart = cart.filter(c => c.id != id);
  saveData();
  updateCartUI();
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
  if (cart.length === 0) return alert('السلة فارغة!');
  toggleCart();
  document.getElementById('checkout-modal').classList.remove('hidden');
  document.getElementById('checkout-modal').classList.add('flex');
}

function closeCheckoutModal() {
  document.getElementById('checkout-modal').classList.add('hidden');
  document.getElementById('checkout-modal').classList.remove('flex');
}

function submitOrder() {
  const name = document.getElementById('cust-name').value.trim();
  const phone = document.getElementById('cust-phone').value.trim();
  const address = document.getElementById('cust-address').value.trim();

  if (!name || !phone || !address) return alert('يرجى ملء جميع البيانات!');

  const newOrder = {
    id: 'ORD-' + Math.floor(100000 + Math.random() * 900000),
    customer: { name, phone, address },
    items: [...cart],
    total: cart.reduce((acc, i) => acc + (i.price * i.qty), 0),
    date: new Date().toLocaleString('ar-EG')
  };

  orders.push(newOrder);
  cart = [];
  saveData();
  closeCheckoutModal();
  updateCartUI();

  alert(`🎉 تم إرسال طلبك بنجاح! رقم الطلب: ${newOrder.id}`);
}

// ==========================================
// 5️⃣ لوحة تحكم الأدمن (مع ربط Supabase)
// ==========================================

function loginAdmin() {
  const pass = document.getElementById('admin-pass-input').value;
  if (pass === '123456') {
    document.getElementById('admin-login-card').classList.add('hidden');
    document.getElementById('admin-panel').classList.remove('hidden');
    renderAdminPanel();
  } else {
    alert('كلمة المرور غير صحيحة!');
  }
}

function logoutAdmin() {
  document.getElementById('admin-login-card').classList.remove('hidden');
  document.getElementById('admin-panel').classList.add('hidden');
}

async function renderAdminPanel() {
  // جلب أحدث البيانات لعرضها في لوحة التحكم
  const { data, error } = await _supabase.from('Products').select('*');
  if (!error) products = data || [];

  const tableBody = document.getElementById('admin-products-table-body');
  if (tableBody) {
    tableBody.innerHTML = products.map(p => `
      <tr class="hover:bg-gray-800/40">
        <td class="p-3 flex items-center gap-2">
          <img src="${p.img}" class="w-8 h-8 rounded object-cover">
          <span class="font-bold">${p.name}</span>
        </td>
        <td class="p-3">${p.category || '-'}</td>
        <td class="p-3 font-bold text-amber-400">${p.price} ج.م</td>
        <td class="p-3">
          <button onclick="deleteProductAdmin('${p.id}')" class="bg-red-600/20 text-red-400 px-2.5 py-1 rounded hover:bg-red-600 hover:text-white transition-all">حذف</button>
        </td>
      </tr>
    `).join('');
  }

  // قائمة الطلبات الواردة
  const ordersList = document.getElementById('admin-orders-list');
  if (ordersList) {
    ordersList.innerHTML = orders.length === 0 ? `<p class="text-xs text-gray-500">لا توجد طلبات واردة حتى الآن.</p>` :
      orders.map(o => `
        <div class="bg-gray-800/60 p-4 rounded-xl border border-gray-700 space-y-2 text-xs">
          <div class="flex justify-between items-center border-b border-gray-700 pb-2">
            <span class="font-bold text-amber-400">${o.id}</span>
            <span class="text-gray-400">${o.date}</span>
          </div>
          <div><strong>العميل:</strong> ${o.customer.name} | ${o.customer.phone}</div>
          <div><strong>العنوان:</strong> ${o.customer.address}</div>
          <div class="bg-gray-900 p-2 rounded-lg space-y-1 my-1">
            ${o.items.map(i => `<div>• ${i.name} (×${i.qty}) - ${i.price * i.qty} ج.م</div>`).join('')}
          </div>
          <div class="text-left font-extrabold text-amber-400 text-sm">الإجمالي: ${o.total} ج.م</div>
        </div>
      `).join('');
  }
}

async function addNewProduct() {
  const name = document.getElementById('new-p-name').value.trim();
  const price = parseFloat(document.getElementById('new-p-price').value);
  const category = document.getElementById('new-p-category').value.trim();
  const img = document.getElementById('new-p-img').value.trim();
  const desc = document.getElementById('new-p-desc').value.trim();

  if (!name || isNaN(price)) return alert('يرجى كتابة الاسم والسعر بصورة صحيحة!');

  const newP = {
    name,
    price,
    category: category || 'عام',
    img: img || 'https://images.unsplash.com/photo-1527661591475-527312dd65f5?auto=format&fit=crop&w=400&q=80',
    description: desc
  };

  // إرسال المنتج مباشرة إلى قاعدة بيانات Supabase الحقيقية
  const { data, error } = await _supabase.from('Products').insert([newP]).select();

  if (error) {
    console.error('خطأ في الإضافة:', error);
    alert('حدث خطأ أثناء حفظ المنتج في قاعدة البيانات!');
    return;
  }

  alert('✅ تم إضافة المنتج بنجاح وأصبح متاحاً لكل الأجهزة!');

  // تفريغ الحقول
  document.getElementById('new-p-name').value = '';
  document.getElementById('new-p-price').value = '';
  document.getElementById('new-p-category').value = '';
  document.getElementById('new-p-img').value = '';
  document.getElementById('new-p-desc').value = '';

  renderAdminPanel();
}

async function deleteProductAdmin(id) {
  if (confirm('هل ترغب بحذف هذا المنتج؟')) {
    const { error } = await _supabase.from('Products').delete().eq('id', id);

    if (error) {
      alert('خطأ أثناء الحذف من القاعدة!');
      return;
    }

    renderAdminPanel();
  }
}

// ==========================================
// 6️⃣ التشغيل عند فتح الصفحة
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  loadProductsFromSupabase();
});
