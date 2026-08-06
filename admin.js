// ============================================






// admin.js - لوحة تحكم طيب العود (TAIEB ALOUD)
// ============================================
import { auth, db, CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, orderBy, writeBatch, serverTimestamp, onSnapshot, limit, startAfter, increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const CURRENCIES = ['SAR', 'AED', 'OMR', 'QAR', 'KWD', 'BHD', 'JOD', 'EGP'];

// ⚠️ لازم يكون نفس إيميل حساب الأدمن بالظبط في Firebase Authentication
// ده عشان نمنع أي حساب تاني (زي حساب العامل "worker") من فتح لوحة تحكم الأدمن الكاملة
const ADMIN_EMAIL = 'admin@taieb-aloud.com';

// ---------- عناصر عامة ----------
const authCheckScreen = document.getElementById('authCheckScreen');
const dashboardWrap = document.getElementById('dashboardWrap');
const logoutBtn = document.getElementById('logoutBtn');
const toast = document.getElementById('toast');

function enterDashboard() {
  sessionStorage.removeItem('justLoggedIn');
  authCheckScreen.classList.add('hidden');
  dashboardWrap.classList.remove('hidden');
  initDashboard();
}

onAuthStateChanged(auth, (user) => {
  if (user && user.email === ADMIN_EMAIL) {
    enterDashboard();
    return;
  }
  if (user) signOut(auth);
  // ⚠️ إصلاح مشكلة "الدخول ثم الرجوع فورًا لصفحة تسجيل الدخول":
  // لو جاي لتوّه من admin-login.html بعد تسجيل دخول ناجح، ممكن جلسة الدخول
  // تاخد جزء من الثانية عشان تتحفظ في المتصفح قبل ما الصفحة تتحمل بالكامل.
  // فبدل ما نطرده فورًا، بنديله فرصة أخيرة (نص ثانية) نتأكد فيها من auth.currentUser
  // مباشرة قبل ما نحكم إنه مش مسجل دخول فعلًا.
  if (sessionStorage.getItem('justLoggedIn') === '1') {
    setTimeout(() => {
      if (auth.currentUser && auth.currentUser.email === ADMIN_EMAIL) {
        enterDashboard();
      } else {
        sessionStorage.removeItem('justLoggedIn');
        window.location.href = 'admin-login.html';
      }
    }, 700);
  } else {
    window.location.href = 'admin-login.html';
  }
});

logoutBtn.addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = 'admin-login.html';
});

function showToast(message, type = 'success') {
  toast.textContent = message;
  toast.className = 'fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-sm font-semibold shadow-lg text-white ' +
    (type === 'success' ? 'bg-green-600' : 'bg-red-500');
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 2800);
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
}

let allProducts = [];
let allCollections = [];
let allSlides = [];
let allOrders = [];
let currentOrderStatusFilter = 'all';

function initDashboard() {
  setupTabs();
  loadProducts();
  loadCollections();
  loadSlider();
  loadSettings();
  loadOrders();
  setupProductModal();
  setupCollectionModal();
  setupSlideModal();
  setupDeleteModal();
  setupSettingsForm();
  setupAnnouncementBar();
  setupSearch();
  setupOrderFilters();
  setupOrderSearch();
  setupTopProductsRefresh();
  setupAdsRefresh();
  setupAccountingTab();
  setupImportDefaults();
  setupQuizTab();
  listenToQuizStats();
  listenToQuizAnswerBreakdown();
  setupCouponModal();
  loadCoupons();
  setupReviewsTab();
  listenToReviews();
  setupCustomersTab();
  listenToAbandonedCartsBadge();
}

// ============================================================
// TABS
// ============================================================
function setupTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const allTabs = ['products', 'collections', 'orders', 'topProducts', 'ads', 'accounting', 'slider', 'settings', 'quiz', 'coupons', 'reviews', 'abandonedCarts', 'customers'];
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      allTabs.forEach(t => document.getElementById('tab-' + t).classList.add('hidden'));
      document.getElementById('tab-' + btn.dataset.tab).classList.remove('hidden');
      if (btn.dataset.tab === 'topProducts') loadTopProducts();
      if (btn.dataset.tab === 'ads') loadAdStats();
      if (btn.dataset.tab === 'accounting') loadAccountingReport();
      if (btn.dataset.tab === 'coupons') loadCoupons();
      if (btn.dataset.tab === 'abandonedCarts') loadAbandonedCarts();
    });
  });
}

// ============================================================
// PRODUCTS: LOAD + RENDER
// ============================================================
async function loadProducts() {
  try {
    const q = query(collection(db, 'products'), orderBy('order', 'asc'));
    const snap = await getDocs(q);
    allProducts = snap.docs.map(d => ({ _docId: d.id, ...d.data() }));
    renderProductsList(allProducts);
  } catch (err) {
    console.error(err);
    showToast('تعذر تحميل المنتجات: ' + err.message, 'error');
  }
}

function renderProductsList(list) {
  const container = document.getElementById('productsList');
  const emptyState = document.getElementById('productsEmptyState');
  if (list.length === 0) { container.innerHTML = ''; emptyState.classList.remove('hidden'); return; }
  emptyState.classList.add('hidden');

  container.innerHTML = list.map(p => {
    const thumb = p.img
      ? `<img src="${p.img}" class="w-12 h-12 rounded-lg object-cover" />`
      : `<div class="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-xl">🧴</div>`;
    return `
      <div class="row bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-3 flex-wrap" draggable="true" data-docid="${p._docId}">
        <span class="drag-handle text-gray-300 text-xl select-none">⠿</span>
        ${thumb}
        <div class="flex-1 min-w-[140px]">
          <p class="font-bold text-sm">${escapeHTML(p.nameAr)}</p>
          <p class="text-xs text-gray-400">${escapeHTML(p.catAr || '')}${p.scentFamily ? ` · 🌿 ${escapeHTML(p.scentFamily)}` : ' · <span class="text-amber-500">بدون نوع رائحة</span>'}</p>
        </div>
        <span class="font-black text-sm">${p.prices?.SAR ?? 0} ر.س</span>
        <div class="flex gap-1">
          <button class="edit-product-btn text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg font-semibold transition" data-docid="${p._docId}">✏️ تعديل</button>
          <button class="delete-product-btn text-xs bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-lg font-semibold transition" data-docid="${p._docId}">🗑️ حذف</button>
        </div>
      </div>`;
  }).join('');

  container.querySelectorAll('.edit-product-btn').forEach(b => b.addEventListener('click', () => openProductModal(b.dataset.docid)));
  container.querySelectorAll('.delete-product-btn').forEach(b => b.addEventListener('click', () => openDeleteModal('product', b.dataset.docid)));
  setupDragReorder(container, 'products', allProducts);
}

// ============================================================
// COLLECTIONS: LOAD + RENDER
// ============================================================
async function loadCollections() {
  try {
    const q = query(collection(db, 'collections'), orderBy('order', 'asc'));
    const snap = await getDocs(q);
    allCollections = snap.docs.map(d => ({ _docId: d.id, ...d.data() }));
    renderCollectionsList(allCollections);
  } catch (err) {
    console.error(err);
    showToast('تعذر تحميل المجموعات: ' + err.message, 'error');
  }
}

function renderCollectionsList(list) {
  const container = document.getElementById('collectionsList');
  const emptyState = document.getElementById('collectionsEmptyState');
  if (list.length === 0) { container.innerHTML = ''; emptyState.classList.remove('hidden'); return; }
  emptyState.classList.add('hidden');

  container.innerHTML = list.map(c => {
    const thumb = c.img
      ? `<img src="${c.img}" class="w-12 h-12 rounded-lg object-cover" />`
      : `<div class="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-xl">🎁</div>`;
    return `
      <div class="row bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-3 flex-wrap" draggable="true" data-docid="${c._docId}">
        <span class="drag-handle text-gray-300 text-xl select-none">⠿</span>
        ${thumb}
        <div class="flex-1 min-w-[140px]">
          <p class="font-bold text-sm">${escapeHTML(c.nameAr)}</p>
          <p class="text-xs text-gray-400 truncate max-w-xs">${escapeHTML(c.descAr || '')}${c.scentFamily ? ` · 🌿 ${escapeHTML(c.scentFamily)}` : ''}</p>
        </div>
        <span class="font-black text-sm">${c.prices?.SAR ?? 0} ر.س</span>
        <div class="flex gap-1">
          <button class="edit-collection-btn text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg font-semibold transition" data-docid="${c._docId}">✏️ تعديل</button>
          <button class="delete-collection-btn text-xs bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-lg font-semibold transition" data-docid="${c._docId}">🗑️ حذف</button>
        </div>
      </div>`;
  }).join('');

  container.querySelectorAll('.edit-collection-btn').forEach(b => b.addEventListener('click', () => openCollectionModal(b.dataset.docid)));
  container.querySelectorAll('.delete-collection-btn').forEach(b => b.addEventListener('click', () => openDeleteModal('collection', b.dataset.docid)));
  setupDragReorder(container, 'collections', allCollections);
}

// ============================================================
// SEARCH
// ============================================================
function setupSearch() {
  const pSearch = document.getElementById('productSearch');
  const cSearch = document.getElementById('collectionSearch');
  pSearch.addEventListener('input', () => {
    const term = pSearch.value.trim().toLowerCase();
    const filtered = allProducts.filter(p => !term || (p.nameAr || '').toLowerCase().includes(term) || (p.nameEn || '').toLowerCase().includes(term));
    renderProductsList(filtered);
  });
  cSearch.addEventListener('input', () => {
    const term = cSearch.value.trim().toLowerCase();
    const filtered = allCollections.filter(c => !term || (c.nameAr || '').toLowerCase().includes(term) || (c.nameEn || '').toLowerCase().includes(term));
    renderCollectionsList(filtered);
  });
}

// ============================================================
// DRAG & DROP REORDER (generic, works for both lists)
// ============================================================
function setupDragReorder(container, collectionName, dataArray) {
  let draggedEl = null;
  container.querySelectorAll('.row').forEach(row => {
    row.addEventListener('dragstart', () => { draggedEl = row; row.classList.add('dragging'); });
    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
      draggedEl = null;
      saveNewOrder(container, collectionName);
    });
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      const after = getDragAfterElement(container, e.clientY);
      if (!draggedEl) return;
      if (after == null) container.appendChild(draggedEl);
      else container.insertBefore(draggedEl, after);
    });
  });
}

function getDragAfterElement(container, y) {
  const rows = [...container.querySelectorAll('.row:not(.dragging)')];
  return rows.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset, element: child };
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

async function saveNewOrder(container, collectionName) {
  const rows = [...container.querySelectorAll('.row')];
  if (rows.length === 0) return;
  try {
    const batch = writeBatch(db);
    rows.forEach((row, index) => {
      batch.update(doc(db, collectionName, row.dataset.docid), { order: index });
    });
    await batch.commit();
    showToast('تم حفظ الترتيب الجديد ✅');
    if (collectionName === 'products') await loadProducts();
    else if (collectionName === 'collections') await loadCollections();
    else await loadSlider();
  } catch (err) {
    console.error(err);
    showToast('تعذر حفظ الترتيب: ' + err.message, 'error');
  }
}

// ============================================================
// GALLERY MANAGER (shared logic for product/collection modals)
// ============================================================
function renderGallery(wrapId, images) {
  const wrap = document.getElementById(wrapId);
  wrap.innerHTML = images.map((url, i) => `
    <div class="gallery-thumb" data-idx="${i}">
      <img src="${url}" />
      <div class="remove-thumb" data-idx="${i}" data-wrap="${wrapId}">✕</div>
      ${i === 0 ? '<div style="position:absolute;bottom:0;left:0;right:0;background:rgba(201,168,76,0.9);color:#000;font-size:9px;text-align:center;font-weight:700;">رئيسية</div>' : ''}
    </div>
  `).join('');
  wrap.querySelectorAll('.remove-thumb').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx, 10);
      if (wrapId === 'p_galleryWrap') { currentProductGallery.splice(idx, 1); renderGallery(wrapId, currentProductGallery); }
      else { currentCollectionGallery.splice(idx, 1); renderGallery(wrapId, currentCollectionGallery); }
    });
  });
}

