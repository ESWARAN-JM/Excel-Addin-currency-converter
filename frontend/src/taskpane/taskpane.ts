/// <reference types="office-js" />

import "./taskpane.css";
import {
  provideFluentDesignSystem,
  fluentButton,
  fluentSkeleton,
} from "@fluentui/web-components";
import { calculateCrossRate } from "./utils";

// Register Fluent UI web components
provideFluentDesignSystem().register(
  fluentButton(),
  fluentSkeleton()
);

let activeDialog: Office.Dialog | null = null;
let currentUser: { id: string; name: string; email: string; isAdmin: boolean } | null = null;

function disableTaskpaneControls() {
  const buttons = document.querySelectorAll("fluent-button");
  buttons.forEach((btn) => {
    btn.setAttribute("disabled", "true");
  });
}

function enableTaskpaneControls() {
  const buttons = document.querySelectorAll("fluent-button");
  buttons.forEach((btn) => {
    btn.removeAttribute("disabled");
  });
}

function handleDialogEvent(args: any) {
  switch (args.error) {
    case 12006: // Dialog closed by user
      activeDialog = null;
      enableTaskpaneControls();
      break;
    default:
      console.warn("Dialog event error:", args.error);
      activeDialog = null;
      enableTaskpaneControls();
      break;
  }
}

function showDialogMessage(message: string, isError = false) {
  if (activeDialog) {
    try {
      activeDialog.close();
    } catch (e) { }
    activeDialog = null;
  }

  disableTaskpaneControls();

  const url = window.location.origin + `/message.html?msg=${encodeURIComponent(message)}&err=${isError}`;

  let attempts = 0;
  const maxAttempts = 3;

  function tryOpen() {
    Office.context.ui.displayDialogAsync(
      url,
      { height: 25, width: 35 },
      (asyncResult) => {
        if (asyncResult.status === Office.AsyncResultStatus.Failed) {
          console.warn(`Failed to open message dialog (attempt ${attempts + 1}):`, asyncResult.error.message);
          if (attempts < maxAttempts) {
            attempts++;
            setTimeout(tryOpen, 250); // Retry after 250ms
          } else {
            console.error("Exceeded maximum attempts to open message dialog.");
            enableTaskpaneControls();
            alert(message);
          }
          return;
        }
        activeDialog = asyncResult.value;
        activeDialog.addEventHandler(Office.EventType.DialogMessageReceived, handleDialogMessage);
        activeDialog.addEventHandler(Office.EventType.DialogEventReceived, handleDialogEvent);
      }
    );
  }

  // Wait slightly for previous dialog closure to finalize
  setTimeout(tryOpen, 250);
}

// Helpers to update message banners
function showMessage(elementId: string, text: string, isError = false) {
  showDialogMessage(text, isError);
}

function clearMessage(elementId: string) {
  // No-op
}

// Show/Hide page loaders
function showLoading(loading: boolean) {
  const loader = document.getElementById("skeleton-loader");
  if (loader) {
    loader.style.display = loading ? "flex" : "none";
  }
}

// Toggle dashboard views based on login state
function updateUIState() {
  const loggedOutView = document.getElementById("logged-out-view");
  const loggedInView = document.getElementById("logged-in-view");
  const userNameSpan = document.getElementById("user-display-name");

  if (!loggedOutView || !loggedInView || !userNameSpan) return;

  if (currentUser) {
    userNameSpan.textContent = currentUser.name;
    loggedOutView.style.display = "none";
    loggedInView.style.display = "flex";
  } else {
    userNameSpan.textContent = "Guest";
    loggedInView.style.display = "none";
    loggedOutView.style.display = "flex";
  }
}

// Check session on start
async function checkAuthSession() {
  showLoading(true);
  clearMessage("message-banner");

  const token = localStorage.getItem("auth_token");
  const cachedUser = localStorage.getItem("auth_user");

  if (!token || !cachedUser) {
    currentUser = null;
    updateUIState();
    showLoading(false);
    return;
  }

  try {
    // Validate session token with server profile call
    const res = await fetch("/api/auth/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.ok) {
      currentUser = JSON.parse(cachedUser);
    } else {
      // Clear expired session
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
      currentUser = null;
    }
  } catch (error) {
    console.error("Session verification failed, using cached state offline:", error);
    // Keep cached user context for offline resiliency during dev
    currentUser = JSON.parse(cachedUser);
  }

  updateUIState();
  showLoading(false);
}

