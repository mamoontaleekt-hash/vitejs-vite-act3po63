import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import {
  Plus,
  Minus,
  Wallet,
  Home,
  Zap,
  ShoppingCart,
  CreditCard,
  TrendingUp,
  Calendar,
  Trash2,
  PieChart,
  Menu,
  X,
  Banknote,
  Activity,
} from 'lucide-react';

// ---------------------------------------------------------
// 🔴 هام جداً: استبدل البيانات أدناه ببيانات مشروعك من Firebase
// ---------------------------------------------------------
const firebaseConfig = {
  apiKey: 'AIzaSyDgehR_k3bf1TfKLEATbrOTWCbR5a-aKmU',
  authDomain: 'myfamilybudget-7d185.firebaseapp.com',
  projectId: 'myfamilybudget-7d185',
  storageBucket: 'myfamilybudget-7d185.firebasestorage.app',
  messagingSenderId: '199879731514',
  appId: '1:199879731514:web:9bdc000321761f00e80803',
};

// تهيئة التطبيق
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// اسم المجموعة في قاعدة البيانات (يمكنك تغييره)
const COLLECTION_NAME = 'family_transactions_v1';

// --- Categories Configuration (Iraqi Context) ---
const EXPENSE_CATEGORIES = [
  {
    id: 'food',
    name: 'طعام ومسواق',
    icon: <ShoppingCart />,
    color: 'bg-orange-100 text-orange-600',
  },
  {
    id: 'rent',
    name: 'إيجار منزل',
    icon: <Home />,
    color: 'bg-blue-100 text-blue-600',
  },
  {
    id: 'utilities',
    name: 'كهرباء/مولدة/ماء',
    icon: <Zap />,
    color: 'bg-yellow-100 text-yellow-600',
  },
  {
    id: 'debt',
    name: 'تسديد ديون',
    icon: <CreditCard />,
    color: 'bg-red-100 text-red-600',
  },
  {
    id: 'transport',
    name: 'نقل وبانزين',
    icon: <Activity />,
    color: 'bg-purple-100 text-purple-600',
  },
  {
    id: 'personal',
    name: 'مصاريف شخصية',
    icon: <Wallet />,
    color: 'bg-indigo-100 text-indigo-600',
  },
  {
    id: 'other',
    name: 'نثريات أخرى',
    icon: <TrendingUp />,
    color: 'bg-gray-100 text-gray-600',
  },
];

const INCOME_CATEGORIES = [
  {
    id: 'salary_fixed',
    name: 'راتب (750)',
    icon: <Banknote />,
    color: 'bg-green-100 text-green-600',
  },
  {
    id: 'salary_var',
    name: 'راتب (متغير)',
    icon: <TrendingUp />,
    color: 'bg-emerald-100 text-emerald-600',
  },
  {
    id: 'other_income',
    name: 'إيراد آخر',
    icon: <Plus />,
    color: 'bg-teal-100 text-teal-600',
  },
];

// --- Components ---

const LoadingScreen = () => (
  <div
    className="flex flex-col items-center justify-center h-screen bg-gray-50"
    dir="rtl"
  >
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mb-4"></div>
    <p className="text-gray-600 font-medium">جاري تحميل المحفظة...</p>
  </div>
);

const StatCard = ({ title, amount, type, icon }) => (
  <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
    <div>
      <p className="text-gray-500 text-xs mb-1">{title}</p>
      <p
        className={`text-xl font-bold ${
          type === 'income'
            ? 'text-emerald-600'
            : type === 'expense'
            ? 'text-red-600'
            : 'text-gray-800'
        }`}
      >
        {amount.toLocaleString()}{' '}
        <span className="text-xs font-normal text-gray-400">د.ع</span>
      </p>
    </div>
    <div
      className={`p-3 rounded-full ${
        type === 'income'
          ? 'bg-emerald-50 text-emerald-600'
          : type === 'expense'
          ? 'bg-red-50 text-red-600'
          : 'bg-blue-50 text-blue-600'
      }`}
    >
      {icon}
    </div>
  </div>
);

