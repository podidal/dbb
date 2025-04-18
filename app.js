// DOM Elements
const startButton = document.getElementById('startRecording');
const stopButton = document.getElementById('stopRecording');
const recordingIndicator = document.getElementById('recordingIndicator');
const resultText = document.getElementById('resultText');
const clearButton = document.getElementById('clearResult');
const saveButton = document.getElementById('saveResult');
const fontSizeInput = document.getElementById('fontSize');
const fontSizeValue = document.getElementById('fontSizeValue');
const darkModeToggle = document.getElementById('darkMode');
const promptInput = document.getElementById('promptInput');
const savePromptButton = document.getElementById('savePrompt');
const resetPromptButton = document.getElementById('resetPrompt');
const generatePromptButton = document.getElementById('generatePrompt');
const audioAnalysisType = document.getElementById('audioAnalysisType');
const audioFormat = document.getElementById('audioFormat');
const useTimestamps = document.getElementById('useTimestamps');
const timestampInputs = document.querySelector('.timestamp-inputs');
const startTime = document.getElementById('startTime');
const endTime = document.getElementById('endTime');

// Debug Elements - will be created dynamically
let debugPanel;
let debugLog;
let debugToggle;

// Global variables
let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let isDebugMode = false;
let recordingStartTime = 0;
let recordingDuration = 0;

// Performance tracking
let performanceMarks = {};

// GEMINI API KEY - YOU NEED TO REPLACE THIS WITH YOUR OWN KEY
const GEMINI_API_KEY = "AIzaSyD8l66ru-JZKdEJZI8-m1NoloN0zng_1A8";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// Default prompts by analysis type
const DEFAULT_PROMPTS = {
    accessibility: "Generate a precise transcript of the speech on same lang for deaf people. Simplify the speech, focusing on short, clear phrases. Make sure the result is gesture-friendly and uses simple vocabulary.",
    transcript: "Generate a detailed transcript of the speech in the audio. Include all spoken words and phrases exactly as they are said.",
    summary: "Listen to this audio and provide a concise summary of the main points and key information discussed.",
    analysis: "Analyze this audio content and describe what you hear, including speaker emotions, tone, background sounds, and main discussion points."
};

// Initialize the application
document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
    log('Инициализация приложения');
    
    // Create debug panel
    createDebugPanel();
    
    // Set up event listeners
    startButton.addEventListener('click', startRecording);
    stopButton.addEventListener('click', stopRecording);
    clearButton.addEventListener('click', clearResult);
    saveButton.addEventListener('click', saveResult);
    fontSizeInput.addEventListener('input', updateFontSize);
    darkModeToggle.addEventListener('change', toggleDarkMode);
    debugToggle.addEventListener('change', toggleDebugMode);
    savePromptButton.addEventListener('click', savePrompt);
    resetPromptButton.addEventListener('click', resetPrompt);
    generatePromptButton.addEventListener('click', generatePrompt);
    audioAnalysisType.addEventListener('change', updatePromptBasedOnAnalysisType);
    useTimestamps.addEventListener('change', toggleTimestampInputs);
    
    // Set default prompt if none exists
    initPrompt();
    
    // Check for saved preferences
    loadPreferences();
    
    // Check if media recording is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showError("Ваш браузер не поддерживает запись аудио!");
        log('Error: Браузер не поддерживает MediaRecorder API', 'error');
        disableRecordingButtons();
        return;
    }
    
    log('Приложение инициализировано успешно');
}

// Toggle timestamp inputs visibility
function toggleTimestampInputs() {
    timestampInputs.style.display = useTimestamps.checked ? 'block' : 'none';
    log(`Использование временных отрезков ${useTimestamps.checked ? 'включено' : 'выключено'}`);
}

// Update prompt based on analysis type selection
function updatePromptBasedOnAnalysisType() {
    const type = audioAnalysisType.value;
    const currentPrompt = promptInput.value.trim();
    const defaultPrompt = DEFAULT_PROMPTS[type];
    
    // Only update if the current prompt is a default one or empty
    const isDefaultPrompt = Object.values(DEFAULT_PROMPTS).includes(currentPrompt);
    if (isDefaultPrompt || !currentPrompt) {
        promptInput.value = defaultPrompt;
        log(`Промпт обновлен на основе типа анализа: ${type}`, 'info');
    }
}

