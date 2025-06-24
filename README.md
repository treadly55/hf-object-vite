# Object Detection AI App

The Object Detection AI App is a proof-of-concept application that uses a Hugging Face distributed AI model which is downloaded to your device to serve as local AI instance.  

The app uses the YOLO-tiny model and processes everything client-side for complete privacy.

Users can upload images or use the default example, and the app will detect objects with confidence scores, displaying results as interactive bounding boxes overlaid on the image.

**Working Example**
https://object-detection-ai-app.netlify.app/

## Tech Stack

* **Frontend**: Vanilla JavaScript, CSS, HTML
* **Build Tool**: Vite (ES6 modules, hot reload)
* **AI Processing**: Web Worker with @xenova/transformers
* **Model**: Xenova/yolos-tiny (YOLO object detection) - https://huggingface.co/Xenova/yolos-tiny
* **Deployment**: Netlify

## How the AI detection process works

**Model Download** → YOLO-tiny model downloads to user's browser on first load.
**Web Worker Processing** → Image sent to background worker to prevent UI freezes
**Local AI Inference** → YOLO model processes image entirely on device
**Results Display** → Bounding boxes drawn on image with object labels and confidence scores

## AI model (YOLO-tiny) notes

The YOLO-tiny model can detect 80+ common objects including:
- People, animals, vehicles
- Furniture, electronics, sports equipment  
- Food items, household objects, etc

## Project Structure

```
object-detection-app/
├── src/
│   ├── main.js              # Frontend logic and UI management
│   ├── worker.js            # Web Worker for AI processing
│   └── style.css            # Modern dark theme styling
├── public/
│   ├── example.jpg          # Default test image
│   └── vite.svg             # Favicon
├── index.html               # Main HTML structure
├── package.json             # Dependencies and scripts
├── vite.config.js           # Vite configuration
└── README.md
```

## Installation & Development

```bash
# Clone the repository
git clone [your-repo-url]
cd object-detection-app

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Dependencies

```json
{
  "@xenova/transformers": "^2.x.x",
  "vite": "^4.x.x"
}
```

## Performance Notes

- **First Load**: Model download (~50MB) takes 1-2 minutes depending on connection
- **Subsequent Uses**: Model cached locally, instant loading
- **Detection Time**: ~15-25 seconds per image depending on device performance
- **Memory Usage**: ~200-400MB RAM during processing

## License

This project is licensed under the [MIT License](LICENSE).