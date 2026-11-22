const state = {
  user: null,
  classes: [],
  students: [],
  missions: [],
  resources: [],
  contacts: [],
  messages: [],
  currentView: 'dashboard'
};

const roleNames = {
  eco_admin: 'Eco Admin',
  director: 'Direktor',
  deputy: 'Direktor o‘rinbosari',
  teacher: 'O‘qituvchi',
  student: 'O‘quvchi'
};

const resourceNames = {
  water: 'Suv',
  electricity: 'Elektr energiyasi',
  waste: 'Chiqindi',
  green_area: 'Yashil hudud'
};

const resourceIcons = {
  water: '◌',
  electricity: 'ϟ',
  waste: '♲',
  green_area: '✳'
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

async function api(path, options = {}) {
  const config = {
    method: options.method || 'GET',
    credentials: 'same-origin',
    headers: { ...(options.headers || {}) }
  };

  if (options.body !== undefined) {
    config.headers['Content-Type'] = 'application/json';
    config.body = JSON.stringify(options.body);
  }

  const response = await fetch(path, config);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 && !path.includes('/auth/login')) {
      showLogin();
    }
    throw new Error(data.error || 'So‘rov bajarilmadi.');
  }

  return data;
}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function showToast(message, isError = false) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 3000);
}

function showLogin() {
  state.user = null;
  $('#appView').classList.add('hidden');
  $('#loginView').classList.remove('hidden');
}

function showApp(user) {
  state.user = user;
  $('#loginView').classList.add('hidden');
  $('#appView').classList.remove('hidden');

  $('#userName').textContent = user.full_name;
  $('#userRole').textContent = roleNames[user.role] || user.role;
  $('#userAvatar').textContent = user.full_name.split(' ').slice(0, 2).map(part => part[0]).join('').toUpperCase();

  $$('.staff-nav').forEach(el => el.classList.toggle('hidden', user.role === 'student'));
  $$('.admin-nav').forEach(el => el.classList.toggle('hidden', !['eco_admin', 'director', 'deputy'].includes(user.role)));
  $$('.admin-control').forEach(el => el.classList.toggle('hidden', !['eco_admin', 'director', 'deputy'].includes(user.role)));
  $$('.staff-control').forEach(el => el.classList.toggle('hidden', !['eco_admin', 'director', 'deputy', 'teacher'].includes(user.role)));

  $('#todayDate').textContent = new Intl.DateTimeFormat('uz-UZ', {
    day: 'numeric', month: 'long', year: 'numeric'
  }).format(new Date());

  loadClasses().then(() => loadDashboard());
  loadNotifications();
  setView('dashboard');
}

async function loadClasses() {
  const data = await api('/api/dashboard/classes');
  state.classes = data.classes || [];
  $('#studentClassSelect').innerHTML = state.classes.map(item =>
    `<option value="${item.id}">${escapeHTML(item.name)}</option>`
  ).join('');
}