// Generate a prompt based on current settings
function generatePrompt() {
    const type = audioAnalysisType.value;
    let basePrompt = DEFAULT_PROMPTS[type];
    
    // Add timestamp references if enabled
    if (useTimestamps.checked && startTime.value && endTime.value) {
        const timeRange = `от ${startTime.value} до ${endTime.value}`;
        basePrompt = basePrompt.replace('. ', `. Анализируй аудио ${timeRange}. `);
        if (!basePrompt.includes(timeRange)) {
            basePrompt += ` Анализируй только отрезок времени ${timeRange}.`;
        }
    }
    
    promptInput.value = basePrompt;
    log('Промпт сгенерирован на основе текущих настроек', 'success');
}

// Initialize prompt with default or saved value
function initPrompt() {
    const savedPrompt = localStorage.getItem('customPrompt');
    if (savedPrompt) {
        promptInput.value = savedPrompt;
        log('Загружен сохраненный промпт', 'info');
    } else {
        promptInput.value = DEFAULT_PROMPTS.accessibility;
        log('Установлен промпт по умолчанию', 'info');
    }
}

// Save prompt to localStorage
function savePrompt() {
    const promptText = promptInput.value.trim();
    if (!promptText) {
        alert("Промпт не может быть пустым!");
        promptInput.value = DEFAULT_PROMPTS[audioAnalysisType.value];
        return;
    }
    
    localStorage.setItem('customPrompt', promptText);
    log('Промпт сохранен в настройках', 'success');
    alert("Промпт сохранен!");
}

// Reset prompt to default
function resetPrompt() {
    const type = audioAnalysisType.value;
    promptInput.value = DEFAULT_PROMPTS[type];
    localStorage.setItem('customPrompt', DEFAULT_PROMPTS[type]);
    log('Промпт сброшен до значения по умолчанию', 'info');
}

// Create Debug Panel
function createDebugPanel() {
    // Create debug toggle in settings
    const settingsEl = document.querySelector('.settings');
    
    const debugToggleContainer = document.createElement('div');
    debugToggleContainer.className = 'debug-settings';
    debugToggleContainer.innerHTML = `
        <label for="debugMode">Режим отладки:</label>
        <input type="checkbox" id="debugMode">
    `;
    settingsEl.appendChild(debugToggleContainer);
    
    debugToggle = document.getElementById('debugMode');
    
    // Create debug panel
    debugPanel = document.createElement('div');
    debugPanel.className = 'debug-panel';
    debugPanel.style.display = 'none';
    
    debugPanel.innerHTML = `
        <h3>Отладочная информация</h3>
        <div class="debug-actions">
            <button id="clearDebug" class="btn">Очистить логи</button>
            <button id="copyDebug" class="btn">Копировать логи</button>
        </div>
        <div id="debugLog" class="debug-log"></div>
    `;
    
    document.querySelector('.app-container').appendChild(debugPanel);
    
    debugLog = document.getElementById('debugLog');
    
    // Add event listeners for debug panel buttons
    document.getElementById('clearDebug').addEventListener('click', () => {
        debugLog.innerHTML = '';
        log('Логи очищены', 'info');
    });
    
    document.getElementById('copyDebug').addEventListener('click', () => {
        const logText = debugLog.innerText;
        navigator.clipboard.writeText(logText)
            .then(() => log('Логи скопированы в буфер обмена', 'success'))
            .catch(err => log('Ошибка при копировании: ' + err, 'error'));
    });
}

// Logging function
function log(message, level = 'debug') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    // Always log to console
    if (level === 'error') {
        console.error(logEntry);
    } else if (level === 'warn') {
        console.warn(logEntry);
    } else {
        console.log(logEntry);
    }
    
    // Add to debug panel if exists and debug mode is on
    if (debugLog && isDebugMode) {
        const logItem = document.createElement('div');
        logItem.className = `log-entry log-${level}`;
        logItem.textContent = logEntry;
        debugLog.appendChild(logItem);
        
        // Auto-scroll to bottom
        debugLog.scrollTop = debugLog.scrollHeight;
    }
}

