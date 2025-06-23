// main.js (for Vite project - with Count-Up Timer Test)
import './style.css'; // Import CSS - Vite handles this

// Import the worker using Vite's special syntax
import AiWorker from './worker.js?worker';

console.log('[Main] Initializing main script.');

document.addEventListener('DOMContentLoaded', () => { // <<< START of DOMContentLoaded listener

    // --- State Variables ---
    let worker = null;
    let isDetectorReady = false; // Track model readiness via worker
    let timerIntervalId = null;  // To store the timer interval ID
    let timerElapsedTime = 0;    // To store elapsed seconds for count-up

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
        // Display elapsed time
        if (timerDisplayElement) {
            // Show only when timer is active (intervalId is not null)
            timerDisplayElement.textContent = timerIntervalId !== null ? `UI Test Timer: ${timerElapsedTime}s` : '';
        }
    }

    function resetTimer() {
        // Clears interval, resets time, clears display
        if (timerIntervalId !== null) {
            clearInterval(timerIntervalId);
            timerIntervalId = null;
        }
        timerElapsedTime = 0;
        updateTimerDisplay(); // Update display to clear it
        console.log('[Main] Timer reset.');
    }

    function startTimer() {
        resetTimer(); // Clear previous timer and reset value first
        timerElapsedTime = 0; // Explicitly set to 0
        updateTimerDisplay(); // Show "0s" immediately

        // Start interval to increment elapsed time
        timerIntervalId = setInterval(() => {
            timerElapsedTime++;
            updateTimerDisplay();
            // console.log(`[Main] Timer tick: ${timerElapsedTime}`); // Optional debug log
        }, 1000); // Update every 1 second
        console.log('[Main] Timer started.');
    }

    function stopTimer() {
        // Clears interval, keeps last displayed value until reset
        if (timerIntervalId !== null) {
            clearInterval(timerIntervalId);
            timerIntervalId = null;
            console.log('[Main] Timer stopped.');
            // Optionally update status or display final time
             if (timerDisplayElement) {
                timerDisplayElement.textContent += ` (Stopped)`;
             }
        }
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
        return; // Exit if worker creation fails
    }

    // --- Worker Message & Error Handlers ---
    worker.onmessage = (event) => {
        const message = event.data;
        if (message.type !== 'DOWNLOAD_PROGRESS') {
            console.log('[Main] Message received from AI worker:', message);
        }

        switch (message.type) {
            case 'STATUS_UPDATE':
                // Avoid overwriting status if timer is actively mentioned
                if (!statusElement.textContent.includes('Timer Running')) {
                    statusElement.textContent = message.payload;
                }
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
                statusElement.textContent = 'AI detector downloaded to your device';
                isDetectorReady = true;
                if (imageElement.src && imageElement.naturalWidth > 0) {
                    detectButton.disabled = false;
                    statusElement.textContent = 'AI detector downloaded to your device.';
                }
                break;

            case 'DETECTION_RESULT':
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
    
    // --- STOP TIMER HERE ---
    stopTimer();
    detectButton.disabled = false; // Re-enable button
    
    // --- SHOW CLEAR BUTTON AFTER FIRST SUCCESSFUL DETECTION ---
    const clearButton = document.getElementById('clear-button');
    if (clearButton && clearButton.classList.contains('hidden')) {
        clearButton.classList.remove('hidden');
        console.log('[Main] Clear button now visible after first detection.');
    }
    break;

            case 'ERROR':
                statusElement.textContent = `Error: ${message.payload}`;
                console.error('[Main] Error message from worker:', message.payload);
                isDetectorReady = false;
                detectButton.disabled = true;
                resetTimer(); // Reset timer on error
                break;

            default:
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

    // --- UI Helper Functions --- (Keep drawObjectBox and clearBoundingBoxes as they were)
    function clearBoundingBoxes() {
        const existingBoxes = imageContainer.querySelectorAll('.bounding-box');
        existingBoxes.forEach(box => box.remove());
    } // <<< End of clearBoundingBoxes

    function drawObjectBox(detectedObject) {
        // ... (drawObjectBox function code remains the same) ...
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
                    statusElement.textContent = 'Image loaded. Waiting for AI model...';
                }
            };
             imageElement.onerror = () => {
                 statusElement.textContent = 'Error displaying image.';
             }
        };
        reader.onerror = (e) => {
            console.error("File reading error:", e);
            statusElement.textContent = 'Error reading file.';
        };
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

    // Clear/Restart Button Event Listener
    const clearButton = document.getElementById('clear-button');
    if (clearButton) {
        clearButton.addEventListener('click', () => {
            console.log('[Main] Clear button clicked - resetting app state.');
            
            // Reset timer
            resetTimer();
            
            // Clear image
            imageElement.src = '/example.jpg'; // Reset to default image
            
            // Clear file input
            if (fileInput) fileInput.value = '';
            
            // Clear bounding boxes and detection results
            clearBoundingBoxes();
            if (detectionListElement) detectionListElement.innerHTML = '';
            
            // Reset status
            if (isDetectorReady) {
                statusElement.textContent = 'App reset. Model ready. Select an image.';
                detectButton.disabled = false;
            } else {
                statusElement.textContent = 'App reset. Waiting for model...';
                detectButton.disabled = true;
            }
            
            console.log('[Main] App state reset complete.');
        });
    }


    // Initial status update
    statusElement.textContent = 'App initialized. Waiting for worker...';
    resetTimer(); // Ensure timer display is clear initially

    console.log('[Main] Main script initialization complete.');

});
