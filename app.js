const services = [
  { id: 'refresh', name: 'The Refresh', duration: 30, price: 25, icon: '✳', description: 'A quick tidy-up and a little time to reset.' },
  { id: 'full-visit', name: 'The Full Visit', duration: 60, price: 45, icon: '✿', description: 'Settle in for the full service, start to finish.' },
  { id: 'something-special', name: 'Something Special', duration: 90, price: 65, icon: '♡', description: 'A little extra care, with nowhere else to be.' }
];
const times = ['9:00 am', '10:00 am', '11:00 am', '12:00 pm', '1:00 pm', '2:00 pm', '3:00 pm', '4:00 pm', '5:00 pm'];
const storageKey = 'booked-shop-appointments-v1';
const $ = (selector) => document.querySelector(selector);
const localDate = (date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const dateInput = $('#date-select');
const today = new Date();
dateInput.min = localDate(today);
dateInput.value = localDate(today);

function readBookings() {
  try { return JSON.parse(localStorage.getItem(storageKey) || '[]'); }
  catch { return []; }
}
function saveBookings(bookings) { localStorage.setItem(storageKey, JSON.stringify(bookings)); }
function money(amount) { return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(amount); }
function prettyDate(value, options = { weekday: 'long', month: 'long', day: 'numeric' }) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-KE', options);
}

function renderServices() {
  $('#service-grid').innerHTML = services.map((service) => `
    <article class="service-card">
      <div class="service-icon" aria-hidden="true">${service.icon}</div>
      <h3>${service.name}</h3><p>${service.description}</p>
      <div class="service-meta"><span>${service.duration} minutes</span><strong>${money(service.price)}</strong></div>
      <button class="select-service" type="button" data-service="${service.id}" aria-label="Book ${service.name}"></button>
    </article>`).join('');
  $('#service-select').insertAdjacentHTML('beforeend', services.map((s) => `<option value="${s.id}">${s.name} · ${s.duration} min · ${money(s.price)}</option>`).join(''));
  document.querySelectorAll('.select-service').forEach((button) => button.addEventListener('click', () => {
    $('#service-select').value = button.dataset.service;
    updateSummary();
    $('#booking').scrollIntoView({ behavior: 'smooth' });
  }));
}

function updateSummary() {
  const service = services.find((item) => item.id === $('#service-select').value);
  $('#booking-summary').innerHTML = service
    ? `<span>${service.name} · ${service.duration} minutes</span><strong>${money(service.price)}</strong>`
    : '<span>Select a service to see your total</span><strong>—</strong>';
}

function renderTimes() {
  const date = dateInput.value;
  const selectedService = $('#service-select').value;
  const booked = readBookings().filter((booking) => booking.date === date && booking.status !== 'cancelled');
  $('#selected-time').value = '';
  $('#slot-error').textContent = '';
  $('#time-slots').innerHTML = times.map((time) => {
    const occupied = booked.some((booking) => booking.time === time);
    return `<button class="time-slot" type="button" data-time="${time}" ${occupied ? 'disabled aria-label="' + time + ', unavailable"' : ''}>${time}</button>`;
  }).join('');
  document.querySelectorAll('.time-slot:not(:disabled)').forEach((button) => button.addEventListener('click', () => {
    document.querySelectorAll('.time-slot').forEach((slot) => slot.classList.remove('active'));
    button.classList.add('active');
    $('#selected-time').value = button.dataset.time;
    $('#slot-error').textContent = '';
  }));
  if (!selectedService) $('#slot-error').textContent = 'Choose a service to continue.';
}

function renderBookings() {
  const bookings = readBookings().filter((booking) => booking.status !== 'cancelled').sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  if (!bookings.length) {
    $('#booking-list').innerHTML = '<div class="empty-state"><strong>No visits on the calendar yet.</strong>Your next good day starts with a booking.</div>';
    return;
  }
  $('#booking-list').innerHTML = bookings.map((booking) => {
    const service = services.find((item) => item.id === booking.serviceId);
    if (!service) return '';
    const date = new Date(`${booking.date}T12:00:00`);
    return `<article class="booking-item"><div class="booking-date"><div class="date-chip"><strong>${date.getDate()}</strong><small>${date.toLocaleDateString('en-KE', { month: 'short' }).toUpperCase()}</small></div><div><h3>${service.name}</h3><p>${prettyDate(booking.date)} · ${booking.time} · ${booking.name}</p></div></div><div><span class="item-price">${money(service.price)}</span><button class="cancel-booking" type="button" data-id="${booking.id}">Cancel</button></div></article>`;
  }).join('');
  document.querySelectorAll('.cancel-booking').forEach((button) => button.addEventListener('click', () => {
    saveBookings(readBookings().filter((booking) => booking.id !== button.dataset.id));
    renderBookings(); renderTimes(); showToast('Your booking has been cancelled.');
  }));
}

let toastTimer;
function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

$('#service-select').addEventListener('change', () => { updateSummary(); renderTimes(); });
dateInput.addEventListener('change', renderTimes);
$('#booking-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const service = services.find((item) => item.id === $('#service-select').value);
  const date = dateInput.value;
  const time = $('#selected-time').value;
  if (!service) { $('#slot-error').textContent = 'Please choose a service.'; $('#service-select').focus(); return; }
  if (!time) { $('#slot-error').textContent = 'Please choose an available time.'; $('#time-slots').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  if (new Date(`${date}T12:00:00`).getDay() === 0 || new Date(`${date}T12:00:00`).getDay() === 1) { $('#slot-error').textContent = 'We’re closed Sunday and Monday. Choose another date.'; return; }
  const bookings = readBookings();
  if (bookings.some((booking) => booking.date === date && booking.time === time)) { $('#slot-error').textContent = 'That time was just booked. Please choose another.'; renderTimes(); return; }
  bookings.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), serviceId: service.id, date, time, name: $('#customer-name').value.trim(), phone: $('#customer-phone').value.trim(), email: $('#customer-email').value.trim(), status: 'booked', createdAt: new Date().toISOString() });
  saveBookings(bookings);
  event.target.reset();
  dateInput.value = localDate(today);
  updateSummary(); renderTimes(); renderBookings();
  showToast('You’re all booked. We look forward to seeing you!');
  $('#my-bookings').scrollIntoView({ behavior: 'smooth' });
});

renderServices();
updateSummary();
renderTimes();
renderBookings();