async function loadDashboard() {
  try {
    const data = await api('/api/dashboard');
    const stats = data.stats;
    $('#statStudents').textContent = Number(stats.totalStudents).toLocaleString('uz-UZ');
    $('#statClasses').textContent = stats.totalClasses;
    $('#statPoints').textContent = Number(stats.totalEcoPoints).toLocaleString('uz-UZ');
    $('#statMissions').textContent = stats.activeMissions;
    $('#statCompleted').textContent = `Bajarilgan missiyalar: ${stats.completedMissions}`;

    if (state.user.role === 'student') {
      $('#statPoints').textContent = Number(stats.myEcoPoints).toLocaleString('uz-UZ');
      $('#statStudents').textContent = '—';
      $('#statClasses').textContent = '—';
    }

    const maxPoints = Math.max(1, ...data.leaderboard.map(item => item.eco_points));
    $('#leaderboard').innerHTML = data.leaderboard.length
      ? data.leaderboard.map((item, index) => `
        <div class="leader-row">
          <span class="rank-number">${String(index + 1).padStart(2, '0')}</span>
          <div class="leader-main">
            <div class="leader-name"><strong>${escapeHTML(item.name)}</strong><span>${item.student_count} o‘quvchi</span></div>
            <div class="bar-track"><div class="bar-fill" data-width="${Math.max(3, item.eco_points / maxPoints * 100)}"></div></div>
          </div>
          <span class="leader-points">${Number(item.eco_points).toLocaleString('uz-UZ')}</span>
        </div>
      `).join('')
      : '<p class="muted small">Hozircha reyting ma’lumoti yo‘q.</p>';

    $$('.bar-fill[data-width]').forEach(el => {
      el.style.width = `${el.dataset.width}%`;
    });

    const resourceMap = Object.fromEntries((data.resourceTotals || []).map(item => [item.resource_type, item]));
    const resourceKeys = ['water', 'electricity', 'waste', 'green_area'];
    $('#resourceSummary').innerHTML = resourceKeys.map(key => {
      const item = resourceMap[key];
      const amount = item ? Number(item.total).toLocaleString('uz-UZ') : '0';
      const unit = item ? item.unit : (key === 'electricity' ? 'kWh' : key === 'green_area' ? 'm²' : key === 'waste' ? 'kg' : 'litr');
      return `<div class="resource-summary-row"><strong>${resourceIcons[key]} &nbsp;${resourceNames[key]}</strong><span>${amount} ${escapeHTML(unit)}</span></div>`;
    }).join('');
  } catch (error) {
    showToast(error.message, true);
  }
}

async function loadStudents(search = '') {
  try {
    const data = await api(`/api/students?search=${encodeURIComponent(search)}`);
    state.students = data.students || [];
    $('#studentCount').textContent = `${state.students.length} ta o‘quvchi`;
    $('#studentsTable').innerHTML = state.students.length ? state.students.map(student => `
      <tr>
        <td><div class="student-cell"><span class="student-mini-avatar">${escapeHTML(student.full_name.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase())}</span><div><strong>${escapeHTML(student.full_name)}</strong><small>ID: #${student.id}</small></div></div></td>
        <td>${escapeHTML(student.class_name || '—')}</td>
        <td>${escapeHTML(student.email)}</td>
        <td><span class="points-pill">${student.eco_points} pts</span></td>
        <td class="admin-control">
          ${['eco_admin', 'director', 'deputy'].includes(state.user.role) ? `<button class="table-action" data-edit-student="${student.id}">Tahrirlash</button><button class="table-action danger" data-delete-student="${student.id}">O‘chirish</button>` : '—'}
        </td>
      </tr>
    `).join('') : '<tr><td colspan="5" class="empty-state">O‘quvchi topilmadi.</td></tr>';
  } catch (error) {
    showToast(error.message, true);
  }
}

async function loadMissions() {
  try {
    const data = await api('/api/missions');
    state.missions = data.missions || [];
    const symbols = { water: '◌', waste: '♲', green: '✳', energy: 'ϟ', general: '✦' };
    $('#missionsGrid').innerHTML = state.missions.length ? state.missions.map(mission => `
      <article class="mission-card">
        <div class="mission-card-top"><span class="mission-symbol">${symbols[mission.category] || '✦'}</span><span class="category-pill">${escapeHTML(mission.category)}</span></div>
        <h3>${escapeHTML(mission.title)}</h3>
        <p>${escapeHTML(mission.description || 'Ekologik topshiriq')}</p>
        <div class="mission-bottom">
          <span class="mission-points">＋${mission.points} ECO</span>
          ${state.user.role === 'student'
            ? (mission.my_status ? '<span class="mission-done">✓ Bajarilgan</span>' : `<button class="btn btn-primary" data-complete-mission="${mission.id}">Bajarildi</button>`)
            : `<span class="mission-done">${mission.status === 'active' ? 'Faol' : 'Yopilgan'}</span>`}
        </div>
      </article>
    `).join('') : '<p class="muted">Hozircha missiyalar mavjud emas.</p>';
  } catch (error) {
    showToast(error.message, true);
  }
}

