document.addEventListener('DOMContentLoaded', () => {
    if (typeof L === 'undefined') {
        console.error('Error: Leaflet library not loaded.');
        return;
    }

    // --- 1. CONFIGURACIÓN INICIAL ---
    const map = L.map('map').setView([4.7110, -74.0721], 12);
    const API_URL = 'http://127.0.0.1:5000'; 

    const alertTypeSelect = document.getElementById('alertTypeSelect');
    const loadingSpinner = document.getElementById('loading-spinner');
    const activeAlertsList = document.getElementById('active-alerts');
    const noAlertsMessage = document.getElementById('no-alerts-message');
    const alertMessage = document.getElementById('alert-message');
    const errorMessage = document.getElementById('error-message');
    const statusMessage = document.getElementById('status-message');

    // --- 2. CAPAS Y CONTROLES DEL MAPA ---
    const lightLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; CARTO' });
    const darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; CARTO' });
    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: '&copy; Esri' });

    let currentLayer = lightLayer;
    currentLayer.addTo(map);

    document.getElementById('btn-default').addEventListener('click', () => { if (currentLayer !== lightLayer) { map.removeLayer(currentLayer); currentLayer = lightLayer; currentLayer.addTo(map); } });
    document.getElementById('btn-dark').addEventListener('click', () => { if (currentLayer !== darkLayer) { map.removeLayer(currentLayer); currentLayer = darkLayer; currentLayer.addTo(map); } });
    document.getElementById('btn-satellite').addEventListener('click', () => { if (currentLayer !== satelliteLayer) { map.removeLayer(currentLayer); currentLayer = satelliteLayer; currentLayer.addTo(map); } });
    
    // --- CÓDIGO DE UBICACIÓN ---
    function onLocationFound(e) {
        L.circle(e.latlng, {
            color: '#3b82f6',
            fillColor: '#60a5fa',
            fillOpacity: 0.5,
            radius: 500
        }).addTo(map).bindPopup("Estás aquí.").openPopup();
    }

    function onLocationError(e) {
        console.log(e.message);
        alert("No se pudo obtener tu ubicación. Asegúrate de haber dado permiso de geolocalización.");
    }
    
    map.on('locationfound', onLocationFound);
    map.on('locationerror', onLocationError);
    map.locate({setView: true, maxZoom: 16});
    document.getElementById('locate-me-btn').addEventListener('click', () => map.locate({ setView: true, maxZoom: 16 }));
    
    // --- 3. LÓGICA DE ALERTAS EN MODO LOCAL (MODIFICADO) ---
    let markersOnMap = {}; 
    let localAlerts = []; // Almacenamiento local de alertas
    let nextLocalId = 1; // Contador para generar IDs únicos

    // Esta función ahora solo dibuja las alertas almacenadas localmente.
    async function fetchAndDisplayAlerts() {
        activeAlertsList.innerHTML = '';
        
        // Limpiar marcadores existentes antes de redibujar para evitar duplicados
        Object.values(markersOnMap).forEach(marker => map.removeLayer(marker));
        markersOnMap = {};

        if (localAlerts.length === 0) {
            noAlertsMessage.classList.remove('hidden');
        } else {
            noAlertsMessage.classList.add('hidden');
            localAlerts.forEach(alert => {
                addAlertToList(alert);
                addMarkerToMap(alert);
            });
        }
        
        // El código original que intentaba hacer fetch desde el backend ha sido eliminado.
    }

    // MODIFICADO: Ahora crea la alerta y la guarda en el array local, sin fetch al API.
    map.on('click', async (event) => {
        const latLng = event.latlng;
        const alertType = alertTypeSelect.value;
        if (!alertType) {
            statusMessage.textContent = 'Por favor, selecciona un tipo de alerta primero.';
            return;
        }
        statusMessage.textContent = 'Generando descripción (Local)...';
        loadingSpinner.classList.remove('hidden');
        try {
            const description = await getGeminiAlertDescription(alertType);
            
            // Creación del objeto de alerta LOCAL
            const newAlert = {
                id: nextLocalId++, 
                alert_type: alertType,
                description: description,
                latitude: latLng.lat,
                longitude: latLng.lng,
                status: 'active',
                timestamp: new Date().toISOString()
            };
            
            // Guardado local
            localAlerts.push(newAlert);

            statusMessage.textContent = 'Alerta creada localmente.';
            
            showTemporaryMessage(alertMessage);
            fetchAndDisplayAlerts(); // Redibuja el mapa y la lista con la nueva alerta
            
        } catch (error) {
            console.error("Fallo al crear la alerta LOCAL:", error);
            errorMessage.textContent = 'Fallo al simular la alerta local.'; 
            showTemporaryMessage(errorMessage);
        } finally {
            loadingSpinner.classList.add('hidden');
            statusMessage.textContent = 'Haz clic en el mapa para colocar una alerta.';
        }
    });
    
    // MODIFICADO: Ahora resuelve la alerta eliminándola del array local, sin fetch al API.
    activeAlertsList.addEventListener('click', async (event) => {
        if (event.target.classList.contains('remove-alert')) {
            const id = parseInt(event.target.dataset.id);
            
            // Resolver alerta LOCALMENTE: Filtra el array, manteniendo solo las que NO coinciden con el ID
            localAlerts = localAlerts.filter(alert => alert.id !== id);

            // Eliminar marcador del mapa
            if (markersOnMap[id]) {
                map.removeLayer(markersOnMap[id]);
                delete markersOnMap[id];
            }
            
            // Eliminar de la lista
            const listItem = event.target.closest('li');
            if (listItem) listItem.remove();
            
            // Mostrar mensaje 'No hay alertas'
            if (localAlerts.length === 0) {
                 noAlertsMessage.classList.remove('hidden');
            }
            
            console.log(`Alerta ID ${id} resuelta localmente.`);
        }
    });

    // --- 4. FUNCIONES AUXILIARES ---
    function addAlertToList(alert) {
        const listItem = document.createElement('li');
        listItem.className = 'bg-red-600 text-white p-4 rounded-2xl shadow-lg flex justify-between items-center';
        listItem.innerHTML = `
            <div>
                <span class="font-bold text-lg">Alerta: ${alert.alert_type}</span>
                <p class="text-sm opacity-90">${alert.description}</p>
            </div>
            <button class="bg-red-700 hover:bg-red-800 text-white font-bold py-2 px-4 rounded-xl remove-alert" data-id="${alert.id}">
                Resolver
            </button>
        `;
        activeAlertsList.appendChild(listItem);
    }

    function addMarkerToMap(alert) {
        // Usa alert.latitude y alert.longitude que son números gracias a la creación local
        const latNum = parseFloat(alert.latitude);
        const lonNum = parseFloat(alert.longitude);

        if (!isNaN(latNum) && !isNaN(lonNum)) {
            const latText = latNum.toFixed(4);
            const lonText = lonNum.toFixed(4);
            const svgIcon = `
                <svg class="alert-marker-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ef4444" stroke="#fff" stroke-width="1.5">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <circle cx="12" cy="17" r="1" fill="#fff"/>
                </svg>`;
            const alertIcon = L.divIcon({ className: 'custom-div-icon', html: svgIcon, iconSize: [40, 40] });
            const marker = L.marker([latNum, lonNum], { icon: alertIcon }).addTo(map);
            marker.bindPopup(`
                <div style="font-family: 'Inter', sans-serif;">
                    <b>Alerta: ${alert.alert_type}</b>
                    <hr style="margin: 4px 0;">
                    <p>${alert.description || 'Descripción no disponible.'}</p>
                    <small style="color: #6b7280; display: block; margin-top: 8px;">
                        Lat: ${latText}, Lon: ${lonText}
                    </small>
                </div>
            `);
            markersOnMap[alert.id] = marker;
        } else {
            console.error("Coordenadas inválidas para la alerta ID:", alert.id);
        }
    }

    async function getGeminiAlertDescription(alertType) {
        const apiKey = ""; // Pon tu API key si quieres
        // Si no hay API Key, simplemente devolvemos la descripción estática.
        if (!apiKey) return `Se ha detectado una condición de ${alertType}.`;
        
        // Código de la API de Gemini (se mantiene por si decides usarlo en el futuro)
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-1.5-pro-latest:generateContent?key=${apiKey}`;
        const prompt = `Genera una breve pero detallada descripción para una alerta de ${alertType}.`;
        const payload = { contents: [{ parts: [{ text: prompt }] }] };
        try {
            const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const result = await response.json();
            const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
            return text ? text.trim() : `Se ha detectado una emergencia de ${alertType}.`;
        } catch (error) {
            console.error('Error con la API de Gemini:', error);
            return `Se ha detectado una emergencia de ${alertType}. Tome las precauciones necesarias.`;
        }
    }

    const showTemporaryMessage = (element, duration = 3000) => {
        element.classList.remove('hidden');
        setTimeout(() => element.classList.add('hidden'), duration);
    };

    // --- FUNCIÓN MOVIDA AL LUGAR CORRECTO ---
    // Esta función aún depende del API (http://127.0.0.1:5000/api/latest-data)
    async function fetchLatestSensorData() {
        try {
            const response = await fetch(`${API_URL}/api/latest-data`);
            if (!response.ok) {
                console.error("No se pudo obtener el último dato del sensor.");
                return;
            }
            const data = await response.json();
            if (data) {
                document.getElementById('sensor-station').textContent = data.estacion;
                document.getElementById('sensor-temp').textContent = `${parseFloat(data.temperatura).toFixed(2)} °C`;
                document.getElementById('sensor-humidity').textContent = `${parseFloat(data.humedad).toFixed(2)} %`;
                document.getElementById('sensor-pressure').textContent = `${parseFloat(data.presion).toFixed(2)} hPa`;
                const date = new Date(data.time);
                document.getElementById('sensor-time').textContent = date.toLocaleString('es-CO');
            } else {
                console.log("No hay datos de sensor disponibles en la base de datos.");
            }
        } catch (error) {
            console.error("Error al procesar datos del sensor:", error);
        }
    }

    // --- 5. INICIALIZACIÓN ---
    fetchAndDisplayAlerts(); // Carga las alertas locales (vacío al inicio)
    fetchLatestSensorData();

    setInterval(() => {
        // Solo llamamos a fetchLatestSensorData, ya que las alertas son gestionadas por el clic
        fetchLatestSensorData();
    }, 5000);
    
});