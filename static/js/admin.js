AOS.init({ once: true, duration: 800 });

const tableBody = document.getElementById('userTableBody');
const totalUsersEl = document.getElementById('totalUsers');
const activeUsersEl = document.getElementById('activeUsers');
const totalWorkoutsEl = document.getElementById('totalWorkouts');
const totalCaloriesEl = document.getElementById('totalCalories');

// Users from localStorage
const users = JSON.parse(localStorage.getItem('users')) || [];

function calculateStats() {
  totalUsersEl.textContent = users.length;
  activeUsersEl.textContent = users.filter(u => u.loggedIn).length;
  totalWorkoutsEl.textContent = users.reduce((sum,u) => sum + (u.workouts||0), 0);
  totalCaloriesEl.textContent = users.reduce((sum,u) => sum + (u.calories||0), 0);
}

function renderTable(filteredUsers) {
  tableBody.innerHTML = '';
  filteredUsers.forEach((u,i) => {
    const tr = document.createElement('tr');
    if(u.loggedIn) tr.classList.add('active-user');
    tr.innerHTML = `
      <td>${u.name}</td>
      <td>${u.email}</td>
      <td><span class="badge bg-${u.loggedIn?'success':'secondary'} badge-status">${u.loggedIn?'Online':'Offline'}</span></td>
      <td>${u.workouts||0}</td>
      <td>${u.calories||0}</td>
      <td>${u.lastLogin||'N/A'}</td>
      <td class="text-center table-actions">
        <button class="btn btn-sm btn-warning" onclick="editUser(${i})"><i class="fa-solid fa-pen"></i></button>
        <button class="btn btn-sm btn-danger" onclick="deleteUser(${i})"><i class="fa-solid fa-trash"></i></button>
      </td>
    `;
    tableBody.appendChild(tr);
  });
}

function editUser(index){
  alert(`Edit functionality for ${users[index].name} coming soon!`);
}

function deleteUser(index){
  if(confirm('Delete this user?')){
    users.splice(index,1);
    localStorage.setItem('users', JSON.stringify(users));
    renderTable(users);
    calculateStats();
  }
}

// Initial render
renderTable(users);
calculateStats();

// Search
document.getElementById('searchBtn').addEventListener('click', ()=>{
  const term = document.getElementById('searchInput').value.toLowerCase();
  const filtered = users.filter(u => u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term));
  renderTable(filtered);
});
document.getElementById('clearSearch').addEventListener('click', ()=>{
  document.getElementById('searchInput').value = '';
  renderTable(users);
});

// Export CSV
document.getElementById('exportCSV').addEventListener('click', ()=>{
  let csv = 'Name,Email,Status,Workouts,Calories,LastLogin\n';
  users.forEach(u=>{
    csv += `${u.name},${u.email},${u.loggedIn?'Online':'Offline'},${u.workouts||0},${u.calories||0},${u.lastLogin||''}\n`;
  });
  const blob = new Blob([csv], {type:'text/csv'});
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'users.csv';
  link.click();
});

// Export JSON
document.getElementById('exportJSON').addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify(users,null,2)], {type:'application/json'});
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'users.json';
  link.click();
});

// Logout
document.getElementById('logout-btn').addEventListener('click', ()=>{
  window.location.href = 'logout.html';
});