async function loadResources() {
  try {
    const data = await api('/api/resources');
    state.resources = data.records || [];
    const totals = {};
    for (const record of state.resources) {
      totals[record.resource_type] = totals[record.resource_type] || { amount: 0, unit: record.unit };
      totals[record.resource_type].amount += Number(record.amount);
    }

    $('#resourceMetrics').innerHTML = ['water', 'electricity', 'waste', 'green_area'].map(key => {
      const item = totals[key] || { amount: 0, unit: key === 'electricity' ? 'kWh' : key === 'green_area' ? 'm²' : key === 'waste' ? 'kg' : 'litr' };
      return `<article class="resource-metric"><span class="metric-label">${resourceIcons[key]} &nbsp;${resourceNames[key]}</span><strong>${item.amount.toLocaleString('uz-UZ')}</strong><small>${escapeHTML(item.unit)} · jami qaydlar</small></article>`;
    }).join('');

    $('#resourcesTable').innerHTML = state.resources.length ? state.resources.map(record => `
      <tr><td><span class="category-pill">${resourceIcons[record.resource_type] || '◈'} ${resourceNames[record.resource_type] || escapeHTML(record.resource_type)}</span></td>
      <td><strong>${Number(record.amount).toLocaleString('uz-UZ')} ${escapeHTML(record.unit)}</strong></td>
      <td>${escapeHTML(record.record_date)}</td><td>${escapeHTML(record.note || '—')}</td><td>${escapeHTML(record.created_by_name || '—')}</td></tr>
    `).join('') : '<tr><td colspan="5" class="empty-state">Monitoring yozuvlari mavjud emas.</td></tr>';
  } catch (error) {
    showToast(error.message, true);
  }
}

async function loadMessages() {
  try {
    const [contactsData, messagesData] = await Promise.all([
      api('/api/messages/contacts'),
      api('/api/messages')
    ]);
    state.contacts = contactsData.contacts || [];
    state.messages = messagesData.messages || [];

    const contactSelect = $('#messageContact');
    const previous = contactSelect.value;
    contactSelect.innerHTML = '<option value="">Kontakt tanlang</option>' + state.contacts.map(contact =>
      `<option value="${contact.id}">${escapeHTML(contact.full_name)} · ${escapeHTML(roleNames[contact.role] || contact.role)}</option>`
    ).join('');
    if (state.contacts.some(item => String(item.id) === previous)) contactSelect.value = previous;
    else if (state.contacts.length) contactSelect.value = String(state.contacts[0].id);

    renderMessages();
  } catch (error) {
    showToast(error.message, true);
  }
}

function renderMessages() {
  const contactId = Number($('#messageContact').value);
  const filtered = state.messages.filter(message =>
    !contactId || message.sender_id === contactId || message.receiver_id === contactId
  );

  $('#messagesList').innerHTML = filtered.length ? filtered.map(message => {
    const mine = message.sender_id === state.user.id;
    const date = new Date(message.created_at.replace(' ', 'T') + (message.created_at.includes('Z') ? '' : 'Z'));
    return `<div class="message-bubble ${mine ? 'mine' : ''}">
      <strong>${mine ? 'Siz → ' + escapeHTML(message.receiver_name) : escapeHTML(message.sender_name)}</strong>
      <p>${escapeHTML(message.body)}</p>
      <small>${Number.isNaN(date.getTime()) ? '' : date.toLocaleString('uz-UZ', { dateStyle: 'short', timeStyle: 'short' })}</small>
    </div>`;
  }).join('') : '<p class="muted small">Hozircha xabarlar yo‘q.</p>';
}

