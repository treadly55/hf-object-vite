// worker.js (for Vite project)
console.log('[Worker] Worker script starting.');

// Import pipeline and env from the installed package
import { pipeline, env } from '@xenova/transformers';

// Define pipeline and env in the worker's scope
let modelPipeline, environment;
let detector = null; 
let libraryLoaded = false;

try {
    modelPipeline = pipeline;
    environment = env;
    environment.allowLocalModels = false; 
    libraryLoaded = true;
    console.log('[Worker] Transformers library access configured.');
} catch(error) {
    console.error('[Worker] Failed during library setup:', error);
    self.postMessage({ type: 'ERROR', payload: `Worker setup failed: ${error.message}` });
}

// Message Handler
self.onmessage = async (event) => {
    const message = event.data;
    console.log('[Worker] Received message:', message);

    if (!libraryLoaded) {
         self.postMessage({ type: 'ERROR', payload: 'Worker cannot process: library failed to load.' });
         return;
    }

    switch (message.type) {
        case 'LOAD_MODEL':
            if (detector) {
                console.log('[Worker] Model already loaded.');
                self.postMessage({ type: 'MODEL_READY' });
                break;
            }

            console.log('[Worker] Starting model loading...');
            self.postMessage({ type: 'STATUS_UPDATE', payload: 'Loading model...' });

            try {
                detector = await modelPipeline('object-detection', 'Xenova/yolos-tiny', {
                     progress_callback: (data) => {
                         // Send detailed progress back to main thread
                         self.postMessage({ type: 'DOWNLOAD_PROGRESS', payload: data });
                     }
                });
                console.log('[Worker] Model loaded successfully.');
                self.postMessage({ type: 'MODEL_READY' });
            } catch (error) {
                console.error('[Worker] Error loading model pipeline:', error);
                const errorMessage = error instanceof Error ? error.message : String(error);
                self.postMessage({ type: 'ERROR', payload: `Failed to load model: ${errorMessage}` });
            }
            break;

        case 'DETECT':
            if (!detector) {
                self.postMessage({ type: 'ERROR', payload: 'Detection failed: Model not loaded.' });
                break;
            }
            if (!message.payload || !message.payload.imageSrc) {
                 self.postMessage({ type: 'ERROR', payload: 'Detection failed: No image data received.' });
                 break;
            }

            console.log('[Worker] Starting detection...');
            self.postMessage({ type: 'STATUS_UPDATE', payload: 'Detecting objects...' });

            try {
                const output = await detector(message.payload.imageSrc, {
                    threshold: 0.5, 
                    percentage: true
                });
                console.log('[Worker] Detection complete.');
                self.postMessage({ type: 'DETECTION_RESULT', payload: { output: output } });

            } catch (error) {
                console.error('[Worker] Error during detection:', error);
                const errorMessage = error instanceof Error ? error.message : String(error);
                self.postMessage({ type: 'ERROR', payload: `Detection failed: ${errorMessage}` });
            }
            break;

        default:
            console.warn('[Worker] Received unknown message type:', message.type);
    }
};

// Global Error Handler
self.onerror = function(error) {
     console.error('[Worker] Uncaught error in worker:', error);
     const errorMessage = error instanceof Error ? error.message : (error.reason || error.message || 'Unknown worker error');
     self.postMessage({ type: 'ERROR', payload: `Worker error: ${errorMessage}` });
};

// Initial Ready Signal
if (libraryLoaded) {
    console.log('[Worker] Ready for commands.');
    self.postMessage({ type: 'STATUS_UPDATE', payload: 'Worker ready.' });
} else {
    console.error("[Worker] Initialization failed earlier.");
}