// static/js/add_workout.js

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('add-workout-form');
  const feedback = document.getElementById('feedback');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = {
      activity_type: form.activity_type.value.trim(),
      duration_minutes: parseInt(form.duration_minutes.value, 10),
      calories: parseInt(form.calories.value, 10),
      activity_date: form.activity_date.value
    };

    // Validate
    if (!data.activity_type || !data.duration_minutes || !data.calories || !data.activity_date) {
      showFeedback('Please fill in all fields.', 'error');
      return;
    }

    // Try to send to server
    try {
      const res = await fetch('/api/workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(data)
      });

      if (res.ok) {
        showFeedback('Workout added successfully ✅', 'success');
        form.reset();
      } else {
        throw new Error('Server error');
      }
    } catch (err) {
      // Fallback: localStorage
      console.warn('API unavailable, saving to localStorage');
      const ls = localStorage.getItem('fittrack_workouts');
      const workouts = ls ? JSON.parse(ls) : [];
      data.id = Date.now();
      workouts.push(data);
      localStorage.setItem('fittrack_workouts', JSON.stringify(workouts));

      showFeedback('Workout saved locally (offline mode).', 'success');
      form.reset();
    }
  });

  function showFeedback(message, type) {
    feedback.textContent = message;
    feedback.className = type === 'error' ? 'text-danger' : 'text-success';
    setTimeout(() => feedback.textContent = '', 4000);
  }
});