// ============================================================
// ضغط وتصغير الصور تلقائيًا قبل الرفع (بدون أي تدخل من المستخدم)
// بيحافظ على نسبة الأبعاد، ويصغّر لأقصى بعد محدد، ويحوّل لـ JPEG مضغوط
// ============================================================
function compressImage(file, maxDimension = 1600, quality = 0.82) {
  return new Promise((resolve) => {
    // لو الملف مش صورة (أو GIF متحرك) سيبه زي ما هو من غير ضغط
    if (!file.type.startsWith('image/') || file.type === 'image/gif') {
      resolve(file);
      return;
    }
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => {
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) { height = Math.round(height * (maxDimension / width)); width = maxDimension; }
          else { width = Math.round(width * (maxDimension / height)); height = maxDimension; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (!blob) { resolve(file); return; }
          // لو الضغط لأي سبب زوّد الحجم بدل ما يقلله، استخدم الأصلي
          if (blob.size >= file.size) { resolve(file); return; }
          const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
          resolve(compressedFile);
        }, 'image/jpeg', quality);
      };
      img.onerror = () => resolve(file);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

async function uploadImageToCloudinary(file, statusEl, folder = 'misc') {
  statusEl.textContent = '⏳ جارٍ ضغط ورفع الصورة...';
  statusEl.className = 'text-xs text-gray-500 mt-1';
  try {
    const compressed = await compressImage(file);
    const formData = new FormData();
    formData.append('file', compressed);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('folder', `taieb-aloud/${folder}`);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (!res.ok || !data.secure_url) throw new Error(data.error?.message || 'upload-failed');

    statusEl.textContent = '✅ تم رفع الصورة بنجاح';
    statusEl.className = 'text-xs text-green-600 mt-1';
    return data.secure_url;
  } catch (err) {
    console.error(err);
    statusEl.textContent = '❌ تعذر رفع الصورة: ' + (err.message || '');
    statusEl.className = 'text-xs text-red-500 mt-1';
    return null;
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ============================================================
// PRODUCT MODAL
// ============================================================
let currentProductGallery = [];

function setupProductModal() {
  const overlay = document.getElementById('productModalOverlay');
  document.getElementById('addProductBtn').addEventListener('click', () => openProductModal(null));
  document.getElementById('closeProductModal').addEventListener('click', closeProductModal);
  document.getElementById('cancelProductModal').addEventListener('click', closeProductModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeProductModal(); });

  document.getElementById('p_imgFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = await uploadImageToCloudinary(file, document.getElementById('p_uploadStatus'), 'products');
    if (url) { currentProductGallery.push(url); renderGallery('p_galleryWrap', currentProductGallery); }
    e.target.value = '';
  });

  document.getElementById('productForm').addEventListener('submit', handleProductFormSubmit);
  document.getElementById('p_addComponentBtn').addEventListener('click', () => addComponentRow('p', null));
}

function openProductModal(docId) {
  const overlay = document.getElementById('productModalOverlay');
  const form = document.getElementById('productForm');
  form.reset();
  populateScentSelects('p');
  currentProductGallery = [];
  document.getElementById('p_id').value = '';
  document.getElementById('p_uploadStatus').textContent = '';
  CURRENCIES.forEach(cur => document.getElementById('pr_' + cur).value = '');
  document.getElementById('p_stock').value = '';
  document.getElementById('p_cost').value = '';

  if (docId) {
    const p = allProducts.find(x => x._docId === docId);
    if (!p) return;
    document.getElementById('productModalTitle').textContent = 'تعديل عطر';
    document.getElementById('p_id').value = docId;
    document.getElementById('p_nameAr').value = p.nameAr || '';
    document.getElementById('p_nameEn').value = p.nameEn || '';
    document.getElementById('p_catAr').value = p.catAr || '';
    document.getElementById('p_catEn').value = p.catEn || '';
    document.getElementById('p_scentFamily').value = p.scentFamily || '';
    document.getElementById('p_stock').value = (typeof p.stock === 'number') ? p.stock : '';
    renderCustomTagFields('p', p.customTags || {});
    renderComponentsFields('p', p.components || []);
    CURRENCIES.forEach(cur => document.getElementById('pr_' + cur).value = p.prices?.[cur] ?? '');
    currentProductGallery = p.gallery && p.gallery.length ? [...p.gallery] : (p.img ? [p.img] : []);
    getDoc(doc(db, 'productCosts', 'product_' + p.id)).then(snap => {
      document.getElementById('p_cost').value = snap.exists() ? (snap.data().cost ?? '') : '';
    }).catch(() => {});
  } else {
    document.getElementById('productModalTitle').textContent = 'إضافة عطر جديد';
    renderCustomTagFields('p', {});
    renderComponentsFields('p', []);
  }
  renderGallery('p_galleryWrap', currentProductGallery);
  overlay.classList.remove('hidden');
  overlay.classList.add('flex');
}

function closeProductModal() {
  const overlay = document.getElementById('productModalOverlay');
  overlay.classList.add('hidden');
  overlay.classList.remove('flex');
}

function buildPrices(prefix) {
  const sar = parseFloat(document.getElementById(prefix + 'SAR').value) || 0;
  const prices = {};
  CURRENCIES.forEach(cur => {
    const el = document.getElementById(prefix + cur);
    const val = parseFloat(el.value);
    prices[cur] = isNaN(val) ? sar : val;
  });
  return prices;
}

async function handleProductFormSubmit(e) {
  e.preventDefault();
  const saveBtn = document.getElementById('saveProductBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'جارٍ الحفظ...';
  try {
    const docId = document.getElementById('p_id').value;
    const prices = buildPrices('pr_');
    const costRaw = document.getElementById('p_cost').value;
    const costVal = costRaw === '' ? 0 : (parseFloat(costRaw) || 0);
    if (costVal > prices.SAR) {
      showToast(`⚠️ سعر التكلفة (${costVal}) أكبر من سعر البيع (${prices.SAR}) — راجع الأرقام قبل الحفظ`, 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 حفظ العطر';
      return;
    }
    const productData = {
      nameAr: document.getElementById('p_nameAr').value.trim(),
      nameEn: document.getElementById('p_nameEn').value.trim(),
      catAr: document.getElementById('p_catAr').value.trim() || 'عطور فاخرة',
      catEn: document.getElementById('p_catEn').value.trim() || 'Luxury Perfumes',
      scentFamily: document.getElementById('p_scentFamily').value || '',
      customTags: collectCustomTags('p'),
      components: collectComponents('p'),
      prices,
      gallery: currentProductGallery,
      img: currentProductGallery[0] || '',
      updatedAt: serverTimestamp()
    };
    const stockRaw = document.getElementById('p_stock').value;
    if (stockRaw !== '') productData.stock = parseInt(stockRaw, 10) || 0;

    let numericIdForCost = null;
    if (docId) {
      await updateDoc(doc(db, 'products', docId), productData);
      const existing = allProducts.find(x => x._docId === docId);
      numericIdForCost = existing ? existing.id : null;
      showToast('تم تعديل العطر بنجاح ✅');
    } else {
      const numericId = Date.now();
      const newDocId = 'prod_' + numericId;
      productData.id = numericId;
      productData.order = allProducts.length;
      productData.createdAt = serverTimestamp();
      await setDoc(doc(db, 'products', newDocId), productData);
      numericIdForCost = numericId;
      showToast('تم إضافة العطر بنجاح ✅');
    }
    if (numericIdForCost !== null) {
      await setDoc(doc(db, 'productCosts', 'product_' + numericIdForCost), { cost: costVal }, { merge: true });
    }
    closeProductModal();
    await loadProducts();
  } catch (err) {
    console.error(err);
    showToast('حدث خطأ أثناء الحفظ: ' + err.message, 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = '💾 حفظ العطر';
  }
}

// ============================================================
// COLLECTION MODAL
// ============================================================
let currentCollectionGallery = [];

function setupCollectionModal() {
  const overlay = document.getElementById('collectionModalOverlay');
  document.getElementById('addCollectionBtn').addEventListener('click', () => openCollectionModal(null));
  document.getElementById('closeCollectionModal').addEventListener('click', closeCollectionModal);
  document.getElementById('cancelCollectionModal').addEventListener('click', closeCollectionModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeCollectionModal(); });

  document.getElementById('c_imgFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = await uploadImageToCloudinary(file, document.getElementById('c_uploadStatus'), 'collections');
    if (url) { currentCollectionGallery.push(url); renderGallery('c_galleryWrap', currentCollectionGallery); }
    e.target.value = '';
  });

  document.getElementById('collectionForm').addEventListener('submit', handleCollectionFormSubmit);
  document.getElementById('c_addComponentBtn').addEventListener('click', () => addComponentRow('c', null));
}

function openCollectionModal(docId) {
  const overlay = document.getElementById('collectionModalOverlay');
  const form = document.getElementById('collectionForm');
  form.reset();
  populateScentSelects('c');
  currentCollectionGallery = [];
  document.getElementById('c_id').value = '';
  document.getElementById('c_uploadStatus').textContent = '';
  CURRENCIES.forEach(cur => document.getElementById('cr_' + cur).value = '');
  document.getElementById('c_stock').value = '';
  document.getElementById('c_cost').value = '';

  if (docId) {
    const c = allCollections.find(x => x._docId === docId);
    if (!c) return;
    document.getElementById('collectionModalTitle').textContent = 'تعديل مجموعة';
    document.getElementById('c_id').value = docId;
    document.getElementById('c_nameAr').value = c.nameAr || '';
    document.getElementById('c_nameEn').value = c.nameEn || '';
    document.getElementById('c_descAr').value = c.descAr || '';
    document.getElementById('c_descEn').value = c.descEn || '';
    document.getElementById('c_scentFamily').value = c.scentFamily || '';
    document.getElementById('c_stock').value = (typeof c.stock === 'number') ? c.stock : '';
    renderCustomTagFields('c', c.customTags || {});
    renderComponentsFields('c', c.components || []);
    CURRENCIES.forEach(cur => document.getElementById('cr_' + cur).value = c.prices?.[cur] ?? '');
    currentCollectionGallery = c.gallery && c.gallery.length ? [...c.gallery] : (c.img ? [c.img] : []);
    getDoc(doc(db, 'productCosts', 'collection_' + c.id)).then(snap => {
      document.getElementById('c_cost').value = snap.exists() ? (snap.data().cost ?? '') : '';
    }).catch(() => {});
  } else {
    document.getElementById('collectionModalTitle').textContent = 'إضافة مجموعة جديدة';
    renderCustomTagFields('c', {});
    renderComponentsFields('c', []);
  }
  renderGallery('c_galleryWrap', currentCollectionGallery);
  overlay.classList.remove('hidden');
  overlay.classList.add('flex');
}

function closeCollectionModal() {
  const overlay = document.getElementById('collectionModalOverlay');
  overlay.classList.add('hidden');
  overlay.classList.remove('flex');
}

async function handleCollectionFormSubmit(e) {
  e.preventDefault();
  const saveBtn = document.getElementById('saveCollectionBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'جارٍ الحفظ...';
  try {
    const docId = document.getElementById('c_id').value;
    const prices = buildPrices('cr_');
    const costRaw = document.getElementById('c_cost').value;
    const costVal = costRaw === '' ? 0 : (parseFloat(costRaw) || 0);
    if (costVal > prices.SAR) {
      showToast(`⚠️ سعر التكلفة (${costVal}) أكبر من سعر البيع (${prices.SAR}) — راجع الأرقام قبل الحفظ`, 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 حفظ المجموعة';
      return;
    }
    const collectionData = {
      nameAr: document.getElementById('c_nameAr').value.trim(),
      nameEn: document.getElementById('c_nameEn').value.trim(),
      descAr: document.getElementById('c_descAr').value.trim(),
      descEn: document.getElementById('c_descEn').value.trim(),
      scentFamily: document.getElementById('c_scentFamily').value || '',
      customTags: collectCustomTags('c'),
      components: collectComponents('c'),
      prices,
      gallery: currentCollectionGallery,
      img: currentCollectionGallery[0] || '',
      updatedAt: serverTimestamp()
    };
    const stockRaw = document.getElementById('c_stock').value;
    if (stockRaw !== '') collectionData.stock = parseInt(stockRaw, 10) || 0;

    let numericIdForCost = null;
    if (docId) {
      await updateDoc(doc(db, 'collections', docId), collectionData);
      const existing = allCollections.find(x => x._docId === docId);
      numericIdForCost = existing ? existing.id : null;
      showToast('تم تعديل المجموعة بنجاح ✅');
    } else {
      const numericId = Date.now();
      const newDocId = 'col_' + numericId;
      collectionData.id = numericId;
      collectionData.order = allCollections.length;
      collectionData.createdAt = serverTimestamp();
      await setDoc(doc(db, 'collections', newDocId), collectionData);
      numericIdForCost = numericId;
      showToast('تم إضافة المجموعة بنجاح ✅');
    }
    if (numericIdForCost !== null) {
      await setDoc(doc(db, 'productCosts', 'collection_' + numericIdForCost), { cost: costVal }, { merge: true });
    }
    closeCollectionModal();
    await loadCollections();
  } catch (err) {
    console.error(err);
    showToast('حدث خطأ أثناء الحفظ: ' + err.message, 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = '💾 حفظ المجموعة';
  }
}

// ============================================================
// DELETE (shared for products & collections)
// ============================================================
let deleteTarget = { type: null, docId: null };

function setupDeleteModal() {
  const overlay = document.getElementById('deleteModalOverlay');
  document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
    if (!deleteTarget.docId) return;
    const btn = document.getElementById('confirmDeleteBtn');
    btn.disabled = true;
    btn.textContent = 'جارٍ الحذف...';
    try {
      const collectionMap = { product: 'products', collection: 'collections', slide: 'slider', order: 'orders', coupon: 'coupons', review: 'reviews', abandonedCart: 'abandonedCarts' };
      const collectionName = collectionMap[deleteTarget.type];
      await deleteDoc(doc(db, collectionName, deleteTarget.docId));
      showToast('تم الحذف بنجاح ✅');
      closeDeleteModal();
      if (deleteTarget.type === 'product') await loadProducts();
      else if (deleteTarget.type === 'collection') await loadCollections();
      else if (deleteTarget.type === 'order') await loadOrders();
      else if (deleteTarget.type === 'coupon') await loadCoupons();
      else if (deleteTarget.type === 'review') { /* هيتحدث تلقائيًا عبر onSnapshot */ }
      else if (deleteTarget.type === 'abandonedCart') await loadAbandonedCarts();
      else await loadSlider();
    } catch (err) {
      console.error(err);
      showToast('تعذر الحذف: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'حذف نهائيًا';
    }
  });
  document.getElementById('cancelDeleteBtn').addEventListener('click', closeDeleteModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeDeleteModal(); });
}

function openDeleteModal(type, docId) {
  const sourceMap = { product: allProducts, collection: allCollections, slide: allSlides, order: allOrders, coupon: allCoupons, review: allReviews, abandonedCart: allAbandonedCarts };
  const source = sourceMap[type];
  const item = source.find(x => x._docId === docId);
  if (!item) return;
  deleteTarget = { type, docId };
  document.getElementById('deleteItemName').textContent = item.nameAr || (type === 'slide' ? ('سلايد ' + (item.type === 'video' ? 'فيديو' : 'صورة')) : (type === 'order' ? `طلب ${item.name || ''} - ${item.phone || ''}` : (type === 'coupon' ? `كوبون ${item.code || ''}` : (type === 'review' ? `تقييم ${item.name || ''}` : (type === 'abandonedCart' ? `سلة ${item.name || item.phone || ''}` : '')))));
  const overlay = document.getElementById('deleteModalOverlay');
  overlay.classList.remove('hidden');
  overlay.classList.add('flex');
}

function closeDeleteModal() {
  deleteTarget = { type: null, docId: null };
  const overlay = document.getElementById('deleteModalOverlay');
  overlay.classList.add('hidden');
  overlay.classList.remove('flex');
}

// ============================================================
// ORDERS: LOAD + RENDER + FILTER + SEARCH + STATUS UPDATE
// ============================================================
const ORDER_STATUS_OPTIONS = ['جديد', 'قيد التنفيذ', 'تم الشحن', 'تم التوصيل والاستلام', 'ملغي'];
const ORDER_STATUS_COLORS = {
  'جديد': 'bg-blue-100 text-blue-700 border-blue-300',
  'قيد التنفيذ': 'bg-amber-100 text-amber-700 border-amber-300',
  'تم الشحن': 'bg-purple-100 text-purple-700 border-purple-300',
  'تم التوصيل والاستلام': 'bg-green-100 text-green-700 border-green-300',
  'ملغي': 'bg-red-100 text-red-700 border-red-300'
};
const PAYMENT_ICONS = { mada: '💳 مدى', bank: '🏦 تحويل بنكي', stc: '📱 STC Pay', cod: '💵 عند الاستلام' };
const ORDERS_PAGE_SIZE = 50;

let ordersFirstLoad = true;
let ordersLastVisible = null;
let ordersHasMore = false;
let ordersLoadingMore = false;

async function loadOrders() {
  try {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(ORDERS_PAGE_SIZE));
    onSnapshot(q, (snap) => {
      if (!ordersFirstLoad) {
        const added = snap.docChanges().filter(c => c.type === 'added');
        if (added.length > 0) {
          showToast(`🔔 وصل طلب جديد (${added.length})`, 'success');
        }
      }
      const liveOrders = snap.docs.map(d => ({ _docId: d.id, ...d.data() }));
      // نحافظ على الطلبات المُحمّلة إضافيًا عن طريق "تحميل المزيد" ونحدّث بس أول صفحة (اللحظية)
      const extraOrders = allOrders.filter(o => !liveOrders.some(lo => lo._docId === o._docId) && o._loadedExtra);
      allOrders = [...liveOrders, ...extraOrders];
      ordersLastVisible = snap.docs[snap.docs.length - 1] || null;
      ordersHasMore = snap.docs.length === ORDERS_PAGE_SIZE;
      applyOrderFilters();
      updateNewOrdersBadge();
      updateLoadMoreOrdersBtn();
      ordersFirstLoad = false;
    }, (err) => {
      console.error(err);
      showToast('تعذر تحميل الطلبات: ' + err.message, 'error');
    });
  } catch (err) {
    console.error(err);
    showToast('تعذر تحميل الطلبات: ' + err.message, 'error');
  }
}

async function loadMoreOrders() {
  if (!ordersHasMore || ordersLoadingMore || !ordersLastVisible) return;
  ordersLoadingMore = true;
  updateLoadMoreOrdersBtn();
  try {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), startAfter(ordersLastVisible), limit(ORDERS_PAGE_SIZE));
    const snap = await getDocs(q);
    const more = snap.docs.map(d => ({ _docId: d.id, ...d.data(), _loadedExtra: true }));
    allOrders = [...allOrders, ...more];
    ordersLastVisible = snap.docs[snap.docs.length - 1] || ordersLastVisible;
    ordersHasMore = snap.docs.length === ORDERS_PAGE_SIZE;
    applyOrderFilters();
  } catch (err) {
    console.error(err);
    showToast('تعذر تحميل المزيد: ' + err.message, 'error');
  }
  ordersLoadingMore = false;
  updateLoadMoreOrdersBtn();
}

