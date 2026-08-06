// ============================================
// Firebase Configuration - طيب العود (TAIEB ALOUD)
// ملف الإعدادات المشترك بين كل الصفحات
// ============================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAnalytics, logEvent, isSupported } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";

// إعدادات مشروع Firebase الخاص بموقع طيب العود
const firebaseConfig = {
  apiKey: "AIzaSyATMyPlF6pgaUFTT0iUtORKQZ67ZCL9gMM",
  authDomain: "taieb-aloud.firebaseapp.com",
  projectId: "taieb-aloud",
  storageBucket: "taieb-aloud.firebasestorage.app",
  messagingSenderId: "677880660565",
  appId: "1:677880660565:web:551b0629e541db58c70adc",
  // ⚠️ لازم تستبدل القيمة دي بمعرّف القياس (Measurement ID) الحقيقي بتاعك عشان يشتغل Firebase Analytics:
  // من Firebase Console → ⚙️ Project settings → Analytics (فعّلها لو مش مفعّلة) → هتلاقي القيمة تحت "Your apps"
  // شكلها هيكون حاجة زي: "G-XXXXXXXXXX"
  measurementId: "G-7XEQVQC6Y8"
};

// تهيئة Firebase
const app = initializeApp(firebaseConfig);

// تصدير الخدمات
export const auth = getAuth(app);
export const db = getFirestore(app);

// ============================================
// ⚠️ إصلاح مهم: تثبيت طريقة حفظ جلسة الدخول (Persistence) بشكل صريح
// من غير السطر ده، بعض المتصفحات (خصوصًا الوضع الخفي/بعض متصفحات الموبايل)
// ممكن ما تحفظش جلسة الدخول صح، فيحصل إن الأدمن/العامل يسجل دخول ويترمي
// تاني على صفحة تسجيل الدخول لحظة ما الصفحة تعمل reload كامل.
// ============================================
export const authReady = setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn('تعذر ضبط نوع حفظ الجلسة (persistence)، هيتم المتابعة بالإعداد الافتراضي:', err);
});

// ============================================
// Firebase Analytics — مجاني بالكامل، بيتفعّل بس بعد ما تحط measurementId الحقيقي فوق
// ============================================
let _analytics = null;
isSupported().then((supported) => {
  if (supported && firebaseConfig.measurementId && firebaseConfig.measurementId !== 'G-XXXXXXXXXX') {
    try {
      _analytics = getAnalytics(app);
      logEvent(_analytics, 'page_view'); // تسجيل زيارة الصفحة تلقائيًا
    } catch (err) {
      console.warn('تعذر تفعيل Firebase Analytics:', err);
    }
  }
}).catch(() => {});

// دالة آمنة لتسجيل أي حدث (add_to_cart, order_placed...) — ماتعملش أي مشكلة لو الـ Analytics لسه مش مفعّل
export function trackEvent(eventName, params = {}) {
  try {
    if (_analytics) logEvent(_analytics, eventName, params);
  } catch (err) { /* تجاهل بصمت */ }
}

// ============================================
// Cloudinary — تخزين ورفع الصور
// ============================================
// ⚠️ دول قيم عامة وآمنة تمامًا يُسمح بظهورها في كود الموقع (مفيش أي سيكرت هنا خالص).
// الرفع بيتم عن طريق "Unsigned Upload Preset" فقط — لازم تتعمل مرة واحدة من Cloudinary Dashboard:
// Settings → Upload → Add upload preset → Signing Mode: Unsigned → سمّيه بنفس الاسم تحت
export const CLOUDINARY_CLOUD_NAME = "o1um5dst";
export const CLOUDINARY_UPLOAD_PRESET = "taieb_aloud_unsigned";
