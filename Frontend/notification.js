function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");

  if (!container) {
    console.error("Toast container not found!");
    return;
  }

  const toast = document.createElement("div");

  toast.className = `toast ${type}`;

  let icon = "";

  switch (type) {
    case "success":
      icon = "✅";
      break;

    case "error":
      icon = "❌";
      break;

    case "warning":
      icon = "⚠️";
      break;

    default:
      icon = "ℹ️";
  }

  toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span>${message}</span>
    `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("show");
  }, 50);

  setTimeout(() => {
    toast.classList.remove("show");

    setTimeout(() => {
      toast.remove();
    }, 400);
  }, 3000);
}
