// Persistent Name (localStorage)
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

// Strict UK Date Format (DD-MM-YYYY)
function formatDateUK(dateStr) {
  if (!dateStr) return '';
  const [yyyy, mm, dd] = dateStr.split('-');
  return `${dd}-${mm}-${yyyy}`;
}

// Utility: get week commencing Monday for a date
function getWeekCommencing(dateStr) {
  const date = new Date(dateStr);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));
  const isoMonday = monday.toISOString().slice(0, 10);
  return formatDateUK(isoMonday);
}

// --- Distance Calculation (unchanged) ---
async function geocodePostcode(postcode) {
  const apiKey = '5b3ce3597851110001cf6248701ed15b48864d0e93d5a18cc93f3101';
  const standardizedPostcode = postcode.replace(/\s+/g, '').toUpperCase();
  const url = `https://api.openrouteservice.org/geocode/search?api_key=${apiKey}&text=${encodeURIComponent(standardizedPostcode)}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.features && data.features.length > 0) {
      return data.features[0].geometry.coordinates;
    } else {
      throw new Error(`Could not find location for the postcode: ${postcode}`);
    }
  } catch (error) {
    console.error("Error geocoding postcode:", error);
    throw new Error("Could not find location for the postcode.");
  }
}

async function calculateDistance(startPostcode, destinationPostcode) {
  try {
    const startCoords = await geocodePostcode(startPostcode);
    const destinationCoords = await geocodePostcode(destinationPostcode);
    const apiKey = '5b3ce3597851110001cf6248701ed15b48864d0e93d5a18cc93f3101';
    const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${apiKey}&start=${startCoords[0]},${startCoords[1]}&end=${destinationCoords[0]},${destinationCoords[1]}&priority=shortest`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.features && data.features.length > 0) {
      const distanceInKm = data.features[0].properties.segments[0].distance / 1000;
      const distanceInMiles = distanceInKm * 0.621371;
      return distanceInMiles.toFixed(2);
    } else {
      throw new Error("Could not calculate distance.");
    }
  } catch (error) {
    console.error("Error calculating distance:", error);
    throw new Error("Could not calculate distance.");
  }
}

// --- Postcode Save/Load (unchanged) ---
function savePostcode(postcode) {
  let savedPostcodes = JSON.parse(localStorage.getItem('postcodes')) || [];
  if (!savedPostcodes.includes(postcode)) {
    savedPostcodes.push(postcode);
    localStorage.setItem('postcodes', JSON.stringify(savedPostcodes));
  }
}
function getPostcodes() {
  return JSON.parse(localStorage.getItem('postcodes')) || [];
}
function showSavedPostcodes(fieldId) {
  const list = document.getElementById(`${fieldId}-saved-list`);
  list.innerHTML = '';
  const savedPostcodes = getPostcodes();
  savedPostcodes.forEach(postcode => {
    const listItem = document.createElement('li');
    listItem.textContent = postcode;
    listItem.addEventListener('click', function () {
      document.getElementById(fieldId).value = postcode;
      list.innerHTML = '';
    });
    list.appendChild(listItem);
  });
}

// --- Trip Log Data ---
function getTripLogs() {
  return JSON.parse(localStorage.getItem('tripLogs')) || [];
}
function saveTripLogs(logs) {
  localStorage.setItem('tripLogs', JSON.stringify(logs));
}

