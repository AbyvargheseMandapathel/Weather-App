let currentLat = 52.52;
let currentLon = 13.41;
let currentStartDate = '2026-02-13';
let currentEndDate = '2026-02-27';

document.addEventListener('DOMContentLoaded', () => {
    // Attempt to automatically get location on load if permission allows
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                currentLat = position.coords.latitude.toFixed(2);
                currentLon = position.coords.longitude.toFixed(2);
                document.getElementById('lat').value = currentLat;
                document.getElementById('lon').value = currentLon;
                updateLocationDisplay();
                fetchWeatherData();
            },
            (error) => {
                console.warn("Auto-geolocation failed or denied. Proceeding with defaults.", error);
                fetchWeatherData();
            },
            { timeout: 5000 }
        );
    } else {
        fetchWeatherData();
    }

    document.getElementById('weather-form').addEventListener('submit', (e) => {
        e.preventDefault();
        currentLat = document.getElementById('lat').value;
        currentLon = document.getElementById('lon').value;
        currentStartDate = document.getElementById('start-date').value;
        currentEndDate = document.getElementById('end-date').value;

        updateLocationDisplay();
        fetchWeatherData();
    });

    document.getElementById('get-location').addEventListener('click', () => {
        const btn = document.getElementById('get-location');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span class="spinner-small"></span> Locating...';
        btn.disabled = true;

        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    currentLat = position.coords.latitude.toFixed(2);
                    currentLon = position.coords.longitude.toFixed(2);
                    document.getElementById('lat').value = currentLat;
                    document.getElementById('lon').value = currentLon;

                    updateLocationDisplay();
                    fetchWeatherData();

                    btn.innerHTML = originalText;
                    btn.disabled = false;
                },
                (error) => {
                    alert("Unable to retrieve your location. Check browser permissions.");
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                }
            );
        } else {
            alert("Geolocation is not supported by your browser.");
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
});

function updateLocationDisplay() {
    document.getElementById('location-display').textContent = `Location: ${currentLat}°N, ${currentLon}°E | Date: ${currentStartDate} to ${currentEndDate}`;
}

async function fetchWeatherData() {
    document.getElementById('loading').classList.remove('hidden');

    // Historical API
    const HISTORICAL_API_URL = `https://historical-forecast-api.open-meteo.com/v1/forecast?latitude=${currentLat}&longitude=${currentLon}&start_date=${currentStartDate}&end_date=${currentEndDate}&hourly=temperature_2m&format=json&timeformat=unixtime`;

    // Current Live API
    const LIVE_API_URL = `https://api.open-meteo.com/v1/forecast?latitude=${currentLat}&longitude=${currentLon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&timezone=auto`;

    try {
        // Fetch both in parallel
        const [histRes, liveRes] = await Promise.all([
            fetch(HISTORICAL_API_URL),
            fetch(LIVE_API_URL)
        ]);

        if (!histRes.ok) throw new Error(`Historical API error: ${histRes.status}`);
        if (!liveRes.ok) throw new Error(`Live API error: ${liveRes.status}`);

        const histData = await histRes.json();
        const liveData = await liveRes.json();

        renderLiveData(liveData);
        processDataAndRender(histData);

        // Hide loading screen
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('live-weather-section').style.display = 'block';

    } catch (error) {
        console.error("Failed to fetch weather data:", error);
        document.getElementById('loading').innerHTML = `
            <div style="color: #ef4444; font-size: 2rem; margin-bottom: 1rem;">⚠️</div>
            <p>Failed to load data.</p>
            <p style="font-size: 0.8rem; color: #94a3b8; margin-top: 0.5rem;">${error.message}</p>
        `;
    }
}

