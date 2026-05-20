console.log("script.js loaded");

// Persistent name
function getLoggerName() {
  return localStorage.getItem("loggerName") || "";
}
function setLoggerName(name) {
  localStorage.setItem("loggerName", name);
}

// Date formatting
function formatDateUK(dateStr) {
  if (!dateStr) return "";
  const [yyyy, mm, dd] = dateStr.split("-");
  return `${dd}-${mm}-${yyyy}`;
}

function getWeekCommencing(dateStr) {
  const date = new Date(dateStr);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));
  return formatDateUK(monday.toISOString().slice(0, 10));
}

// Geocoding
async function geocodePostcode(postcode) {
  const apiKey = "5b3ce3597851110001cf6248701ed15b48864d0e93d5a18cc93f3101";
  const cleaned = postcode.replace(/\s+/g, "").toUpperCase();
  const url = `https://api.openrouteservice.org/geocode/search?api_key=${apiKey}&text=${encodeURIComponent(cleaned)}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.features && data.features.length > 0) {
    return data.features[0].geometry.coordinates;
  }
  throw new Error(`Could not find location for postcode: ${postcode}`);
}

// Distance calculation
async function calculateDistance(start, end) {
  const startCoords = await geocodePostcode(start);
  const endCoords = await geocodePostcode(end);
  const apiKey = "5b3ce3597851110001cf6248701ed15b48864d0e93d5a18cc93f3101";
  const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${apiKey}&start=${startCoords[0]},${startCoords[1]}&end=${endCoords[0]},${endCoords[1]}&priority=shortest`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.features && data.features.length > 0) {
    const km = data.features[0].properties.segments[0].distance / 1000;
    return (km * 0.621371).toFixed(2);
  }
  throw new Error("Could not calculate distance.");
}

// Postcode saving
function savePostcode(pc) {
  const saved = JSON.parse(localStorage.getItem("postcodes")) || [];
  if (!saved.includes(pc)) {
    saved.push(pc);
    localStorage.setItem("postcodes", JSON.stringify(saved));
  }
}

function getPostcodes() {
  return JSON.parse(localStorage.getItem("postcodes")) || [];
}

function showSavedPostcodes(fieldId) {
  const list = document.getElementById(`${fieldId}-saved-list`);
  list.innerHTML = "";
  getPostcodes().forEach(pc => {
    const li = document.createElement("li");
    li.textContent = pc;
    li.onclick = () => {
      document.getElementById(fieldId).value = pc;
      list.innerHTML = "";
    };
    list.appendChild(li);
  });
}

// Trip logs
function getTripLogs() {
  return JSON.parse(localStorage.getItem("tripLogs")) || [];
}

function saveTripLogs(logs) {
  localStorage.setItem("tripLogs", JSON.stringify(logs));
}

// Delete entry
function deleteEntry(id) {
  const logs = getTripLogs().filter(log => log.id !== id);
  saveTripLogs(logs);
  renderLogs();
}

let pendingDeleteId = null;

function showDeletePopup(id) {
  pendingDeleteId = id;
  document.getElementById("delete-popup").classList.remove("hidden");
}

function hideDeletePopup() {
  pendingDeleteId = null;
  document.getElementById("delete-popup").classList.add("hidden");
}

// Log trip
async function logTrip() {
  const date = document.getElementById("date").value;
  const start = document.getElementById("start").value;
  const end = document.getElementById("destination").value;
  const period = document.getElementById("period").value;
  const name = document.getElementById("logger-name").value;
  const output = document.getElementById("output");

  if (!date || !start || !end || !name) {
    output.textContent = "Please fill in all fields.";
    return;
  }

  try {
    const distance = await calculateDistance(start, end);
    savePostcode(start);
    savePostcode(end);

    const logs = getTripLogs();
    logs.push({
      id: crypto.randomUUID(),
      date: formatDateUK(date),
      weekCommencing: getWeekCommencing(date),
      period,
      startPostcode: start,
      destinationPostcode: end,
      distance: parseFloat(distance),
      name
    });

    saveTripLogs(logs);
    renderLogs();
    output.textContent = "Trip added!";
    document.getElementById("start").value = "";
    document.getElementById("destination").value = "";
  } catch (err) {
    output.textContent = err.message;
  }
}

// Render logs
function renderLogs() {
  const logs = getTripLogs();
  const table = document.getElementById("trip-log");
  table.innerHTML = "";

  const weeks = {};

  logs.forEach(log => {
    if (!weeks[log.weekCommencing]) weeks[log.weekCommencing] = [];
    weeks[log.weekCommencing].push(log);
  });

  Object.keys(weeks)
    .sort((a, b) => new Date(a.split("-").reverse().join("-")) - new Date(b.split("-").reverse().join("-")))
    .forEach((week, index) => {
      if (index > 0) {
        const gap = document.createElement("tr");
        gap.classList.add("gap-row");
        gap.innerHTML = "<td colspan='6'></td>";
        table.appendChild(gap);
      }

      const weekLogs = weeks[week];
      const total = weekLogs.reduce((sum, l) => sum + l.distance, 0);

      const header = document.createElement("tr");
      header.innerHTML = `<td colspan="6"><strong>Week Commencing: ${week} — Total Miles: ${total.toFixed(2)}</strong></td>`;
      table.appendChild(header);

      weekLogs.forEach(log => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${log.date}</td>
          <td>${log.period}</td>
          <td>${log.startPostcode}</td>
          <td>${log.destinationPostcode}</td>
          <td>${log.distance.toFixed(2)} miles</td>
          <td>${log.name}</td>
        `;

        row.addEventListener("contextmenu", e => {
          e.preventDefault();
          showDeletePopup(log.id);
        });

        let pressTimer;
        row.addEventListener("touchstart", () => {
          pressTimer = setTimeout(() => showDeletePopup(log.id), 700);
        });
        row.addEventListener("touchend", () => clearTimeout(pressTimer));
        row.addEventListener("touchmove", () => clearTimeout(pressTimer));

        table.appendChild(row);
      });
    });
}

// Clear all
function clearAll() {
  saveTripLogs([]);
  renderLogs();
  document.getElementById("output").textContent = "All entries cleared.";
}

// Export CSV
function exportLogsAsCSV() {
  const logs = getTripLogs();
  if (!logs.length) return;

  let csv = "Date,Period,Start,Destination,Distance,Name\n";

  logs.forEach(l => {
    csv += `${l.date},${l.period},${l.startPostcode},${l.destinationPostcode},${l.distance},${l.name}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "mileage_log.csv";
  a.click();
}

// DOM Ready
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("logger-name").value = getLoggerName();
  document.getElementById("logger-name").addEventListener("input", e => setLoggerName(e.target.value));

  document.getElementById("log-trip-btn").addEventListener("click", logTrip);
  document.getElementById("clear-all-btn").addEventListener("click", clearAll);
  document.getElementById("export-csv-btn").addEventListener("click", exportLogsAsCSV);

  document.getElementById("start-show-btn").addEventListener("click", () => showSavedPostcodes("start"));
  document.getElementById("destination-show-btn").addEventListener("click", () => showSavedPostcodes("destination"));

  document.getElementById("delete-yes").addEventListener("click", () => {
    deleteEntry(pendingDeleteId);
    hideDeletePopup();
  });

  document.getElementById("delete-no").addEventListener("click", hideDeletePopup);

  renderLogs();
});
