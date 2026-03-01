document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-test-btn');
    startBtn.addEventListener('click', startSpeedTest);

    // Initialize status indicator to ready
    setStatus('Ready to Test', 'ready');
});

// A reliable publicly accessible test file on Cloudflare's network
const imageApi = "https://speed.cloudflare.com/__down?bytes=50000000"; // 50MB chunks for continuous stream

function setStatus(text, state) {
    const statusInd = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    const pulseDot = document.getElementById('pulse-dot');

    statusText.textContent = text;

    // Reset classes
    statusInd.className = 'status-indicator';
    pulseDot.className = 'pulse';

    if (state === 'ready') {
        statusInd.classList.add('ready');
        pulseDot.classList.add('pulse-idle');
    } else if (state === 'testing') {
        statusInd.classList.add('testing');
        pulseDot.classList.add('pulse-testing');
    } else if (state === 'done') {
        statusInd.classList.add('done');
        pulseDot.classList.add('pulse-done');
    }
}

function updateProgressCircle(percentage) {
    const circle = document.getElementById('progress-value');
    const radius = circle.r.baseVal.value;
    const circumference = radius * 2 * Math.PI;

    circle.style.strokeDasharray = `${circumference} ${circumference}`;

    // Cap percentage at 100 for display (100Mbps representing max on dial scale for now)
    // We'll scale it so that 100 Mbps = 100% of the circle.
    const cappedPercentage = Math.min(Math.max(percentage, 0), 100);
    const offset = circumference - (cappedPercentage / 100) * circumference;

    circle.style.strokeDashoffset = offset;
}

async function startSpeedTest() {
    const startBtn = document.getElementById('start-test-btn');
    const speedValueEl = document.getElementById('speed-value');
    const resultsGrid = document.getElementById('results-grid');

    // UI Reset
    startBtn.disabled = true;
    startBtn.textContent = 'Testing...';
    speedValueEl.textContent = '0.0';
    updateProgressCircle(0);
    resultsGrid.classList.add('hidden');

    setStatus('Testing Download (60s)...', 'testing');

    const duration = 60; // 60 seconds test
    let keepRunning = true;
    let loadedBytes = 0;

    try {
        // Measure ping first
        const pingStart = performance.now();
        await fetch(`https://speed.cloudflare.com/__down?bytes=0&t=${Date.now()}`, { method: 'HEAD', mode: 'no-cors' });
        const latency = Math.round(performance.now() - pingStart);

        const testStartTime = performance.now();

        const abortController = new AbortController();
        const timeoutId = setTimeout(() => {
            keepRunning = false;
            abortController.abort();
        }, duration * 1000);

        const updateInterval = setInterval(() => {
            const elapsedSeconds = (performance.now() - testStartTime) / 1000;
            if (elapsedSeconds > 0) {
                const bps = (loadedBytes * 8) / elapsedSeconds;
                const mbps = bps / 1024 / 1024;
                updateUI(mbps);
            }
        }, 200);

        // Fetch loop to keep streaming data until time is up
        while (keepRunning) {
            try {
                const response = await fetch(`${imageApi}&t=${Date.now()}`, {
                    cache: 'no-store',
                    signal: abortController.signal
                });

                const reader = response.body.getReader();

                while (keepRunning) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    if (value) {
                        loadedBytes += value.length;
                    }
                }
            } catch (e) {
                if (e.name !== 'AbortError') {
                    console.warn('Stream interrupted, retrying if time remains:', e);
                }
            }
        }

        clearInterval(updateInterval);
        clearTimeout(timeoutId); // Clear the timeout in case the loop finishes early (e.g., network error)

        const testEndTime = performance.now();
        const totalDurationSeconds = Math.min((testEndTime - testStartTime) / 1000, duration);
        const bps = (loadedBytes * 8) / totalDurationSeconds;
        const finalMbps = bps / 1024 / 1024;

        // Final updates
        updateUI(finalMbps);

        document.getElementById('final-download').textContent = `${finalMbps.toFixed(2)} Mbps`;
        document.getElementById('final-ping').textContent = `${latency} ms`;
        document.getElementById('test-size').textContent = `${(loadedBytes / 1024 / 1024).toFixed(2)} MB`;

        resultsGrid.classList.remove('hidden');
        setStatus('Test Complete', 'done');

    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Speed test failed:', error);
            setStatus('Test Failed', 'ready');
            alert("Failed to perform the speed test. Please check your network or try again.");
            updateProgressCircle(0);
            speedValueEl.textContent = '--';
        }
    } finally {
        startBtn.disabled = false;
        startBtn.textContent = 'Test Again';
    }
}

function updateUI(mbpsValue) {
    document.getElementById('speed-value').textContent = mbpsValue.toFixed(1);
    updateProgressCircle(mbpsValue); // Scale 100 Mbps = 100% circle coverage
}

// Initial draw of the circle to 0
updateProgressCircle(0);
