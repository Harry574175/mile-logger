let dailyMiles = { AM: 0, PM: 0 }; // Track AM and PM miles for the day
let monthlyTotal = 0; // Track total miles for the month

async function geocodePostcode(postcode) {
  const apiKey = '5b3ce3597851110001cf6248701ed15b48864d0e93d5a18cc93f3101';

  // Standardize the postcode: remove spaces and convert to uppercase
  const standardizedPostcode = postcode.replace(/\s+/g, '').toUpperCase();
  const url = `https://api.openrouteservice.org/geocode/search?api_key=${apiKey}&text=${encodeURIComponent(standardizedPostcode)}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    // Get the coordinates (longitude and latitude) of the postcode
    return data.features[0].geometry.coordinates; // [longitude, latitude]
  } catch (error) {
    console.error("Error geocoding postcode:", error);
    throw new Error("Could not find location for the postcode.");
  }
}

async function calculateDistance(startPostcode, destinationPostcode) {
  try {
    // Geocode the start and destination postcodes
    const startCoords = await geocodePostcode(startPostcode);
    const destinationCoords = await geocodePostcode(destinationPostcode);

    const apiKey = '5b3ce3597851110001cf6248701ed15b48864d0e93d5a18cc93f3101';
    const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${apiKey}&start=${startCoords[0]},${startCoords[1]}&end=${destinationCoords[0]},${destinationCoords[1]}`;

    const response = await fetch(url);
    const data = await response.json();

    // Get the distance in meters and convert to kilometers
    const distanceInKm = data.features[0].properties.segments[0].distance / 1000;
    // Convert kilometers to miles
    const distanceInMiles = distanceInKm * 0.621371;
    return distanceInMiles.toFixed(2); // Return the distance in miles
  } catch (error) {
    console.error("Error calculating distance:", error);
    throw new Error("Could not calculate distance.");
  }
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

    // Add the trip details to the log table
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

    // Update totals
    dailyMiles[period] += parseFloat(distance);
    monthlyTotal += parseFloat(distance);
    updateTotals();

    // Clear the form inputs
    document.getElementById('start').value = '';
    document.getElementById('destination').value = '';
    document.getElementById('output').textContent = "Trip added successfully!";
  } catch (error) {
    document.getElementById('output').textContent = "An error occurred. Please try again.";
  }
}

function updateTotals() {
  // Update the daily totals
  document.getElementById('daily-am').textContent = `AM Total: ${dailyMiles.AM.toFixed(2)} miles`;
  document.getElementById('daily-pm').textContent = `PM Total: ${dailyMiles.PM.toFixed(2)} miles`;
  document.getElementById('daily-total').textContent = `Daily Total: ${(dailyMiles.AM + dailyMiles.PM).toFixed(2)} miles`;

  // Update the monthly total
  document.getElementById('monthly-total').textContent = `Monthly Total: ${monthlyTotal.toFixed(2)} miles`;
}
