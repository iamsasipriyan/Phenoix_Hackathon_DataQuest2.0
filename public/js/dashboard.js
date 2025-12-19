const calendarModal = document.getElementById('calendarModal');
const modalContent = document.getElementById('calendarModalContent');
const inlineWrapper = document.getElementById('inlineCalendarWrapper');
const calendarContainer = document.getElementById('calendarContainer');

/* ================================
   DOM REFERENCES
================================ */
const timeColumn = document.querySelector('.time-column');
const eventsColumn = document.getElementById('eventsColumn');
const todoContainer = document.getElementById('todoContainer');
const viewItems = document.querySelectorAll('.view-list li');

let calendarEvents = [];
let currentView = 'hour';

/* ================================
   USER INFO
// ================================ */

// const storedEmail = localStorage.getItem('userEmail');
// const storedName = localStorage.getItem('userName');
// const storedPhoto = localStorage.getItem('userPhoto');

// localStorage.setItem('userEmail', user.email);


fetch('/user')
  .then(res => res.json())
  .then(user => {
    if (!user.email) return;

    document.getElementById('profilePic').src = user.photo;
    document.getElementById('userName').innerText =
      user.email.split('@')[0];
    document.getElementById('userEmail').innerText = user.email;
    document.getElementById('calendarTitle').innerText = 'Calendar';

    loadGoogleEvents();
  });

/* ================================
   LOAD GOOGLE EVENTS (ONCE)
================================ */
function loadGoogleEvents() {
  fetch('/calendar/events')
    .then(res => res.json())
    .then(events => {
      calendarEvents = events || [];
      switchView('hour');
    });
}

/* ================================
   VIEW SWITCH HANDLER
================================ */
viewItems.forEach(item => {
  item.addEventListener('click', () => {
    viewItems.forEach(v => v.classList.remove('active'));
    item.classList.add('active');
    switchView(item.dataset.view);
  });
});

/* ================================
   MAIN VIEW SWITCH
================================ */
function switchView(view) {
  // clear previous content
  timeColumn.innerHTML = '';
  eventsColumn.innerHTML = '';
  eventsColumn.removeAttribute('style');

  if (view === 'hour') {
    /* ✅ RETURN TO INLINE */

    // MOVE CALENDAR BACK INLINE
    if (!inlineWrapper.contains(calendarContainer)) {
      inlineWrapper.appendChild(calendarContainer);
    }

    calendarModal.classList.remove('active');

    calendarContainer.style.width = '240px';
    calendarContainer.style.height = '600px';

    timeColumn.style.display = 'block';

    generateHours();
    renderHourView();

     // ✅ ADD THESE
  showCurrentTimeLine();
  scrollToCurrentTime();
  }

  if (view === 'week') {
    /* WEEK POPUP */

    calendarModal.classList.add('active');
    modalContent.appendChild(calendarContainer);

    calendarContainer.style.width = '80vw';
    calendarContainer.style.height = '80vh';

    timeColumn.style.display = 'none';

    renderWeekView();
  }

  if (view === 'month') {
    /* MONTH POPUP */

    calendarModal.classList.add('active');
    modalContent.appendChild(calendarContainer);

    calendarContainer.style.width = '80vw';
    calendarContainer.style.height = '80vh';

    timeColumn.style.display = 'none';

    renderMonthView();
  }
}




/* ================================
   HOUR VIEW (DAY)
================================ */
function renderHourView() {
  generateHours();

  calendarEvents.forEach(event => {
    if (!event.start?.dateTime || !event.end?.dateTime) return;

    const start = new Date(event.start.dateTime);
    const end = new Date(event.end.dateTime);

    renderEvent(
      event.summary || 'Untitled',
      start.getHours() + start.getMinutes() / 60,
      end.getHours() + end.getMinutes() / 60
    );
  });
}
let currentTimeLine = null;

function showCurrentTimeLine() {
  // Remove old line
  if (currentTimeLine) currentTimeLine.remove();

  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();

  // Convert time → minutes since midnight
  const minutesFromTop = (hours * 60) + minutes;

  currentTimeLine = document.createElement('div');
  currentTimeLine.className = 'current-time-line';
  currentTimeLine.style.top = `${minutesFromTop}px`;

  const dot = document.createElement('div');
  dot.className = 'current-time-dot';
  currentTimeLine.appendChild(dot);

  eventsColumn.appendChild(currentTimeLine);
}

function scrollToCurrentTime() {
  const now = new Date();
  const minutesFromTop = (now.getHours() * 60) + now.getMinutes();

  // Scroll so current time is slightly above center
  eventsColumn.parentElement.scrollTop = Math.max(minutesFromTop - 200, 0);
}


function generateHours() {
  // Clear existing hours first
  timeColumn.innerHTML = '';

  for (let i = 0; i < 24; i++) {
    const hour = document.createElement('div');
    hour.className = 'hour';

    const displayHour = i % 12 === 0 ? 12 : i % 12;
    const period = i < 12 ? 'AM' : 'PM';

    hour.innerText = `${displayHour} ${period}`;
    timeColumn.appendChild(hour);
  }
}


