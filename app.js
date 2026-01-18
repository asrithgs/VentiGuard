// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyA-oB_ELL9chUnCqXOrxVamor8Zg4dHL98",
  authDomain: "esp32-iot-001.firebaseapp.com",
  databaseURL: "https://esp32-iot-001-default-rtdb.firebaseio.com",
  projectId: "esp32-iot-001",
  storageBucket: "esp32-iot-001.firebasestorage.app",
  messagingSenderId: "995851199850",
  appId: "1:995851199850:web:3e79477398eb3c5a873113"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();

// Global variables
let currentUser = null;
let currentNode = null;
let riskChart = null;
let sensorChart = null;
let alertHistory = [];
let sensorDataHistory = [];
let map = null;
let userMarker = null;
let nodeMarkers = {};
let availableLocations = {};
let isMapInitialized = false;

// DOM Elements
const loginPage = document.getElementById('login-page');
const dashboardPage = document.getElementById('dashboard-page');
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const googleLoginBtn = document.getElementById('google-login-btn');
const logoutBtn = document.getElementById('logout-btn');
const showSignupLink = document.getElementById('show-signup');
const showLoginLink = document.getElementById('show-login');
const nodeSelect = document.getElementById('node-select');
const locateMeBtn = document.getElementById('locate-me');
const nodeList = document.getElementById('node-list');

// Check authentication state
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        showPage(dashboardPage);
        initializeDashboard();
    } else {
        showPage(loginPage);
    }
});

// Login Functions
loginBtn.addEventListener('click', () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorElement = document.getElementById('login-error');
    
    if (!email || !password) {
        showError(errorElement, 'Please fill in all fields');
        return;
    }
    
    auth.signInWithEmailAndPassword(email, password)
        .catch((error) => {
            showError(errorElement, error.message);
        });
});

signupBtn.addEventListener('click', () => {
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const errorElement = document.getElementById('signup-error');
    
    if (!email || !password || !confirmPassword) {
        showError(errorElement, 'Please fill in all fields');
        return;
    }
    
    if (password !== confirmPassword) {
        showError(errorElement, 'Passwords do not match');
        return;
    }
    
    if (password.length < 6) {
        showError(errorElement, 'Password must be at least 6 characters');
        return;
    }
    
    auth.createUserWithEmailAndPassword(email, password)
        .then(() => {
            document.querySelector('.signup-form').style.display = 'none';
            document.querySelector('.login-form:not(.signup-form)').style.display = 'block';
        })
        .catch((error) => {
            showError(errorElement, error.message);
        });
});

googleLoginBtn.addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    
    auth.signInWithPopup(provider)
        .then((result) => {
            console.log("Google Sign-In Success:", result.user.email);
        })
        .catch((error) => {
            console.error("Google Sign-In Error:", error);
            if (error.code === 'auth/unauthorized-domain') {
                alert("Please add 'localhost' to authorized domains in Firebase Console");
            } else if (error.code === 'auth/operation-not-allowed') {
                alert("Google Sign-In is not enabled in Firebase Console");
            } else {
                alert("Google Sign-In failed: " + error.message);
            }
        });
});

// Form switching
showSignupLink.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelector('.login-form:not(.signup-form)').style.display = 'none';
    document.querySelector('.signup-form').style.display = 'block';
});

showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelector('.signup-form').style.display = 'none';
    document.querySelector('.login-form:not(.signup-form)').style.display = 'block';
});

logoutBtn.addEventListener('click', () => {
    auth.signOut();
});

// Helper functions
function showPage(page) {
    loginPage.classList.remove('active');
    dashboardPage.classList.remove('active');
    page.classList.add('active');
}

function showError(element, message) {
    element.textContent = message;
    element.style.display = 'block';
    setTimeout(() => {
        element.style.display = 'none';
    }, 5000);
}