function updateLoadMoreOrdersBtn() {
  const btn = document.getElementById('loadMoreOrdersBtn');
  if (!btn) return;
  if (!ordersHasMore) {
    btn.classList.add('hidden');
    return;
  }
  btn.classList.remove('hidden');
  btn.disabled = ordersLoadingMore;
  btn.textContent = ordersLoadingMore ? 'جارٍ التحميل...' : '⬇ تحميل المزيد من الطلبات';
}

function updateNewOrdersBadge() {
  const badge = document.getElementById('newOrdersBadge');
  const count = allOrders.filter(o => (o.status || 'جديد') === 'جديد').length;
  if (count > 0) {
    badge.textContent = count;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function timeAgoAr(ts) {
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `منذ ${hrs} ساعة`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `منذ ${days} يوم`;
  return date.toLocaleDateString('ar-EG');
}

function applyOrderFilters() {
  const term = (document.getElementById('orderSearch')?.value || '').trim().toLowerCase();
  let filtered = allOrders;
  if (currentOrderStatusFilter !== 'all') {
    filtered = filtered.filter(o => (o.status || 'جديد') === currentOrderStatusFilter);
  }
  if (term) {
    filtered = filtered.filter(o => (o.name || '').toLowerCase().includes(term) || (o.phone || '').toLowerCase().includes(term));
  }
  renderOrdersList(filtered);
}

function setupOrderFilters() {
  document.querySelectorAll('.order-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.order-filter-btn').forEach(b => {
        b.classList.remove('active', 'bg-gray-800', 'text-white');
        b.classList.add('bg-gray-200');
      });
      btn.classList.add('active', 'bg-gray-800', 'text-white');
      btn.classList.remove('bg-gray-200');
      currentOrderStatusFilter = btn.dataset.status;
      applyOrderFilters();
    });
  });
  const loadMoreBtn = document.getElementById('loadMoreOrdersBtn');
  if (loadMoreBtn) loadMoreBtn.addEventListener('click', loadMoreOrders);
  const exportBtn = document.getElementById('exportOrdersBtn');
  if (exportBtn) exportBtn.addEventListener('click', exportOrdersToCSV);
}

// ============================================================
// نسخة احتياطية للطلبات — بتنزّل كل الطلبات المُحمّلة حاليًا كملف CSV
// (لو عايز كل الطلبات مش بس أول 50، دوس "تحميل المزيد" لحد ما تجيب كل الطلبات الأول، وبعدين اعمل تنزيل)
// ============================================================
function exportOrdersToCSV() {
  if (!allOrders.length) { showToast('لا توجد طلبات لتصديرها', 'error'); return; }
  const headers = ['التاريخ', 'الاسم', 'الجوال', 'الإيميل', 'المدينة', 'الحي', 'العنوان', 'العنوان الوطني', 'طريقة الدفع', 'الحالة', 'المنتجات', 'الإجمالي', 'العملة', 'ملاحظات'];
  const escapeCsv = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
  const rows = allOrders.map(o => {
    const date = o.createdAt && o.createdAt.toDate ? o.createdAt.toDate().toLocaleString('ar-EG') : '';
    const items = (o.items || []).map(it => `${it.nameAr || it.nameEn || ''} (${it.price || 0})`).join(' | ');
    return [date, o.name, o.phone, o.email, o.city, o.district, o.addr, o.nationalAddr, o.paymentLabel, o.status, items, o.total, o.currency, o.notes]
      .map(escapeCsv).join(',');
  });
  const csv = '\uFEFF' + headers.map(escapeCsv).join(',') + '\n' + rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `orders-backup-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast(`✅ تم تنزيل ${allOrders.length} طلب`, 'success');
}

function setupOrderSearch() {
  const input = document.getElementById('orderSearch');
  if (input) input.addEventListener('input', applyOrderFilters);
}

async function updateOrderStatus(docId, newStatus) {
  try {
    await updateDoc(doc(db, 'orders', docId), { status: newStatus });
    const order = allOrders.find(o => o._docId === docId);
    if (order) order.status = newStatus;
    updateNewOrdersBadge();
    showToast('تم تحديث حالة الطلب ✅');
  } catch (err) {
    console.error(err);
    showToast('تعذر تحديث الحالة: ' + err.message, 'error');
  }
}

function renderOrdersList(list) {
  const container = document.getElementById('ordersList');
  const emptyState = document.getElementById('ordersEmptyState');
  if (!list.length) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  container.innerHTML = list.map(o => {
    const status = o.status || 'جديد';
    const statusColor = ORDER_STATUS_COLORS[status] || ORDER_STATUS_COLORS['جديد'];
    const itemsHTML = (o.items || []).map(it => {
      const safeImg = /^https?:\/\//i.test(it.image || '') ? it.image : (it.image ? it.image : '');
      const imgTag = safeImg
        ? `<img src="${escapeHTML(safeImg)}" class="w-9 h-9 object-cover rounded-md border border-gray-200 flex-shrink-0" onerror="this.style.display='none'" alt="">`
        : `<span class="w-9 h-9 rounded-md bg-gray-100 flex items-center justify-center text-[10px] flex-shrink-0">🧴</span>`;
      return `<div class="flex items-center gap-2 py-1">${imgTag}<span>${escapeHTML(it.nameAr || it.name || '')} — ${escapeHTML(String(it.price ?? ''))} ${escapeHTML(o.currency || '')}</span></div>`;
    }).join('');
    const paymentLabel = PAYMENT_ICONS[o.payment] || escapeHTML(o.paymentLabel || o.payment || '');
    const safeProofUrl = /^https:\/\//i.test(o.paymentProofUrl || '') ? o.paymentProofUrl : '';
    const proofHTML = safeProofUrl
      ? `<a href="${escapeHTML(safeProofUrl)}" target="_blank" rel="noopener" class="inline-block mt-2">
           <img src="${escapeHTML(safeProofUrl)}" class="w-16 h-16 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition" alt="إثبات الدفع" />
         </a>`
      : '';
    const safeMapsLink = /^https:\/\//i.test(o.mapsLink || '') ? o.mapsLink : '';
    const mapsHTML = safeMapsLink
      ? `<a href="${escapeHTML(safeMapsLink)}" target="_blank" rel="noopener" class="text-blue-600 underline text-xs">📍 عرض الموقع على الخريطة</a>`
      : '';
    const statusOptionsHTML = ORDER_STATUS_OPTIONS.map(s => `<option value="${s}" ${s === status ? 'selected' : ''}>${s}</option>`).join('');

    return `
    <div class="border border-gray-200 rounded-2xl p-4 bg-white shadow-sm">
      <div class="flex items-start justify-between flex-wrap gap-2">
        <div>
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-bold text-gray-800">${escapeHTML(o.name || '—')}</span>
            <span class="text-xs px-2 py-0.5 rounded-full border ${statusColor} font-bold">${status}</span>
            <span class="text-[11px] text-gray-400">${timeAgoAr(o.createdAt)}</span>
          </div>
          <div class="text-sm text-gray-500 mt-1">📞 ${escapeHTML(o.phone || '')} &nbsp;|&nbsp; 🏙️ ${escapeHTML(o.city || '')} - ${escapeHTML(o.district || '')}</div>
          ${o.email ? `<div class="text-xs text-gray-500 mt-0.5">📧 ${escapeHTML(o.email)}</div>` : ''}
          <div class="text-xs text-gray-400 mt-1">${escapeHTML(o.addr || '')}${o.nationalAddr ? ' | العنوان الوطني: ' + escapeHTML(o.nationalAddr) : ''}</div>
          ${mapsHTML}
          ${o.notes ? `<div class="text-xs text-gray-500 mt-1">📝 ${escapeHTML(o.notes)}</div>` : ''}
        </div>
        <div class="text-left">
          <div class="font-bold text-gold text-lg">${escapeHTML(String(o.total ?? 0))} ${escapeHTML(o.currency || '')}</div>
          <div class="text-xs text-gray-500 mt-1">${paymentLabel}</div>
          ${proofHTML}
        </div>
      </div>

      <div class="text-xs text-gray-600 mt-3 border-t border-gray-100 pt-2 space-y-0.5">${itemsHTML}</div>

      <div class="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
        <select data-order-status="${o._docId}" class="order-status-select text-xs border border-gray-300 rounded-full px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gold">
          ${statusOptionsHTML}
        </select>
        <button class="delete-order-btn text-xs text-red-500 font-bold hover:underline" data-docid="${o._docId}">🗑 حذف</button>
      </div>
    </div>`;
  }).join('');

  container.querySelectorAll('.order-status-select').forEach(sel => {
    sel.addEventListener('change', () => updateOrderStatus(sel.dataset.orderStatus, sel.value));
  });
  container.querySelectorAll('.delete-order-btn').forEach(b => {
    b.addEventListener('click', () => openDeleteModal('order', b.dataset.docid));
  });
}

// ============================================================
// TOP PRODUCTS: ترتيب المنتجات حسب عدد مرات الطلب (من مجموعة productStats)
// ============================================================
let topProductsLoaded = false;

async function loadTopProducts() {
  const container = document.getElementById('topProductsList');
  const emptyState = document.getElementById('topProductsEmptyState');
  try {
    const snap = await getDocs(collection(db, 'productStats'));
    const stats = snap.docs.map(d => ({ _docId: d.id, ...d.data() }));
    stats.sort((a, b) => (b.count || 0) - (a.count || 0));
    renderTopProducts(stats);
    topProductsLoaded = true;
  } catch (err) {
    console.error(err);
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    emptyState.querySelector('p:last-child').textContent = 'تعذر تحميل الإحصائية: ' + err.message;
    showToast('تعذر تحميل إحصائية المنتجات', 'error');
  }
}

function renderTopProducts(stats) {
  const container = document.getElementById('topProductsList');
  const emptyState = document.getElementById('topProductsEmptyState');
  if (!stats.length) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');
  const maxCount = Math.max(...stats.map(s => s.count || 0), 1);
  const medals = ['🥇', '🥈', '🥉'];

  container.innerHTML = stats.map((s, i) => {
    const count = s.count || 0;
    const revenue = s.revenue || 0;
    const pct = Math.round((count / maxCount) * 100);
    const rankBadge = medals[i] || `#${i + 1}`;
    const safeImg = /^https?:\/\//i.test(s.image || '') ? s.image : '';
    const imgTag = safeImg
      ? `<img src="${escapeHTML(safeImg)}" class="w-12 h-12 object-cover rounded-lg border border-gray-200 flex-shrink-0" onerror="this.style.display='none'" alt="">`
      : `<span class="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-xl flex-shrink-0">🧴</span>`;
    return `
    <div class="border border-gray-200 rounded-2xl p-3 bg-white shadow-sm flex items-center gap-3">
      <div class="text-lg font-bold text-gray-400 w-8 text-center flex-shrink-0">${rankBadge}</div>
      ${imgTag}
      <div class="flex-1 min-w-0">
        <div class="font-bold text-gray-800 truncate">${escapeHTML(s.nameAr || s.nameEn || 'منتج')}</div>
        <div class="w-full bg-gray-100 rounded-full h-2 mt-1.5">
          <div class="bg-gold h-2 rounded-full" style="width:${pct}%"></div>
        </div>
      </div>
      <div class="text-left flex-shrink-0">
        <div class="font-bold text-gray-800">${count} <span class="text-xs font-normal text-gray-400">طلب</span></div>
        <div class="text-xs text-gray-400">إيراد: ${Math.round(revenue)}</div>
      </div>
    </div>`;
  }).join('');
}