async function loadNotifications() {
  try {
    const data = await api('/api/notifications');
    const items = data.notifications || [];
    $('#notificationDot').classList.toggle('hidden', items.length === 0);
    $('#notificationList').innerHTML = items.length ? items.map(item => `
      <div class="notification-item"><strong>${escapeHTML(item.title)}</strong><p>${escapeHTML(item.body)}</p></div>
    `).join('') : '<p class="muted small">Hozircha bildirishnoma yo‘q.</p>';
  } catch (_) {
    // Bildirishnomalar asosiy sahifaga kirishga to‘sqinlik qilmaydi.
  }
}

function setView(view) {
  const allowed = ['dashboard', 'students', 'missions', 'resources', 'messages', 'reports'];
  if (!allowed.includes(view)) return;
  if (view === 'students' && state.user.role === 'student') view = 'dashboard';
  if (view === 'reports' && !['eco_admin', 'director', 'deputy'].includes(state.user.role)) view = 'dashboard';

  state.currentView = view;
  $$('.view-section').forEach(section => section.classList.toggle('hidden', section.id !== `view-${view}`));
  $$('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.view === view));

  const titles = {
    dashboard: 'Umumiy panel', students: 'O‘quvchilar', missions: 'Eco Missions',
    resources: 'Monitoring', messages: 'Xabarlar', reports: 'Hisobotlar'
  };
  $('#pageTitle').textContent = titles[view];

  if (view === 'dashboard') loadDashboard();
  if (view === 'students') loadStudents($('#studentSearch').value);
  if (view === 'missions') loadMissions();
  if (view === 'resources') loadResources();
  if (view === 'messages') loadMessages();
}

function openStudentDialog(student = null) {
  const form = $('#studentForm');
  form.reset();
  form.elements.student_id.value = student ? student.id : '';
  $('#studentDialogTitle').textContent = student ? 'O‘quvchini tahrirlash' : 'O‘quvchi qo‘shish';
  form.elements.full_name.value = student ? student.full_name : '';
  form.elements.email.value = student ? student.email : '';
  form.elements.class_id.value = student ? String(student.class_id) : (state.classes[0] ? String(state.classes[0].id) : '');
  form.elements.password.required = !student;
  $('#studentPasswordLabel').classList.toggle('hidden', Boolean(student));
  $('#studentDialog').showModal();
}

async function startApp() {
  try {
    const data = await api('/api/auth/me');
    showApp(data.user);
  } catch (_) {
    showLogin();
  }
}

$('#loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  $('#loginError').textContent = '';
  const form = new FormData(event.currentTarget);
  try {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: { email: form.get('email'), password: form.get('password') }
    });
    showApp(data.user);
  } catch (error) {
    $('#loginError').textContent = error.message;
  }
});

$$('[data-demo-email]').forEach(button => {
  button.addEventListener('click', () => {
    $('#loginEmail').value = button.dataset.demoEmail;
    $('#loginPassword').value = button.dataset.demoPassword;
  });
});

$('#logoutBtn').addEventListener('click', async () => {
  try {
    await api('/api/auth/logout', { method: 'POST' });
    showLogin();
  } catch (error) {
    showToast(error.message, true);
  }
});

$$('.nav-item').forEach(button => button.addEventListener('click', () => {
  setView(button.dataset.view);
  $('#sidebar').classList.remove('open');
}));

$$('[data-go]').forEach(button => button.addEventListener('click', () => setView(button.dataset.go)));

$('#mobileMenuBtn').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
$('#notificationBtn').addEventListener('click', () => $('#notificationPanel').classList.toggle('hidden'));
document.addEventListener('click', (event) => {
  if (!event.target.closest('.notification-wrap')) $('#notificationPanel').classList.add('hidden');
});

$('#studentSearch').addEventListener('input', (event) => loadStudents(event.target.value));
$('#addStudentBtn').addEventListener('click', () => openStudentDialog());