// Dashboard Functions
function initializeDashboard() {
    // Initialize time display
    updateTime();
    setInterval(updateTime, 1000);
    
    // Initialize event listeners
    nodeSelect.addEventListener('change', (e) => {
        currentNode = e.target.value;
        if (currentNode) {
            loadNodeData();
        }
    });
    
    document.getElementById('clear-history').addEventListener('click', clearHistory);
    
    // Map event listener
    locateMeBtn.addEventListener('click', locateUser);
    
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
    
    // Initialize charts
    initializeCharts();
    
    // Initialize map FIRST
    initMap();
    
    // Then load available locations
    loadAvailableLocations();
}

function updateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    document.getElementById('current-time').textContent = timeString;
}

// Parse location key to coordinates
function parseLocationKey(locationKey) {
    // Check if it's in the format: lat_10_0647_lon_76_6294
    if (locationKey.startsWith('lat_') && locationKey.includes('_lon_')) {
        const latPart = locationKey.split('_lon_')[0].replace('lat_', '');
        const lonPart = locationKey.split('_lon_')[1];
        
        // Replace underscores with dots for decimal
        const lat = parseFloat(latPart.replace(/_/g, '.'));
        const lon = parseFloat(lonPart.replace(/_/g, '.'));
        
        return { lat, lng: lon };
    }
    
    return null;
}

