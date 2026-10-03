import { createContext, useContext, useEffect, useState } from "react";

const dict = {
  en: {
    menu: "Menu", cart: "Cart", addToCart: "Add", submitOrder: "Submit Order",
    callStaff: "Call Staff", askBill: "Ask for Bill", table: "Table",
    price: "Price", qty: "Qty", total: "Total", subtotal: "Subtotal",
    yourName: "Your name (optional)", phone: "Phone (optional)",
    unavailable: "Unavailable", popular: "Popular", empty: "Your cart is empty",
    orderStatus: "Order Status", received: "Received", preparing: "Preparing",
    ready: "Ready", served: "Served", pay: "Pay", cash: "Cash", khqr: "KHQR",
    payway: "ABA PayWay", scanToPay: "Scan to Pay", waitingCash: "Waiter will collect cash",
    close: "Close", paid: "Paid", note: "Note (e.g. no chili)",
    orderPlaced: "Order placed! Kitchen has it.", staffCalled: "Staff has been notified",
    billRequested: "Bill requested. Waiter is on the way.",
    perGuest: "Per Guest", allOrders: "All Orders", welcome: "Welcome to",
    tapItemToAdd: "Tap items to add to your table's shared bill",
    yourBill: "Your Bill", noOrdersYet: "No orders yet",
    poweredBy: "Order faster with QR", langLabel: "ភាសាខ្មែរ / EN",
  },
  km: {
    menu: "ម៉ឺនុយ", cart: "កន្ត្រក", addToCart: "បន្ថែម", submitOrder: "បញ្ជាទិញ",
    callStaff: "ហៅបុគ្គលិក", askBill: "សុំវិក័យប័ត្រ", table: "តុ",
    price: "តម្លៃ", qty: "ចំនួន", total: "សរុប", subtotal: "សរុបរង",
    yourName: "ឈ្មោះអ្នក (ស្រេច)", phone: "លេខទូរស័ព្ទ (ស្រេច)",
    unavailable: "អស់ស្តុក", popular: "ពេញនិយម", empty: "កន្ត្រកទទេ",
    orderStatus: "ស្ថានភាពការបញ្ជាទិញ", received: "បានទទួល", preparing: "កំពុងចម្អិន",
    ready: "រួចរាល់", served: "បានផ្ដល់ជូន", pay: "បង់ប្រាក់", cash: "សាច់ប្រាក់", khqr: "KHQR",
    payway: "ABA PayWay", scanToPay: "ស្កែនដើម្បីបង់ប្រាក់", waitingCash: "បុគ្គលិកនឹងមកយកសាច់ប្រាក់",
    close: "បិទ", paid: "បានបង់", note: "កំណត់ចំណាំ (ឧ. មិនហិរ)",
    orderPlaced: "បានបញ្ជាទិញ! ផ្ទះបាយបានទទួល។", staffCalled: "បានហៅបុគ្គលិកហើយ",
    billRequested: "បានស្នើសុំវិក័យប័ត្រ។ បុគ្គលិកកំពុងមក។",
    perGuest: "តាមភ្ញៀវ", allOrders: "ការបញ្ជាទាំងអស់", welcome: "សូមស្វាគមន៍មកកាន់",
    tapItemToAdd: "ចុចលើម្ហូបដើម្បីបន្ថែម", yourBill: "វិក័យប័ត្ររបស់អ្នក",
    noOrdersYet: "មិនទាន់មានការបញ្ជាទិញ", poweredBy: "បញ្ជាទិញលឿនតាម QR",
    langLabel: "EN / ភាសាខ្មែរ",
  },
};

const I18nCtx = createContext({ lang: "en", t: (k) => k, setLang: () => {} });

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem("bbq_lang") || "en");
  useEffect(() => {
    localStorage.setItem("bbq_lang", lang);
    document.documentElement.lang = lang;
  }, [lang]);
  const t = (k) => dict[lang][k] ?? dict.en[k] ?? k;
  const nameOf = (obj) => (lang === "km" && obj?.name_km ? obj.name_km : obj?.name_en) || "";
  const descOf = (obj) => (lang === "km" && obj?.description_km ? obj.description_km : obj?.description_en) || "";
  return <I18nCtx.Provider value={{ lang, setLang, t, nameOf, descOf }}>{children}</I18nCtx.Provider>;
}

export function useI18n() { return useContext(I18nCtx); }
