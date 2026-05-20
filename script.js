console.log('🚀 script.js loaded successfully');

// Persistent name
function getLoggerName() {
  return localStorage.getItem('loggerName') || '';
}
function setLoggerName(name) {
  localStorage.setItem('loggerName', name);
}

// Date formatting
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

// Geocoding and distance
async function geocodePostcode(postcode) {
  const apiKey = '5b3ce3597851110001cf6248701ed15b48864d0e93d5a18cc93f3101';
  const cleaned = postcode.replace(/\s+/g, '').toUpperCase();
  const url = `https://api.openrouteservice.org/geocode/search?api_key=${apiKey}&text=${encodeURIComponent(cleaned)}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.features && data.features.length > 0) {
    return data.features[0].geometry.coordinates;
  }
  throw new Error(`Could not find location for postcode: ${postcode}`);
}

async function calculateDistance(start, end) {
  const startCoords = await geocodePostcode(start);
  const endCoords = await geocodePostcode(end);
  const apiKey = '5b3ce3597851110001cf6248701ed15b48864d0e93d5a18cc93f3101';
  const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${apiKey}&start=${startCoords[0]},${startCoords[1]}&end=${endCoords[0]},${endCoords[1]}&priority=shortest`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.features && data.features.length > 0) {
    const km = data.features[0].properties.segments[0].distance / 1000;
    return (km * 0.621371).toFixed(2);
  }
  throw new Error('Could not calculate distance.');
}

// Postcode save/load
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
  getPostcodes().forEach(pc => {
    const li = document.createElement('li');
    li.textContent = pc;
    li.onclick = () =>
