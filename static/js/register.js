document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("register-form");
  const feedback = document.getElementById("register-feedback");

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    feedback.textContent = "Processing registration...";
    feedback.style.color = "#007bff";

    setTimeout(() => {
      feedback.textContent = "Account created successfully!";
      feedback.style.color = "green";
      form.reset();
    }, 1200);
  });
});
