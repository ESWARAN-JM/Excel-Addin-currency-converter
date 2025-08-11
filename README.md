Currency Converter Excel Add-in

📌 Overview
This is a custom Excel Add-in that allows users to convert currency values directly inside Excel without leaving the spreadsheet.  
It also includes user authentication and admin features for managing users.

The add-in is hosted online and can be loaded into Excel via the provided `manifest.xml` file.  
Once loaded, it works seamlessly inside Excel for both Web and Desktop versions.

---

 ✨ Features
- Login & Registration – Users can sign in or create an account.
- Role-based Access – Admin users can manage other users.
- Live Currency Conversion – Select any cell containing a number and convert between currencies instantly.
- Searchable Currency Selection – Quickly find the currency you need.
- Logout Option – Securely sign out anytime.
- Responsive UI – Works well inside Excel’s task pane.

---

 🛠 How to Load the Add-in in Excel

 `manifest.xml` – The configuration file that tells Excel where the add-in is hosted.

Follow these steps:

1. Open Excel (Desktop or Web version).
2. Go to:
   - Desktop: `Insert` → `My Add-ins` → `Manage My Add-ins` → `Upload My Add-in`.
   - Web: `Insert` → `Office Add-ins` → `Upload My Add-in`.
3. Choose the provided `manifest.xml` file.
4. The Currency Converter add-in will now appear in the ribbon.
5. Click it to open the task pane and start using it.

---

 💻 How It Works
- When the add-in opens, you’ll see a login screen.
- After logging in, you can:
  - Select a “From” currency and “To” currency.
  - Click "Convert Selected Cell" to instantly convert the selected value in Excel.
  - Admins will see an "Users" button to manage user accounts.

---

 🔗 Hosting & Deployment
- The add-in is hosted live at: Vercel
- All assets (HTML, CSS, JS) are served from this location.
- `manifest.xml` points to this hosted version so Excel can load it.



