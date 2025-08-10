/// <reference types="office-js" />
import { 
  auth, 
  createDefaultAdmin, 
  createUserRecord,
  getUserData,
  getUsersList,
  removeUser,
  setAdminStatus,
  UserData 
} from "./firebaseConfig";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  User
} from "firebase/auth";

declare global {
  interface Window {
    Office: any;
    Excel: any;
  }
}



let isAdminUser = false;
let usersList: UserData[] = [];
let selectedUserId = "";

const API_BASE = "https://open.er-api.com/v6/latest";

let currentUser: User | null = null;
let allCurrencies: string[] = [];
let selectedFromCurrency: string | null = null;
let selectedToCurrency: string | null = null;

function showMessage(elementId: string, text: string, isError: boolean = false) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = text;
  el.className = isError ? "message error" : "message success";
}

async function loadAllCurrencies(): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/USD`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.result !== "success" || !data.rates) throw new Error("Invalid data from API");

    allCurrencies = Object.keys(data.rates).sort();
    if (data.base && !allCurrencies.includes(data.base)) allCurrencies.push(data.base);

    initCurrencySelect("from");
    initCurrencySelect("to");

    showMessage("converter-message", "Currencies loaded", false);
  } catch (err: any) {
    console.error("loadAllCurrencies:", err);
    showMessage("converter-message", "Failed to load currencies (network).", true);
  }
}

function initCurrencySelect(type: "from" | "to") {
  const inputId = `${type}-currency-input`;
  const listId = `${type}-currency-list`;

  const input = document.getElementById(inputId) as HTMLInputElement;
  const list = document.getElementById(listId) as HTMLUListElement;

  if (!input || !list) return;

  function populateList(filter = "") {
    list.innerHTML = "";
    const q = filter.trim().toUpperCase();
    const filtered = q ? allCurrencies.filter(c => c.includes(q)) : allCurrencies;
    
    filtered.slice(0, 100).forEach(currency => {
      const li = document.createElement("li");
      li.textContent = currency;
      li.addEventListener("click", () => {
        input.value = currency;
        if (type === "from") selectedFromCurrency = currency;
        else selectedToCurrency = currency;
        list.style.display = "none";
        showMessage("converter-message", `${currency} selected`, false);
      });
      list.appendChild(li);
    });
  }

  input.addEventListener("focus", () => {
    populateList();
    list.style.display = "block";
  });

  input.addEventListener("input", () => {
    populateList(input.value);
    list.style.display = "block";
  });

  document.addEventListener("click", (e) => {
    if (!input.contains(e.target as Node) && !list.contains(e.target as Node)) {
      list.style.display = "none";
    }
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      list.style.display = "none";
    }
  });

  // Initial placeholder
  input.value = "";
  input.placeholder = "Select currency";
}

async function convertSelectedCell(): Promise<void> {
  const fromCurrency = selectedFromCurrency;
  const toCurrency = selectedToCurrency;

  if (!fromCurrency || !toCurrency) {
    showMessage("converter-message", "Please select both currencies", true);
    return;
  }

  if (!allCurrencies.includes(fromCurrency) || !allCurrencies.includes(toCurrency)) {
    showMessage("converter-message", "Invalid currency selected", true);
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/${fromCurrency}`);
    if (!res.ok) throw new Error(`Rate fetch failed: ${res.status}`);
    const data = await res.json();
    if (data.result !== "success" || !data.rates) throw new Error("Invalid rate data");

    const rate = data.rates[toCurrency];
    if (rate === undefined) throw new Error(`Rate not available for ${toCurrency}`);

    await Excel.run(async (context) => {
      const range = context.workbook.getSelectedRange();
      range.load("values");
      await context.sync();

      const raw = range.values?.[0]?.[0];
      const amount = (typeof raw === "number") ? raw : parseFloat(String(raw));
      if (isNaN(amount)) {
        showMessage("converter-message", "Selected cell must contain a number", true);
        return;
      }

      const converted = amount * rate;
      range.values = [[converted]];
      await context.sync();

      showMessage("converter-message", 
        `Converted ${amount} ${fromCurrency} → ${converted.toFixed(2)} ${toCurrency}`, 
        false
      );

      // Reset selections
      resetCurrencySelectors();
    });
  } catch (err: any) {
    console.error("convertSelectedCell:", err);
    showMessage("converter-message", err.message || "Conversion failed", true);
  }
}