// --- UI/Log Logic ---
async function logTrip() {
  const date = document.getElementById('date').value;
  const startPostcode = document.getElementById('start').value;
  const destinationPostcode = document.getElementById('destination').value;
  const period = document.getElementById('period').value;
  const name = document.getElementById('logger-name').value;
  if (!date || !startPostcode || !destinationPostcode || !name) {
    document.getElementById('output').textContent = "Please fill in all fields, including name.";
    return;
  }
  try {
    const distance = await calculateDistance(startPostcode, destinationPostcode);
    savePostcode(startPostcode);
    savePostcode(destinationPostcode);
    const weekCommencing = getWeekCommencing(date);
    const logs = getTripLogs();
    logs.push({
      date: formatDateUK(date),
      weekCommencing,
      period,
      startPostcode,
      destinationPostcode,
      distance: parseFloat(distance),
      name
    });
    saveTripLogs(logs);
    renderLogs();
    document.getElementById('start').value = '';
    document.getElementById('destination').value = '';
    document.getElementById('output').textContent = "Trip added successfully!";
  } catch (error) {
    document.getElementById('output').textContent = error.message;
  }
}

// --- Render Table with Weekly Gaps and UK Dates ---
function renderLogs() {
  const logs = getTripLogs();
  const tableBody = document.getElementById('trip-log');
  tableBody.innerHTML = '';
  const weeks = {};
  logs.forEach(log => {
    if (!weeks[log.weekCommencing]) weeks[log.weekCommencing] = [];
    weeks[log.weekCommencing].push(log);
  });
  let firstWeek = true;
  Object.keys(weeks).sort((a, b) => {
    const [aD, aM, aY] = a.split('-').map(Number);
    const [bD, bM, bY] = b.split('-').map(Number);
    return new Date(`${aY}-${aM}-${aD}`) - new Date(`${bY}-${bM}-${bD}`);
  }).forEach(week => {
    if (!firstWeek) {
      const gapRow = document.createElement('tr');
      gapRow.innerHTML = `<td colspan="6" style="height: 1em; background: #fff;"></td>`;
      tableBody.appendChild(gapRow);
    }
    firstWeek = false;
    const weekLogs = weeks[week];
    const weekTotal = weekLogs.reduce((sum, l) => sum + l.distance, 0);
    const weekRow = document.createElement('tr');
    weekRow.innerHTML =
      `<td colspan="6"><strong>Week Commencing: ${week} — Total Miles: ${weekTotal.toFixed(2)}</strong></td>`;
    tableBody.appendChild(weekRow);
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

// --- Initialization ---
function initializeTotals() {
  renderLogs();
}

// --- Clear All ---
function clearAll() {
  localStorage.setItem('tripLogs', JSON.stringify([]));
  renderLogs();
  document.getElementById('output').textContent = "All logged miles have been cleared!";
}

// --- CSV Export (excel-friendly with detailed breakdown) ---
function exportLogsAsCSV() {
  const logs = getTripLogs();
  if (!logs.length) return;
  const name = getLoggerName() || logs[0].name || 'Unknown';
  const now = new Date();
  const isoDate = now.toISOString().slice(0, 10);
  const ukDate = formatDateUK(isoDate);

  // UTF-8 BOM for Excel
  let csv = '\uFEFF';
  csv += `Report Generated On,${ukDate}\n`;
  csv += `Name,${name}\n\n`;

  // Group logs by week
  const weeks = {};
  logs.forEach(log => {
    weeks[log.weekCommencing] = weeks[log.weekCommencing] || [];
    weeks[log.weekCommencing].push(log);
  });

  // Sort weeks chronologically
  const sortedWeeks = Object.keys(weeks).sort((a, b) => {
    const [aD, aM, aY] = a.split('-').map(Number);
    const [bD, bM, bY] = b.split('-').map(Number);
    return new Date(`${aY}-${aM}-${aD}`) - new Date(`${bY}-${bM}-${bD}`);
  });

  // Build CSV body
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

  // Download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const filename = `${name.replace(/\s+/g, '_')}_${isoDate}_mile_logs.csv`;
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

// --- Expose Functions ---
window.logTrip = logTrip;
window.showSavedPostcodes = showSavedPostcodes;
window.clearAll = clearAll;
window.initializeTotals = initializeTotals;
window.exportLogsAsCSV = exportLogsAsCSV;

// --- Initialize on page load ---
document.addEventListener('DOMContentLoaded', initializeTotals);
