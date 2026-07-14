import {
  provideFluentDesignSystem,
  fluentButton,
  fluentTextField,
  fluentSkeleton,
} from "@fluentui/web-components";

// Initialize Fluent Design System
provideFluentDesignSystem().register(
  fluentButton(),
  fluentTextField(),
  fluentSkeleton()
);

let isLoginMode = true;

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

function showLoading(loading: boolean) {
  const formContent = document.getElementById("form-content");
  const skeletonLoader = document.getElementById("skeleton-loader");
  const nameSkeleton = document.getElementById("skeleton-name-field");

  if (!formContent || !skeletonLoader) return;

  if (loading) {
    formContent.style.display = "none";
    if (nameSkeleton) {
      nameSkeleton.style.display = isLoginMode ? "none" : "block";
    }
    skeletonLoader.style.display = "block";
  } else {
    formContent.style.display = "block";
    skeletonLoader.style.display = "none";
  }
}

function toggleAuthMode() {
  isLoginMode = !isLoginMode;
  clearMessage();

  const title = document.getElementById("title");
  const nameGroup = document.getElementById("name-group");
  const authBtn = document.getElementById("auth-btn");
  const switchText = document.getElementById("switch-text");
  const toggleLink = document.getElementById("toggle-auth-link");

  if (!title || !nameGroup || !authBtn || !switchText || !toggleLink) return;

  if (isLoginMode) {
    title.textContent = "Log In";
    nameGroup.style.display = "none";
    authBtn.textContent = "Log In";
    switchText.textContent = "New user?";
    toggleLink.textContent = "Create Account";
  } else {
    title.textContent = "Create Account";
    nameGroup.style.display = "block";
    authBtn.textContent = "Register";
    switchText.textContent = "Already have an account?";
    toggleLink.textContent = "Log In";
  }
}

async function handleAuth() {
  clearMessage();

  const emailInput = document.getElementById("email") as HTMLInputElement;
  const passwordInput = document.getElementById("password") as HTMLInputElement;
  const nameInput = document.getElementById("name") as HTMLInputElement;

  const email = emailInput?.value?.trim();
  const password = passwordInput?.value?.trim();
  const name = nameInput?.value?.trim();

  if (!email || !password) {
    showMessage("Email and password are required.", true);
    return;
  }

  if (!isLoginMode && !name) {
    showMessage("Please enter your name.", true);
    return;
  }

  showLoading(true);

  const url = isLoginMode ? "/api/auth/login" : "/api/auth/register";
  const payload = isLoginMode 
    ? { email, password }
    : { name, email, password };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Authentication failed.");
    }

    // Success! Send token and user details to parent taskpane
    Office.context.ui.messageParent(
      JSON.stringify({
        type: "LOGIN_SUCCESS",
        token: data.token,
        user: data.user,
      })
    );
  } catch (error: any) {
    console.error("Auth error:", error);
    showLoading(false);
    showMessage(error.message || "An unexpected error occurred.", true);
  }
}

// Ensure Office context is initialized before binding events
Office.onReady(() => {
  document.getElementById("toggle-auth-link")?.addEventListener("click", toggleAuthMode);
  document.getElementById("auth-btn")?.addEventListener("click", handleAuth);

  // Allow enter key to submit
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      handleAuth();
    }
  });
});
