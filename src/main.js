// main.js (for Vite project)
import './style.css';

// Import the worker using Vite's special syntax
// Inside src/main.js
import AiWorker from './worker.js?worker'; // Use './' for sibling file

console.log('[Main] Initializing main script.');

// --- State Variables ---
let worker = null;
let isDetectorReady = false; // Track model readiness via worker

// --- DOM Elements ---
const statusElement = document.getElementById('status');
const imageElement = document.getElementById('test-image');
const detectButton = document.getElementById('detect-button');
const imageContainer = document.getElementById('image-container');
const fileInput = document.getElementById('image-upload');
const detectionListElement = document.getElementById('detection-list');

// --- Initialize Worker ---
try {
    statusElement.textContent = 'Initializing background processor...';
    worker = new AiWorker(); // Instantiate worker imported via Vite syntax
    console.log('[Main] AI Worker instance created.');

    // Request model load once worker is potentially ready
    // Optional: Wait for initial 'Worker ready' status first, or just send
    worker.postMessage({ type: 'LOAD_MODEL' });

} catch (error) {
    console.error('[Main] Failed to create AI worker:', error);
    statusElement.textContent = 'Error: Could not initialize background processor.';
    if(detectButton) detectButton.disabled = true;
    if(fileInput) fileInput.disabled = true;
    // Don't proceed if worker creation fails
    throw new Error("Worker initialization failed.");
}

// --- Worker Message & Error Handlers ---
// Listener for messages FROM the AI worker
worker.onmessage = (event) => {
    const message = event.data;
    // Generic log moved inside 'default' case below

    switch (message.type) {
        case 'STATUS_UPDATE':
            console.log('[Main] Received STATUS_UPDATE:', message.payload); // More specific log
            statusElement.textContent = message.payload;
            break;

        case 'DOWNLOAD_PROGRESS':
            // Log progress specifically if needed for debugging, otherwise just update UI
            // console.log('[Main] Received DOWNLOAD_PROGRESS:', message.payload);
            const progressData = message.payload;
            if (progressData.status === 'progress') {
                 const percentage = (progressData.progress || 0).toFixed(2);
                 statusElement.textContent = `Downloading model: <span class="math-inline">\{progressData\.file\} \(</span>{percentage}%)`;
            } else if (progressData.status === 'done') {
                 // Briefly show 'done' message before MODEL_READY potentially overrides it
                 statusElement.textContent = `Finished downloading: ${progressData.file}`;
            } else {
                statusElement.textContent = `Model download status: ${progressData.status}`;
            }
            break;

        case 'MODEL_READY':
            console.log('[Main] Received MODEL_READY'); // Specific log
            statusElement.textContent = 'Model ready. Select an image.';
            isDetectorReady = true;
            if (imageElement.src && imageElement.naturalWidth > 0) {
                detectButton.disabled = false;
                statusElement.textContent = 'Model ready. Ready to detect.';
            }
            break;

        case 'DETECTION_RESULT':
            console.log('[Main] Received DETECTION_RESULT'); // Specific log
            const output = message.payload.output;
            clearBoundingBoxes();
            if (detectionListElement) detectionListElement.innerHTML = '';

            if (output.length > 0) {
                statusElement.textContent = `Detection complete. Found ${output.length} objects.`;
                const limitedOutput = output.slice(0, 15);

                limitedOutput.forEach(detectedObject => {
                    drawObjectBox(detectedObject);
                    const { label, score } = detectedObject;
                    const listItem = document.createElement('li');
                    listItem.textContent = `${label}: ${Math.floor(score * 100)}%`;
                    if (detectionListElement) {
                        detectionListElement.appendChild(listItem);
                    }
                });
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
            detectButton.disabled = false; // Re-enable button
            break;

        case 'ERROR':
            // Error already logged by the line below this switch
            statusElement.textContent = `Error: ${message.payload}`;
            console.error('[Main] Error message from worker:', message.payload); // Keep specific error log
            isDetectorReady = false;
            detectButton.disabled = true;
            break;

        default:
            // Log only unhandled messages generically
            console.log('[Main] Message received from AI worker (unhandled type):', message);
            console.warn('[Main] Received unknown message type from worker:', message.type);
    }
};

worker.onerror = (error) => {
    console.error('[Main] Critical worker error:', error.message, error);
    statusElement.textContent = `Critical background error: ${error.message}. Please refresh.`;
    isDetectorReady = false;
    detectButton.disabled = true;
    if (fileInput) fileInput.disabled = true;
};

// --- UI Helper Functions ---
function clearBoundingBoxes() {
    const existingBoxes = imageContainer.querySelectorAll('.bounding-box');
    existingBoxes.forEach(box => box.remove());
}

function drawObjectBox(detectedObject) {
    const { label, score, box } = detectedObject;
    const { xmax, xmin, ymax, ymin } = box; // Assuming percentage coordinates

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
}

// --- Event Handlers ---
function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file || !file.type.startsWith('image/')) {
        statusElement.textContent = file ? 'Error: Please select an image file.' : 'No file selected.';
        if (fileInput) fileInput.value = '';
        detectButton.disabled = true; // Ensure button is disabled
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
        // Image needs to load into the element before we check readiness
        imageElement.onload = () => {
            if (isDetectorReady) {
                statusElement.textContent = 'Image loaded. Ready to detect.';
                detectButton.disabled = false;
            } else {
                statusElement.textContent = 'Image loaded. Waiting for model...';
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
}

// --- Attach Event Listeners ---
if (fileInput) {
    fileInput.addEventListener('change', handleImageUpload);
}

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
        statusElement.textContent = 'Sending image to worker...';

        worker.postMessage({
            type: 'DETECT',
            payload: {
                imageSrc: imageElement.src // Send data URL
            }
        });
    });
}

// Initial status update
statusElement.textContent = 'App initialized. Waiting for worker...';

console.log('[Main] Main script initialization complete.');