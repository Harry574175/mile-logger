// --- Persistent Name ---
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

// --- Utilities ---
function getWeekCommencing(dateStr) {
  // Returns YYYY-MM-DD of Monday for the given date
  const date = new Date(dateStr);
  const day = date.getDay();
  // Calculate Monday (day 1), Sunday is 0
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));
  return monday.toISOString().slice(0, 10);
}

// --- Distance Calculation (your code, unchanged) ---
async function geocodePostcode(postcode) {
  const apiKey = '5b3ce3597851110001cf6248701ed15b48864d0e93d5a18cc93f3101';
  const standardizedPostcode = postcode.replace(/\s+/g, '').toUpperCase();
  const url = `https://api.openrouteservice.org/geocode/search?api_key=${apiKey}&text=${encodeURIComponent(standardizedPostcode)}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.features && data.features.length > 0) {
      return data.features[0].geometry.coordinates; // [longitude, latitude]
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
      const distanceInMiles = distanceInKm * 0.621371; // Convert km to miles
      return distanceInMiles.toFixed(2); // Return distance in miles
    } else {
      throw new Error("Could not calculate distance.");
    }
  } catch (error) {
    console.error("Error calculating distance:", error);
    throw new Error("Could not calculate distance.");
  }
}

// --- Postcode Save/Load (your code, unchanged) ---
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
  list.innerHTML = ''; // Clear the list
  const savedPostcodes = getPostcodes();

  savedPostcodes.forEach(postcode => {
    const listItem = document.createElement('li');
    listItem.textContent = postcode;
    listItem.addEventListener('click', function () {
      document.getElementById(fieldId).value = postcode; // Populate the input field
      list.innerHTML = ''; // Clear the list after selection
    });
    list.appendChild(listItem);
  });
}

// --- Trip Log Data (grouped by week) ---
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
  const period = document.getElementById('period').value; // AM or PM
  const name = document.getElementById('logger-name').value;

  if (!date || !startPostcode || !destinationPostcode || !name) {
    document.getElementById('output').textContent = "Please fill in all fields, including name.";
    return;
  }

  try {
    const distance = await calculateDistance(startPostcode, destinationPostcode);

    savePostcode(startPostcode);
    savePostcode(destinationPostcode);

    // Add to log storage
    const weekCommencing = getWeekCommencing(date);
    const logs = getTripLogs();
    logs.push({
      date,
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

function renderLogs() {
  const logs = getTripLogs();
  const tableBody = document.getElementById('trip-log');
  tableBody.innerHTML = '';

  // Group by week
  const weeks = {};
  logs.forEach(log => {
    if (!weeks[log.weekCommencing]) weeks[log.weekCommencing] = [];
    weeks[log.weekCommencing].push(log);
  });

  // Render rows grouped by week
  Object.keys(weeks).sort().forEach(week => {
    const weekLogs = weeks[week];
    const weekTotal = weekLogs.reduce((sum, l) => sum + l.distance, 0);

    // Week summary row
    const weekRow = document.createElement('tr');
    weekRow.innerHTML = `
      <td colspan="6"><strong>Week Commencing: ${week} &mdash; Total Miles: ${weekTotal.toFixed(2)}</strong></td>
    `;
    tableBody.appendChild(weekRow);

    // Individual trip rows
    weekLogs.forEach(log => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${log.date}</td>
        <td>${log.period}</td>
        <td>${log.startPostcode}</td>
        <td>${log.destinationPostcode}</td>
        <td>${log.distance.toFixed(2)} miles</td>
        <td>${log.name}</td>
      `;
      tableBody.appendChild(row);
    });
  });
}

// --- Totals ---
function updateTotals() {
  const logs = getTripLogs();
  const today = new Date().toISOString().slice(0, 10);
  const todayLogs = logs.filter(log => log.date === today);
  const amTotal = todayLogs.filter(l => l.period === "AM").reduce((sum, l) => sum + l.distance, 0);
  const pmTotal = todayLogs.filter(l => l.period === "PM").reduce((sum, l) => sum + l.distance, 0);
  const dailyTotal = amTotal + pmTotal;
  const monthlyTotal = logs.reduce((sum, l) => sum + l.distance, 0);

  document.getElementById('daily-am').textContent = `AM Total: ${amTotal.toFixed(2)} miles`;
  document.getElementById('daily-pm').textContent = `PM Total: ${pmTotal.toFixed(2)} miles`;
  document.getElementById('daily-total').textContent = `Daily Total: ${dailyTotal.toFixed(2)} miles`;
  document.getElementById('monthly-total').textContent = `Monthly Total: ${monthlyTotal.toFixed(2)} miles`;
}

// --- Initialization ---
function initializeTotals() {
  renderLogs();
  updateTotals();
}

// --- Clear All ---
function clearAll() {
  localStorage.setItem('tripLogs', JSON.stringify([]));
  renderLogs();
  updateTotals();
  document.getElementById('output').textContent = "All logged miles have been cleared!";
}

// --- CSV Export (weekly breakdown) ---
function exportLogsAsCSV() {
  const logs = getTripLogs();
  // Group by week
  const weeks = {};
  logs.forEach(log => {
    if (!weeks[log.weekCommencing]) weeks[log.weekCommencing] = 0;
    weeks[log.weekCommencing] += log.distance;
  });

  let csvContent = "Week Commencing,Name,Miles\n";
  Object.entries(weeks).forEach(([week, miles]) => {
    // Use first log's name for week (assumes consistent name per week)
    const name = logs.find(l => l.weekCommencing === week).name || '';
    csvContent += `${week},${name},${miles.toFixed(2)}\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'mile_logs.csv';
  link.click();
  URL.revokeObjectURL(url);
}

// --- Expose Functions ---
window.logTrip = logTrip;
window.showSavedPostcodes = showSavedPostcodes;
window.clearAll = clearAll;
window.initializeTotals = initializeTotals;
window.exportLogsAsCSV = exportLogsAsCSV;

// --- Initialize on page load ---
document.addEventListener('DOMContentLoaded', initializeTotals);