// Toggle debug mode
function toggleDebugMode() {
    isDebugMode = debugToggle.checked;
    
    if (debugPanel) {
        debugPanel.style.display = isDebugMode ? 'block' : 'none';
    }
    
    log(`Режим отладки ${isDebugMode ? 'включен' : 'выключен'}`, 'info');
    
    // Save preference
    localStorage.setItem('debugMode', isDebugMode);
}

// Audio Recording Functions
async function startRecording() {
    log('Начало записи аудио');
    
    try {
        // Request microphone access
        log('Запрос доступа к микрофону');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        log('Доступ к микрофону получен');
        
        // Get selected audio format
        const selectedFormat = audioFormat.value;
        log(`Выбранный формат записи: ${selectedFormat}`);
        
        // Create media recorder with selected format if supported
        log('Создание MediaRecorder');
        let options = {};
        
        // Try to use the selected format, fall back to default if not supported
        try {
            options = { mimeType: selectedFormat };
            mediaRecorder = new MediaRecorder(stream, options);
            log(`MediaRecorder создан с mimeType: ${selectedFormat}`);
        } catch (e) {
            log(`Формат ${selectedFormat} не поддерживается, используем формат по умолчанию`, 'warn');
            mediaRecorder = new MediaRecorder(stream);
        }
        
        log(`MediaRecorder создан, mimeType: ${mediaRecorder.mimeType || 'не указан'}`);
        
        // Set up event handlers
        mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
            log(`Получен аудио-чанк, размер: ${Math.round(event.data.size / 1024)} KB`);
        };
        
        mediaRecorder.onstop = processAudio;
        
        // Start recording and track time
        audioChunks = [];
        recordingStartTime = Date.now();
        mediaRecorder.start();
        isRecording = true;
        log('Запись начата');
        
        // Update UI
        startButton.disabled = true;
        stopButton.disabled = false;
        recordingIndicator.classList.add('active');
        resultText.innerText = "Запись...";
        
        // Disable changing formats during recording
        audioFormat.disabled = true;
        
    } catch (error) {
        log(`Ошибка при запуске записи: ${error.message}`, 'error');
        showError("Ошибка при запуске записи: " + error.message);
    }
}

function stopRecording() {
    if (mediaRecorder && isRecording) {
        log('Остановка записи');
        
        // Calculate recording duration
        recordingDuration = (Date.now() - recordingStartTime) / 1000; // in seconds
        log(`Длительность записи: ${recordingDuration.toFixed(2)} секунд`);
        
        // Stop recording
        mediaRecorder.stop();
        isRecording = false;
        
        // Update UI
        startButton.disabled = false;
        stopButton.disabled = true;
        recordingIndicator.classList.remove('active');
        resultText.innerText = "Обработка записи...";
        
        // Re-enable format selection
        audioFormat.disabled = false;
    } else {
        log('Попытка остановить запись, но запись не активна', 'warn');
    }
}