$('#studentsTable').addEventListener('click', async (event) => {
  const editButton = event.target.closest('[data-edit-student]');
  const deleteButton = event.target.closest('[data-delete-student]');

  if (editButton) {
    const student = state.students.find(item => item.id === Number(editButton.dataset.editStudent));
    if (student) openStudentDialog(student);
  }

  if (deleteButton) {
    const id = Number(deleteButton.dataset.deleteStudent);
    const student = state.students.find(item => item.id === id);
    if (!student || !window.confirm(`${student.full_name} ma’lumotini o‘chirmoqchimisiz?`)) return;
    try {
      await api(`/api/students/${id}`, { method: 'DELETE' });
      showToast('O‘quvchi o‘chirildi.');
      loadStudents($('#studentSearch').value);
      loadDashboard();
    } catch (error) {
      showToast(error.message, true);
    }
  }
});

$('#studentForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const id = form.get('student_id');
  const body = {
    full_name: form.get('full_name'),
    email: form.get('email'),
    class_id: Number(form.get('class_id')),
    password: form.get('password')
  };

  try {
    await api(id ? `/api/students/${id}` : '/api/students', {
      method: id ? 'PUT' : 'POST',
      body
    });
    $('#studentDialog').close();
    showToast(id ? 'Ma’lumot yangilandi.' : 'O‘quvchi qo‘shildi.');
    loadStudents($('#studentSearch').value);
    loadDashboard();
  } catch (error) {
    showToast(error.message, true);
  }
});

$('#addMissionBtn').addEventListener('click', () => $('#missionDialog').showModal());
$('#missionForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    await api('/api/missions', {
      method: 'POST',
      body: {
        title: form.get('title'),
        description: form.get('description'),
        category: form.get('category'),
        points: Number(form.get('points'))
      }
    });
    $('#missionDialog').close();
    event.currentTarget.reset();
    showToast('Yangi Eco Mission yaratildi.');
    loadMissions();
    loadDashboard();
  } catch (error) {
    showToast(error.message, true);
  }
});

$('#missionsGrid').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-complete-mission]');
  if (!button) return;
  button.disabled = true;
  try {
    const data = await api(`/api/missions/${button.dataset.completeMission}/complete`, { method: 'POST', body: {} });
    showToast(data.message);
    loadMissions();
    loadDashboard();
    const me = await api('/api/auth/me');
    state.user = me.user;
  } catch (error) {
    showToast(error.message, true);
    button.disabled = false;
  }
});

$('#resourceForm').elements.record_date.value = new Date().toISOString().slice(0, 10);
$('#resourceForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    await api('/api/resources', {
      method: 'POST',
      body: {
        resource_type: form.get('resource_type'),
        amount: Number(form.get('amount')),
        unit: form.get('unit'),
        record_date: form.get('record_date'),
        note: form.get('note')
      }
    });
    event.currentTarget.reset();
    event.currentTarget.elements.record_date.value = new Date().toISOString().slice(0, 10);
    showToast('Monitoring yozuvi saqlandi.');
    loadResources();
    loadDashboard();
  } catch (error) {
    showToast(error.message, true);
  }
});

$('#messageContact').addEventListener('change', renderMessages);
$('#refreshMessages').addEventListener('click', loadMessages);
$('#messageForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const receiverId = Number($('#messageContact').value);
  const body = $('#messageBody').value.trim();
  if (!receiverId) return showToast('Avval kontakt tanlang.', true);

  try {
    await api('/api/messages', { method: 'POST', body: { receiver_id: receiverId, body } });
    $('#messageBody').value = '';
    showToast('Xabar yuborildi.');
    loadMessages();
    loadNotifications();
  } catch (error) {
    showToast(error.message, true);
  }
});

$$('[data-close]').forEach(button => {
  button.addEventListener('click', () => {
    const dialog = document.getElementById(button.dataset.close);
    if (dialog) dialog.close();
  });
});

startApp();