function getWeatherDescription(code) {
    // WMO Weather interpretation codes
    if (code === 0) return { text: "Clear Sky", icon: "☀️" };
    if (code === 1 || code === 2 || code === 3) return { text: "Partly Cloudy", icon: "⛅" };
    if (code === 45 || code === 48) return { text: "Fog", icon: "🌫️" };
    if (code >= 51 && code <= 55) return { text: "Drizzle", icon: "🌧️" };
    if (code === 56 || code === 57) return { text: "Freezing Drizzle", icon: "❄️🌧️" };
    if (code >= 61 && code <= 65) return { text: "Rain", icon: "🌧️" };
    if (code === 66 || code === 67) return { text: "Freezing Rain", icon: "🥶🌧️" };
    if (code >= 71 && code <= 75) return { text: "Snowfall", icon: "❄️" };
    if (code === 77) return { text: "Snow Grains", icon: "🌨️" };
    if (code >= 80 && code <= 82) return { text: "Rain Showers", icon: "🌦️" };
    if (code === 85 || code === 86) return { text: "Snow Showers", icon: "🌨️" };
    if (code === 95) return { text: "Thunderstorm", icon: "⛈️" };
    if (code === 96 || code === 99) return { text: "Severe Thunderstorm/Storm", icon: "🌪️⛈️" };
    return { text: "Unknown", icon: "❓" };
}

function renderLiveData(data) {
    if (!data || !data.current) return;

    const current = data.current;

    document.getElementById('live-temp').textContent = `${current.temperature_2m}°C`;
    document.getElementById('live-feels').textContent = `${current.apparent_temperature}°C`;
    document.getElementById('live-wind').textContent = `${current.wind_speed_10m} km/h`;
    document.getElementById('live-humidity').textContent = `${current.relative_humidity_2m}%`;
    document.getElementById('live-precip').textContent = `${current.precipitation} mm`;

    // Process weather code
    const weatherInfo = getWeatherDescription(current.weather_code);

    // Add visual alert for storm
    const conditionEl = document.getElementById('live-condition');
    conditionEl.textContent = weatherInfo.text;
    if (current.weather_code >= 95) {
        conditionEl.style.color = '#ef4444'; // Red for storms
        conditionEl.style.fontWeight = '700';
    } else {
        conditionEl.style.color = 'var(--accent-primary)';
        conditionEl.style.fontWeight = '500';
    }

    document.getElementById('live-icon').textContent = weatherInfo.icon;
}

function processDataAndRender(data) {
    const times = data.hourly.time; // Unixtime in seconds
    const temps = data.hourly.temperature_2m;

    let minTemp = Infinity;
    let maxTemp = -Infinity;
    let sumTemp = 0;

    let minTimeStr = '';
    let maxTimeStr = '';

    const chartLabels = [];
    const chartData = [];

    // Formatter for readable time
    const dateFormatter = new Intl.DateTimeFormat('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    for (let i = 0; i < times.length; i++) {
        const temp = temps[i];
        if (temp === null) continue; // Skip nulls if any

        const date = new Date(times[i] * 1000);
        const dateStr = dateFormatter.format(date);

        chartLabels.push(dateStr);
        chartData.push(temp);

        if (temp < minTemp) {
            minTemp = temp;
            minTimeStr = dateStr;
        }
        if (temp > maxTemp) {
            maxTemp = temp;
            maxTimeStr = dateStr;
        }
        sumTemp += temp;
    }

    const avgTemp = (sumTemp / chartData.length).toFixed(1);

    // Update DOM
    document.getElementById('min-temp').textContent = `${minTemp}°C`;
    document.getElementById('min-time').textContent = minTimeStr;

    document.getElementById('max-temp').textContent = `${maxTemp}°C`;
    document.getElementById('max-time').textContent = maxTimeStr;

    document.getElementById('avg-temp').textContent = `${avgTemp}°C`;
    document.getElementById('total-records').textContent = chartData.length;

    renderChart(chartLabels, chartData);
}

let tempChartInstance = null;

function renderChart(labels, data) {
    const ctx = document.getElementById('tempChart').getContext('2d');

    if (tempChartInstance) {
        tempChartInstance.destroy();
    }

    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)'); // brand primary
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font.family = "'Outfit', sans-serif";

    tempChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Temperature (°C)',
                data: data,
                borderColor: '#3b82f6',
                backgroundColor: gradient,
                borderWidth: 2,
                pointBackgroundColor: '#0f172a',
                pointBorderColor: '#3b82f6',
                pointBorderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 6,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#f8fafc',
                    bodyColor: '#e2e8f0',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: function (context) {
                            return `${context.parsed.y}°C`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        maxTicksLimit: 10,
                        maxRotation: 0
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        callback: function (value) {
                            return value + '°';
                        }
                    }
                }
            }
        }
    });
}