async function processAudio() {
    log('Обработка записанного аудио');
    resetPerformanceMarks();
    markTime('processStart');
    
    try {
        // Get the MIME type from the recorder or fallback to selected format
        const mimeType = mediaRecorder.mimeType || audioFormat.value;
        
        // Convert audio chunks to blob
        markTime('blobCreationStart');
        log(`Создание Blob из ${audioChunks.length} аудио-чанков с типом ${mimeType}`);
        const audioBlob = new Blob(audioChunks, { type: mimeType });
        markTime('blobCreationEnd');
        measureTime('blobCreationStart', 'blobCreationEnd', 'Создание Blob заняло');
        
        log(`Blob создан, размер: ${Math.round(audioBlob.size / 1024)} KB`);
        
        // Estimate token usage (32 tokens per second of audio)
        const estimatedTokens = Math.round(recordingDuration * 32);
        log(`Примерное использование токенов для аудио: ${estimatedTokens} (${recordingDuration.toFixed(2)} сек × 32)`);
        
        // For debugging: create audio element to play back recording
        if (isDebugMode) {
            const audioUrl = URL.createObjectURL(audioBlob);
            const audioElement = document.createElement('audio');
            audioElement.controls = true;
            audioElement.src = audioUrl;
            debugLog.appendChild(audioElement);
            log('Добавлен аудио-элемент для прослушивания записи', 'info');
        }
        
        // Check if file is too large for inline data (> 20MB)
        const fileSizeMB = audioBlob.size / (1024 * 1024);
        if (fileSizeMB > 20) {
            log(`Файл слишком большой для inline обработки: ${fileSizeMB.toFixed(2)}MB > 20MB`, 'error');
            showError("Аудиофайл слишком большой. Максимальный размер для обработки - 20MB.");
            return;
        }
        
        // Convert audio to base64
        markTime('base64ConversionStart');
        log('Конвертация аудио в base64');
        const base64Audio = await blobToBase64(audioBlob);
        markTime('base64ConversionEnd');
        measureTime('base64ConversionStart', 'base64ConversionEnd', 'Конвертация в base64 заняла');
        
        log(`Аудио конвертировано в base64, длина: ${base64Audio.length} символов`);
        
        // Send to Gemini API
        log('Отправка аудио в Gemini API');
        markTime('apiCallStart');
        await sendToGeminiAPI(base64Audio, mimeType);
        // markTime('apiCallEnd') будет вызван внутри sendToGeminiAPI
        
    } catch (error) {
        log(`Ошибка при обработке аудио: ${error.message}`, 'error');
        showError("Ошибка при обработке аудио: " + error.message);
    } finally {
        markTime('processEnd');
        const totalTime = measureTime('processStart', 'processEnd', 'Общее время обработки');
        
        // Log performance summary
        if (isDebugMode) {
            logPerformanceSummary();
        }
    }
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        log('Начало преобразования Blob в base64');
        const reader = new FileReader();
        reader.onloadend = () => {
            // Extract base64 data from the result
            const base64String = reader.result.split(',')[1];
            log('Blob успешно преобразован в base64');
            resolve(base64String);
        };
        reader.onerror = (err) => {
            log(`Ошибка при преобразовании Blob в base64: ${err}`, 'error');
            reject(err);
        };
        reader.readAsDataURL(blob);
    });
}

