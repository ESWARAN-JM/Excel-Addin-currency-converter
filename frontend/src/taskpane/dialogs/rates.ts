import {
  provideFluentDesignSystem,
  fluentButton,
  fluentSkeleton,
  fluentSelect,
  fluentOption,
  fluentTextField,
} from "@fluentui/web-components";
import { calculateCrossRate, calculateRelativeRates } from "../utils";

// Initialize Fluent Design System components
provideFluentDesignSystem().register(
  fluentButton(),
  fluentSkeleton(),
  fluentSelect(),
  fluentOption(),
  fluentTextField()
);

let allRates: Record<string, number> = {};
let currencies: string[] = [];
const targetCheckedStates: Record<string, boolean> = {};

function showMessage(text: string, isError = false) {
  const banner = document.getElementById("message-banner");
  if (!banner) return;
  banner.textContent = text;
  banner.className = isError ? "message error" : "message success";
}

function clearMessage() {
  const banner = document.getElementById("message-banner");
  if (banner) {
    banner.textContent = "";
    banner.className = "message";
  }
}

// Fetch currencies and rates from backend
async function loadRatesData() {
  try {
    const res = await fetch("/api/rates/latest");
    if (!res.ok) {
      throw new Error(`Failed to load exchange rates: ${res.statusText}`);
    }

    const data = await res.json();
    if (data.result !== "success" || !data.rates) {
      throw new Error("Invalid rate data structure from server.");
    }

    allRates = data.rates;
    currencies = Object.keys(allRates).sort();

    // Add base currency if not explicitly in rates
    if (data.base && !currencies.includes(data.base)) {
      currencies.push(data.base);
      allRates[data.base] = 1.0;
      currencies.sort();
    }

    populateDropdowns();
    populateChecklist();

    // Hide skeleton and show main panel
    document.getElementById("main-skeleton")!.style.display = "none";
    document.getElementById("main-content")!.style.display = "block";
  } catch (err: any) {
    console.error("loadRatesData error:", err);
    document.getElementById("main-skeleton")!.style.display = "none";
    const content = document.getElementById("main-content");
    content!.style.display = "block";
    // Show only the error
    document.getElementById("content-convert")!.style.display = "none";
    document.getElementById("content-table")!.style.display = "none";
    document.querySelector(".tabs-header")?.remove();
    showMessage(err.message || "Failed to load exchange rates.", true);
  }
}

function populateDropdowns() {
  const fromSelect = document.getElementById("convert-from") as any;
  const toSelect = document.getElementById("convert-to") as any;
  const tableFromSelect = document.getElementById("table-from") as any;

  if (!fromSelect || !toSelect || !tableFromSelect) return;

  fromSelect.innerHTML = "";
  toSelect.innerHTML = "";
  tableFromSelect.innerHTML = "";

  currencies.forEach((currency) => {
    const opt1 = document.createElement("fluent-option");
    opt1.setAttribute("value", currency);
    opt1.textContent = currency;
    if (currency === "USD") {
      opt1.setAttribute("selected", "true");
    }
    fromSelect.appendChild(opt1);

    const opt2 = document.createElement("fluent-option");
    opt2.setAttribute("value", currency);
    opt2.textContent = currency;
    if (currency === "EUR") {
      opt2.setAttribute("selected", "true");
    }
    toSelect.appendChild(opt2);

    const opt3 = document.createElement("fluent-option");
    opt3.setAttribute("value", currency);
    opt3.textContent = currency;
    if (currency === "USD") {
      opt3.setAttribute("selected", "true");
    }
    tableFromSelect.appendChild(opt3);
  });
}