function resetCurrencySelectors() {
  const fromInput = document.getElementById("from-currency-input") as HTMLInputElement;
  const toInput = document.getElementById("to-currency-input") as HTMLInputElement;
  const fromList = document.getElementById("from-currency-list") as HTMLUListElement;
  const toList = document.getElementById("to-currency-list") as HTMLUListElement;

  if (fromInput) {
    fromInput.value = "";
    fromInput.placeholder = "Select currency";
  }
  if (toInput) {
    toInput.value = "";
    toInput.placeholder = "Select currency";
  }
  if (fromList) fromList.style.display = "none";
  if (toList) toList.style.display = "none";

  selectedFromCurrency = null;
  selectedToCurrency = null;
}

function toggleAuthForm(isLogin: boolean) {
  const title = document.getElementById("form-title");
  const nameGroup = document.getElementById("name-group");
  const authButton = document.getElementById("auth-button");
  const toggleAuth = document.getElementById("toggle-auth");

  if (!title || !nameGroup || !authButton || !toggleAuth) return;
  title.textContent = isLogin ? "Login" : "Register";
  nameGroup.style.display = isLogin ? "none" : "block";
  (authButton as HTMLButtonElement).textContent = isLogin ? "Login" : "Register";
  (toggleAuth as HTMLButtonElement).textContent = isLogin ? "Create Account" : "Back to Login";
  showMessage("auth-message", isLogin ? "Welcome back! Please login" : "Create your account", false);
}

async function initializeApp() {
  await createDefaultAdmin();
showMessage("auth-message", "Welcome!", false);
  document.getElementById("toggle-auth")?.addEventListener("click", () => {
    const isLogin = (document.getElementById("auth-button") as HTMLButtonElement).textContent === "Login";
    toggleAuthForm(!isLogin);
  
  });

  document.getElementById("admin-btn")?.addEventListener("click", showUserManagementModal);
  document.getElementById("remove-user-btn")?.addEventListener("click", handleRemoveUser);
  document.getElementById("make-admin-btn")?.addEventListener("click", handleMakeAdmin);
// Close modal when clicking X
  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener("click", closeModals);
  });

  // Close modal when clicking outside
  window.addEventListener("click", (event) => {
    if ((event.target as HTMLElement).className === "modal") {
      closeModals();
    }
  });
  document.getElementById("auth-button")?.addEventListener("click", async () => {
    const email = (document.getElementById("email") as HTMLInputElement).value;
    const password = (document.getElementById("password") as HTMLInputElement).value;
    const isLogin = (document.getElementById("auth-button") as HTMLButtonElement).textContent === "Login";

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        showMessage("auth-message", "Login successful", false);
      } else {
        const name = (document.getElementById("name") as HTMLInputElement).value;
        if (!name) throw new Error("Please enter your name");
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCred.user, { displayName: name });
        await createUserRecord(userCred.user, name);
        showMessage("auth-message", "Registration successful", false);
      }
    } catch (err: any) {
      showMessage("auth-message", err.message || "Auth failed", true);
    }
  });

  document.getElementById("logout-btn")?.addEventListener("click", () => signOut(auth));
  document.getElementById("convert-btn")?.addEventListener("click", convertSelectedCell);

  onAuthStateChanged(auth, async (user) => {
  const authContainer = document.getElementById("auth-container");
  const converterContainer = document.getElementById("converter-container");
  const adminBtn = document.getElementById("admin-btn");

  if (user) {
    currentUser = user;
    const userData = await getUserData(user.uid);
    isAdminUser = userData?.isAdmin || false;

    console.log('User logged in:', user.email);
    console.log('Admin status:', isAdminUser);

    if (authContainer) authContainer.style.display = "none";
    if (converterContainer) converterContainer.style.display = "block";

    const displayName = document.getElementById("display-name");
    if (displayName) displayName.textContent = user.displayName || user.email || "";

    // Show admin button if user is admin
    if (adminBtn) {
      adminBtn.style.display = isAdminUser ? "inline-block" : "none";
    }

    await loadAllCurrencies();
  } else {
    if (authContainer) authContainer.style.display = "block";
    if (converterContainer) converterContainer.style.display = "none";

    (document.getElementById("email") as HTMLInputElement).value = "";
    (document.getElementById("password") as HTMLInputElement).value = "";
    (document.getElementById("name") as HTMLInputElement).value = "";

    toggleAuthForm(true);
  }
});
}

