console.log("script.js loaded");

// Helpers
const LS = localStorage;
const $ = id => document.getElementById(id);

// Storage
const getLogs = () => JSON.parse(LS.getItem("tripLogs") || "[]");
const saveLogs = logs => LS.setItem("tripLogs", JSON.stringify(logs));
const getPC = () => JSON.parse(LS.getItem("postcodes") || "[]");
const savePC = pc => {
  const list = getPC();
  if (!list.includes(pc)) {
    list.push(pc);
    LS.setItem("postcodes", JSON.stringify(list));
  }
};

// Date helpers
const UK = d => {
  const [y, m, d2] = d.split("-");
  return `${d2}-${m}-${y}`;
};
const weekOf = d => {
  const dt = new Date(d);
  const day = dt.getDay();
  const diff = dt.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(dt.setDate(diff));
  return UK(mon.toISOString().slice(0, 10));
};

// API helpers
async function geo(pc) {
  const key = "5b3ce3597851110001cf6248701ed15b48864d0e93d5a18cc93f3101";
  const clean = pc.replace(/\s+/g, "");
  const url = `https://api.openrouteservice.org/geocode/search?api_key=${key}&text=${clean}`;
  const r = await fetch(url);
  const j = await r.json();
  if (j.features?.length) return j.features[0].geometry.coordinates;
  throw new Error("Invalid postcode: " + pc);
}

async function dist(a, b) {
  const A = await geo(a);
  const B = await geo(b);
  const key = "5b3ce3597851110001cf6248701ed15b48864d0e93d5a18cc93f3101";
  const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${key}&start=${A[0]},${A[1]}&end=${B[0]},${B[1]}`;
  const r = await fetch(url);
  const j = await r.json();
  const km = j.features[0].properties.segments[0].distance / 1000;
  return (km * 0.621371).toFixed(2);
}

// Saved postcode UI
function showPC(field) {
  const list = $(`${field}-saved-list`);
  list.innerHTML = "";
  getPC().forEach(pc => {
    const li = document.createElement("li");
    li.textContent = pc;
    li.onclick = () => {
      $(field).value = pc;
      list.innerHTML = "";
    };
    list.appendChild(li);
  });
}

// Delete popup
let pending = null;
function showDel(id) {
  pending = id;
  $("delete-popup").classList.remove("hidden");
}
function hideDel() {
  pending = null;
  $("delete-popup").classList.add("hidden");
}

// Log trip
async function logTrip() {
  const date = $("date").value;
  const start = $("start").value;
  const end = $("destination").value;
  const period = $("period").value;
  const name = $("logger-name").value;
  const out = $("output");

  if (!date || !start || !end || !name) {
    out.textContent = "Please fill in all fields.";
    return;
  }

  try {
    const miles = await dist(start, end);
    savePC(start);
    savePC(end);

    const logs = getLogs();
    logs.push({
      id: crypto.randomUUID(),
      date: UK(date),
      week: weekOf(date),
      period,
      start,
      end,
      distance: parseFloat(miles),
      name
    });

    saveLogs(logs);
    render();
    out.textContent = "Trip added!";
    $("start").value = "";
    $("destination").value = "";
  } catch (e) {
    out.textContent = e.message;
  }
}

// Render logs
function render() {
  const logs = getLogs();
  const table = $("trip-log");
  table.innerHTML = "";

  const weeks = {};
  logs.forEach(l => {
    if (!weeks[l.week]) weeks[l.week] = [];
    weeks[l.week].push(l);
  });

  Object.keys(weeks)
    .sort((a, b) => {
      const A = a.split("-").reverse().join("-");
      const B = b.split("-").reverse().join("-");
      return new Date(A) - new Date(B);
    })
    .forEach((week, i) => {
      if (i > 0) {
        const gap = document.createElement("tr");
        gap.classList.add("gap-row");
        gap.innerHTML = "<td colspan='6'></td>";
        table.appendChild(gap);
      }

      const wk = weeks[week];
      const total = wk.reduce((s, l) => s + l.distance, 0);

      const head = document.createElement("tr");
      head.innerHTML = `<td colspan="6"><strong>Week Commencing: ${week} — Total Miles: ${total.toFixed(2)}</strong></td>`;
      table.appendChild(head);

      wk.forEach(l => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${l.date}</td>
          <td>${l.period}</td>
          <td>${l.start}</td>
          <td>${l.end}</td>
          <td>${l.distance.toFixed(2)} miles</td>
          <td>${l.name}</td>
        `;

        row.addEventListener("contextmenu", e => {
          e.preventDefault();
          showDel(l.id);
        });

        let timer;
        row.addEventListener("touchstart", () => {
          timer = setTimeout(() => showDel(l.id), 700);
        });
        row.addEventListener("touchend", () => clearTimeout(timer));
        row.addEventListener("touchmove", () => clearTimeout(timer));

        table.appendChild(row);
      });
    });
}

// Clear all
function clearAll() {
  saveLogs([]);
  render();
  $("output").textContent = "All entries cleared.";
}

// ✅ Export CSV with weekly totals
function exportCSV() {
  const logs = getLogs();
  if (!logs.length) return;

  const weeks = {};
  logs.forEach(l => {
    if (!weeks[l.week]) weeks[l.week] = [];
    weeks[l.week].push(l);
  });

  let csv = "Week Commencing,Date,Period,Start,Destination,Distance,Name\n";

  Object.keys(weeks)
    .sort((a, b) => {
      const A = a.split("-").reverse().join("-");
      const B = b.split("-").reverse().join("-");
      return new Date(A) - new Date(B);
    })
    .forEach(week => {
      const wk = weeks[week];
      const total = wk.reduce((sum, l) => sum + l.distance, 0);

      wk.forEach(l => {
        csv += `${week},${l.date},${l.period},${l.start},${l.end},${l.distance.toFixed(2)},${l.name}\n`;
      });

      csv += `Total Miles for ${week},,,,,${total.toFixed(2)}\n\n`;
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
  $("log-trip-btn").onclick = logTrip;
  $("clear-all-btn").onclick = clearAll;
  $("export-csv-btn").onclick = exportCSV;

  $("start-show-btn").onclick = () => showPC("start");
  $("destination-show-btn").onclick = () => showPC("destination");

  $("delete-yes").onclick = () => {
    saveLogs(getLogs().filter(l => l.id !== pending));
    hideDel();
    render();
  };
  $("delete-no").onclick = hideDel;

  render();
});