function setupTopProductsRefresh() {
  const btn = document.getElementById('refreshTopProductsBtn');
  if (btn) btn.addEventListener('click', loadTopProducts);
}

// ============================================================
// ADS: عداد الإعلانات الداخلي (view_content / add_to_cart / purchase)
// ============================================================
async function loadAdStats() {
  try {
    const [totalsSnap, byProductSnap] = await Promise.all([
      getDocs(collection(db, 'adStats')),
      getDocs(collection(db, 'adStatsByProduct'))
    ]);

    let totals = { view_content: 0, add_to_cart: 0, purchase: 0 };
    const dailyDocs = [];
    totalsSnap.forEach(d => {
      const data = d.data();
      if (d.id === 'totals') {
        totals = { view_content: data.view_content || 0, add_to_cart: data.add_to_cart || 0, purchase: data.purchase || 0 };
      } else if (d.id.startsWith('daily_')) {
        dailyDocs.push({ date: d.id.replace('daily_', ''), view_content: data.view_content || 0, add_to_cart: data.add_to_cart || 0, purchase: data.purchase || 0 });
      }
    });
    dailyDocs.sort((a, b) => b.date.localeCompare(a.date));

    const byProduct = byProductSnap.docs.map(d => ({ _docId: d.id, ...d.data() }));
    byProduct.sort((a, b) => ((b.view_content || 0) + (b.add_to_cart || 0)) - ((a.view_content || 0) + (a.add_to_cart || 0)));

    renderAdsTotals(totals);
    renderAdsDaily(dailyDocs.slice(0, 14));
    renderAdsByProduct(byProduct.slice(0, 15));
  } catch (err) {
    console.error(err);
    showToast('تعذر تحميل إحصائية الإعلانات: ' + err.message, 'error');
  }
}

function renderAdsTotals(totals) {
  document.getElementById('adsTotalView').textContent = totals.view_content;
  document.getElementById('adsTotalCart').textContent = totals.add_to_cart;
  document.getElementById('adsTotalPurchase').textContent = totals.purchase;
}

