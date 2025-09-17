console.log('🚀 script.js loaded at', new Date().toISOString());

// --- Persistent Name (localStorage) ---
function getLoggerName() {
  return localStorage.getItem('loggerName') || '';
}
function setLoggerName(name) {
  localStorage.setItem('loggerName', name);
}
document.addEventListener('DOMContentLoaded', function () {
  const nameInput = document.getElementById('logger-name');
  if (nameInput) {
    nameInput.value = getLoggerName();
    nameInput.addEventListener('input', (e) => setLoggerName(e.target.value));
  }
});

// --- UK Date Format ---
function formatDateUK(dateStr) {
  if (!dateStr) return '';
  const [yyyy, mm, dd] = dateStr.split('-');
  return `${dd}-${mm}-${yyyy}`;
}
function getWeekCommencing(dateStr) {
  const date = new Date(dateStr);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));
  return formatDateUK(monday.toISOString().slice(0, 10));
}

// --- Geocoding & Distance ---
async function geocodePostcode(postcode) {
  const apiKey = '5b3ce3597851110001cf6248701ed15b48864d0e93d5a18cc93f3101';
  const standardized = postcode.replace(/\s+/g, '').toUpperCase();
  const url = `https://api.openrouteservice.org/geocode/search?api_key=${apiKey}&text=${encodeURIComponent(standardized)}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.features?.length > 0) {
      return data.features[0].geometry.coordinates;
    } else {
      throw new Error(`Could not find location for postcode: ${postcode}`);
    }
  } catch (err) {
    console.error("Geocode error:", err);
    throw new Error("Could not find location for the postcode.");
  }
}

async function calculateDistance(start, end) {
  try {
    const startCoords = await geocodePostcode(start);
    const endCoords = await geocodePostcode(end);
    const apiKey = '5b3ce3597851110001cf6248701ed15b48864d0e93d5a18cc93f3101';
    const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${apiKey}&start=${startCoords[0]},${startCoords[1]}&end=${endCoords[0]},${endCoords[1]}&priority=shortest`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.features?.length > 0) {
      const km = data.features[0].properties.segments[0].distance / 1000;
      return (km * 0.621371).toFixed(2);
    } else {
      throw new Error("Could not calculate distance.");
    }
  } catch (err) {
    console.error("Distance error:", err);
    throw new Error("Could not calculate distance.");
  }
}

// --- Postcode Save/Load ---
function savePostcode(postcode) {
  const saved = JSON.parse(localStorage.getItem('postcodes')) || [];
  if (!saved.includes(postcode)) {
    saved.push(postcode);
    localStorage.setItem('postcodes', JSON.stringify(saved));
  }
}
function getPostcodes() {
  return JSON.parse(localStorage.getItem('postcodes')) || [];
}
function showSavedPostcodes(fieldId) {
  const list = document.getElementById(`${fieldId}-saved-list`);
  if (!list) return;
  list.innerHTML = '';
  getPostcodes().forEach(postcode => {
    const li = document.createElement('li');
    li.textContent = postcode;
    li.onclick = () => {
      document.getElementById(fieldId).value = postcode;
      list.innerHTML = '';
    };
    list.appendChild(li);
  });
}

// --- Trip Log Data ---
function getTripLogs() {
  return JSON.parse(localStorage.getItem('tripLogs')) || [];
}
function saveTripLogs(logs) {
  localStorage.setItem('tripLogs', JSON.stringify(logs));
}

// --- Log Trip ---
async function logTrip() {
  const date = document.getElementById('date').value;
  const start = document.getElementById('start').value;
  const end = document.getElementById('destination').value;
  const period = document.getElementById('period').value;
  const name = document.getElementById('logger-name').value;
  if (!date || !start || !end || !name) {
    document.getElementById('output').textContent = "Please fill in all fields, including name.";
    return;
  }
  try {
    const distance = await calculateDistance(start, end);
    savePostcode(start);
    savePostcode(end);
    const week = getWeekCommencing(date);
    const logs = getTripLogs();
    logs.push({
      date: formatDateUK(date),
      weekCommencing: week,
      period,
      startPostcode: start,
      destinationPostcode: end,
      distance: parseFloat(distance),
      name
    });
    saveTripLogs(logs);
    renderLogs();
    document.getElementById('start').value = '';
    document.getElementById('destination').value = '';
    document.getElementById('output').textContent = "Trip added successfully!";
  } catch (err) {
    document.getElementById('output').textContent = err.message;
  }
}

