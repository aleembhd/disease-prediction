const fileInput = document.getElementById('fileInput');
const uploadArea = document.getElementById('uploadArea');
const previewImage = document.getElementById('previewImage');
const analyzeBtn = document.getElementById('analyzeBtn');
const loading = document.getElementById('loading');
const cameraButton = document.getElementById('cameraButton');

let currentLanguage = 'en';
let lastAnalysisResult = null;

uploadArea.addEventListener('click', () => {
    fileInput.click();
});

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.style.backgroundColor = 'var(--pale-green)';
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.style.backgroundColor = 'transparent';
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.style.backgroundColor = 'transparent';
    const file = e.dataTransfer.files[0];
    handleImage(file);
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    handleImage(file);
});

cameraButton.addEventListener('click', async () => {
    try {
        // Create video element for camera stream
        const videoElement = document.createElement('video');
        videoElement.style.display = 'block';
        videoElement.style.maxWidth = '100%';
        videoElement.style.margin = '20px auto';
        videoElement.autoplay = true;
        
        // Create canvas for capturing the image
        const canvas = document.createElement('canvas');
        
        // Create capture button
        const captureBtn = document.createElement('button');
        captureBtn.textContent = 'Capture Photo';
        captureBtn.className = 'camera-button';
        
        // Create container for camera UI
        const cameraContainer = document.createElement('div');
        cameraContainer.style.position = 'fixed';
        cameraContainer.style.top = '0';
        cameraContainer.style.left = '0';
        cameraContainer.style.width = '100%';
        cameraContainer.style.height = '100%';
        cameraContainer.style.backgroundColor = '#fff';
        cameraContainer.style.zIndex = '1000';
        cameraContainer.style.padding = '20px';
        cameraContainer.style.boxSizing = 'border-box';
        
        // Create close button
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.style.position = 'absolute';
        closeBtn.style.right = '20px';
        closeBtn.style.top = '20px';
        closeBtn.style.fontSize = '24px';
        closeBtn.style.border = 'none';
        closeBtn.style.background = 'none';
        closeBtn.style.cursor = 'pointer';
        
        // Add elements to container
        cameraContainer.appendChild(closeBtn);
        cameraContainer.appendChild(videoElement);
        cameraContainer.appendChild(captureBtn);
        document.body.appendChild(cameraContainer);
        
        // Get camera stream
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: 'environment', // Use back camera on mobile
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            } 
        });
        videoElement.srcObject = stream;
        
        // Handle capture button click
        captureBtn.onclick = () => {
            // Set canvas dimensions to match video
            canvas.width = videoElement.videoWidth;
            canvas.height = videoElement.videoHeight;
            
            // Draw video frame to canvas
            canvas.getContext('2d').drawImage(videoElement, 0, 0);
            
            // Convert to image
            const imageData = canvas.toDataURL('image/jpeg');
            previewImage.src = imageData;
            previewImage.style.display = 'block';
            analyzeBtn.style.display = 'flex';
            
            // Clean up
            stream.getTracks().forEach(track => track.stop());
            cameraContainer.remove();
        };
        
        // Handle close button click
        closeBtn.onclick = () => {
            stream.getTracks().forEach(track => track.stop());
            cameraContainer.remove();
        };
        
    } catch (err) {
        console.error('Error accessing camera:', err);
        alert('Unable to access camera. Please make sure you have granted camera permissions.');
    }
});

function handleImage(file) {
    if (file && file.type.startsWith('image/')) {
        if (file.size > 10 * 1024 * 1024) {
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImage.src = e.target.result;
            previewImage.style.display = 'block';
            analyzeBtn.style.display = 'flex';
        };
        reader.readAsDataURL(file);
    }
}

analyzeBtn.addEventListener('click', async () => {
    if (!previewImage.src) return;

    loading.style.display = 'block';
    analyzeBtn.disabled = true;
    
    try {
        const imageData = previewImage.src.split(',')[1];
        
        // Updated prompt to be more specific and structured
        const analysisPrompt = `Analyze this crop/plant image and provide information in the following format:
        1. Identify the crop/plant
        2. Check for any diseases or health issues
        3. Provide exactly 4 brief, bullet-point treatment recommendations

        Format your response EXACTLY as follows (including the curly braces):
        {
            "cropName": "name of the crop",
            "disease": "disease name or 'No disease detected'",
            "treatment": "• Treatment point 1\n• Treatment point 2\n• Treatment point 3\n• Treatment point 4"
        }

        Keep each treatment recommendation must be 10 words, focusing on immediate actions.`;

        const result = await window.model.generateContent([
            analysisPrompt,
            {
                inlineData: {
                    mimeType: "image/jpeg",
                    data: imageData
                }
            }
        ]);

        const response = await result.response;
        const responseText = response.text();
        
        // Find the JSON object in the response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        let analysisResult;
        
        if (jsonMatch) {
            try {
                analysisResult = JSON.parse(jsonMatch[0]);
            } catch (parseError) {
                // If JSON parsing fails, create a structured response from the text
                analysisResult = {
                    cropName: "Unable to identify",
                    disease: "Analysis incomplete",
                    treatment: "Please try again with a clearer image"
                };
            }
        } else {
            // If no JSON found, structure the entire response
            analysisResult = {
                cropName: "Analysis Result",
                disease: responseText.includes("disease") ? "Disease detected" : "Unable to determine",
                treatment: responseText
            };
        }
        
        // Store the result for language switching
        lastAnalysisResult = analysisResult;
        
        // Update the display
        updateResultsDisplay(analysisResult);
        document.getElementById('analysisResult').style.display = 'block';
        
    } catch (error) {
        console.error('Analysis error:', error);
        // Instead of alert, show error in the results container
        const resultsContainer = document.querySelector('.results-container');
        resultsContainer.innerHTML = `
            <div class="result-card">
                <div class="crop-info">
                    <div class="analysis-section">
                        <h3>Analysis Error</h3>
                        <p>Unable to analyze image. Please try again with a different image.</p>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('analysisResult').style.display = 'block';
    } finally {
        loading.style.display = 'none';
        analyzeBtn.disabled = false;
    }
});

function updateResultsDisplay(result) {
    const cropInfo = document.getElementById('cropInfo');
    const diseaseInfo = document.getElementById('diseaseInfo');
    const treatmentInfo = document.getElementById('treatmentInfo');

    // Display crop information
    cropInfo.innerHTML = `
        <p>
            <strong>Identified Crop:</strong> 
            <span class="highlight">${result.cropName}</span>
        </p>
    `;

    // Display disease information with status indicator
    const diseaseStatus = result.disease.toLowerCase().includes('no disease') 
        ? '<span class="status-healthy">✓ Healthy</span>' 
        : '<span class="status-disease">! Disease Detected</span>';
    
    diseaseInfo.innerHTML = `
        <div class="disease-info">
            <div class="disease-status-line">
                <strong>Status:</strong> ${diseaseStatus}
            </div>
            <div class="disease-details-line">
                <strong>Details:</strong> ${result.disease}
            </div>
        </div>
    `;

    // Display treatment information
    const treatmentPoints = result.treatment.split('\n').map(point => 
        `<div class="treatment-point">${point}</div>`
    ).join('');

    treatmentInfo.innerHTML = `
        <div class="treatment-info">
            <div class="treatment-header">
                <strong>Recommended Action:</strong>
            </div>
            <div class="treatment-list">
                ${treatmentPoints}
            </div>
        </div>
    `;

    document.getElementById('analysisResult').style.display = 'block';
}