function showUserManagementModal() {
  const modal = document.getElementById("user-management-modal");
  if (modal) modal.style.display = "block";
  loadUsersList();
}

function closeModals() {
  document.querySelectorAll('.modal').forEach(modal => {
    (modal as HTMLElement).style.display = "none";
  });
}

async function loadUsersList() {
  try {
    usersList = await getUsersList();
    const userListEl = document.getElementById("user-list");
    if (userListEl) {
      userListEl.innerHTML = "";
      usersList.forEach(user => {
        if (user.uid !== currentUser?.uid) {
          const li = document.createElement("li");
          li.textContent = `${user.displayName || user.email} ${user.isAdmin ? '(Admin)' : ''}`;
          li.addEventListener("click", () => showUserActions(user));
          userListEl.appendChild(li);
        }
      });
    }
  } catch (error) {
    showMessage("converter-message", "Failed to load users", true);
  }
}

function showUserActions(user: UserData) {
  selectedUserId = user.uid;
  const modal = document.getElementById("user-actions-modal");
  const usernameEl = document.getElementById("selected-username");
  
  if (modal && usernameEl) {
    usernameEl.textContent = `Manage ${user.displayName || user.email}`;
    const makeAdminBtn = document.getElementById("make-admin-btn");
    if (makeAdminBtn) {
      makeAdminBtn.textContent = user.isAdmin ? "Remove Admin" : "Make Admin";
    }
    modal.style.display = "block";
  }
}

async function handleRemoveUser() {
  if (!selectedUserId || !currentUser) {
    console.error('No user selected or not logged in');
    return;
  }

  try {
    console.log('Attempting to remove user:', selectedUserId);
    
    // First verify admin status
    const currentUserData = await getUserData(currentUser.uid);
    if (!currentUserData?.isAdmin) {
      throw new Error('You must be an admin to remove users');
    }

    // Additional check - don't allow removing yourself
    if (selectedUserId === currentUser.uid) {
      throw new Error('You cannot remove yourself');
    }

    // Perform the removal
    await removeUser(selectedUserId);
    console.log('User removed successfully');
    
    showMessage("converter-message", "User removed successfully", false);
    loadUsersList();
    closeModals();
  } catch (error: any) {
    console.error('Remove user error:', error);
    showMessage("converter-message", error.message || "Failed to remove user", true);
  }
}

async function handleMakeAdmin() {
  if (!selectedUserId || !currentUser) {
    console.error('No user selected or not logged in');
    return;
  }

  try {
    console.log('Attempting to change admin status for:', selectedUserId);
    
    // Verify admin status
    const currentUserData = await getUserData(currentUser.uid);
    if (!currentUserData?.isAdmin) {
      throw new Error('You must be an admin to change user roles');
    }

    // Don't allow changing your own admin status
    if (selectedUserId === currentUser.uid) {
      throw new Error('You cannot change your own admin status');
    }

    // Get current status
    const user = usersList.find(u => u.uid === selectedUserId);
    if (!user) {
      throw new Error('User not found');
    }

    // Toggle admin status
    const newAdminStatus = !user.isAdmin;
    console.log('Setting admin status to:', newAdminStatus);
    
    await setAdminStatus(selectedUserId, newAdminStatus);
    console.log('Admin status updated successfully');
    
    showMessage("converter-message", 
      newAdminStatus ? "User promoted to admin" : "Admin privileges removed", 
      false
    );
    loadUsersList();
    closeModals();
  } catch (error: any) {
    console.error('Admin status change error:', error);
    showMessage("converter-message", error.message || "Failed to update user role", true);
  }
}

window.Office.onReady(() => {
  initializeApp().catch(err => {
    console.error("init error:", err);
    showMessage("auth-message", "Failed to initialize application", true);
  });
});