// Spawn child dialog utility
function openAddinDialog(url: string, width: number, height: number) {
  if (activeDialog) {
    try {
      activeDialog.close();
    } catch (e) { }
    activeDialog = null;
  }

  disableTaskpaneControls();

  // Get current hostname (resolves localhost/https routing dynamically)
  const fullUrl = window.location.origin + url;

  let attempts = 0;
  const maxAttempts = 10;

  function tryOpen() {
    Office.context.ui.displayDialogAsync(
      fullUrl,
      { height, width },
      (asyncResult) => {
        if (asyncResult.status === Office.AsyncResultStatus.Failed) {
          console.warn(`Failed to open add-in dialog (attempt ${attempts + 1}):`, asyncResult.error.message);
          if (attempts < maxAttempts) {
            attempts++;
            setTimeout(tryOpen, 250); // Retry after 250ms
          } else {
            console.error("Could not open dialog window after max retries.");
            enableTaskpaneControls();
            showMessage("message-banner", "Could not open dialog window: " + asyncResult.error.message, true);
          }
          return;
        }

        activeDialog = asyncResult.value;
        activeDialog.addEventHandler(Office.EventType.DialogMessageReceived, handleDialogMessage);
        activeDialog.addEventHandler(Office.EventType.DialogEventReceived, handleDialogEvent);
      }
    );
  }

  // Wait slightly for previous dialog closure to finalize
  setTimeout(tryOpen, 250);
}

// Handle parent-child message communication
function handleDialogMessage(args: any) {
  if (!args || !args.message) return;

  try {
    const payload = JSON.parse(args.message);

    switch (payload.type) {
      case "LOGIN_SUCCESS":
        // Save session details
        localStorage.setItem("auth_token", payload.token);
        localStorage.setItem("auth_user", JSON.stringify(payload.user));
        currentUser = payload.user;
        updateUIState();

        // Close auth dialog
        if (activeDialog) {
          try {
            activeDialog.close();
          } catch (e) { }
          activeDialog = null;
        }
        showMessage("message-banner", `Welcome back, ${payload.user.name}!`, false);
        break;

      case "CONVERT_CELLS":
        if (!currentUser) {
          console.warn("Conversion request blocked because user is logged out.");
          break;
        }
        // Close the dialog immediately before converting cell values
        if (activeDialog) {
          try {
            activeDialog.close();
          } catch (e) { }
          activeDialog = null;
        }
        convertSelectedCells(payload.rate, payload.fromCurrency, payload.toCurrency);
        break;

      case "BUILD_TABLE":
        if (!currentUser) {
          console.warn("Table build request blocked because user is logged out.");
          break;
        }
        // Close the dialog immediately before building the sheet
        if (activeDialog) {
          try {
            activeDialog.close();
          } catch (e) { }
          activeDialog = null;
        }
        buildExchangeRateTable(payload.baseCurrency, payload.rates);
        break;

      case "CLOSE_MESSAGE_DIALOG":
        if (activeDialog) {
          try {
            activeDialog.close();
          } catch (e) { }
          activeDialog = null;
        }
        enableTaskpaneControls();
        break;

      default:
        console.warn("Unknown dialog message type:", payload.type);
    }
  } catch (err) {
    console.error("Error parsing dialog message:", err);
  }
}

// Excel API: Convert values in selection
async function convertSelectedCells(rate: number, fromCurrency: string, toCurrency: string) {
  try {
    await Excel.run(async (context) => {
      const range = context.workbook.getSelectedRange();
      range.load(["values", "rowCount", "columnCount", "rowIndex", "columnIndex"]);
      const sheet = context.workbook.worksheets.getActiveWorksheet();
      const comments = sheet.comments;
      comments.load("items");
      await context.sync();

      const values = range.values;
      let convertedCount = 0;

      if (comments.items.length > 0) {
        comments.items.forEach((c) => {
          c.getLocation().load(["rowIndex", "columnIndex"]);
        });
        await context.sync();
      }

      for (let r = 0; r < range.rowCount; r++) {
        for (let c = 0; c < range.columnCount; c++) {
          const val = values[r][c];
          const num = typeof val === "number" ? val : parseFloat(String(val));
          if (!isNaN(num)) {
            convertedCount++;
            const cell = range.getCell(r, c);
            const targetRowIndex = range.rowIndex + r;
            const targetColIndex = range.columnIndex + c;

            // Find existing comment on this cell
            const existingComment = comments.items.find((item) => {
              const loc = item.getLocation();
              return loc.rowIndex === targetRowIndex && loc.columnIndex === targetColIndex;
            });

            if (existingComment) {
              existingComment.delete();
            }

            // Add new comment with metadata
            const metadataText = `Currency Converter Metadata: ${fromCurrency}->${toCurrency}, original: ${num}`;
            sheet.comments.add(cell, metadataText);

            // Update cell value
            cell.values = [[num * rate]];
          }
        }
      }

      if (convertedCount === 0) {
        showMessage("message-banner", "Please select cells containing numeric values to convert.", true);
        return;
      }

      await context.sync();

      showMessage(
        "message-banner",
        `Successfully converted ${convertedCount} cells from ${fromCurrency} to ${toCurrency} (1 ${fromCurrency} = ${rate.toFixed(4)} ${toCurrency}).`,
        false
      );
    });
  } catch (error: any) {
    console.error("Excel conversion error:", error);
    showMessage("message-banner", "Excel Error: " + (error.message || error), true);
  }
}

