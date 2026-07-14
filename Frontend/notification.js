const socket = io("http://localhost:5000");

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.innerText = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

// role-based filtering
const role = localStorage.getItem("role");

socket.on("foodPosted", (data) => {
  if (role === "ngo") showToast(data.message);
});

socket.on("newRequest", (data) => {
  if (role === "volunteer") showToast(data.message);
});

socket.on("volunteerAssigned", (data) => {
  if (role === "ngo" || role === "restaurant") {
    showToast(data.message);
  }
});

socket.on("deliveryCompleted", (data) => {
  showToast(data.message);
});