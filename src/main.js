// main.js (for Vite project - with Count-Up Timer Test)
import './style.css'; // Import CSS - Vite handles this

// Import the worker using Vite's special syntax
import AiWorker from './worker.js?worker';

console.log('[Main] Initializing main script.');

document.addEventListener('DOMContentLoaded', () => { 
    // START DOMContentLoaded listener

    let worker = null;
    let isDetectorReady = false; 
    let timerIntervalId = null;  
    let timerElapsedTime = 0;    
    let isUserUpload = false;    

    // --- DOM Elements ---
    const statusElement = document.getElementById('status');
    const imageElement = document.getElementById('test-image');
    const detectButton = document.getElementById('detect-button');
    const imageContainer = document.getElementById('image-container');
    const fileInput = document.getElementById('image-upload');
    const detectionListElement = document.getElementById('detection-list');
    const timerDisplayElement = document.getElementById('timer-display'); 

    // --- Timer Functions ---
    function updateTimerDisplay() {
        if (timerDisplayElement) {
            timerDisplayElement.textContent = timerIntervalId !== null ? `Time elapsed: ${timerElapsedTime}s` : '';
        }
    }

    function resetTimer() {
        if (timerIntervalId !== null) {
            clearInterval(timerIntervalId);
            timerIntervalId = null;
        }
        timerElapsedTime = 0;
        updateTimerDisplay();
        console.log('[Main] Timer reset.');
    }

    function startTimer() {
        resetTimer(); 
        timerElapsedTime = 0; 
        updateTimerDisplay(); 

        timerIntervalId = setInterval(() => {
            timerElapsedTime++;
            updateTimerDisplay();          
        }, 1000); 
        console.log('[Main] Timer started.');
    }

    function stopTimer() {
        if (timerIntervalId !== null) {
            clearInterval(timerIntervalId);
            timerIntervalId = null;
            console.log('[Main] Timer stopped.');
             if (timerDisplayElement) {
                timerDisplayElement.textContent += ` (Completed)`;
             }
        }
    }

    // --- Smooth Scroll Functions ---
    function smoothScrollToElement(element, offset = 0) {
        if (element) {
            const elementPosition = element.offsetTop + offset;
            window.scrollTo({
                top: elementPosition,
                behavior: 'smooth'
            });
            console.log(`[Main] Smooth scrolling to element:`, element.id || element.className);
        }
    }

    function smoothScrollToTop() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
        console.log('[Main] Smooth scrolling to top of page.');
    }

    function smoothScrollToStatus() {
        const statusSection = document.querySelector('.status-section');
        smoothScrollToElement(statusSection, -20); // Slight offset for better positioning
    }

    // --- Initialize Worker ---
    try {
        statusElement.textContent = 'Initializing background processor...';
        resetTimer(); 
        worker = new AiWorker(); 
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
                statusElement.textContent = 'Model successfully downloaded to device. Select an image.';
                isDetectorReady = true;
                if (imageElement.src && imageElement.naturalWidth > 0) {
                    detectButton.disabled = false;
                    statusElement.textContent = 'Model downloaded to local device. Ready to detect.';
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
                
                const detectionListContainer = document.getElementById('detection-list-container');
                if (detectionListContainer) {
                    detectionListContainer.style.display = 'block';
                    console.log('[Main] Detection results container now visible.');
                }
                
                // --- STOP TIMER HERE ---
                stopTimer();
                detectButton.disabled = false; 
                break;

            case 'ERROR':
                statusElement.textContent = `Error: ${message.payload}`;
                console.error('[Main] Error message from worker:', message.payload);
                isDetectorReady = false;
                detectButton.disabled = true;
                resetTimer();
                break;

            default:
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
        resetTimer(); 
    }; 

    // --- UI Helper Functions --- 
    function clearBoundingBoxes() {
        const existingBoxes = imageContainer.querySelectorAll('.bounding-box');
        existingBoxes.forEach(box => box.remove());
    } 

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
    } 

    // --- Event Handlers ---
    function handleImageUpload(event) {
        resetTimer(); 
        const file = event.target.files[0];
        const clearButton = document.getElementById('clear-button');
        const detectionListContainer = document.getElementById('detection-list-container');
        
        if (!file || !file.type.startsWith('image/')) {
            statusElement.textContent = file ? 'Error: Please select an image file.' : 'No file selected.';
            if (fileInput) fileInput.value = '';
            detectButton.disabled = true;
            clearBoundingBoxes();
            if (detectionListElement) detectionListElement.innerHTML = '';
            if (detectionListContainer) detectionListContainer.style.display = 'none';
            if (clearButton && !clearButton.classList.contains('hidden')) {
                clearButton.classList.add('hidden');
                console.log('[Main] Clear button hidden - no valid image selected.');
            }
            return;
        }

        clearBoundingBoxes();
        if (detectionListElement) detectionListElement.innerHTML = '';
        if (detectionListContainer) detectionListContainer.style.display = 'none';
        
        statusElement.textContent = 'Loading image...';
        detectButton.disabled = true;

        const reader = new FileReader();
        reader.onload = (e) => {
            isUserUpload = true; 
            imageElement.src = e.target.result;
            imageElement.onload = () => {
                if (isDetectorReady) {
                    statusElement.textContent = 'Image loaded. Ready to detect.';
                    detectButton.disabled = false;
                } else {
                    statusElement.textContent = 'Image loaded. Waiting for model...';
                }
                
                if (isUserUpload && clearButton && clearButton.classList.contains('hidden')) {
                    clearButton.classList.remove('hidden');
                    console.log('[Main] Clear button now visible - user uploaded image.');
                }
            };
             imageElement.onerror = () => {
                 statusElement.textContent = 'Error displaying image.';
                 if (clearButton && !clearButton.classList.contains('hidden')) {
                     clearButton.classList.add('hidden');
                     console.log('[Main] Clear button hidden - image load error.');
                 }
             }
        };
        reader.onerror = (e) => {
            console.error("File reading error:", e);
            statusElement.textContent = 'Error reading file.';
            if (clearButton && !clearButton.classList.contains('hidden')) {
                clearButton.classList.add('hidden');
                console.log('[Main] Clear button hidden - file read error.');
            }
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
            statusElement.textContent = 'AI detector working...';

            // Hide detection results container during detection
            const detectionListContainer = document.getElementById('detection-list-container');
            if (detectionListContainer) {
                detectionListContainer.style.display = 'none';
            }

            // --- START TIMER ---
            startTimer();

            // --- SMOOTH SCROLL TO STATUS AREA ---
            setTimeout(() => {
                smoothScrollToStatus();
            }, 100); // Small delay to ensure status text is updated first

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
            
            // Clear image back to default
            isUserUpload = false; // Mark this as NOT a user upload
            imageElement.src = '/example.jpg'; // Reset to default image
            
            // Clear file input
            if (fileInput) fileInput.value = '';
            
            // Clear bounding boxes and detection results
            clearBoundingBoxes();
            if (detectionListElement) detectionListElement.innerHTML = '';
            
            // Hide detection results container on reset
            const detectionListContainer = document.getElementById('detection-list-container');
            if (detectionListContainer) {
                detectionListContainer.style.display = 'none';
                console.log('[Main] Detection results container hidden on reset.');
            }
            
            // Force hide clear button since we're back to default image
            clearButton.classList.add('hidden');
            console.log('[Main] Clear button forcibly hidden - back to default image.');
            console.log('[Main] Clear button classes after hiding:', clearButton.classList.toString());
            
            // Reset status
            if (isDetectorReady) {
                statusElement.textContent = 'App reset. AI successfully downloaded to device. Select an image.';
                detectButton.disabled = false;
            } else {
                statusElement.textContent = 'App reset. Waiting...';
                detectButton.disabled = true;
            }
            
            // --- SMOOTH SCROLL TO TOP ---
            setTimeout(() => {
                smoothScrollToTop();
            }, 100); // Small delay to ensure reset is processed first
            
            console.log('[Main] App state reset complete.');
        });
    }

    // Initial status update
    statusElement.textContent = 'App initialized. Waiting...';
    resetTimer(); // Ensure timer display is clear initially

    console.log('[Main] Main script initialization complete.');

});