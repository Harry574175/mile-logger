// Track AM and PM miles for the day
let dailyMiles = { AM: 0, PM: 0 }; 
let monthlyTotal = 0; // Track total miles for the month

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

async function logTrip() {
  const date = document.getElementById('date').value;
  const startPostcode = document.getElementById('start').value;
  const destinationPostcode = document.getElementById('destination').value;
  const period = document.getElementById('period').value; // AM or PM

  if (!date || !startPostcode || !destinationPostcode) {
    document.getElementById('output').textContent = "Please fill in all fields.";
    return;
  }

  try {
    const distance = await calculateDistance(startPostcode, destinationPostcode);

    savePostcode(startPostcode);
    savePostcode(destinationPostcode);

    const tableBody = document.getElementById('trip-log');
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${date}</td>
      <td>${period}</td>
      <td>${startPostcode}</td>
      <td>${destinationPostcode}</td>
      <td>${distance} miles</td>
    `;
    tableBody.appendChild(row);

    if (!dailyMiles[period]) {
      dailyMiles[period] = 0; // Initialize if undefined
    }
    dailyMiles[period] += parseFloat(distance);
    monthlyTotal += parseFloat(distance);
    updateTotals();

    document.getElementById('start').value = '';
    document.getElementById('destination').value = '';
    document.getElementById('output').textContent = "Trip added successfully!";
  } catch (error) {
    document.getElementById('output').textContent = error.message;
  }
}

function updateTotals() {
  document.getElementById('daily-am').textContent = `AM Total: ${dailyMiles.AM.toFixed(2)} miles`;
  document.getElementById('daily-pm').textContent = `PM Total: ${dailyMiles.PM.toFixed(2)} miles`;
  document.getElementById('daily-total').textContent = `Daily Total: ${(dailyMiles.AM + dailyMiles.PM).toFixed(2)} miles`;
  document.getElementById('monthly-total').textContent = `Monthly Total: ${monthlyTotal.toFixed(2)} miles`;

  // Save to localStorage
  localStorage.setItem('dailyMiles', JSON.stringify(dailyMiles));
  localStorage.setItem('monthlyTotal', monthlyTotal);
}

function initializeTotals() {
  const savedDailyMiles = localStorage.getItem('dailyMiles');
  const savedMonthlyTotal = localStorage.getItem('monthlyTotal');

  if (savedDailyMiles) {
    dailyMiles = JSON.parse(savedDailyMiles);
  }
  if (savedMonthlyTotal) {
    monthlyTotal = parseFloat(savedMonthlyTotal);
  }

  updateTotals();
}

// Call this function when the page loads
initializeTotals();

function exportLogsAsCSV() {
  const tableBody = document.getElementById('trip-log');
  const rows = Array.from(tableBody.rows);
  let csvContent = "Date,Period,Start Postcode,Destination Postcode,Distance (miles)\n";

  rows.forEach(row => {
    const cells = Array.from(row.cells).map(cell => cell.textContent);
    csvContent += cells.join(",") + "\n";
  });

  // Add the monthly total at the end of the file
  csvContent += `\nMonthly Total,,${monthlyTotal.toFixed(2)} miles`;

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'trip_logs.csv';
  link.click();
  URL.revokeObjectURL(url);
}

// Attach functions to the global scope
window.logTrip = logTrip;
window.showSavedPostcodes = showSavedPostcodes;
window.initializeTotals = initializeTotals;