export default function App() {
  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('dashboard');

  // Form State
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [type, setType] = useState('expense');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Authentication & Data Sync ---
  useEffect(() => {
    // تسجيل دخول بسيط (مجهول) للبدء
    signInAnonymously(auth).catch((error) => {
      console.error('Auth Error:', error);
    });

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) setLoading(false);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    // جلب البيانات من المجموعة الموحدة
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeData = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
        }));
        setTransactions(data);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching transactions:', error);
        setLoading(false);
      }
    );

    return () => unsubscribeData();
  }, [user]);

  // --- Calculations ---
  const summary = useMemo(() => {
    const income = transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const expense = transactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    return {
      income,
      expense,
      balance: income - expense,
    };
  }, [transactions]);

  const expensesByCategory = useMemo(() => {
    const groups = {};
    transactions
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        if (!groups[t.categoryId]) groups[t.categoryId] = 0;
        groups[t.categoryId] += Number(t.amount);
      });
    return groups;
  }, [transactions]);

  // --- Actions ---
  const handleAddTransaction = async (e) => {
    e.preventDefault();
    if (!amount || isSubmitting) return;

    setIsSubmitting(true);
    try {
      // إضافة البيانات لقاعدة البيانات المشتركة
      await addDoc(collection(db, COLLECTION_NAME), {
        amount: Number(amount),
        categoryName: category.name,
        categoryId: category.id,
        type,
        note,
        createdAt: serverTimestamp(),
        addedBy: user.uid,
      });

      setAmount('');
      setNote('');
      setView('dashboard');
    } catch (error) {
      console.error('Error adding document: ', error);
      alert('حدث خطأ أثناء الحفظ، تأكد من الاتصال بالانترنت');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('هل أنت متأكد من حذف هذا السجل؟')) {
      await deleteDoc(doc(db, COLLECTION_NAME, id));
    }
  };

  const activeCategories =
    type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  if (loading) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-20" dir="rtl">
      {/* Header */}
      <div className="bg-emerald-700 text-white p-6 rounded-b-3xl shadow-lg relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <svg width="100%" height="100%">
            <pattern
              id="grid"
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="white"
                strokeWidth="1"
              />
            </pattern>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="relative z-10">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">مصاريف العائلة</h1>
            <div className="bg-emerald-600 p-2 rounded-full">
              <Wallet className="w-6 h-6 text-emerald-100" />
            </div>
          </div>

          <div className="text-center mb-2">
            <p className="text-emerald-200 text-sm mb-1">الرصيد المتبقي</p>
            <h2 className="text-4xl font-bold dir-ltr inline-block tracking-tight">
              {summary.balance.toLocaleString()}
            </h2>
            <span className="text-sm mr-2 font-medium">د.ع</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="px-4 -mt-8 relative z-20 grid grid-cols-2 gap-3">
        <StatCard
          title="مجموع الدخل"
          amount={summary.income}
          type="income"
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <StatCard
          title="مجموع الصرف"
          amount={summary.expense}
          type="expense"
          icon={<TrendingUp className="w-5 h-5 rotate-180" />}
        />
      </div>

      {/* Main Content */}
      <div className="p-4 pt-6">
        {view === 'dashboard' && (
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => {
                  setType('expense');
                  setView('add');
                }}
                className="flex items-center justify-center gap-2 bg-red-50 text-red-700 p-4 rounded-xl border border-red-100 shadow-sm active:scale-95 transition-transform"
              >
                <div className="bg-red-200 p-1 rounded-full">
                  <Minus size={18} />
                </div>
                <span className="font-bold">صرف جديد</span>
              </button>
              <button
                onClick={() => {
                  setType('income');
                  setView('add');
                }}
                className="flex items-center justify-center gap-2 bg-emerald-50 text-emerald-700 p-4 rounded-xl border border-emerald-100 shadow-sm active:scale-95 transition-transform"
              >
                <div className="bg-emerald-200 p-1 rounded-full">
                  <Plus size={18} />
                </div>
                <span className="font-bold">إضافة دخل</span>
              </button>
            </div>

            {/* Recent Transactions Preview */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-700">أحدث الحركات</h3>
                <button
                  onClick={() => setView('history')}
                  className="text-sm text-emerald-600 font-medium"
                >
                  عرض الكل
                </button>
              </div>

              <div className="space-y-3">
                {transactions.length === 0 ? (
                  <p className="text-center text-gray-400 py-4 text-sm">
                    لا توجد سجلات لهذا الشهر
                  </p>
                ) : (
                  transactions.slice(0, 5).map((t) => (
                    <div
                      key={t.id}
                      className="flex justify-between items-center border-b border-gray-50 last:border-0 pb-2 last:pb-0"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-full ${
                            t.type === 'income'
                              ? 'bg-green-100 text-green-600'
                              : 'bg-red-50 text-red-500'
                          }`}
                        >
                          {t.type === 'income' ? (
                            <Plus size={16} />
                          ) : (
                            EXPENSE_CATEGORIES.find(
                              (c) => c.id === t.categoryId
                            )?.icon || <Minus size={16} />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800 text-sm">
                            {t.categoryName}
                          </p>
                          <p className="text-xs text-gray-400">
                            {t.createdAt.toLocaleDateString('ar-IQ', {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'numeric',
                            })}
                            {t.note && ` - ${t.note}`}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`font-bold text-sm ${
                          t.type === 'income'
                            ? 'text-emerald-600'
                            : 'text-gray-800'
                        }`}
                      >
                        {t.type === 'income' ? '+' : '-'}
                        {t.amount.toLocaleString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Spending Breakdown Preview */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-700">تحليل الصرف</h3>
                <button
                  onClick={() => setView('analysis')}
                  className="text-sm text-emerald-600 font-medium"
                >
                  تفاصيل
                </button>
              </div>
              {/* Simple visual bars for top 3 expenses */}
              <div className="space-y-3">
                {Object.entries(expensesByCategory)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 3)
                  .map(([catId, total]) => {
                    const cat = EXPENSE_CATEGORIES.find((c) => c.id === catId);
                    const percent =
                      Math.min((total / summary.expense) * 100, 100) || 0;
                    return (
                      <div key={catId}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-600">{cat?.name}</span>
                          <span className="font-bold text-gray-800">
                            {total.toLocaleString()}
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div
                            className="bg-emerald-500 h-2 rounded-full"
                            style={{ width: `${percent}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                {summary.expense === 0 && (
                  <p className="text-xs text-gray-400 text-center">
                    لا توجد بيانات للصرف بعد
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {view === 'add' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">
                {type === 'income' ? 'تسجيل إيراد جديد' : 'تسجيل مصروف جديد'}
              </h2>
              <button
                onClick={() => setView('dashboard')}
                className="bg-gray-200 p-2 rounded-full text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddTransaction} className="space-y-6">
              {/* Amount Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-600">
                  المبلغ (دينار عراقي)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    className="w-full text-4xl font-bold text-center py-4 border-2 border-emerald-100 rounded-2xl focus:border-emerald-500 focus:outline-none bg-white text-gray-800"
                    autoFocus
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-sm">
                    IQD
                  </span>
                </div>
                {/* Quick amount suggestions */}
                <div className="flex gap-2 justify-center flex-wrap">
                  {[5000, 10000, 25000, 50000, 100000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setAmount(val)}
                      className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full hover:bg-emerald-100"
                    >
                      {val.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-600">
                  تصنيف الصرف
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {activeCategories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`flex flex-col items-center p-3 rounded-xl border transition-all ${
                        category.id === cat.id
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm scale-105'
                          : 'border-gray-100 bg-white text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <div className="mb-2">{cat.icon}</div>
                      <span className="text-xs font-medium text-center">
                        {cat.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Note Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-600">
                  ملاحظة (اختياري)
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="مثلاً: مولدة شهر 5"
                  className="w-full p-4 border border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none bg-white"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !amount}
                className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-emerald-700 disabled:opacity-50 disabled:shadow-none transition-all"
              >
                {isSubmitting ? 'جاري الحفظ...' : 'حفظ العملية'}
              </button>
            </form>
          </div>
        )}

        {view === 'history' && (
          <div className="animate-in fade-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">سجل العمليات</h2>
              <button
                onClick={() => setView('dashboard')}
                className="bg-gray-200 p-2 rounded-full text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {transactions.map((t) => (
                <div
                  key={t.id}
                  className="flex justify-between items-center p-4 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-full ${
                        t.type === 'income'
                          ? 'bg-green-100 text-green-600'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {t.type === 'income' ? (
                        <Plus size={18} />
                      ) : (
                        EXPENSE_CATEGORIES.find((c) => c.id === t.categoryId)
                          ?.icon || <Minus size={18} />
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-gray-800 text-sm">
                        {t.categoryName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {t.createdAt.toLocaleDateString('ar-IQ')} •{' '}
                        {t.createdAt.toLocaleTimeString('ar-IQ', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {t.note && (
                          <span className="block text-gray-400 mt-0.5">
                            {t.note}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`font-bold dir-ltr ${
                        t.type === 'income'
                          ? 'text-emerald-600'
                          : 'text-gray-800'
                      }`}
                    >
                      {t.type === 'income' ? '+' : '-'}
                      {Number(t.amount).toLocaleString()}
                    </span>
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'analysis' && (
          <div className="animate-in fade-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">
                أين تذهب أموالي؟
              </h2>
              <button
                onClick={() => setView('dashboard')}
                className="bg-gray-200 p-2 rounded-full text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid gap-4">
              {Object.entries(expensesByCategory)
                .sort(([, a], [, b]) => b - a)
                .map(([catId, total]) => {
                  const cat = EXPENSE_CATEGORIES.find((c) => c.id === catId);
                  const percent = ((total / summary.expense) * 100).toFixed(1);
                  return (
                    <div
                      key={catId}
                      className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`p-3 rounded-full ${
                            cat?.color || 'bg-gray-100'
                          }`}
                        >
                          {cat?.icon}
                        </div>
                        <div>
                          <p className="font-bold text-gray-700">{cat?.name}</p>
                          <p className="text-xs text-gray-400">
                            {percent}% من الصرف
                          </p>
                        </div>
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-gray-800">
                          {total.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500">د.ع</p>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 pb-safe shadow-lg z-50">
        <div className="flex justify-around items-center p-3">
          <button
            onClick={() => setView('dashboard')}
            className={`flex flex-col items-center gap-1 ${
              view === 'dashboard' ? 'text-emerald-600' : 'text-gray-400'
            }`}
          >
            <Home size={24} />
            <span className="text-[10px] font-medium">الرئيسية</span>
          </button>

          <div className="relative -top-5">
            <button
              onClick={() => {
                setType('expense');
                setView('add');
              }}
              className="bg-emerald-600 text-white p-4 rounded-full shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-colors"
            >
              <Plus size={28} />
            </button>
          </div>

          <button
            onClick={() => setView('analysis')}
            className={`flex flex-col items-center gap-1 ${
              view === 'analysis' ? 'text-emerald-600' : 'text-gray-400'
            }`}
          >
            <PieChart size={24} />
            <span className="text-[10px] font-medium">تحليل</span>
          </button>
        </div>
      </div>
    </div>
  );
}