// Excel API: Generate exchange rate report sheet
async function buildExchangeRateTable(baseCurrency: string, rates: Record<string, number>) {
  try {
    await Excel.run(async (context) => {
      const sheets = context.workbook.worksheets;
      sheets.load("items/name");
      await context.sync();

      // Find a unique sheet name (avoid duplicates)
      const baseName = `Rates_${baseCurrency}`;
      let sheetName = baseName;
      let counter = 1;
      while (sheets.items.some((s) => s.name === sheetName)) {
        sheetName = `${baseName}_${counter}`;
        counter++;
      }

      const sheet = sheets.add(sheetName);
      sheet.activate();

      // Page Title Header block
      const titleRange = sheet.getRange("A1:C1");
      titleRange.values = [["Currency Exchange Rate Report", "", ""]];
      titleRange.format.font.bold = true;
      titleRange.format.font.size = 16;
      titleRange.format.font.color = "#0078d4";
      titleRange.merge();

      // Metadata Info block
      const metaRange = sheet.getRange("A2:C2");
      metaRange.values = [
        [`Base Currency: ${baseCurrency}`, "", `Generated: ${new Date().toLocaleDateString()}`],
      ];
      metaRange.format.font.italic = true;
      metaRange.format.font.size = 10;
      metaRange.format.font.color = "#605e5c";

      // Define columns
      const headers = ["Target Currency", `Rate (1 ${baseCurrency})`, `Inverse (1 Target)`];
      const rows: any[][] = [];

      Object.keys(rates).forEach((target) => {
        const rate = rates[target];
        const inverseRate = rate > 0 ? 1 / rate : 0;
        rows.push([target, rate, inverseRate]);
      });

      // Write headers
      const headerRange = sheet.getRange("A4:C4");
      headerRange.values = [headers];
      headerRange.format.font.bold = true;
      headerRange.format.font.color = "#ffffff";
      headerRange.format.fill.color = "#0078d4";
      headerRange.format.horizontalAlignment = "Center";

      // Write data rows
      const dataRange = sheet.getRange(`A5:C${5 + rows.length - 1}`);
      dataRange.values = rows;

      // Add metadata comments to Column B (Rate) and Column C (Inverse)
      for (let i = 0; i < rows.length; i++) {
        const target = rows[i][0];
        const rowNum = 5 + i;

        // Rate cell B[rowNum]
        const rateCellAddress = `'${sheetName}'!B${rowNum}`;
        const rateCommentText = `Currency Converter Metadata: ${baseCurrency}->${target}, original: 1`;
        sheet.comments.add(rateCellAddress, rateCommentText);

        // Inverse cell C[rowNum]
        const inverseCellAddress = `'${sheetName}'!C${rowNum}`;
        const inverseCommentText = `Currency Converter Metadata: ${target}->${baseCurrency}, original: 1`;
        sheet.comments.add(inverseCellAddress, inverseCommentText);
      }

      // Formatting borders
      const horizontalBorders = dataRange.format.borders.getItem("InsideHorizontal");
      horizontalBorders.style = "Continuous";
      horizontalBorders.weight = "Thin";
      horizontalBorders.color = "#edebe9";

      const bottomBorder = dataRange.format.borders.getItem("EdgeBottom");
      bottomBorder.style = "Continuous";
      bottomBorder.weight = "Medium";
      bottomBorder.color = "#0078d4";

      // Format currency alignment and decimals
      const targetCol = sheet.getRange(`A5:A${5 + rows.length - 1}`);
      targetCol.format.horizontalAlignment = "Left";
      targetCol.format.font.bold = true;

      const rateCols = sheet.getRange(`B5:C${5 + rows.length - 1}`);
      rateCols.format.horizontalAlignment = "Right";
      rateCols.numberFormat = rows.map(() => ["#,##0.0000", "#,##0.0000"]);

      // Auto-adjust widths
      sheet.getUsedRange().format.autofitColumns();

      await context.sync();
      showMessage("message-banner", `Successfully created sheet "${sheetName}" with rate table.`, false);
    });
  } catch (error: any) {
    console.error("Excel build table error:", error);
    showMessage("message-banner", "Excel Error: " + (error.message || error), true);
  }
}