async function sendToGeminiAPI(base64Audio, mimeType) {
    markTime('apiRequestPreparationStart');
    log('Подготовка запроса к Gemini API');
    
    let resultTextBackup = '';
    
    try {
        resultText.innerText = "Отправка в нейросеть...";
        
        // Get the current prompt text from the textarea
        let currentPrompt = promptInput.value.trim() || DEFAULT_PROMPTS[audioAnalysisType.value];
        
        // Add timestamp references if enabled
        if (useTimestamps.checked && startTime.value && endTime.value) {
            log(`Добавление временных отрезков: от ${startTime.value} до ${endTime.value}`);
            currentPrompt += ` Анализируй только отрезок времени от ${startTime.value} до ${endTime.value}.`;
        }
        
        log(`Используемый промпт: "${currentPrompt.substring(0, 50)}..."`);
        
        // Construct the request
        const requestData = {
            contents: [
                {
                    parts: [
                        {
                            text: currentPrompt
                        },
                        {
                            inline_data: {
                                mime_type: mimeType,
                                data: base64Audio
                            }
                        }
                    ]
                }
            ]
        };
        
        // Log the model being used
        log(`Используем модель: ${GEMINI_API_URL.split('/').pop().split(':')[0]}`);
        
        markTime('apiRequestPreparationEnd');
        measureTime('apiRequestPreparationStart', 'apiRequestPreparationEnd', 'Подготовка запроса заняла');
        
        log('Запрос сформирован, отправка в Gemini API');
        
        // Start request timer animation
        startRequestTimer();
        
        // Make the API call
        const apiUrl = `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`;
        log(`Отправка POST запроса на: ${GEMINI_API_URL.split('/').slice(0, 3).join('/')}/*****`);
        
        markTime('apiNetworkStart');
        resultTextBackup = resultText.innerHTML;
        updateRequestStatus(1, "Отправка запроса...");
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        
        markTime('apiNetworkEnd');
        const networkTime = measureTime('apiNetworkStart', 'apiNetworkEnd', 'Сетевое взаимодействие заняло');
        updateRequestStatus(2, "Ответ получен, обработка данных...");
        
        log(`Ответ получен, статус: ${response.status}, время: ${networkTime}ms`);
        
        if (!response.ok) {
            const errorText = await response.text();
            log(`API вернула ошибку: ${response.status} ${response.statusText}`, 'error');
            log(`Содержание ошибки: ${errorText}`, 'error');
            throw new Error(`API вернула ошибку: ${response.status}`);
        }
        
        markTime('apiParsingStart');
        const responseData = await response.json();
        markTime('apiParsingEnd');
        measureTime('apiParsingStart', 'apiParsingEnd', 'Парсинг JSON ответа занял');
        
        log('Ответ успешно преобразован в JSON');
        updateRequestStatus(3, "Обработка ответа...");
        
        // For debugging, log the full response in console
        if (isDebugMode) {
            console.log('Полный ответ API:', responseData);
        }
        
        // Process and display the response
        markTime('apiProcessingStart');
        if (responseData.candidates && responseData.candidates.length > 0) {
            const text = responseData.candidates[0].content.parts[0].text;
            log(`Получен текст от API, длина: ${text.length} символов`);
            displayResult(text);
        } else {
            log('Неожиданная структура ответа API', 'error');
            if (isDebugMode) {
                const responseStr = JSON.stringify(responseData, null, 2);
                log(`Структура ответа: ${responseStr}`, 'error');
            }
            throw new Error("Неожиданный ответ от API");
        }
        markTime('apiProcessingEnd');
        measureTime('apiProcessingStart', 'apiProcessingEnd', 'Обработка ответа заняла');
        
        // Calculate total API time
        markTime('apiCallEnd');
        measureTime('apiCallStart', 'apiCallEnd', 'Общее время запроса к API');
        
    } catch (error) {
        log(`Ошибка при отправке в Gemini API: ${error.message}`, 'error');
        showError("Ошибка при отправке в Gemini API: " + error.message);
        markTime('apiCallEnd'); // Все равно отмечаем время окончания для статистики
    } finally {
        // Stop the request timer animation
        stopRequestTimer();
        
        // If we're still showing status updates, restore the original text or show error
        if (resultText.innerText.includes("...") && resultTextBackup) {
            resultText.innerHTML = resultTextBackup;
        }
    }
}

// Request timer animation
let requestTimerInterval;
let requestTimeCounter = 0;

function startRequestTimer() {
    requestTimeCounter = 0;
    requestTimerInterval = setInterval(() => {
        requestTimeCounter += 100;
        const seconds = (requestTimeCounter / 1000).toFixed(1);
        updateRequestStatus(0, `Ожидание ответа от API (${seconds}с)...`);
    }, 100);
}

function stopRequestTimer() {
    if (requestTimerInterval) {
        clearInterval(requestTimerInterval);
        requestTimerInterval = null;
    }
}

function updateRequestStatus(stage, message) {
    if (!resultText) return;
    
    // Different stages of request processing
    let progress = "";
    switch(stage) {
        case 0: // Waiting
            progress = "<span class='api-waiting'>⏳</span>";
            break;
        case 1: // Sending
            progress = "<span class='api-sending'>📤</span>";
            break; 
        case 2: // Processing
            progress = "<span class='api-processing'>🔄</span>";
            break;
        case 3: // Finishing
            progress = "<span class='api-finishing'>📥</span>";
            break;
    }
    
    resultText.innerHTML = `${progress} ${message}`;
}

