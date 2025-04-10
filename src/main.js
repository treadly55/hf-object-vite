// main.js (for Vite project - with Timer Test) - RE-VERIFIED SYNTAX
import './style.css'; // Import CSS - Vite handles this

// Import the worker using Vite's special syntax
import AiWorker from './worker.js?worker';

console.log('[Main] Initializing main script.');

document.addEventListener('DOMContentLoaded', () => { // <<< START of DOMContentLoaded listener

    // --- State Variables ---
    let worker = null;
    let isDetectorReady = false; // Track model readiness via worker
    let timerIntervalId = null;  // To store the timer interval ID
    const timerStartValue = 10;  // Countdown starts from 10 seconds
    let timerCountdownValue = timerStartValue;

    // --- DOM Elements ---
    const statusElement = document.getElementById('status');
    const imageElement = document.getElementById('test-image');
    const detectButton = document.getElementById('detect-button');
    const imageContainer = document.getElementById('image-container');
    const fileInput = document.getElementById('image-upload');
    const detectionListElement = document.getElementById('detection-list');
    const timerDisplayElement = document.getElementById('timer-display'); // Get timer display element

    // --- Timer Functions ---
    function updateTimerDisplay() {
        if (timerDisplayElement) {
            timerDisplayElement.textContent = timerCountdownValue >= 0 ? `UI Test Timer: ${timerCountdownValue}` : '';
        }
    }

    function resetTimer() {
        if (timerIntervalId !== null) {
            clearInterval(timerIntervalId);
            timerIntervalId = null;
        }
        timerCountdownValue = timerStartValue;
        // Update display to show initial state or clear it
        if (timerDisplayElement) {
             timerDisplayElement.textContent = ''; // Clear display on reset
        }
        // updateTimerDisplay(); // Or call this to show the reset value immediately if desired
    }

    function startTimer() {
        resetTimer(); // Clear previous timer and reset value first
        updateTimerDisplay(); // Show starting value immediately
        // Avoid modifying statusElement directly here, rely on DETECT start message perhaps
        // statusElement.textContent += ' (Timer Started)';

        timerIntervalId = setInterval(() => {
            timerCountdownValue--;
            updateTimerDisplay();
            // console.log(`[Main] Timer tick: ${timerCountdownValue}`); // Optional debug log

            if (timerCountdownValue < 0) {
                clearInterval(timerIntervalId);
                timerIntervalId = null;
                console.log('[Main] Timer finished.');
            }
        }, 1000); // Update every 1 second
    }

    // --- Initialize Worker ---
    try {
        statusElement.textContent = 'Initializing background processor...';
        resetTimer(); // Ensure timer is reset/cleared on initial load
        worker = new AiWorker(); // Instantiate worker imported via Vite syntax
        console.log('[Main] AI Worker instance created.');

        worker.postMessage({ type: 'LOAD_MODEL' });

    } catch (error) {
        console.error('[Main] Failed to create AI worker:', error);
        statusElement.textContent = 'Error: Could not initialize background processor.';
        if(detectButton) detectButton.disabled = true;
        if(fileInput) fileInput.disabled = true;
        // Optionally re-throw if initialization is critical
        // throw new Error("Worker initialization failed.");
        return; // Exit if worker creation fails
    }

    // --- Worker Message & Error Handlers ---
    worker.onmessage = (event) => {
        const message = event.data;
        // Log only non-progress messages here if desired
        if (message.type !== 'DOWNLOAD_PROGRESS') {
            console.log('[Main] Message received from AI worker:', message);
        }

        switch (message.type) {
            case 'STATUS_UPDATE':
                statusElement.textContent = message.payload;
                break;

            case 'DOWNLOAD_PROGRESS':
                const progressData = message.payload;
                if (progressData.status === 'progress') {
                     const percentage = (progressData.progress || 0).toFixed(2);
                     statusElement.textContent = `Downloading model: ${progressData.file} (${percentage}%)`;
                } else if (progressData.status === 'done') {
                     statusElement.textContent = `Finished downloading: ${progressData.file}`;
                } else {
                    statusElement.textContent = `Model download status: ${progressData.status}`;
                }
                break;

            case 'MODEL_READY':
                statusElement.textContent = 'Model ready. Select an image.';
                isDetectorReady = true;
                if (imageElement.src && imageElement.naturalWidth > 0) {
                    detectButton.disabled = false;
                    statusElement.textContent = 'Model ready. Ready to detect.';
                }
                break;

            case 'DETECTION_RESULT':
                // Clean up timer status message part if detection finishes before timer
                statusElement.textContent = statusElement.textContent.replace(' (Timer Started)', ''); // Example cleanup if added
                const output = message.payload.output;
                statusElement.textContent = `Detection complete. Found ${output.length} objects.`;

                clearBoundingBoxes();
                if (detectionListElement) detectionListElement.innerHTML = '';

                if (output.length > 0) {
                    const limitedOutput = output.slice(0, 15);
                    limitedOutput.forEach(detectedObject => drawObjectBox(detectedObject));
                    if (detectionListElement) {
                         limitedOutput.forEach(detectedObject => {
                             const { label, score } = detectedObject;
                             const listItem = document.createElement('li');
                             listItem.textContent = `${label}: ${Math.floor(score * 100)}%`;
                             detectionListElement.appendChild(listItem);
                         });
                    }
                    if (output.length > limitedOutput.length) {
                        statusElement.textContent += ` Displaying top ${limitedOutput.length}.`;
                    }
                } else {
                     statusElement.textContent = 'Detection complete. No objects found.';
                    if (detectionListElement) {
                        const listItem = document.createElement('li');
                        listItem.textContent = 'No objects detected above threshold.';
                        detectionListElement.appendChild(listItem);
                    }
                }
                // Re-enable button only if the timer hasn't been reset by another action
                if (timerIntervalId !== null || timerCountdownValue >= 0) {
                    // Or simply always enable if appropriate
                }
                 detectButton.disabled = false; // Re-enable button
                break;

            case 'ERROR':
                statusElement.textContent = `Error: ${message.payload}`;
                console.error('[Main] Error message from worker:', message.payload); // Keep specific error log
                isDetectorReady = false;
                detectButton.disabled = true;
                resetTimer(); // Also reset timer on error
                break;

            default:
                // Log only unhandled messages generically
                console.log('[Main] Message received from AI worker (unhandled type):', message);
                console.warn('[Main] Received unknown message type from worker:', message.type);
        }
    }; // <<< End of worker.onmessage handler

    worker.onerror = (error) => {
        console.error('[Main] Critical worker error:', error.message, error);
        statusElement.textContent = `Critical background error: ${error.message}. Please refresh.`;
        isDetectorReady = false;
        detectButton.disabled = true;
        if (fileInput) fileInput.disabled = true;
        resetTimer(); // Reset timer on critical worker error
    }; // <<< End of worker.onerror handler

    // --- UI Helper Functions ---
    function clearBoundingBoxes() {
        const existingBoxes = imageContainer.querySelectorAll('.bounding-box');
        existingBoxes.forEach(box => box.remove());
    } // <<< End of clearBoundingBoxes

    function drawObjectBox(detectedObject) {
        const { label, score, box } = detectedObject;
        const { xmax, xmin, ymax, ymin } = box;
        const color = '#' + Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0');
        const boxElement = document.createElement('div');
        boxElement.className = 'bounding-box';
        Object.assign(boxElement.style, {
            borderColor: color,
            left: `${xmin * 100}%`,
            top: `${ymin * 100}%`,
            width: `${(xmax - xmin) * 100}%`,
            height: `${(ymax - ymin) * 100}%`,
        });
        const labelElement = document.createElement('span');
        labelElement.textContent = `${label}: ${Math.floor(score * 100)}%`;
        labelElement.className = 'bounding-box-label';
        labelElement.style.backgroundColor = color;
        boxElement.appendChild(labelElement);
        imageContainer.appendChild(boxElement);
    } // <<< End of drawObjectBox

    // --- Event Handlers ---
    function handleImageUpload(event) {
        resetTimer(); // <<< RESET TIMER HERE
        const file = event.target.files[0];
        if (!file || !file.type.startsWith('image/')) {
            statusElement.textContent = file ? 'Error: Please select an image file.' : 'No file selected.';
            if (fileInput) fileInput.value = '';
            detectButton.disabled = true;
            clearBoundingBoxes();
            if (detectionListElement) detectionListElement.innerHTML = '';
            return;
        }

        clearBoundingBoxes();
        if (detectionListElement) detectionListElement.innerHTML = '';
        statusElement.textContent = 'Loading image...';
        detectButton.disabled = true;

        const reader = new FileReader();
        reader.onload = (e) => {
            imageElement.src = e.target.result;
            imageElement.onload = () => {
                if (isDetectorReady) {
                    statusElement.textContent = 'Image loaded. Ready to detect.';
                    detectButton.disabled = false;
                } else {
                    statusElement.textContent = 'Image loaded. Waiting for model...';
                }
            }; // <<< End of imageElement.onload
             imageElement.onerror = () => {
                 statusElement.textContent = 'Error displaying image.';
             }; // <<< End of imageElement.onerror
        }; // <<< End of reader.onload
        reader.onerror = (e) => {
            console.error("File reading error:", e);
            statusElement.textContent = 'Error reading file.';
        }; // <<< End of reader.onerror
        reader.readAsDataURL(file);
    } // <<< End of handleImageUpload

    // --- Attach Event Listeners ---
    if (fileInput) {
        fileInput.addEventListener('change', handleImageUpload);
    } // <<< End of fileInput if block

    if (detectButton) {
        detectButton.addEventListener('click', () => {
            if (!isDetectorReady || !worker) {
                statusElement.textContent = !worker ? 'Error: Background processor unavailable.' : 'Detector not ready. Please wait.';
                return;
            }
            if (!imageElement.src || imageElement.naturalWidth === 0) {
                statusElement.textContent = 'No image loaded or ready for detection.';
                return;
            }

            clearBoundingBoxes();
            if (detectionListElement) detectionListElement.innerHTML = '';
            detectButton.disabled = true;
            statusElement.textContent = 'Sending image to worker... (UI Timer Running)';

            // --- START TIMER HERE ---
            startTimer();

            worker.postMessage({
                type: 'DETECT',
                payload: {
                    imageSrc: imageElement.src
                }
            });
        }); // <<< End of click listener callback
    } // <<< End of detectButton if block

    // Initial status update
    statusElement.textContent = 'App initialized. Waiting for worker...';

    console.log('[Main] Main script initialization complete.');

}); // <<< END of DOMContentLoaded listener