function renderEvent(title, start, end) {
  const eventDiv = document.createElement('div');
  eventDiv.className = 'event';
  eventDiv.style.top = `${start * 60}px`;
  eventDiv.style.height = `${(end - start) * 60}px`;
  eventDiv.style.background = getColor(title);

  eventDiv.innerHTML = `
    <strong>${title}</strong>
    <span>${formatTime(start)} – ${formatTime(end)}</span>
  `;

  eventsColumn.appendChild(eventDiv);
}

/* ================================
   WEEK VIEW (REAL GOOGLE EVENTS)
================================ */
function renderWeekView() {
  timeColumn.style.display = 'none';

  eventsColumn.innerHTML = '';
  eventsColumn.style.display = 'grid';
  eventsColumn.style.gridTemplateColumns = 'repeat(7, 1fr)';
  eventsColumn.style.gap = '14px';

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday

  for (let d = 0; d < 7; d++) {
    const dayDate = new Date(weekStart);
    dayDate.setDate(weekStart.getDate() + d);

    const dayCol = document.createElement('div');
    dayCol.className = 'week-day';

    dayCol.innerHTML = `
      <div class="week-day-header">
        ${dayDate.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric'
        })}
      </div>
      <div class="week-events"></div>
    `;

    const eventsWrapper = dayCol.querySelector('.week-events');

    calendarEvents.forEach(event => {
      const start = new Date(event.start.dateTime || event.start.date);

      if (start.toDateString() === dayDate.toDateString()) {
        const ev = document.createElement('div');
        ev.className = 'week-event';
        ev.innerText = event.summary || 'Untitled';
        eventsWrapper.appendChild(ev);
      }
    });

    eventsColumn.appendChild(dayCol);
  }
}
/* ================================
   MONTH VIEW (REAL GOOGLE EVENTS)
================================ */
function renderMonthView() {
  timeColumn.style.display = 'none';

  eventsColumn.innerHTML = '';
  eventsColumn.style.display = 'grid';
  eventsColumn.style.gridTemplateColumns = 'repeat(7, 1fr)';
  eventsColumn.style.gap = '12px';

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    eventsColumn.appendChild(document.createElement('div'));
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const cell = document.createElement('div');
    cell.className = 'month-day';

    // Count events for this day
    const eventCount = calendarEvents.filter(event => {
      const start = new Date(event.start.dateTime || event.start.date);
      return (
        start.getDate() === day &&
        start.getMonth() === month &&
        start.getFullYear() === year
      );
    }).length;

    cell.innerHTML = `
  <div class="month-day-header">
    <div class="day-number">${day}</div>
    ${
      eventCount > 0
        ? `<div class="event-count">${eventCount}</div>`
        : ''
    }
  </div>
`;

    eventsColumn.appendChild(cell);
  }
}

/* ================================
   YEAR VIEW (SUMMARY)
================================ */
// function renderYearView() {
//   timeColumn.style.display = 'none';

//   eventsColumn.style.display = 'grid';
//   eventsColumn.style.gridTemplateColumns = 'repeat(4, 1fr)';
//   eventsColumn.style.gap = '16px';

//   const months = [
//     'January','February','March','April',
//     'May','June','July','August',
//     'September','October','November','December'
//   ];

//   months.forEach(month => {
//     const box = document.createElement('div');
//     box.style.background = 'rgba(255,255,255,0.06)';
//     box.style.borderRadius = '16px';
//     box.style.padding = '18px';
//     box.style.textAlign = 'center';
//     box.style.fontWeight = '600';
//     box.innerText = month;

//     eventsColumn.appendChild(box);
//   });
// }

/* ================================
   TODO LIST (JSON)
================================ */
fetch('/todo.json')
  .then(res => res.json())
  .then(todos => {
    todos.forEach((todo, index) => {
      const item = document.createElement('div');
      item.className = `todo-item ${getTodoColor(index)}`;

      item.innerHTML = `
        <label class="todo-check">
          <input type="checkbox">
          <span class="checkmark"></span>
        </label>
        <span class="todo-title">${todo.title}</span>
      `;

      const checkbox = item.querySelector('input');
      checkbox.addEventListener('change', () => {
        item.classList.toggle('completed', checkbox.checked);
      });

      todoContainer.appendChild(item);
    });
  });

/* ================================
   HELPERS
================================ */
function formatTime(h) {
  const hour = Math.floor(h);
  const min = Math.round((h % 1) * 60);
  return `${hour % 12 || 12}:${min === 0 ? '00' : min}`;
}

function getColor(text) {
  const colors = ['#A78BFA', '#60A5FA', '#34D399', '#F472B6', '#FBBF24'];
  return colors[text.length % colors.length];
}

function getTodoColor(index) {
  const colors = ['purple', 'blue', 'green', 'pink', 'orange'];
  return colors[index % colors.length];
}

/* ================================
   MODAL & LOGOUT
================================ */
function openTaskModal() {
  document.getElementById('taskModal').style.display = 'flex';
}