// Log performance summary
function logPerformanceSummary() {
    if (Object.keys(performanceMarks).length === 0) return;
    
    log("📊 СВОДКА ПО ПРОИЗВОДИТЕЛЬНОСТИ 📊", 'info');
    
    // Check if we have complete API call timing
    if (performanceMarks['apiCallStart'] && performanceMarks['apiCallEnd']) {
        const totalApiTime = performanceMarks['apiCallEnd'] - performanceMarks['apiCallStart'];
        
        // Calculate preparation time
        let prepTime = 0;
        if (performanceMarks['apiRequestPreparationStart'] && performanceMarks['apiRequestPreparationEnd']) {
            prepTime = performanceMarks['apiRequestPreparationEnd'] - performanceMarks['apiRequestPreparationStart'];
        }
        
        // Calculate network time
        let networkTime = 0;
        if (performanceMarks['apiNetworkStart'] && performanceMarks['apiNetworkEnd']) {
            networkTime = performanceMarks['apiNetworkEnd'] - performanceMarks['apiNetworkStart'];
        }
        
        // Calculate parsing time
        let parsingTime = 0;
        if (performanceMarks['apiParsingStart'] && performanceMarks['apiParsingEnd']) {
            parsingTime = performanceMarks['apiParsingEnd'] - performanceMarks['apiParsingStart'];
        }
        
        // Calculate processing time
        let processingTime = 0;
        if (performanceMarks['apiProcessingStart'] && performanceMarks['apiProcessingEnd']) {
            processingTime = performanceMarks['apiProcessingEnd'] - performanceMarks['apiProcessingStart'];
        }
        
        // Calculate other time (time not accounted for in detailed measurements)
        const detailedTime = prepTime + networkTime + parsingTime + processingTime;
        const otherTime = totalApiTime - detailedTime;
        
        // Create table-like output
        log(`┌───────────────────────────┬────────┐`, 'info');
        log(`│ Подготовка запроса        │ ${prepTime.toString().padStart(5)}ms │`, 'info');
        log(`│ Сетевое взаимодействие    │ ${networkTime.toString().padStart(5)}ms │ ⚠️ ОСНОВНОЕ ВРЕМЯ ЗДЕСЬ`, 'info');
        log(`│ Парсинг JSON              │ ${parsingTime.toString().padStart(5)}ms │`, 'info');
        log(`│ Обработка ответа          │ ${processingTime.toString().padStart(5)}ms │`, 'info');
        log(`│ Прочие операции           │ ${otherTime.toString().padStart(5)}ms │`, 'info');
        log(`├───────────────────────────┼────────┤`, 'info');
        log(`│ ОБЩЕЕ ВРЕМЯ API           │ ${totalApiTime.toString().padStart(5)}ms │`, 'info');
        log(`└───────────────────────────┴────────┘`, 'info');
        
        // Analysis of bottlenecks
        const bottleneckAnalysis = [];
        if (networkTime > totalApiTime * 0.7) {
            bottleneckAnalysis.push("⚠️ Сетевое взаимодействие занимает более 70% времени. Проблемы с сетью или сервером API.");
        }
        if (prepTime > 300) {
            bottleneckAnalysis.push("⚠️ Подготовка запроса занимает слишком много времени.");
        }
        if (parsingTime > 500) {
            bottleneckAnalysis.push("⚠️ Парсинг JSON занимает слишком много времени. Возможно, устройство недостаточно мощное.");
        }
        
        if (bottleneckAnalysis.length > 0) {
            log("АНАЛИЗ ПРОБЛЕМ:", 'warn');
            bottleneckAnalysis.forEach(issue => log(issue, 'warn'));
        }
    }
}

function displayResult(text) {
    log('Отображение результата на экране');
    
    // Format the result with emotion highlighting
    let formattedText = text;
    
    // Only apply emotion highlighting for accessibility mode
    if (audioAnalysisType.value === 'accessibility') {
        formattedText = formattedText.replace(/\?(.*?)(?:\?|$)/g, '<span class="emotion-question">$&</span>');
        formattedText = formattedText.replace(/\!(.*?)(?:\!|$)/g, '<span class="emotion-exclamation">$&</span>');
    }
    
    // Update UI
    resultText.innerHTML = formattedText;
    log('Результат успешно отображен');
}