async function refreshActiveSheet() {
  if (!currentUser) {
    showDialogMessage("You must be logged in to refresh rates.", true);
    return;
  }

  showLoading(true);
  disableTaskpaneControls();

  try {
    // 1. Fetch latest rates
    const res = await fetch("/api/rates/latest");
    if (!res.ok) {
      throw new Error(`Failed to load exchange rates: ${res.statusText}`);
    }

    const data = await res.json();
    if (data.result !== "success" || !data.rates) {
      throw new Error("Invalid rate data structure from server.");
    }

    const latestRates = data.rates;

    // 2. Read comments in active sheet
    await Excel.run(async (context) => {
      const sheet = context.workbook.worksheets.getActiveWorksheet();
      const comments = sheet.comments;
      comments.load("items");
      await context.sync();

      if (comments.items.length === 0) {
        throw new Error("Active sheet does not contain any comments.");
      }

      // Load content for each comment
      comments.items.forEach((c) => {
        c.load(["content"]);
      });
      await context.sync();

      // Find cell location for each matching comment
      const conversionComments: { comment: Excel.Comment; from: string; to: string; original: number }[] = [];
      for (let i = 0; i < comments.items.length; i++) {
        const comment = comments.items[i];
        const match = comment.content.match(/Currency Converter Metadata:\s*([A-Z]{3})->([A-Z]{3}),\s*original:\s*([\d.]+)/i);
        if (match) {
          const from = match[1];
          const to = match[2];
          const original = parseFloat(match[3]);
          conversionComments.push({ comment, from, to, original });
        }
      }

      if (conversionComments.length === 0) {
        throw new Error("Active sheet does not contain any currency conversion comments.");
      }

      // Now load locations
      conversionComments.forEach((cc) => {
        cc.comment.getLocation().load(["address", "values"]);
      });
      await context.sync();

      let refreshCount = 0;

      // Update cell values based on new rates
      for (const cc of conversionComments) {
        const cell = cc.comment.getLocation();
        const rateFrom = latestRates[cc.from];
        const rateTo = latestRates[cc.to];

        if (rateFrom !== undefined && rateTo !== undefined) {
          const newCrossRate = calculateCrossRate(rateFrom, rateTo);
          cell.values = [[cc.original * newCrossRate]];
          refreshCount++;
        }
      }

      await context.sync();
      showDialogMessage(`Successfully refreshed ${refreshCount} cells with the latest exchange rates.`, false);
    });

  } catch (error: any) {
    console.error("Refresh active sheet error:", error);
    // User requested error dialog with exactly "active sheet don't have comments"
    if (error.message && (error.message.includes("does not contain any comments") || error.message.includes("does not contain any currency conversion comments") || error.message.includes("active sheet don't have comments"))) {
      showDialogMessage("active sheet don't have comments", true);
    } else {
      showDialogMessage("Error refreshing sheet: " + (error.message || error), true);
    }
  } finally {
    showLoading(false);
    enableTaskpaneControls();
  }
}

function handleLogout() {
  localStorage.removeItem("auth_token");
  localStorage.removeItem("auth_user");
  currentUser = null;
  if (activeDialog) {
    try {
      activeDialog.close();
    } catch (e) { }
    activeDialog = null;
  }
  enableTaskpaneControls();
  updateUIState();
  showMessage("message-banner", "Logged out successfully.", false);
}

// Bind clicks on ready
Office.onReady(() => {
  document.getElementById("login-dialog-trigger")?.addEventListener("click", () => {
    openAddinDialog("/login.html", 35, 55);
  });

  document.getElementById("logout-btn")?.addEventListener("click", handleLogout);

  document.getElementById("open-rates-dialog")?.addEventListener("click", () => {
    openAddinDialog("/rates.html", 40, 60);
  });

  document.getElementById("refresh-sheet-btn")?.addEventListener("click", refreshActiveSheet);

  // Verify cached session state
  checkAuthSession().catch((err) => {
    console.error("Session check error:", err);
    showLoading(false);
  });
});