function renderAdsDaily(rows) {
  const tbody = document.getElementById('adsDailyTable');
  const emptyState = document.getElementById('adsDailyEmptyState');
  if (!rows.length) {
    tbody.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');
  tbody.innerHTML = rows.map(r => `
    <tr class="border-b border-gray-50">
      <td class="py-2 text-gray-700">${escapeHTML(r.date)}</td>
      <td class="py-2 text-center">${r.view_content}</td>
      <td class="py-2 text-center">${r.add_to_cart}</td>
      <td class="py-2 text-center font-bold text-gray-800">${r.purchase}</td>
    </tr>`).join('');
}

function renderAdsByProduct(rows) {
  const container = document.getElementById('adsByProductList');
  const emptyState = document.getElementById('adsByProductEmptyState');
  if (!rows.length) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');
  const maxViews = Math.max(...rows.map(r => r.view_content || 0), 1);
  container.innerHTML = rows.map(r => {
    const pct = Math.round(((r.view_content || 0) / maxViews) * 100);
    return `
    <div class="border border-gray-200 rounded-2xl p-3 bg-white shadow-sm flex items-center gap-3">
      <span class="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-lg flex-shrink-0">${r.itemType === 'collection' ? '🎁' : '🧴'}</span>
      <div class="flex-1 min-w-0">
        <div class="font-bold text-gray-800 truncate">${escapeHTML(r.nameAr || 'منتج')}</div>
        <div class="w-full bg-gray-100 rounded-full h-2 mt-1.5">
          <div class="bg-gold h-2 rounded-full" style="width:${pct}%"></div>
        </div>
      </div>
      <div class="text-left flex-shrink-0 text-xs text-gray-500 space-y-0.5">
        <div>👁️ ${r.view_content || 0}</div>
        <div>🛒 ${r.add_to_cart || 0}</div>
        <div>✅ ${r.purchase || 0}</div>
      </div>
    </div>`;
  }).join('');
}

function setupAdsRefresh() {
  const btn = document.getElementById('refreshAdsBtn');
  if (btn) btn.addEventListener('click', loadAdStats);
}

// ============================================================
// ACCOUNTING: تقرير داخلي بسيط (مبيعات / تكلفة / ربح / ضريبة)
// ============================================================
function fmtMoney(n) {
  return (Math.round((n || 0) * 100) / 100).toLocaleString('ar-EG');
}

function getRangeStartDate(range) {
  const now = new Date();
  if (range === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
  if (range === '30days') return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (range === '7days') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return null; // all
}

async function loadAccountingReport() {
  const btn = document.getElementById('refreshAccountingBtn');
  if (btn) btn.disabled = true;
  try {
    const range = document.getElementById('acc_range').value;
    const startDate = getRangeStartDate(range);

    const [ordersSnap, costsSnap] = await Promise.all([
      getDocs(collection(db, 'orders')),
      getDocs(collection(db, 'productCosts'))
    ]);

    const costMap = {};
    costsSnap.forEach(d => { costMap[d.id] = d.data().cost || 0; });

    let ordersCount = 0, revenue = 0, cost = 0;
    lastAccountingRows = [];
    ordersSnap.forEach(d => {
      const o = d.data();
      if ((o.status || 'جديد') === 'ملغي') return;
      const createdAt = o.createdAt && o.createdAt.toDate ? o.createdAt.toDate() : null;
      if (startDate && (!createdAt || createdAt < startDate)) return;

      let orderCost = 0;
      (o.items || []).forEach(it => {
        const key = `${it.itemType || 'product'}_${it.id}`;
        orderCost += costMap[key] || 0;
      });
      const orderVat = (o.total || 0) - ((o.total || 0) / 1.15);

      ordersCount++;
      revenue += o.total || 0;
      cost += orderCost;

      lastAccountingRows.push({
        date: createdAt ? createdAt.toLocaleDateString('ar-EG') : '',
        orderId: d.id,
        name: o.name || '',
        phone: o.phone || '',
        itemsCount: (o.items || []).length,
        total: o.total || 0,
        cost: orderCost,
        profit: (o.total || 0) - orderCost,
        vat: orderVat,
        status: o.status || 'جديد'
      });
    });

    const vat = revenue - (revenue / 1.15);
    const grossProfit = revenue - cost;
    const netProfit = grossProfit - vat;

    document.getElementById('acc_ordersCount').textContent = ordersCount;
    document.getElementById('acc_revenue').textContent = fmtMoney(revenue);
    document.getElementById('acc_cost').textContent = fmtMoney(cost);
    document.getElementById('acc_grossProfit').textContent = fmtMoney(grossProfit);
    document.getElementById('acc_vat').textContent = fmtMoney(vat);
    document.getElementById('acc_netProfit').textContent = fmtMoney(netProfit);
  } catch (err) {
    console.error(err);
    showToast('تعذر تحميل التقرير المحاسبي: ' + err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

let lastAccountingRows = [];

function exportAccountingCSV() {
  if (!lastAccountingRows.length) {
    showToast('مفيش بيانات لتصديرها في الفترة المختارة', 'error');
    return;
  }
  const headers = ['التاريخ', 'رقم الطلب', 'اسم العميل', 'الجوال', 'عدد المنتجات', 'الإجمالي', 'التكلفة', 'الربح', 'الضريبة (15%)', 'الحالة'];
  const rows = lastAccountingRows.map(r => [
    r.date, r.orderId, r.name, r.phone, r.itemsCount,
    r.total.toFixed(2), r.cost.toFixed(2), r.profit.toFixed(2), r.vat.toFixed(2), r.status
  ]);
  const escapeCSV = (val) => {
    const s = String(val ?? '');
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const csvContent = [headers, ...rows].map(row => row.map(escapeCSV).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' }); // BOM عشان Excel يقرأ العربي صح
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const range = document.getElementById('acc_range').value;
  a.href = url;
  a.download = `تقرير-محاسبي-${range}-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function setupAccountingTab() {
  const refreshBtn = document.getElementById('refreshAccountingBtn');
  if (refreshBtn) refreshBtn.addEventListener('click', loadAccountingReport);
  const rangeSelect = document.getElementById('acc_range');
  if (rangeSelect) rangeSelect.addEventListener('change', loadAccountingReport);
  const exportBtn = document.getElementById('exportAccountingBtn');
  if (exportBtn) exportBtn.addEventListener('click', exportAccountingCSV);
}

// ============================================================
// SLIDER: LOAD + RENDER + CRUD
// ============================================================
async function loadSlider() {
  try {
    const q = query(collection(db, 'slider'), orderBy('order', 'asc'));
    const snap = await getDocs(q);
    allSlides = snap.docs.map(d => ({ _docId: d.id, ...d.data() }));
    renderSliderList(allSlides);
  } catch (err) {
    console.error(err);
    showToast('تعذر تحميل السلايدر: ' + err.message, 'error');
  }
}

function renderSliderList(list) {
  const container = document.getElementById('sliderList');
  const emptyState = document.getElementById('sliderEmptyState');
  if (list.length === 0) { container.innerHTML = ''; emptyState.classList.remove('hidden'); return; }
  emptyState.classList.add('hidden');

  container.innerHTML = list.map(s => {
    const thumb = s.type === 'video'
      ? `<div class="w-16 h-12 rounded-lg bg-gray-800 flex items-center justify-center text-xl">🎬</div>`
      : `<img src="${s.url}" class="w-16 h-12 rounded-lg object-cover" />`;
    return `
      <div class="row bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-3 flex-wrap" draggable="true" data-docid="${s._docId}">
        <span class="drag-handle text-gray-300 text-xl select-none">⠿</span>
        ${thumb}
        <div class="flex-1 min-w-[140px]">
          <p class="font-bold text-sm">${s.type === 'video' ? '🎬 فيديو' : '🖼️ صورة'}</p>
          <p class="text-xs text-gray-400 truncate max-w-xs" dir="ltr">${escapeHTML(s.url)}</p>
        </div>
        <div class="flex gap-1">
          <button class="edit-slide-btn text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg font-semibold transition" data-docid="${s._docId}">✏️ تعديل</button>
          <button class="delete-slide-btn text-xs bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-lg font-semibold transition" data-docid="${s._docId}">🗑️ حذف</button>
        </div>
      </div>`;
  }).join('');

  container.querySelectorAll('.edit-slide-btn').forEach(b => b.addEventListener('click', () => openSlideModal(b.dataset.docid)));
  container.querySelectorAll('.delete-slide-btn').forEach(b => b.addEventListener('click', () => openDeleteModal('slide', b.dataset.docid)));
  setupDragReorder(container, 'slider', allSlides);
}

function setupSlideModal() {
  const overlay = document.getElementById('slideModalOverlay');
  document.getElementById('addSlideBtn').addEventListener('click', () => openSlideModal(null));
  document.getElementById('closeSlideModal').addEventListener('click', closeSlideModal);
  document.getElementById('cancelSlideModal').addEventListener('click', closeSlideModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeSlideModal(); });

  document.getElementById('sl_type_image').addEventListener('change', toggleSlideTypeBlocks);
  document.getElementById('sl_type_video').addEventListener('change', toggleSlideTypeBlocks);

  document.getElementById('sl_imgFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = await uploadImageToCloudinary(file, document.getElementById('sl_uploadStatus'), 'slider');
    if (url) {
      document.getElementById('sl_url').value = url;
      const preview = document.getElementById('sl_imgPreview');
      preview.src = url;
      preview.classList.remove('hidden');
      document.getElementById('sl_imgPlaceholder').classList.add('hidden');
    }
  });

  document.getElementById('slideForm').addEventListener('submit', handleSlideFormSubmit);
}

function toggleSlideTypeBlocks() {
  const isVideo = document.getElementById('sl_type_video').checked;
  document.getElementById('sl_imageBlock').classList.toggle('hidden', isVideo);
  document.getElementById('sl_videoBlock').classList.toggle('hidden', !isVideo);
}

function openSlideModal(docId) {
  const overlay = document.getElementById('slideModalOverlay');
  const form = document.getElementById('slideForm');
  form.reset();
  document.getElementById('sl_docId').value = '';
  document.getElementById('sl_url').value = '';
  document.getElementById('sl_videoUrl').value = '';
  document.getElementById('sl_uploadStatus').textContent = '';
  document.getElementById('sl_imgPreview').classList.add('hidden');
  document.getElementById('sl_imgPlaceholder').classList.remove('hidden');
  document.getElementById('sl_type_image').checked = true;
  toggleSlideTypeBlocks();

  if (docId) {
    const s = allSlides.find(x => x._docId === docId);
    if (!s) return;
    document.getElementById('slideModalTitle').textContent = 'تعديل السلايد';
    document.getElementById('sl_docId').value = docId;
    if (s.type === 'video') {
      document.getElementById('sl_type_video').checked = true;
      document.getElementById('sl_videoUrl').value = s.url || '';
    } else {
      document.getElementById('sl_type_image').checked = true;
      document.getElementById('sl_url').value = s.url || '';
      if (s.url) {
        const preview = document.getElementById('sl_imgPreview');
        preview.src = s.url;
        preview.classList.remove('hidden');
        document.getElementById('sl_imgPlaceholder').classList.add('hidden');
      }
    }
    toggleSlideTypeBlocks();
  } else {
    document.getElementById('slideModalTitle').textContent = 'إضافة سلايد جديد';
  }

  overlay.classList.remove('hidden');
  overlay.classList.add('flex');
}

function closeSlideModal() {
  const overlay = document.getElementById('slideModalOverlay');
  overlay.classList.add('hidden');
  overlay.classList.remove('flex');
}

async function handleSlideFormSubmit(e) {
  e.preventDefault();
  const saveBtn = document.getElementById('saveSlideBtn');
  const isVideo = document.getElementById('sl_type_video').checked;
  const url = isVideo ? document.getElementById('sl_videoUrl').value.trim() : document.getElementById('sl_url').value.trim();

  if (!url) {
    showToast(isVideo ? 'الرجاء إدخال رابط الفيديو' : 'الرجاء رفع صورة أولًا', 'error');
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = 'جارٍ الحفظ...';
  try {
    const docId = document.getElementById('sl_docId').value;
    const slideData = { type: isVideo ? 'video' : 'image', url, updatedAt: serverTimestamp() };

    if (docId) {
      await updateDoc(doc(db, 'slider', docId), slideData);
      showToast('تم تعديل السلايد بنجاح ✅');
    } else {
      const newDocId = 'slide_' + Date.now();
      slideData.order = allSlides.length;
      slideData.createdAt = serverTimestamp();
      await setDoc(doc(db, 'slider', newDocId), slideData);
      showToast('تم إضافة السلايد بنجاح ✅');
    }
    closeSlideModal();
    await loadSlider();
  } catch (err) {
    console.error(err);
    showToast('حدث خطأ أثناء الحفظ: ' + err.message, 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = '💾 حفظ السلايد';
  }
}

// ============================================================
// SETTINGS
// ============================================================
async function loadSettings() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'general'));
    if (snap.exists()) {
      const d = snap.data();
      document.getElementById('s_whatsappNumber').value = d.whatsappNumber || '';
      const social = d.socialLinks || {};
      document.getElementById('s_social_instagram').value = social.instagram || '';
      document.getElementById('s_social_snapchat').value = social.snapchat || '';
      document.getElementById('s_social_tiktok').value = social.tiktok || '';
      document.getElementById('s_social_twitter').value = social.twitter || '';
      document.getElementById('s_social_youtube').value = social.youtube || '';
      document.getElementById('s_metaPixelId').value = d.metaPixelId || '';
      document.getElementById('s_tiktokPixelId').value = d.tiktokPixelId || '';
      document.getElementById('s_googleAdsId').value = d.googleAdsId || '';
    }
  } catch (err) {
    console.error(err);
    showToast('تعذر تحميل الإعدادات: ' + err.message, 'error');
  }
  loadAnnouncementBarSettings();
}

async function loadAnnouncementBarSettings() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'announcementBar'));
    const d = snap.exists() ? snap.data() : {};
    document.getElementById('ann_enabled').checked = !!d.enabled;
    document.getElementById('ann_bgColor').value = d.bgColor || '#000000';
    document.getElementById('ann_textColor').value = d.textColor || '#ffffff';
    document.getElementById('ann_speed').value = d.speedSeconds || 20;
    document.getElementById('ann_messagesAr').value = Array.isArray(d.messagesAr) ? d.messagesAr.join('\n') : (Array.isArray(d.messages) ? d.messages.join('\n') : '');
    document.getElementById('ann_messagesEn').value = Array.isArray(d.messagesEn) ? d.messagesEn.join('\n') : '';
  } catch (err) {
    console.error(err);
    showToast('تعذر تحميل شريط الإعلانات: ' + err.message, 'error');
  }
}

async function saveAnnouncementBar() {
  const btn = document.getElementById('saveAnnouncementBtn');
  btn.disabled = true;
  try {
    const messagesAr = document.getElementById('ann_messagesAr').value
      .split('\n').map(m => m.trim()).filter(Boolean);
    const messagesEn = document.getElementById('ann_messagesEn').value
      .split('\n').map(m => m.trim()).filter(Boolean);
    await setDoc(doc(db, 'settings', 'announcementBar'), {
      enabled: document.getElementById('ann_enabled').checked,
      bgColor: document.getElementById('ann_bgColor').value,
      textColor: document.getElementById('ann_textColor').value,
      speedSeconds: parseInt(document.getElementById('ann_speed').value, 10) || 20,
      messagesAr,
      messagesEn,
      updatedAt: serverTimestamp()
    }, { merge: true });
    showToast('تم حفظ شريط الإعلانات ✅');
  } catch (err) {
    console.error(err);
    showToast('تعذر حفظ شريط الإعلانات: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

function setupAnnouncementBar() {
  const btn = document.getElementById('saveAnnouncementBtn');
  if (btn) btn.addEventListener('click', saveAnnouncementBar);
}

// ============================================================
// QUIZ SETTINGS: أنواع الروائح + مستويات الثبات + عداد الاستخدام
// ============================================================
const DEFAULT_QUIZ_FAMILIES = [
  { key:'خشبية', ar:'خشبية عود', en:'Woody oud', icon:'🜃' },
  { key:'شرقية', ar:'شرقية عنبرية', en:'Oriental amber', icon:'✹' },
  { key:'زهرية', ar:'زهرية', en:'Floral', icon:'❀' },
  { key:'منعشة', ar:'منعشة حمضية', en:'Fresh citrus', icon:'❉' },
];
let quizFamilies = [...DEFAULT_QUIZ_FAMILIES];

function loadQuizConfig() {
  try {
    onSnapshot(doc(db, 'settings', 'quizConfig'), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        if (Array.isArray(d.families) && d.families.length) quizFamilies = d.families;
        if (Array.isArray(d.customQuestions)) quizCustomQuestions = d.customQuestions;
      }
      renderQuizFamiliesList();
      renderQuizCustomQuestionsList();
    }, (err) => {
      console.error('quizConfig listener error:', err);
      showToast('تعذر تحميل إعدادات الكويز — راجع صلاحيات Firestore لمجموعة settings', 'error');
    });
  } catch (err) {
    console.error(err);
  }
}

async function saveQuizConfig() {
  try {
    await setDoc(doc(db, 'settings', 'quizConfig'), { families: quizFamilies, customQuestions: quizCustomQuestions, updatedAt: serverTimestamp() }, { merge: true });
  } catch (err) {
    console.error(err);
    showToast('تعذر حفظ إعدادات الكويز: ' + err.message, 'error');
  }
}

function renderQuizFamiliesList() {
  const el = document.getElementById('quizFamiliesList');
  if (!el) return;
  el.innerHTML = quizFamilies.map(f => `
    <div class="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
      <span class="text-lg">${f.icon || '✦'}</span>
      <div class="flex-1 text-sm"><b>${escapeHTML(f.ar)}</b> <span class="text-gray-400">· ${escapeHTML(f.en || '')}</span></div>
      <button class="del-family-btn text-xs text-red-500 hover:underline" data-key="${escapeHTML(f.key)}">🗑 حذف</button>
    </div>`).join('');
  el.querySelectorAll('.del-family-btn').forEach(b => b.addEventListener('click', () => {
    quizFamilies = quizFamilies.filter(f => f.key !== b.dataset.key);
    renderQuizFamiliesList();
    saveQuizConfig();
  }));
}

let quizCustomQuestions = [];
let draftQOptions = [];

function renderQuizCustomQuestionsList() {
  const el = document.getElementById('quizCustomQuestionsList');
  if (!el) return;
  if (!quizCustomQuestions.length) {
    el.innerHTML = '<p class="text-xs text-gray-400">لسه مفيش أسئلة إضافية.</p>';
    return;
  }
  el.innerHTML = quizCustomQuestions.map(q => `
    <div class="bg-gray-50 border border-gray-200 rounded-xl p-3">
      <div class="flex items-start justify-between gap-2 mb-2">
        <p class="text-sm font-bold">${escapeHTML(q.textAr)}</p>
        <button class="del-question-btn text-xs text-red-500 hover:underline flex-shrink-0" data-id="${escapeHTML(q.id)}">🗑 حذف السؤال</button>
      </div>
      <div class="flex flex-wrap gap-1.5">
        ${q.options.map(o => `<span class="text-xs bg-white border border-gray-200 rounded-full px-2.5 py-1">${escapeHTML(o.ar)}</span>`).join('')}
      </div>
    </div>`).join('');
  el.querySelectorAll('.del-question-btn').forEach(b => b.addEventListener('click', () => {
    quizCustomQuestions = quizCustomQuestions.filter(q => q.id !== b.dataset.id);
    renderQuizCustomQuestionsList();
    saveQuizConfig();
  }));
}

function renderDraftOptions() {
  const el = document.getElementById('draftOptionsList');
  if (!el) return;
  el.innerHTML = draftQOptions.map((o, i) => `
    <span class="text-xs bg-gray-100 border border-gray-200 rounded-full px-2.5 py-1 flex items-center gap-1">
      ${escapeHTML(o.ar)}
      <button class="del-draft-opt-btn text-red-500" data-i="${i}">✕</button>
    </span>`).join('') || '<span class="text-xs text-gray-400">لسه مفيش اختيارات مضافة</span>';
  el.querySelectorAll('.del-draft-opt-btn').forEach(b => b.addEventListener('click', () => {
    draftQOptions.splice(parseInt(b.dataset.i), 1);
    renderDraftOptions();
  }));
}

// بيرسم مجموعة اختيارات (Checkboxes) لكل سؤال إضافي داخل نموذج تعديل العطر/البوكس
function renderCustomTagFields(prefix, existingTags) {
  const wrap = document.getElementById(prefix + '_customTagsWrap');
  if (!wrap) return;
  if (!quizCustomQuestions.length) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = quizCustomQuestions.map(q => `
    <div>
      <label class="field-label">${escapeHTML(q.textAr)}</label>
      <div class="flex flex-wrap gap-2">
        ${q.options.map(o => `
          <label class="text-xs flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5 cursor-pointer">
            <input type="checkbox" class="custom-tag-check" data-qid="${escapeHTML(q.id)}" value="${escapeHTML(o.key)}" ${(existingTags?.[q.id] || []).includes(o.key) ? 'checked' : ''} />
            ${escapeHTML(o.ar)}
          </label>`).join('')}
      </div>
    </div>`).join('');
}

// بيجمع الاختيارات المحددة من الـ Checkboxes وقت الحفظ
function collectCustomTags(prefix) {
  const wrap = document.getElementById(prefix + '_customTagsWrap');
  const tags = {};
  if (!wrap) return tags;
  wrap.querySelectorAll('.custom-tag-check:checked').forEach(chk => {
    const qid = chk.dataset.qid;
    if (!tags[qid]) tags[qid] = [];
    tags[qid].push(chk.value);
  });
  return tags;
}

// ============================================================
// المكونات: عناصر إضافية (زجاجات/مكوّنات) تظهر بس عند فتح تفاصيل
// المنتج/البوكس في الموقع — مش على الكارت من برة
// ============================================================
function addComponentRow(prefix, data) {
  const wrap = document.getElementById(prefix + '_componentsWrap');
  if (!wrap) return;
  const row = document.createElement('div');
  row.className = 'component-row border border-gray-200 rounded-xl p-3 space-y-2';
  row.innerHTML = `
    <div class="flex items-center justify-between">
      <span class="text-xs font-bold text-gray-500">🧪 مكوّن</span>
      <button type="button" class="remove-component-btn text-xs text-red-500 hover:underline">🗑 حذف</button>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
      <input class="component-nameAr field-input" placeholder="اسم العنصر بالعربي (مثلاً: عطر شفق)" value="${escapeHTML(data?.nameAr || '')}" />
      <input class="component-nameEn field-input" dir="ltr" placeholder="Name in English (optional)" value="${escapeHTML(data?.nameEn || '')}" />
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
      <textarea class="component-descAr field-input" rows="2" placeholder="يتكون من... بالعربي (مثلاً: شجرة العود + زيت الورد)">${escapeHTML(data?.descAr || '')}</textarea>
      <textarea class="component-descEn field-input" rows="2" dir="ltr" placeholder="Ingredients in English (optional)">${escapeHTML(data?.descEn || '')}</textarea>
    </div>
  `;
  row.querySelector('.remove-component-btn').addEventListener('click', () => row.remove());
  wrap.appendChild(row);
}

function renderComponentsFields(prefix, components) {
  const wrap = document.getElementById(prefix + '_componentsWrap');
  if (!wrap) return;
  wrap.innerHTML = '';
  (Array.isArray(components) ? components : []).forEach(c => addComponentRow(prefix, c));
}

function collectComponents(prefix) {
  const wrap = document.getElementById(prefix + '_componentsWrap');
  if (!wrap) return [];
  return Array.from(wrap.querySelectorAll('.component-row')).map(row => ({
    nameAr: row.querySelector('.component-nameAr').value.trim(),
    nameEn: row.querySelector('.component-nameEn').value.trim(),
    descAr: row.querySelector('.component-descAr').value.trim(),
    descEn: row.querySelector('.component-descEn').value.trim()
  })).filter(c => c.nameAr || c.descAr || c.nameEn || c.descEn);
}

function setupQuizTab() {
  document.getElementById('addFamilyBtn').addEventListener('click', () => {
    const ar = document.getElementById('newFamilyAr').value.trim();
    const en = document.getElementById('newFamilyEn').value.trim();
    if (!ar) { showToast('اكتب اسم نوع الرائحة بالعربي', 'error'); return; }
    if (quizFamilies.some(f => f.key === ar)) { showToast('نوع الرائحة ده موجود بالفعل', 'error'); return; }
    quizFamilies.push({ key: ar, ar, en: en || ar, icon: '✦' });
    document.getElementById('newFamilyAr').value = '';
    document.getElementById('newFamilyEn').value = '';
    renderQuizFamiliesList();
    saveQuizConfig();
    showToast('تمت الإضافة ✅');
  });

  document.getElementById('addDraftOptionBtn').addEventListener('click', () => {
    const ar = document.getElementById('newQOptAr').value.trim();
    const en = document.getElementById('newQOptEn').value.trim();
    if (!ar) { showToast('اكتب اسم الاختيار بالعربي', 'error'); return; }
    if (draftQOptions.some(o => o.key === ar)) { showToast('الاختيار ده موجود بالفعل في نفس السؤال', 'error'); return; }
    draftQOptions.push({ key: ar, ar, en: en || ar });
    document.getElementById('newQOptAr').value = '';
    document.getElementById('newQOptEn').value = '';
    renderDraftOptions();
  });

  document.getElementById('saveCustomQuestionBtn').addEventListener('click', () => {
    const textAr = document.getElementById('newQTextAr').value.trim();
    const textEn = document.getElementById('newQTextEn').value.trim();
    if (!textAr) { showToast('اكتب نص السؤال بالعربي', 'error'); return; }
    if (draftQOptions.length < 2) { showToast('ضيف اختيارين على الأقل للسؤال', 'error'); return; }
    quizCustomQuestions.push({ id: 'q_' + Date.now(), textAr, textEn: textEn || textAr, options: [...draftQOptions] });
    document.getElementById('newQTextAr').value = '';
    document.getElementById('newQTextEn').value = '';
    draftQOptions = [];
    renderDraftOptions();
    renderQuizCustomQuestionsList();
    saveQuizConfig();
    showToast('تمت إضافة السؤال للكويز ✅');
  });

  renderDraftOptions();
  loadQuizConfig();
}

function listenToQuizStats() {
  try {
    onSnapshot(doc(db, 'quizStats', 'counter'), (snap) => {
      const d = snap.exists() ? snap.data() : {};
      const opensEl = document.getElementById('quizOpensCount');
      const compEl = document.getElementById('quizCompletionsCount');
      if (opensEl) opensEl.textContent = d.opens || 0;
      if (compEl) compEl.textContent = d.completions || 0;
    }, (err) => {
      console.error('quizStats listener error:', err);
      const opensEl = document.getElementById('quizOpensCount');
      const compEl = document.getElementById('quizCompletionsCount');
      if (opensEl) opensEl.textContent = '⚠️';
      if (compEl) compEl.textContent = '⚠️';
      showToast('تعذر تحميل عداد الكويز — راجع صلاحيات Firestore لمجموعة quizStats', 'error');
    });
  } catch (err) {
    console.error(err);
  }
}

// بتملي قائمة "نوع الرائحة" في نموذج تعديل العطر/البوكس من نفس إعدادات الكويز
function populateScentSelects(prefix) {
  const famSel = document.getElementById(prefix + '_scentFamily');
  if (famSel) {
    const current = famSel.value;
    famSel.innerHTML = '<option value="">— غير محدد —</option>' +
      quizFamilies.map(f => `<option value="${escapeHTML(f.key)}">${escapeHTML(f.ar)}</option>`).join('');
    famSel.value = current;
  }
}

function setupSettingsForm() {
  document.getElementById('settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('saveSettingsBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'جارٍ الحفظ...';
    try {
      const settingsData = {
        whatsappNumber: document.getElementById('s_whatsappNumber').value.trim(),
        socialLinks: {
          instagram: document.getElementById('s_social_instagram').value.trim(),
          snapchat: document.getElementById('s_social_snapchat').value.trim(),
          tiktok: document.getElementById('s_social_tiktok').value.trim(),
          twitter: document.getElementById('s_social_twitter').value.trim(),
          youtube: document.getElementById('s_social_youtube').value.trim(),
        },
        metaPixelId: document.getElementById('s_metaPixelId').value.trim(),
        tiktokPixelId: document.getElementById('s_tiktokPixelId').value.trim(),
        googleAdsId: document.getElementById('s_googleAdsId').value.trim(),
        updatedAt: serverTimestamp()
      };
      await setDoc(doc(db, 'settings', 'general'), settingsData, { merge: true });
      showToast('تم حفظ الإعدادات بنجاح ✅');
    } catch (err) {
      console.error(err);
      showToast('تعذر حفظ الإعدادات: ' + err.message, 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 حفظ الإعدادات';
    }
  });
}

// ============================================================
// استيراد البيانات الأصلية (مرة واحدة، لو القوائم فاضية)
// ============================================================
const DEFAULT_PRODUCTS = [
  { nameAr:'سويت روتس', nameEn:'Sweet Roots', prices:{ SAR:140, AED:140, OMR:15.5, QAR:160, KWD:14, BHD:15, JOD:32 }, img:'', gallery:[] },
  { nameAr:'بلاك روتس', nameEn:'Black Roots', prices:{ SAR:140, AED:140, OMR:15.5, QAR:160, KWD:14, BHD:15, JOD:32 }, img:'', gallery:[] },
  { nameAr:'دا روتس', nameEn:'Dark Roots', prices:{ SAR:140, AED:140, OMR:15.5, QAR:160, KWD:14, BHD:15, JOD:32 }, img:'', gallery:[] },
  { nameAr:'عود روتس', nameEn:'Oud Roots', prices:{ SAR:140, AED:140, OMR:15.5, QAR:160, KWD:14, BHD:15, JOD:32 }, img:'', gallery:[] },
  { nameAr:'ديانا', nameEn:'Diana', prices:{ SAR:125, AED:125, OMR:14, QAR:145, KWD:13, BHD:13.5, JOD:29 }, img:'', gallery:[] },
  { nameAr:'رافينا', nameEn:'Ravina', prices:{ SAR:125, AED:125, OMR:14, QAR:145, KWD:13, BHD:13.5, JOD:29 }, img:'', gallery:[] },
  { nameAr:'دوليس', nameEn:'Dulice', prices:{ SAR:135, AED:135, OMR:15, QAR:155, KWD:13.5, BHD:14.5, JOD:31 }, img:'', gallery:[] },
  { nameAr:'فيمانتي', nameEn:'Vimanti', prices:{ SAR:135, AED:135, OMR:15, QAR:155, KWD:13.5, BHD:14.5, JOD:31 }, img:'', gallery:[] },
  { nameAr:'اميندا', nameEn:'Amanda', prices:{ SAR:135, AED:135, OMR:15, QAR:155, KWD:13.5, BHD:14.5, JOD:31 }, img:'', gallery:[] },
  { nameAr:'عود ملكي', nameEn:'Royal Oud', prices:{ SAR:175, AED:175, OMR:19.5, QAR:200, KWD:18, BHD:19, JOD:40 }, img:'', gallery:[] },
  { nameAr:'قصة', nameEn:'Qissa', prices:{ SAR:175, AED:175, OMR:19.5, QAR:200, KWD:18, BHD:19, JOD:40 }, img:'', gallery:[] },
  { nameAr:'شما', nameEn:'Shama', prices:{ SAR:149, AED:149, OMR:16.5, QAR:170, KWD:15, BHD:16, JOD:34 }, img:'', gallery:[] },
  { nameAr:'الزعيم', nameEn:'Al Zaeem', prices:{ SAR:149, AED:149, OMR:16.5, QAR:170, KWD:15, BHD:16, JOD:34 }, img:'', gallery:[] },
  { nameAr:'أصايل', nameEn:'Asayel', prices:{ SAR:149, AED:149, OMR:16.5, QAR:170, KWD:15, BHD:16, JOD:34 }, img:'', gallery:[] },
  { nameAr:'تالا', nameEn:'Tala', prices:{ SAR:149, AED:149, OMR:16.5, QAR:170, KWD:15, BHD:16, JOD:34 }, img:'', gallery:[] },
  { nameAr:'أحباب', nameEn:'Ahbab', prices:{ SAR:149, AED:149, OMR:16.5, QAR:170, KWD:15, BHD:16, JOD:34 }, img:'', gallery:[] },
  { nameAr:'دلع', nameEn:'Dalaa', prices:{ SAR:149, AED:149, OMR:16.5, QAR:170, KWD:15, BHD:16, JOD:34 }, img:'', gallery:[] },
  { nameAr:'نورة', nameEn:'Nora', prices:{ SAR:149, AED:149, OMR:16.5, QAR:170, KWD:15, BHD:16, JOD:34 }, img:'', gallery:[] },
  { nameAr:'نوف', nameEn:'Nouf', prices:{ SAR:149, AED:149, OMR:16.5, QAR:170, KWD:15, BHD:16, JOD:34 }, img:'', gallery:[] },
  { nameAr:'مها', nameEn:'Maha', prices:{ SAR:149, AED:149, OMR:16.5, QAR:170, KWD:15, BHD:16, JOD:34 }, img:'', gallery:[] },
  { nameAr:'عرين', nameEn:'Areen', prices:{ SAR:149, AED:149, OMR:16.5, QAR:170, KWD:15, BHD:16, JOD:34 }, img:'', gallery:[] },
  { nameAr:'O5', nameEn:'O5', prices:{ SAR:59, AED:59, OMR:7, QAR:70, KWD:6, BHD:6.5, JOD:14 }, img:'', gallery:[] },
  { nameAr:'O7', nameEn:'O7', prices:{ SAR:59, AED:59, OMR:7, QAR:70, KWD:6, BHD:6.5, JOD:14 }, img:'', gallery:[] },
].map(p => ({ ...p, catAr: 'عطور فاخرة', catEn: 'Luxury Perfumes' }));

const DEFAULT_COLLECTIONS = [
  { nameAr:'الفخامة العربية', nameEn:'Arabian Luxury', descAr:'مجموعة تجمع أصالة العود العربي بلمسة فاخرة مميزة', descEn:'A collection blending authentic Arabian oud with a distinguished luxury touch', prices:{ SAR:495, AED:495, OMR:55, QAR:550, KWD:14, BHD:15, JOD:32 }, img:'', gallery:[] },
  { nameAr:'ديور', nameEn:'Dior', descAr:'إحساس عصري وأناقة راقية تلهم إطلالتك اليومية', descEn:'A modern feel and refined elegance to inspire your everyday look', prices:{ SAR:495, AED:495, OMR:55, QAR:550, KWD:14, BHD:15, JOD:32 }, img:'', gallery:[] },
  { nameAr:'LV', nameEn:'Louis Vuitton', descAr:'رفاهية استثنائية وحضور لا يُنسى في كل مكان', descEn:'Exceptional luxury and an unforgettable presence wherever you go', prices:{ SAR:750, AED:750, OMR:83, QAR:820, KWD:76, BHD:79, JOD:170 }, img:'', gallery:[] },
  { nameAr:'شانيل', nameEn:'Chanel', descAr:'كلاسيكية خالدة بروح عصرية أنيقة', descEn:'Timeless classic style with an elegant modern spirit', prices:{ SAR:495, AED:495, OMR:55, QAR:550, KWD:14, BHD:15, JOD:32 }, img:'', gallery:[] },
  { nameAr:'شغف', nameEn:'Shaghaf', descAr:'عطور تروي قصة شغف وتترك أثراً في القلب', descEn:'Fragrances that tell a story of passion and leave a mark on the heart', prices:{ SAR:550, AED:550, OMR:61, QAR:610, KWD:56, BHD:58, JOD:125 }, img:'', gallery:[] },
  { nameAr:'M أخضر', nameEn:'M Green', descAr:'نفحة منعشة وحيوية تناسب الإطلالة الجريئة', descEn:'A fresh, energetic note suited for a bold look', prices:{ SAR:225, AED:225, OMR:25, QAR:250, KWD:23, BHD:24, JOD:52 }, img:'', gallery:[] },
  { nameAr:'F أحمر', nameEn:'F Red', descAr:'قوة وجاذبية في زجاجة واحدة تلفت الأنظار', descEn:'Strength and allure in one bottle that turns heads', prices:{ SAR:250, AED:250, OMR:28, QAR:280, KWD:25, BHD:27, JOD:58 }, img:'', gallery:[] },
];

function setupImportDefaults() {
  const pBtn = document.getElementById('importDefaultProductsBtn');
  const cBtn = document.getElementById('importDefaultCollectionsBtn');

  if (pBtn) pBtn.addEventListener('click', async () => {
    pBtn.disabled = true;
    pBtn.textContent = 'جارٍ الاستيراد...';
    try {
      const batch = writeBatch(db);
      DEFAULT_PRODUCTS.forEach((p, index) => {
        const numericId = Date.now() + index;
        batch.set(doc(db, 'products', 'prod_seed_' + index), { ...p, id: numericId, order: index, createdAt: serverTimestamp() });
      });
      await batch.commit();
      showToast('تم استيراد ' + DEFAULT_PRODUCTS.length + ' عطر بنجاح ✅ — دلوقتي ارفعلهم صور من "تعديل"');
      await loadProducts();
    } catch (err) {
      console.error(err);
      showToast('تعذر الاستيراد: ' + err.message, 'error');
    } finally {
      pBtn.disabled = false;
      pBtn.textContent = '📥 استيراد قائمة العطور الأصلية (٢٣ عطر)';
    }
  });

  if (cBtn) cBtn.addEventListener('click', async () => {
    cBtn.disabled = true;
    cBtn.textContent = 'جارٍ الاستيراد...';
    try {
      const batch = writeBatch(db);
      DEFAULT_COLLECTIONS.forEach((c, index) => {
        const numericId = Date.now() + index;
        batch.set(doc(db, 'collections', 'col_seed_' + index), { ...c, id: numericId, order: index, createdAt: serverTimestamp() });
      });
      await batch.commit();
      showToast('تم استيراد ' + DEFAULT_COLLECTIONS.length + ' مجموعة بنجاح ✅ — دلوقتي ارفعلهم صور من "تعديل"');
      await loadCollections();
    } catch (err) {
      console.error(err);
      showToast('تعذر الاستيراد: ' + err.message, 'error');
    } finally {
      cBtn.disabled = false;
      cBtn.textContent = '📥 استيراد المجموعات الأصلية (٧ مجموعات)';
    }
  });
}

// ============================================================
// COUPONS (أكواد الخصم) — CRUD كامل + عداد استخدام لكل كود
// ============================================================
let allCoupons = [];

async function loadCoupons() {
  try {
    const snap = await getDocs(collection(db, 'coupons'));
    allCoupons = snap.docs.map(d => ({ _docId: d.id, ...d.data() }));
    allCoupons.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
    renderCouponsList();
  } catch (err) {
    console.error(err);
    showToast('تعذر تحميل الكوبونات: ' + err.message, 'error');
  }
}

function renderCouponsList() {
  const wrap = document.getElementById('couponsList');
  const empty = document.getElementById('couponsEmptyState');
  if (!allCoupons.length) {
    wrap.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  const COUNTRY_LABELS = { SA:'🇸🇦 السعودية', AE:'🇦🇪 الإمارات', OM:'🇴🇲 عمان', QA:'🇶🇦 قطر', KW:'🇰🇼 الكويت', BH:'🇧🇭 البحرين', JO:'🇯🇴 الأردن', EG:'🇪🇬 مصر' };
  wrap.innerHTML = allCoupons.map(c => {
    const valueLabel = c.type === 'percent' ? `${c.value}%` : `${c.value}`;
    const usageLabel = c.usageLimit ? `${c.usageCount || 0} / ${c.usageLimit}` : `${c.usageCount || 0} (غير محدود)`;
    const activeBadge = c.active === false
      ? '<span class="text-xs font-bold bg-gray-200 text-gray-500 px-2 py-1 rounded-full">⏸️ متوقف</span>'
      : '<span class="text-xs font-bold bg-green-100 text-green-700 px-2 py-1 rounded-full">✅ فعّال</span>';
    const countryLabel = (Array.isArray(c.countries) && c.countries.length > 0)
      ? c.countries.map(cc => COUNTRY_LABELS[cc] || cc).join('، ')
      : 'كل الدول 🌍';
    return `<div class="bg-white rounded-2xl border border-gray-200 p-4 flex items-center justify-between flex-wrap gap-3">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <span class="font-black text-base tracking-wide" dir="ltr">${escapeHTML(c.code || '')}</span>
          ${activeBadge}
        </div>
        <p class="text-xs text-gray-500">الخصم: <span class="font-bold text-gray-700">${valueLabel}</span> &nbsp;|&nbsp; الاستخدام: <span class="font-bold text-gray-700">${usageLabel}</span></p>
        <p class="text-xs text-gray-400 mt-1">📍 ${countryLabel}</p>
      </div>
      <div class="flex gap-2">
        <button class="edit-coupon-btn text-xs font-bold px-3 py-1.5 rounded-full border border-gray-300 hover:bg-gray-50" data-docid="${c._docId}">✏️ تعديل</button>
        <button class="delete-coupon-btn text-xs font-bold px-3 py-1.5 rounded-full border border-red-200 text-red-500 hover:bg-red-50" data-docid="${c._docId}">🗑️ حذف</button>
      </div>
    </div>`;
  }).join('');
  wrap.querySelectorAll('.edit-coupon-btn').forEach(b => b.addEventListener('click', () => openCouponModal(b.dataset.docid)));
  wrap.querySelectorAll('.delete-coupon-btn').forEach(b => b.addEventListener('click', () => openDeleteModal('coupon', b.dataset.docid)));
}

function setupCouponModal() {
  document.getElementById('addCouponBtn').addEventListener('click', () => openCouponModal(null));
  document.getElementById('closeCouponModal').addEventListener('click', closeCouponModal);
  document.getElementById('cancelCouponModal').addEventListener('click', closeCouponModal);
  document.getElementById('couponModalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'couponModalOverlay') closeCouponModal();
  });
  document.getElementById('couponForm').addEventListener('submit', handleCouponFormSubmit);
  const allCountriesCb = document.getElementById('cp_allCountries');
  allCountriesCb.addEventListener('change', () => {
    document.getElementById('cp_countriesWrap').classList.toggle('hidden', allCountriesCb.checked);
  });
}

window.openCouponModal = function (docId) {
  const form = document.getElementById('couponForm');
  form.reset();
  document.getElementById('cp_docId').value = '';
  document.getElementById('cp_active').checked = true;
  document.getElementById('cp_allCountries').checked = true;
  document.getElementById('cp_countriesWrap').classList.add('hidden');
  document.querySelectorAll('.cp-country').forEach(cb => cb.checked = false);
  if (docId) {
    const c = allCoupons.find(x => x._docId === docId);
    if (!c) return;
    document.getElementById('couponModalTitle').textContent = 'تعديل الكوبون';
    document.getElementById('cp_docId').value = docId;
    document.getElementById('cp_code').value = c.code || '';
    document.getElementById('cp_type').value = c.type || 'percent';
    document.getElementById('cp_value').value = c.value != null ? c.value : '';
    document.getElementById('cp_usageLimit').value = c.usageLimit || '';
    document.getElementById('cp_active').checked = c.active !== false;
    const hasCountryLimit = Array.isArray(c.countries) && c.countries.length > 0;
    document.getElementById('cp_allCountries').checked = !hasCountryLimit;
    document.getElementById('cp_countriesWrap').classList.toggle('hidden', !hasCountryLimit);
    if (hasCountryLimit) {
      document.querySelectorAll('.cp-country').forEach(cb => cb.checked = c.countries.includes(cb.value));
    }
  } else {
    document.getElementById('couponModalTitle').textContent = 'إضافة كوبون جديد';
  }
  const overlay = document.getElementById('couponModalOverlay');
  overlay.classList.remove('hidden');
  overlay.classList.add('flex');
};

function closeCouponModal() {
  const overlay = document.getElementById('couponModalOverlay');
  overlay.classList.add('hidden');
  overlay.classList.remove('flex');
}

async function handleCouponFormSubmit(e) {
  e.preventDefault();
  const saveBtn = document.getElementById('saveCouponBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'جارٍ الحفظ...';
  try {
    const docId = document.getElementById('cp_docId').value;
    const code = document.getElementById('cp_code').value.trim().toUpperCase();
    const type = document.getElementById('cp_type').value;
    const value = parseFloat(document.getElementById('cp_value').value) || 0;
    const usageLimitRaw = document.getElementById('cp_usageLimit').value;
    const usageLimit = usageLimitRaw ? parseInt(usageLimitRaw, 10) : null;
    const active = document.getElementById('cp_active').checked;
    const allCountries = document.getElementById('cp_allCountries').checked;
    const countries = allCountries ? [] : Array.from(document.querySelectorAll('.cp-country:checked')).map(cb => cb.value);
    if (!allCountries && countries.length === 0) { showToast('اختار دولة واحدة على الأقل، أو فعّل "متاح لكل الدول"', 'error'); saveBtn.disabled = false; saveBtn.textContent = '💾 حفظ الكوبون'; return; }
    if (!code) { showToast('اكتب كود الخصم', 'error'); saveBtn.disabled = false; saveBtn.textContent = '💾 حفظ الكوبون'; return; }

    // تحقق إن الكود مش مكرر (غير الكود اللي بيتعدل حاليًا)
    const dup = allCoupons.find(c => (c.code || '').toUpperCase() === code && c._docId !== docId);
    if (dup) { showToast('في كوبون تاني بنفس الكود فعلاً', 'error'); saveBtn.disabled = false; saveBtn.textContent = '💾 حفظ الكوبون'; return; }

    const data = { code, type, value, usageLimit, active, countries, updatedAt: serverTimestamp() };
    if (docId) {
      await updateDoc(doc(db, 'coupons', docId), data);
    } else {
      data.usageCount = 0;
      data.createdAt = serverTimestamp();
      data.createdAtMs = Date.now();
      await setDoc(doc(db, 'coupons', 'cp_' + Date.now()), data);
    }
    showToast('تم حفظ الكوبون بنجاح ✅');
    closeCouponModal();
    await loadCoupons();
  } catch (err) {
    console.error(err);
    showToast('تعذر حفظ الكوبون: ' + err.message, 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = '💾 حفظ الكوبون';
  }
}

// ============================================================
// REVIEWS / UGC — موافقة/رفض تقييمات العملاء قبل ظهورها في الموقع
// ============================================================
let allReviews = [];
let currentReviewFilter = 'pending';

function listenToReviews() {
  try {
    onSnapshot(collection(db, 'reviews'), (snap) => {
      allReviews = snap.docs.map(d => ({ _docId: d.id, ...d.data() }));
      renderReviewsList();
      const pendingCount = allReviews.filter(r => r.approved !== true).length;
      const badge = document.getElementById('pendingReviewsBadge');
      if (pendingCount > 0) { badge.textContent = pendingCount; badge.classList.remove('hidden'); }
      else badge.classList.add('hidden');
    }, (err) => {
      console.error('reviews listener error:', err);
    });
  } catch (err) {
    console.error(err);
  }
}

function setupReviewsTab() {
  document.querySelectorAll('.review-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.review-filter-btn').forEach(b => { b.classList.remove('active', 'bg-gray-800', 'text-white'); b.classList.add('bg-gray-200'); });
      btn.classList.add('active', 'bg-gray-800', 'text-white');
      btn.classList.remove('bg-gray-200');
      currentReviewFilter = btn.dataset.status;
      renderReviewsList();
    });
  });
}

function renderReviewsList() {
  const wrap = document.getElementById('reviewsList');
  const empty = document.getElementById('reviewsEmptyState');
  let filtered = allReviews;
  if (currentReviewFilter === 'pending') filtered = allReviews.filter(r => r.approved !== true);
  else if (currentReviewFilter === 'approved') filtered = allReviews.filter(r => r.approved === true);
  filtered = [...filtered].sort((a, b) => {
    const ta = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
    const tb = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
    return tb - ta;
  });
  if (!filtered.length) {
    wrap.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  wrap.innerHTML = filtered.map(r => {
    const stars = '★'.repeat(r.rating || 0) + '☆'.repeat(5 - (r.rating || 0));
    const itemLabel = r.itemType === 'product' ? 'منتج' : 'مجموعة';
    const statusBadge = r.approved === true
      ? '<span class="text-xs font-bold bg-green-100 text-green-700 px-2 py-1 rounded-full">✅ ظاهر بالموقع</span>'
      : '<span class="text-xs font-bold bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">⏳ بانتظار الموافقة</span>';
    return `<div class="bg-white rounded-2xl border border-gray-200 p-4">
      <div class="flex items-center justify-between flex-wrap gap-2 mb-2">
        <div>
          <span class="font-bold text-sm">${escapeHTML(r.name || '')}</span>
          <span class="text-gold text-sm mr-2">${stars}</span>
          <span class="text-xs text-gray-400">· ${itemLabel} #${r.itemId ?? ''}</span>
        </div>
        ${statusBadge}
      </div>
      <p class="text-sm text-gray-600 mb-3">${escapeHTML(r.text || '')}</p>
      <div class="flex gap-2">
        ${r.approved !== true
          ? `<button class="approve-review-btn text-xs font-bold px-3 py-1.5 rounded-full bg-green-600 text-white hover:bg-green-700" data-docid="${r._docId}">✅ موافقة وإظهار</button>`
          : `<button class="unapprove-review-btn text-xs font-bold px-3 py-1.5 rounded-full border border-gray-300 hover:bg-gray-50" data-docid="${r._docId}">⏸️ إخفاء مؤقت</button>`}
        <button class="delete-review-btn text-xs font-bold px-3 py-1.5 rounded-full border border-red-200 text-red-500 hover:bg-red-50" data-docid="${r._docId}">🗑️ حذف</button>
      </div>
    </div>`;
  }).join('');
  wrap.querySelectorAll('.approve-review-btn').forEach(b => b.addEventListener('click', () => approveReview(b.dataset.docid)));
  wrap.querySelectorAll('.unapprove-review-btn').forEach(b => b.addEventListener('click', () => unapproveReview(b.dataset.docid)));
  wrap.querySelectorAll('.delete-review-btn').forEach(b => b.addEventListener('click', () => openDeleteModal('review', b.dataset.docid)));
}

window.approveReview = async function (docId) {
  try {
    await updateDoc(doc(db, 'reviews', docId), { approved: true });
    showToast('تم إظهار التقييم في الموقع ✅');
  } catch (err) {
    console.error(err);
    showToast('تعذر تحديث التقييم: ' + err.message, 'error');
  }
};
window.unapproveReview = async function (docId) {
  try {
    await updateDoc(doc(db, 'reviews', docId), { approved: false });
    showToast('تم إخفاء التقييم من الموقع');
  } catch (err) {
    console.error(err);
    showToast('تعذر تحديث التقييم: ' + err.message, 'error');
  }
};

// ============================================================
// ABANDONED CARTS (السلة المتروكة) — متابعة عملاء ماكملوش الطلب
// ============================================================
let allAbandonedCarts = [];

async function loadAbandonedCarts() {
  try {
    const snap = await getDocs(collection(db, 'abandonedCarts'));
    allAbandonedCarts = snap.docs
      .map(d => ({ _docId: d.id, ...d.data() }))
      .filter(c => c.status !== 'converted');
    allAbandonedCarts.sort((a, b) => {
      const ta = a.updatedAt && a.updatedAt.toMillis ? a.updatedAt.toMillis() : 0;
      const tb = b.updatedAt && b.updatedAt.toMillis ? b.updatedAt.toMillis() : 0;
      return tb - ta;
    });
    renderAbandonedCartsList();
  } catch (err) {
    console.error(err);
    showToast('تعذر تحميل السلات المتروكة: ' + err.message, 'error');
  }
}

// نعرض عداد سريع في التاب من غير ما نحمّل القائمة كاملة كل مرة الداشبورد يفتح
function listenToAbandonedCartsBadge() {
  try {
    onSnapshot(collection(db, 'abandonedCarts'), (snap) => {
      const activeCount = snap.docs.filter(d => d.data().status !== 'converted').length;
      const badge = document.getElementById('abandonedCartsBadge');
      if (activeCount > 0) { badge.textContent = activeCount; badge.classList.remove('hidden'); }
      else badge.classList.add('hidden');
    }, (err) => console.error('abandonedCarts badge listener error:', err));
  } catch (err) {
    console.error(err);
  }
}

function renderAbandonedCartsList() {
  const wrap = document.getElementById('abandonedCartsList');
  const empty = document.getElementById('abandonedCartsEmptyState');
  if (!allAbandonedCarts.length) {
    wrap.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  wrap.innerHTML = allAbandonedCarts.map(c => {
    const itemsLabel = (c.items || []).map(i => i.nameAr || i.nameEn).join('، ');
    const phoneDigits = (c.phone || '').replace(/[^\d]/g, '');
    const waMessage = encodeURIComponent(
      `مرحباً ${c.name || ''} 🌿\nلاحظنا إنك كنت بتحاول تكمل طلب من طيب العود ولسه ما اتمش.\nهل تحب نساعدك تكمل الطلب أو عندك أي استفسار؟`
    );
    return `<div class="bg-white rounded-2xl border border-gray-200 p-4 flex items-center justify-between flex-wrap gap-3">
      <div>
        <p class="font-bold text-sm">${escapeHTML(c.name || 'بدون اسم')} ${c.phone ? '· ' + escapeHTML(c.phone) : ''}</p>
        <p class="text-xs text-gray-500 mt-1">${escapeHTML(itemsLabel) || 'سلة بدون منتجات محددة'}</p>
        <p class="text-xs text-gray-400 mt-1">الإجمالي التقريبي: ${c.total || 0} ${c.currency || ''}</p>
      </div>
      <div class="flex gap-2">
        ${phoneDigits ? `<a href="https://wa.me/${phoneDigits}?text=${waMessage}" target="_blank" class="text-xs font-bold px-3 py-1.5 rounded-full bg-green-600 text-white hover:bg-green-700">📲 تواصل واتساب</a>` : ''}
        <button class="dismiss-cart-btn text-xs font-bold px-3 py-1.5 rounded-full border border-gray-300 hover:bg-gray-50" data-docid="${c._docId}">✕ تجاهل</button>
      </div>
    </div>`;
  }).join('');
  wrap.querySelectorAll('.dismiss-cart-btn').forEach(b => b.addEventListener('click', () => openDeleteModal('abandonedCart', b.dataset.docid)));
}

// ============================================================
// CUSTOMERS (قاعدة بيانات العملاء) — متجمّعة من الطلبات المسجّلة حسب رقم الجوال
// ============================================================
let allCustomers = [];

function setupCustomersTab() {
  document.getElementById('loadCustomersBtn').addEventListener('click', loadCustomers);
  document.getElementById('customerSearch').addEventListener('input', (e) => {
    renderCustomersList(e.target.value.trim());
  });
}

async function loadCustomers() {
  const btn = document.getElementById('loadCustomersBtn');
  btn.disabled = true;
  btn.textContent = 'جارٍ التحميل...';
  try {
    const snap = await getDocs(collection(db, 'orders'));
    const orders = snap.docs.map(d => d.data());
    const byPhone = {};
    orders.forEach(o => {
      const key = (o.phone || '').trim() || ('بدون رقم-' + (o.name || 'غير معروف'));
      if (!byPhone[key]) byPhone[key] = { phone: o.phone || '', name: o.name || '', city: o.city || '', ordersCount: 0, totalSpent: 0, lastOrderMs: 0 };
      byPhone[key].ordersCount += 1;
      byPhone[key].totalSpent += (o.total || 0);
      byPhone[key].name = o.name || byPhone[key].name;
      byPhone[key].city = o.city || byPhone[key].city;
      const ms = o.createdAt && o.createdAt.toMillis ? o.createdAt.toMillis() : 0;
      if (ms > byPhone[key].lastOrderMs) byPhone[key].lastOrderMs = ms;
    });
    allCustomers = Object.values(byPhone).sort((a, b) => b.totalSpent - a.totalSpent);
    renderCustomersList('');
    showToast('تم تحميل بيانات ' + allCustomers.length + ' عميل ✅');
  } catch (err) {
    console.error(err);
    showToast('تعذر تحميل بيانات العملاء: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '🔄 تحميل / تحديث بيانات العملاء';
  }
}

function renderCustomersList(searchTerm) {
  const wrap = document.getElementById('customersList');
  const empty = document.getElementById('customersEmptyState');
  let list = allCustomers;
  if (searchTerm) {
    const t = searchTerm.toLowerCase();
    list = list.filter(c => (c.name || '').toLowerCase().includes(t) || (c.phone || '').includes(t));
  }
  if (!list.length) {
    wrap.innerHTML = '';
    empty.classList.remove('hidden');
    if (allCustomers.length) empty.querySelector('p:last-child').textContent = 'مفيش نتائج مطابقة للبحث.';
    return;
  }
  empty.classList.add('hidden');
  wrap.innerHTML = list.map(c => {
    const loyaltyBadge = c.ordersCount >= 3
      ? '<span class="text-xs font-bold bg-gold/20 text-gold-700 px-2 py-1 rounded-full">⭐ عميل دائم</span>'
      : (c.ordersCount === 1 ? '<span class="text-xs font-bold bg-gray-100 text-gray-500 px-2 py-1 rounded-full">أول طلب</span>' : '');
    const phoneDigits = (c.phone || '').replace(/[^\d]/g, '');
    return `<div class="bg-white rounded-2xl border border-gray-200 p-4 flex items-center justify-between flex-wrap gap-3">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <span class="font-bold text-sm">${escapeHTML(c.name || 'غير معروف')}</span>
          ${loyaltyBadge}
        </div>
        <p class="text-xs text-gray-500" dir="ltr">${escapeHTML(c.phone || '—')}</p>
        <p class="text-xs text-gray-400 mt-1">${c.ordersCount} طلب · إجمالي إنفاق: ${Math.round(c.totalSpent * 100) / 100}</p>
      </div>
      ${phoneDigits ? `<a href="https://wa.me/${phoneDigits}" target="_blank" class="text-xs font-bold px-3 py-1.5 rounded-full bg-green-600 text-white hover:bg-green-700">📲 واتساب</a>` : ''}
    </div>`;
  }).join('');
}

// ============================================================
// QUIZ ANSWER BREAKDOWN — أكتر اختيارات العملاء تكرارًا في الكويز
// ============================================================
function listenToQuizAnswerBreakdown() {
  try {
    onSnapshot(doc(db, 'quizStats', 'answers'), (snap) => {
      const d = snap.exists() ? snap.data() : {};
      renderQuizAnswerBreakdown(d);
    }, (err) => console.error('quiz answers listener error:', err));
  } catch (err) {
    console.error(err);
  }
}

function renderQuizAnswerBreakdown(data) {
  const wrap = document.getElementById('quizAnswerBreakdown');
  const emptyEl = document.getElementById('quizAnswerBreakdownEmpty');
  if (!wrap) return;
  const sections = [
    { key: 'family', label: '🌿 أكتر عائلة روائح مطلوبة' },
    { key: 'budget', label: '💰 أكتر فئة سعرية مطلوبة' }
  ];
  let hasAny = false;
  wrap.innerHTML = sections.map(sec => {
    const values = data[sec.key] || {};
    const entries = Object.entries(values).sort((a, b) => b[1] - a[1]);
    if (entries.length) hasAny = true;
    const rows = entries.slice(0, 5).map(([k, v]) => `<div class="flex justify-between text-xs py-1 border-b border-dashed border-gray-100"><span>${escapeHTML(k)}</span><span class="font-bold text-gold">${v}</span></div>`).join('');
    return `<div class="bg-gray-50 rounded-xl p-3">
      <p class="text-xs font-bold text-gray-600 mb-2">${sec.label}</p>
      ${rows || '<p class="text-xs text-gray-400">لا توجد بيانات بعد</p>'}
    </div>`;
  }).join('');
  emptyEl.classList.toggle('hidden', hasAny);
}