// --- Render Logs ---
function renderLogs() {
  const logs = getTripLogs();
  const tableBody = document.getElementById('trip-log');
  if (!tableBody) return;
  tableBody.innerHTML = '';
  const weeks = {};
  logs.forEach(log => {
    weeks[log.weekCommencing] = weeks[log.weekCommencing] || [];
    weeks[log.weekCommencing].push(log);
  });
  let firstWeek = true;
  Object.keys(weeks).sort((a, b) => {
    const [aD, aM, aY] = a.split('-').map(Number);
    const [bD, bM, bY] = b.split('-').map(Number);
    return new Date(`${aY}-${aM}-${aD}`) - new Date(`${bY}-${bM}-${bD}`);
  }).forEach(week => {
    if (!firstWeek) {
      const gap = document.createElement('tr');
      gap.innerHTML = `<td colspan="6" style="height: 1em; background: #fff;"></td>`;
      tableBody.appendChild(gap);
    }
    firstWeek = false;
    const weekLogs = weeks[week];
    const total = weekLogs.reduce((sum, l) => sum + l.distance, 0);
    const header = document.createElement('tr');
    header.innerHTML = `<td colspan="6"><strong>Week Commencing: ${week} — Total Miles: ${total.toFixed(2)}</strong></td>`;
    tableBody.appendChild(header);
    weekLogs.forEach(log => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${log.date}</td>
        <td>${log.period}</td>
        <td>${log.startPostcode}</td>
        <td>${log.destinationPostcode}</td>
        <td>${log.distance.toFixed(2)} miles</td>
        <td>${log.name}</td>`;
      tableBody.appendChild(row);
    });
  });
}

// --- Clear All ---
function clearAll() {
  localStorage.setItem('tripLogs', JSON.stringify([]));
  renderLogs();
  document.getElementById('output').textContent = "All logged miles have been cleared!";
}

// --- Export CSV ---
function exportLogsAsCSV() {
  const logs = getTripLogs();
  if (!logs.length) return;
  const name = getLoggerName() || logs[0].name || 'Unknown';
  const now = new Date();
  const isoDate = now.toISOString().slice(0, 10);
  const ukDate = formatDateUK(isoDate);
  let csv = '\uFEFF';
  csv += `Report Generated On,${ukDate}\n`;
  csv += `Name,${name}\n\n`;
  const weeks = {};
  logs.forEach(log => {
    weeks[log.weekCommencing] = weeks[log.weekCommencing] || [];
    weeks[log.weekCommencing].push(log);
  });
  const sortedWeeks = Object.keys(weeks).sort((a, b) => {
    const [aD, aM, aY] = a.split('-').map(Number);
    const [bD, bM, bY] = b.split('-').map(Number);
    return new Date(`${aY}-${aM}-${aD}`) - new Date(`${bY}-${bM}-${bD}`);
  });
  sortedWeeks
  sortedWeeks.forEach(week => {
    const weekLogs = weeks[week];
    const weekTotal = weekLogs.reduce((sum, l) => sum + l.distance, 0);
    csv += `Week Commencing,${week}\n`;
    csv += `Date,Period,Start Postcode,Destination Postcode,Distance (miles)\n`;
    weekLogs.forEach(l => {
      csv += [
        l.date,
        l.period,
        l.startPostcode,
        l.destinationPostcode,
        l.distance.toFixed(2)
      ].join(',') + '\n';
    });
    csv += `Total Miles:,${weekTotal.toFixed(2)}\n\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const filename = `${name.replace(/\s+/g, '_')}_${isoDate}_mile_logs.csv`;
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

// ✅ Expose functions globally
window.getLoggerName = getLoggerName;
window.setLoggerName = setLoggerName;
window.showSavedPostcodes = showSavedPostcodes;
window.logTrip = logTrip;
window.clearAll = clearAll;
window.exportLogsAsCSV = exportLogsAsCSV;
window.initializeTotals = renderLogs;

// ✅ Initialize on page load
document.addEventListener('DOMContentLoaded', renderLogs);