function closeTaskModal() {
  document.getElementById('taskModal').style.display = 'none';
}
calendarModal.addEventListener('click', (e) => {
  if (e.target === calendarModal) {
    calendarModal.classList.remove('active');

    // revert to hour view
    document
      .querySelector('.view-list li[data-view="hour"]')
      .click();
  }
});

function logout() {
  window.location.href = '/logout';
}

/* ================================
   CLOSE CALENDAR MODAL SAFELY
================================ */
calendarModal.addEventListener('click', (e) => {
  if (e.target === calendarModal) {
    document
      .querySelector('.view-list li[data-view="hour"]')
      .click();
  }
});

// fetch('/api/analyze-task', {
//   method: 'POST',
//   body: JSON.stringify({
//     taskDescription,
//     userEmail,
//     userName
//   })
// });


document.addEventListener('DOMContentLoaded', () => {
  document.querySelector('.save-btn').addEventListener('click', async () => {
    const input = document.getElementById('taskInput');
    const taskDescription = input.value.trim();

    if (!taskDescription) {
      alert('Please enter a task');
      return;
    }

    const btn = document.querySelector('.save-btn');
    btn.innerText = 'Analyzing...';
    btn.disabled = true;

    try {
      const response = await fetch('/api/analyze-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          taskDescription,
          userEmail: localStorage.getItem('userEmail'),
          userName: localStorage.getItem('userName')
        })
      });

      if (!response.ok) {
        throw new Error('API failed');
      }

      const data = await response.json();
      console.log('Gemini API Response:', data);

      alert(
        `Task Created!\n\nType: ${data.type}\nTitle: ${data.data?.title}`
      );

      input.value = '';
      closeTaskModal();

    } catch (error) {
      console.error('API Error:', error);
      alert('Failed to analyze task');
    } finally {
      btn.innerText = 'Submit';
      btn.disabled = false;
    }
  });
});
document.addEventListener("DOMContentLoaded", () => {
  const ctx = document.getElementById("taskBarChart");

  new Chart(ctx, {
    type: "bar",
    data: {
      labels: [
        "6 AM","7 AM","8 AM","9 AM","10 AM","11 AM",
        "12 PM","1 PM","2 PM","3 PM","4 PM","5 PM",
        "6 PM","7 PM","8 PM","9 PM","10 PM","11 PM"
      ],
      datasets: [{
        label: "Tasks per Hour",
        data: [
          0, 1, 3, 4, 5, 3,
          2, 1, 0, 2, 3, 4,
          2, 1, 0, 0, 0, 0
        ],
        backgroundColor: [
          "#22c55e","#ef4444","#ef4444","#ef4444","#ef4444","#ef4444",
          "#ef4444","#ef4444","#22c55e","#ef4444","#ef4444","#ef4444",
          "#ef4444","#ef4444","#22c55e","#22c55e","#22c55e","#22c55e"
        ],
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx =>
              ctx.raw === 0 ? "Free slot" : `${ctx.raw} task(s)`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1 }
        }
      }
    }
  });
});
document.addEventListener("DOMContentLoaded", () => {
  const ctx = document.getElementById("taskPieChart");

  new Chart(ctx, {
    type: "pie",
    data: {
      labels: ["Work", "Personal", "Hobby", "Fun", "Rest"],
      datasets: [{
        data: [10, 20, 15, 8, 12]
      }]
    }
  });
});
const pendingTasksData = [
  { id: 1, title: "Fix login bug", completed: false },
  { id: 2, title: "Prepare weekly report", completed: false },
  { id: 3, title: "Review PRs", completed: true }
];
/* ================================
   PENDING TASKS (CHECKBOX)
================================ */

document.addEventListener("DOMContentLoaded", () => {
  renderPendingTasks();
});

function renderPendingTasks() {
  const container = document.getElementById("pendingTasks");
  if (!container) return;

  // Remove old list if re-rendering
  const oldList = container.querySelector(".pending-list");
  if (oldList) oldList.remove();

  const list = document.createElement("div");
  list.className = "pending-list";

  pendingTasksData.forEach(task => {
    const item = document.createElement("div");
    item.className = "pending-item";
    if (task.completed) item.classList.add("completed");

    item.innerHTML = `
      <label class="pending-check">
        <input type="checkbox" ${task.completed ? "checked" : ""}>
        <span class="checkmark"></span>
      </label>
      <span class="pending-title">${task.title}</span>
    `;

    const checkbox = item.querySelector("input");
    checkbox.addEventListener("change", () => {
      task.completed = checkbox.checked;
      item.classList.toggle("completed", checkbox.checked);
    });

    list.appendChild(item);
  });

  container.appendChild(list);
}
const helpBtn = document.querySelector('.help-btn');

if (helpBtn) {
  helpBtn.addEventListener('click', () => {
    openChatModal();
  });
}

function openChatModal() {
  if (chatbotModal) {
    chatbotModal.style.display = 'flex';
  }
}

setInterval(() => {
  if (currentView === 'hour') {
    showCurrentTimeLine();
  }
}, 60000);