function clearResult() {
    log('Очистка результата');
    resultText.innerHTML = "";
}

function saveResult() {
    const text = resultText.innerText;
    if (!text) {
        log('Попытка сохранить пустой результат', 'warn');
        alert("Нет текста для сохранения!");
        return;
    }
    
    log('Сохранение результата в файл');
    
    // Create a blob and download link
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const filename = `transcription_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    log(`Создан файл: ${filename}, размер: ${Math.round(blob.size / 1024)} KB`);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    log('Файл успешно сохранен');
}

// UI Functions
function updateFontSize() {
    const size = fontSizeInput.value;
    fontSizeValue.textContent = `${size}px`;
    document.documentElement.style.setProperty('--font-size', `${size}px`);
    log(`Размер шрифта изменен на ${size}px`);
    savePreferences();
}

function toggleDarkMode() {
    if (darkModeToggle.checked) {
        document.body.setAttribute('data-theme', 'dark');
        log('Включена темная тема');
    } else {
        document.body.removeAttribute('data-theme');
        log('Включена светлая тема');
    }
    savePreferences();
}

function loadPreferences() {
    log('Загрузка пользовательских настроек');
    
    // Load font size
    const savedFontSize = localStorage.getItem('fontSize');
    if (savedFontSize) {
        fontSizeInput.value = savedFontSize;
        updateFontSize();
        log(`Загружен сохраненный размер шрифта: ${savedFontSize}px`);
    }
    
    // Load theme
    const darkMode = localStorage.getItem('darkMode') === 'true';
    darkModeToggle.checked = darkMode;
    toggleDarkMode();
    
    // Load debug mode
    const debugMode = localStorage.getItem('debugMode') === 'true';
    debugToggle.checked = debugMode;
    toggleDebugMode();
    
    // Load audio settings
    const savedAnalysisType = localStorage.getItem('analysisType');
    if (savedAnalysisType) {
        audioAnalysisType.value = savedAnalysisType;
        log(`Загружен сохраненный тип анализа: ${savedAnalysisType}`);
    }
    
    const savedAudioFormat = localStorage.getItem('audioFormat');
    if (savedAudioFormat) {
        audioFormat.value = savedAudioFormat;
        log(`Загружен сохраненный формат аудио: ${savedAudioFormat}`);
    }
    
    // Load custom prompt (already handled in initPrompt)
    
    log('Настройки пользователя загружены');
}

function savePreferences() {
    log('Сохранение пользовательских настроек');
    localStorage.setItem('fontSize', fontSizeInput.value);
    localStorage.setItem('darkMode', darkModeToggle.checked);
    localStorage.setItem('debugMode', debugToggle.checked);
    localStorage.setItem('analysisType', audioAnalysisType.value);
    localStorage.setItem('audioFormat', audioFormat.value);
}

// Error handling
function showError(message) {
    resultText.innerHTML = `<span style="color: var(--secondary-color)">Ошибка: ${message}</span>`;
    log(`Ошибка отображена пользователю: ${message}`, 'error');
}

function disableRecordingButtons() {
    startButton.disabled = true;
    stopButton.disabled = true;
    log('Кнопки записи отключены', 'warn');
}

// Mark timing for performance tracking
function markTime(label) {
    performanceMarks[label] = Date.now();
    log(`[⏱️] Метка времени: ${label}`, 'info');
}

// Measure time between marks
function measureTime(startLabel, endLabel, description) {
    if (!performanceMarks[startLabel] || !performanceMarks[endLabel]) {
        log(`⚠️ Невозможно измерить время между метками ${startLabel} и ${endLabel}`, 'warn');
        return 0;
    }
    
    const duration = performanceMarks[endLabel] - performanceMarks[startLabel];
    log(`[⏱️] ${description}: ${duration}ms`, 'info');
    return duration;
}

// Reset performance marks
function resetPerformanceMarks() {
    performanceMarks = {};
} 