// Format location key for display
function formatLocationKey(locationKey) {
    const coords = parseLocationKey(locationKey);
    if (coords) {
        return `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
    }
    return locationKey;
}

// Get friendly location name
function getLocationName(locationKey) {
    const coords = parseLocationKey(locationKey);
    if (!coords) return locationKey;
    
    // Common locations mapping (you can customize this)
    const locations = {
        '10.0647,76.6294': 'Main Campus',
        '10.0650,76.6300': 'Library Building',
        '10.0630,76.6280': 'Student Canteen',
        '10.0660,76.6310': 'Auditorium',
        '10.0620,76.6270': 'Sports Complex'
    };
    
    const coordString = `${coords.lat.toFixed(4)},${coords.lng.toFixed(4)}`;
    return locations[coordString] || `Location (${coordString})`;
}

// Load available locations from database
function loadAvailableLocations() {
    console.log("Loading available locations from Firebase...");
    
    const locationsRef = database.ref('ventiguard');
    
    locationsRef.once('value').then((snapshot) => {
        console.log("Firebase data received:", snapshot.exists());
        
        if (!snapshot.exists()) {
            console.log("No data found in 'ventiguard' path");
            showNotification("No monitoring locations found in database", "warn");
            return;
        }
        
        availableLocations = {};
        let locationCount = 0;
        let nodeCount = 0;
        
        snapshot.forEach((locationSnapshot) => {
            const locationKey = locationSnapshot.key;
            console.log("Found location:", locationKey);
            
            const coordinates = parseLocationKey(locationKey);
            
            if (coordinates) {
                // Get nodes at this location
                const nodes = {};
                locationSnapshot.forEach((nodeSnapshot) => {
                    const nodeName = nodeSnapshot.key;
                    const nodeData = nodeSnapshot.val();
                    
                    nodes[nodeName] = {
                        ...nodeData,
                        coordinates: coordinates,
                        locationKey: locationKey
                    };
                    nodeCount++;
                });
                
                availableLocations[locationKey] = {
                    coordinates: coordinates,
                    nodes: nodes,
                    locationName: getLocationName(locationKey)
                };
                
                locationCount++;
                
                // Add marker for this location
                addLocationMarker(locationKey, coordinates, nodes);
            } else {
                console.log("Skipping invalid location key format:", locationKey);
            }
        });
        
        console.log(`Loaded ${locationCount} locations with ${nodeCount} total nodes`);
        
        if (locationCount > 0) {
            // Update node selector dropdown
            updateNodeSelector();
            
            // Set first node as default if none selected
            if (!currentNode) {
                const firstLocation = Object.keys(availableLocations)[0];
                const firstNode = Object.keys(availableLocations[firstLocation].nodes)[0];
                currentNode = `${firstLocation}/${firstNode}`;
                document.getElementById('node-select').value = currentNode;
                loadNodeData();
            }
            
            // Fit map bounds to show all markers
            fitMapToMarkers();
            
            showNotification(`Loaded ${locationCount} monitoring locations`, "success");
        } else {
            showNotification("No valid locations found in database", "warn");
        }
        
    }).catch((error) => {
        console.error("Error loading locations:", error);
        showNotification("Failed to load locations from database", "error");
    });
}

// Fit map bounds to show all markers
function fitMapToMarkers() {
    if (Object.keys(nodeMarkers).length === 0) return;
    
    const bounds = L.latLngBounds();
    
    Object.values(nodeMarkers).forEach(markerData => {
        bounds.extend([markerData.coordinates.lat, markerData.coordinates.lng]);
    });
    
    // Add padding to bounds
    map.fitBounds(bounds, { padding: [50, 50] });
}

// Add marker for a location
function addLocationMarker(locationKey, coordinates, nodes) {
    // Determine overall status for this location
    let overallStatus = 'safe';
    
    // Check each node's status
    Object.values(nodes).forEach(node => {
        if (node.risk_level === 'DANGER') overallStatus = 'danger';
        else if (node.risk_level === 'WARN' && overallStatus !== 'danger') overallStatus = 'warn';
    });
    
    // Create custom marker
    const markerHtml = `
        <div class="custom-marker marker-${overallStatus}">
            <i class="fas fa-map-marker-alt"></i>
        </div>
    `;
    
    const icon = L.divIcon({
        html: markerHtml,
        className: 'custom-div-icon',
        iconSize: [40, 40],
        iconAnchor: [20, 40],
        popupAnchor: [0, -40]
    });
    
    // Add marker to map
    const marker = L.marker([coordinates.lat, coordinates.lng], { icon: icon })
        .addTo(map);
    
    const locationName = getLocationName(locationKey);
    
    // Create popup content
    let popupContent = `<h3>${locationName}</h3>`;
    popupContent += `<div class="popup-details">`;
    popupContent += `<div class="popup-detail"><span class="label">Coordinates:</span> <span class="value">${formatLocationKey(locationKey)}</span></div>`;
    popupContent += `<div class="popup-detail"><span class="label">Nodes:</span> <span class="value">${Object.keys(nodes).length}</span></div>`;
    
    // Add node list
    Object.keys(nodes).forEach((nodeName, index) => {
        if (index < 3) { // Show only first 3 nodes in popup
            const nodeStatus = nodes[nodeName].risk_level || 'UNKNOWN';
            popupContent += `
                <div class="popup-detail">
                    <span class="label">${nodeName}:</span>
                    <span class="value ${nodeStatus.toLowerCase()}">${nodeStatus}</span>
                </div>
            `;
        }
    });
    
    if (Object.keys(nodes).length > 3) {
        popupContent += `<div class="popup-detail"><span class="label">...</span> <span class="value">+${Object.keys(nodes).length - 3} more</span></div>`;
    }
    
    popupContent += `</div>`;
    popupContent += `<button class="btn-primary btn-sm" onclick="window.selectLocation('${locationKey}')" style="margin-top: 10px; width: 100%;">View All Nodes</button>`;
    
    marker.bindPopup(popupContent);
    
    // Add click event to marker
    marker.on('click', function() {
        selectLocation(locationKey);
    });
    
    // Store marker reference
    nodeMarkers[locationKey] = {
        marker: marker,
        coordinates: coordinates,
        nodes: nodes,
        status: overallStatus,
        locationName: locationName
    };
    
    console.log(`Marker added for ${locationKey} at ${coordinates.lat}, ${coordinates.lng}`);
}

// Initialize Leaflet Map
function initMap() {
    console.log("Initializing map...");
    
    // Default center (Kochi coordinates)
    const defaultCenter = [10.0647, 76.6294];
    
    // Initialize map
    map = L.map('map').setView(defaultCenter, 15);
    
    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
    
    // Add click event to map
    map.on('click', function(e) {
        showNodesAtLocation(e.latlng);
    });
    
    isMapInitialized = true;
    console.log("Map initialized successfully");
    
    // Try to get user's location
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                updateUserMarker(userLocation);
            },
            (error) => {
                console.log("Geolocation error:", error);
            }
        );
    }
}

// Update user marker
function updateUserMarker(coords) {
    if (userMarker) {
        map.removeLayer(userMarker);
    }
    
    const markerHtml = `
        <div class="custom-marker marker-user">
            <i class="fas fa-user"></i>
        </div>
    `;
    
    const icon = L.divIcon({
        html: markerHtml,
        className: 'custom-div-icon',
        iconSize: [40, 40],
        iconAnchor: [20, 40],
        popupAnchor: [0, -40]
    });
    
    userMarker = L.marker([coords.lat, coords.lng], { icon: icon })
        .addTo(map)
        .bindPopup('<b>Your Current Location</b>');
}

// Locate user function
function locateUser() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const coords = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                updateUserMarker(coords);
                map.setView([coords.lat, coords.lng], 16);
                showNotification("Centered on your location", "success");
            },
            (error) => {
                alert('Unable to get your location. Please enable location services.');
            },
            { enableHighAccuracy: true }
        );
    } else {
        alert('Geolocation is not supported by your browser.');
    }
}

// Show nodes at clicked location
function showNodesAtLocation(latlng) {
    const clickedCoords = { lat: latlng.lat, lng: latlng.lng };
    
    // Find nearest location from available locations
    let nearestLocation = null;
    let minDistance = Infinity;
    
    Object.entries(availableLocations).forEach(([locationKey, locationData]) => {
        const distance = calculateDistance(
            clickedCoords.lat, clickedCoords.lng,
            locationData.coordinates.lat, locationData.coordinates.lng
        );
        
        if (distance < minDistance && distance < 0.5) { // Within 500 meters
            minDistance = distance;
            nearestLocation = { 
                locationKey, 
                ...locationData, 
                distance 
            };
        }
    });
    
    if (nearestLocation) {
        displayNodesList(nearestLocation);
        highlightLocationMarker(nearestLocation.locationKey);
    } else {
        nodeList.innerHTML = `
            <div class="empty-nodes">
                <i class="fas fa-map-marker-slash"></i>
                <p>No monitoring nodes at this location</p>
                <small>Available nodes are marked with colored pins on the map</small>
            </div>
        `;
    }
}

// Display nodes list in sidebar
function displayNodesList(locationData) {
    const { locationKey, coordinates, nodes, distance, locationName } = locationData;
    
    let html = '';
    
    // Location header
    html += `
        <div class="location-header">
            <h5><i class="fas fa-map-pin"></i> ${locationName}</h5>
            <div class="location-details">
                <span class="node-coordinates">${formatLocationKey(locationKey)}</span>
                ${distance ? `<span class="node-distance">${(distance * 1000).toFixed(0)}m away</span>` : ''}
            </div>
        </div>
    `;
    
    // Add each node
    Object.entries(nodes).forEach(([nodeName, nodeData]) => {
        const status = nodeData.risk_level ? nodeData.risk_level.toLowerCase() : 'unknown';
        const temperature = nodeData.temperature ? nodeData.temperature.toFixed(1) : '--';
        const humidity = nodeData.humidity || '--';
        
        html += `
            <div class="node-item ${status}" onclick="window.selectNode('${locationKey}', '${nodeName}')">
                <div class="node-header">
                    <div class="node-name">
                        <i class="fas fa-microchip"></i>
                        ${nodeName}
                    </div>
                    <div class="node-temp">${temperature}°C</div>
                </div>
                <div class="node-details">
                    <span><i class="fas fa-tint"></i> Humidity: ${humidity}%</span>
                    <span><i class="fas fa-wind"></i> Air: ${nodeData.air_quality || '--'} PPM</span>
                    <span><i class="fas fa-users"></i> People: ${nodeData.ir_count || '0'}</span>
                </div>
                <div class="node-status ${status}">
                    ${nodeData.risk_level || 'NO DATA'}
                </div>
            </div>
        `;
    });
    
    nodeList.innerHTML = html;
}

// Highlight a location marker
function highlightLocationMarker(locationKey) {
    Object.values(nodeMarkers).forEach(markerData => {
        markerData.marker.setZIndexOffset(0);
    });
    
    if (nodeMarkers[locationKey]) {
        const marker = nodeMarkers[locationKey].marker;
        const coords = nodeMarkers[locationKey].coordinates;
        
        marker.setZIndexOffset(1000);
        marker.openPopup();
        map.setView([coords.lat, coords.lng], 17);
    }
}

// Select location from popup or click
function selectLocation(locationKey) {
    if (availableLocations[locationKey]) {
        const { coordinates, nodes, locationName } = availableLocations[locationKey];
        displayNodesList({
            locationKey,
            coordinates,
            nodes,
            locationName
        });
        highlightLocationMarker(locationKey);
    }
}

// Select a node from the list
function selectNode(locationKey, nodeName) {
    if (availableLocations[locationKey] && availableLocations[locationKey].nodes[nodeName]) {
        currentNode = `${locationKey}/${nodeName}`;
        
        // Update the node selector dropdown
        updateNodeInSelector(locationKey, nodeName);
        
        // Load node data
        loadNodeData();
        
        // Show success message
        const locationName = getLocationName(locationKey);
        showNotification(`Now monitoring ${nodeName} at ${locationName}`, "success");
    }
}

// Make functions available globally for popup buttons
window.selectLocation = selectLocation;
window.selectNode = selectNode;

// Update node in selector
function updateNodeInSelector(locationKey, nodeName) {
    const select = document.getElementById('node-select');
    select.value = `${locationKey}/${nodeName}`;
}

// Update node selector dropdown with available locations
function updateNodeSelector() {
    const select = document.getElementById('node-select');
    
    // Clear existing options except the placeholder
    while (select.options.length > 1) {
        select.remove(1);
    }
    
    // Add location-based options grouped by location
    Object.entries(availableLocations).forEach(([locationKey, locationData]) => {
        const locationName = locationData.locationName;
        
        // Add optgroup for each location
        const optgroup = document.createElement('optgroup');
        optgroup.label = `${locationName} (${formatLocationKey(locationKey)})`;
        
        Object.keys(locationData.nodes).forEach(nodeName => {
            const option = document.createElement('option');
            option.value = `${locationKey}/${nodeName}`;
            option.textContent = `${nodeName}`;
            optgroup.appendChild(option);
        });
        
        select.appendChild(optgroup);
    });
    
    console.log(`Node selector updated with ${Object.keys(availableLocations).length} locations`);
}

// Calculate distance between two coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Load node data
function loadNodeData() {
    if (!currentNode) {
        console.log("No node selected");
        return;
    }
    
    console.log("Loading data for node:", currentNode);
    
    const nodeRef = database.ref(`ventiguard/${currentNode}`);
    
    nodeRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            console.log("Node data received:", data);
            updateDashboardUI(data);
            updateHistoryTable(data);
            updateCharts(data);
            checkAlerts(data);
            
            // Update map marker if needed
            const [locationKey, nodeName] = currentNode.split('/');
            if (nodeMarkers[locationKey]) {
                updateNodeMarker(locationKey, nodeName, data);
            }
        } else {
            console.log("No data found for node:", currentNode);
            showNotification(`No data available for selected node`, "warn");
        }
    }, (error) => {
        console.error("Error loading node data:", error);
        showNotification(`Failed to load node data: ${error.message}`, "error");
    });
}

// Update dashboard UI
function updateDashboardUI(data) {
    // Update sensor values
    document.getElementById('temperature-value').textContent = data.temperature?.toFixed(1) || '--';
    document.getElementById('humidity-value').textContent = data.humidity?.toFixed(0) || '--';
    document.getElementById('air-quality-value').textContent = data.air_quality || '--';
    document.getElementById('crowd-value').textContent = data.ir_count || '0';
    
    // Update risk assessment
    const riskScore = data.risk_score || 0;
    const riskLevel = data.risk_level || 'SAFE';
    const actionMsg = data.action || 'NORMAL';
    
    document.getElementById('risk-score-value').textContent = riskScore.toFixed(0);
    document.getElementById('action-message').textContent = actionMsg;
    
    // Update status indicators
    updateStatusIndicators(data, riskLevel);
    
    // Update gauge
    updateRiskGauge(riskScore);
    
    // Update last update time
    document.getElementById('last-update-time').textContent = new Date().toLocaleTimeString();
}

// Update status indicators
function updateStatusIndicators(data, riskLevel) {
    const overallIndicator = document.getElementById('overall-status-indicator');
    const overallText = document.getElementById('overall-status-text');
    const riskBadge = document.getElementById('risk-badge');
    
    overallIndicator.className = `status-indicator ${riskLevel.toLowerCase()}`;
    overallText.textContent = riskLevel;
    riskBadge.className = `risk-badge ${riskLevel.toLowerCase()}`;
    riskBadge.textContent = riskLevel;
    
    updateSensorStatus('temp', data.temperature, 25, 35);
    updateSensorStatus('hum', data.humidity, 30, 60);
    updateSensorStatus('air', data.air_quality, 1000, 2000);
    updateSensorStatus('crowd', data.ir_count, 0, 5);
}

function updateSensorStatus(type, value, min, max) {
    const indicator = document.getElementById(`${type}-status-indicator`);
    const text = document.getElementById(`${type}-status-text`);
    
    if (!value || value === '--') {
        indicator.className = 'status-indicator';
        text.textContent = 'No Data';
        return;
    }
    
    if (value < min || value > max) {
        indicator.className = 'status-indicator danger';
        text.textContent = 'Critical';
    } else if (value < min * 1.1 || value > max * 0.9) {
        indicator.className = 'status-indicator warn';
        text.textContent = 'Warning';
    } else {
        indicator.className = 'status-indicator safe';
        text.textContent = 'Normal';
    }
}

function updateRiskGauge(score) {
    const needle = document.getElementById('gauge-needle');
    const angle = Math.min(score * 1.8, 180);
    needle.style.transform = `rotate(${angle}deg)`;
}

// Update node marker on map
function updateNodeMarker(locationKey, nodeName, data) {
    if (nodeMarkers[locationKey]) {
        // Update node data
        nodeMarkers[locationKey].nodes[nodeName] = data;
        
        // Recalculate overall status
        let overallStatus = 'safe';
        Object.values(nodeMarkers[locationKey].nodes).forEach(node => {
            if (node.risk_level === 'DANGER') overallStatus = 'danger';
            else if (node.risk_level === 'WARN' && overallStatus !== 'danger') overallStatus = 'warn';
        });
        
        nodeMarkers[locationKey].status = overallStatus;
        
        // Update marker color
        const markerHtml = `
            <div class="custom-marker marker-${overallStatus}">
                <i class="fas fa-map-marker-alt"></i>
            </div>
        `;
        
        const icon = L.divIcon({
            html: markerHtml,
            className: 'custom-div-icon',
            iconSize: [40, 40],
            iconAnchor: [20, 40],
            popupAnchor: [0, -40]
        });
        
        nodeMarkers[locationKey].marker.setIcon(icon);
        
        // Update popup content
        const locationName = nodeMarkers[locationKey].locationName;
        const nodeCount = Object.keys(nodeMarkers[locationKey].nodes).length;
        
        let popupContent = `<h3>${locationName}</h3>`;
        popupContent += `<div class="popup-details">`;
        popupContent += `<div class="popup-detail"><span class="label">Coordinates:</span> <span class="value">${formatLocationKey(locationKey)}</span></div>`;
        popupContent += `<div class="popup-detail"><span class="label">Nodes:</span> <span class="value">${nodeCount}</span></div>`;
        
        Object.keys(nodeMarkers[locationKey].nodes).forEach((node, index) => {
            if (index < 3) {
                const nodeStatus = nodeMarkers[locationKey].nodes[node].risk_level || 'UNKNOWN';
                popupContent += `
                    <div class="popup-detail">
                        <span class="label">${node}:</span>
                        <span class="value ${nodeStatus.toLowerCase()}">${nodeStatus}</span>
                    </div>
                `;
            }
        });
        
        if (nodeCount > 3) {
            popupContent += `<div class="popup-detail"><span class="label">...</span> <span class="value">+${nodeCount - 3} more</span></div>`;
        }
        
        popupContent += `</div>`;
        popupContent += `<button class="btn-primary btn-sm" onclick="window.selectLocation('${locationKey}')" style="margin-top: 10px; width: 100%;">View All Nodes</button>`;
        
        nodeMarkers[locationKey].marker.setPopupContent(popupContent);
    }
}

// Update history table
function updateHistoryTable(data) {
    const tableBody = document.getElementById('history-table-body');
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const riskLevel = data.risk_level || 'SAFE';
    const [locationKey, nodeName] = currentNode.split('/');
    const locationName = getLocationName(locationKey);
    
    const newRow = document.createElement('tr');
    newRow.innerHTML = `
        <td>${timeString}</td>
        <td>${locationName}</td>
        <td>${nodeName}</td>
        <td>${data.temperature?.toFixed(1) || '--'}</td>
        <td>${data.humidity?.toFixed(0) || '--'}</td>
        <td>${data.air_quality || '--'}</td>
        <td>${data.ir_count || '0'}</td>
        <td>${data.risk_score?.toFixed(0) || '--'}</td>
        <td><span class="risk-badge ${riskLevel.toLowerCase()}">${riskLevel}</span></td>
    `;
    
    sensorDataHistory.push({
        time: timeString,
        temperature: data.temperature,
        humidity: data.humidity,
        airQuality: data.air_quality,
        riskScore: data.risk_score
    });
    
    if (sensorDataHistory.length > 20) {
        sensorDataHistory.shift();
    }
    
    if (tableBody.rows.length >= 10) {
        tableBody.deleteRow(-1);
    }
    tableBody.insertBefore(newRow, tableBody.firstChild);
}

// Initialize charts
function initializeCharts() {
    const ctxRisk = document.getElementById('risk-chart');
    const ctxSensor = document.getElementById('sensor-chart');
    
    riskChart = new Chart(ctxRisk, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Risk Score',
                data: [],
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.4,
                fill: true,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    min: 0,
                    max: 100,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        callback: function(value) {
                            if (value < 40) return 'Safe';
                            if (value < 70) return 'Warn';
                            return 'Danger';
                        }
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                }
            }
        }
    });
    
    sensorChart = new Chart(ctxSensor, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Temperature (°C)',
                    data: [],
                    borderColor: '#ff6b6b',
                    backgroundColor: 'rgba(255, 107, 107, 0.1)',
                    tension: 0.4,
                    borderWidth: 2
                },
                {
                    label: 'Humidity (%)',
                    data: [],
                    borderColor: '#4ecdc4',
                    backgroundColor: 'rgba(78, 205, 196, 0.1)',
                    tension: 0.4,
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        padding: 20,
                        usePointStyle: true
                    }
                }
            },
            scales: {
                y: {
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                }
            }
        }
    });
}

// Update charts
function updateCharts(data) {
    const riskLabels = sensorDataHistory.map(item => item.time);
    const riskData = sensorDataHistory.map(item => item.riskScore);
    
    riskChart.data.labels = riskLabels;
    riskChart.data.datasets[0].data = riskData;
    riskChart.update();
    
    const tempData = sensorDataHistory.map(item => item.temperature);
    const humData = sensorDataHistory.map(item => item.humidity);
    
    sensorChart.data.labels = riskLabels;
    sensorChart.data.datasets[0].data = tempData;
    sensorChart.data.datasets[1].data = humData;
    sensorChart.update();
}

// Check alerts
function checkAlerts(data) {
    const riskLevel = data.risk_level;
    const alertsContainer = document.getElementById('alerts-container');
    const noAlerts = document.getElementById('no-alerts');
    
    if (riskLevel === 'WARN' || riskLevel === 'DANGER') {
        noAlerts.style.display = 'none';
        
        const existingAlert = Array.from(alertsContainer.children).find(child => 
            child.classList.contains('alert-item') && 
            child.dataset.type === riskLevel.toLowerCase()
        );
        
        if (!existingAlert) {
            const alertItem = document.createElement('div');
            alertItem.className = `alert-item ${riskLevel.toLowerCase()}`;
            alertItem.dataset.type = riskLevel.toLowerCase();
            
            const now = new Date();
            const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const [locationKey, nodeName] = currentNode.split('/');
            const locationName = getLocationName(locationKey);
            
            alertItem.innerHTML = `
                <div class="alert-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <div class="alert-content">
                    <h4>${riskLevel} Alert - ${nodeName}</h4>
                    <p>${data.action || 'Immediate action required'}</p>
                    <small>${timeString} • ${locationName}</small>
                </div>
            `;
            
            alertsContainer.insertBefore(alertItem, alertsContainer.firstChild);
            
            // Show browser notification
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('🚨 VentiGuard Alert', {
                    body: `${riskLevel} at ${nodeName}: ${data.action}`,
                    icon: 'https://cdn-icons-png.flaticon.com/512/206/206875.png'
                });
            }
            
            // Keep only last 5 alerts
            const alerts = alertsContainer.querySelectorAll('.alert-item');
            if (alerts.length > 5) {
                alerts[alerts.length - 1].remove();
            }
        }
    } else {
        const alerts = alertsContainer.querySelectorAll('.alert-item');
        if (alerts.length === 0) {
            noAlerts.style.display = 'block';
        }
    }
}

function clearHistory() {
    if (confirm('Are you sure you want to clear the history log?')) {
        const tableBody = document.getElementById('history-table-body');
        tableBody.innerHTML = '';
        sensorDataHistory = [];
        
        if (riskChart) {
            riskChart.data.labels = [];
            riskChart.data.datasets[0].data = [];
            riskChart.update();
        }
        
        if (sensorChart) {
            sensorChart.data.labels = [];
            sensorChart.data.datasets[0].data = [];
            sensorChart.data.datasets[1].data = [];
            sensorChart.update();
        }
        
        showNotification("History log cleared", "info");
    }
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Initialize app
window.addEventListener('load', () => {
    const user = auth.currentUser;
    if (user) {
        showPage(dashboardPage);
        initializeDashboard();
    } else {
        showPage(loginPage);
    }
});

// Debug function to manually trigger location loading
window.debugLoadLocations = function() {
    console.log("Manually triggering location loading...");
    loadAvailableLocations();
};

setTimeout(() => {
    if (isMapInitialized && Object.keys(nodeMarkers).length === 0) {
        console.log("No markers found, checking Firebase manually...");
        debugLoadLocations();
    }
}, 2000);