function populateChecklist(filterText = "") {
  const grid = document.getElementById("checklist-grid");
  if (!grid) return;

  grid.innerHTML = "";
  const filter = filterText.trim().toLowerCase();

  const filteredCurrencies = currencies.filter((c) =>
    c.toLowerCase().includes(filter)
  );

  // Core major currencies to place at the top of the list if they match filter
  const majorCurrencies = ["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "CNY", "INR", "SGD"];
  const listToRender = [
    ...majorCurrencies.filter((c) => filteredCurrencies.includes(c)),
    ...filteredCurrencies.filter((c) => !majorCurrencies.includes(c)),
  ];

  listToRender.forEach((currency) => {
    const label = document.createElement("label");
    label.className = "checkbox-label";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = currency;
    checkbox.checked = !!targetCheckedStates[currency];

    checkbox.addEventListener("change", () => {
      targetCheckedStates[currency] = checkbox.checked;
    });

    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(currency));
    grid.appendChild(label);
  });
}

function switchTab(activeTab: "convert" | "table") {
  clearMessage();
  const convertTabBtn = document.getElementById("tab-convert");
  const tableTabBtn = document.getElementById("tab-table");
  const convertContent = document.getElementById("content-convert");
  const tableContent = document.getElementById("content-table");

  if (!convertTabBtn || !tableTabBtn || !convertContent || !tableContent) return;

  if (activeTab === "convert") {
    convertTabBtn.classList.add("active");
    tableTabBtn.classList.remove("active");
    convertContent.classList.add("active");
    tableContent.classList.remove("active");
  } else {
    tableTabBtn.classList.add("active");
    convertTabBtn.classList.remove("active");
    tableContent.classList.add("active");
    convertContent.classList.remove("active");
  }
}

function handleConvertClick() {
  clearMessage();
  const fromSelect = document.getElementById("convert-from") as HTMLSelectElement;
  const toSelect = document.getElementById("convert-to") as HTMLSelectElement;

  const from = fromSelect.value;
  const to = toSelect.value;

  if (from === to) {
    showMessage("Please select different base and target currencies.", true);
    return;
  }

  const rateFrom = allRates[from];
  const rateTo = allRates[to];

  if (!rateFrom || !rateTo) {
    showMessage("Rate details are unavailable for the selected pair.", true);
    return;
  }

  // Calculate conversion rate (To relative to From)
  const conversionRate = calculateCrossRate(rateFrom, rateTo);

  // Message the parent taskpane
  Office.context.ui.messageParent(
    JSON.stringify({
      type: "CONVERT_CELLS",
      fromCurrency: from,
      toCurrency: to,
      rate: conversionRate,
    })
  );
  showMessage(`Requested conversion: 1 ${from} = ${conversionRate.toFixed(4)} ${to}.`);
}

function handleBuildTableClick() {
  clearMessage();
  const fromSelect = document.getElementById("table-from") as HTMLSelectElement;
  const baseCurrency = fromSelect.value;

  // Gather all checked target currencies
  const targets = Object.keys(targetCheckedStates).filter((c) => targetCheckedStates[c]);

  if (targets.length === 0) {
    showMessage("Please select at least one target currency.", true);
    return;
  }

  const rateBase = allRates[baseCurrency];
  if (!rateBase) {
    showMessage("Base currency rates are unavailable.", true);
    return;
  }

  // Calculate rates relative to the base currency
  const relativeRates = calculateRelativeRates(rateBase, allRates);
  const filteredRelativeRates: Record<string, number> = {};
  targets.forEach((target) => {
    if (relativeRates[target] !== undefined) {
      filteredRelativeRates[target] = relativeRates[target];
    }
  });

  // Message the parent taskpane
  Office.context.ui.messageParent(
    JSON.stringify({
      type: "BUILD_TABLE",
      baseCurrency,
      rates: filteredRelativeRates,
    })
  );
  showMessage(`Requested exchange table for base ${baseCurrency}.`);
}

// Bind events on ready
Office.onReady(() => {
  document.getElementById("tab-convert")?.addEventListener("click", () => switchTab("convert"));
  document.getElementById("tab-table")?.addEventListener("click", () => switchTab("table"));

  // Bind Search Filter
  document.getElementById("target-search")?.addEventListener("input", (e) => {
    const input = e.target as HTMLInputElement;
    populateChecklist(input.value);
  });

  document.getElementById("convert-btn")?.addEventListener("click", handleConvertClick);
  document.getElementById("build-table-btn")?.addEventListener("click", handleBuildTableClick);

  loadRatesData();
});
