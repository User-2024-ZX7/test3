// register.js
document.getElementById("registerForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  let users = JSON.parse(localStorage.getItem("fittrack_users")) || [];

  if (users.some((u) => u.email === email)) {
    alert("User already exists");
    return;
  }

  const newUser = { name, email, password, isAdmin: false };
  users.push(newUser);
  localStorage.setItem("fittrack_users", JSON.stringify(users));
  alert("Registration successful!");
  window.location.href = "login.html";
});
