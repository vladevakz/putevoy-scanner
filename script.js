// Элементы интерфейса
const video = document.getElementById('video');
const captureButton = document.getElementById('captureButton');
const startButton = document.getElementById('startButton');
const rawTextDiv = document.getElementById('rawText');
const calculationsDiv = document.getElementById('calculations');
const weatherInfoDiv = document.getElementById('weatherInfo');

// Настройки из полей
const fuelAddedManual = document.getElementById('fuelAddedManual');
const normSummerInput = document.getElementById('normSummer');
const normWinterInput = document.getElementById('normWinter');
const seasonRadios = document.getElementsByName('season');

// =============================================
// 1. ЗАПУСК КАМЕРЫ
// =============================================
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
        });
        video.srcObject = stream;
        // Дождёмся, пока видео начнёт воспроизводиться
        await new Promise((resolve) => {
            video.onloadedmetadata = () => resolve();
        });
        captureButton.disabled = false;
    } catch (err) {
        alert('Не удалось запустить камеру: ' + err.message);
    }
}

// =============================================
// 2. ОПРЕДЕЛЕНИЕ ПОГОДЫ ПО ГЕОЛОКАЦИИ
// =============================================
function getSelectedSeasonMode() {
    for (const radio of seasonRadios) {
        if (radio.checked) return radio.value;
    }
    return 'auto';
}

async function fetchWeatherByLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Геолокация не поддерживается'));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                try {
                    const response = await fetch(
                        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
                    );
                    const data = await response.json();
                    const temp = data.current_weather.temperature;
                    resolve(temp);
                } catch (err) {
                    reject(new Error('Ошибка получения погоды: ' + err.message));
                }
            },
            (err) => {
                reject(new Error('Доступ к геолокации запрещён: ' + err.message));
            },
            { timeout: 5000 }
        );
    });
}

async function updateWeatherAndDetermineNorm() {
    const mode = getSelectedSeasonMode();
    weatherInfoDiv.textContent = '';

    if (mode !== 'auto') {
        const seasonName = mode === 'winter' ? 'Зима (вручную)' : 'Лето (вручную)';
        weatherInfoDiv.textContent = `📌 Сезон: ${seasonName}`;
        return mode;
    }

    try {
        weatherInfoDiv.textContent = '🌍 Определяем местоположение и погоду...';
        const temp = await fetchWeatherByLocation();
        weatherInfoDiv.textContent = `🌡️ Температура: ${temp}°C. Режим: ${temp < 0 ? '❄️ Зима' : '☀️ Лето'}`;
        return temp < 0 ? 'winter' : 'summer';
    } catch (err) {
        weatherInfoDiv.textContent = '⚠️ Погода недоступна, используется летняя норма';
        return 'summer';
    }
}

// =============================================
// 3. РАСПОЗНАВАНИЕ И РАСЧЁТ (с пошаговым отчётом)
// =============================================
async function captureAndRecognize() {
    // Блокируем кнопку, чтобы не нажать дважды
    captureButton.disabled = true;
    captureButton.textContent = '⏳ Идёт процесс...';
    rawTextDiv.textContent = '⏱ Захват кадра...';
    calculationsDiv.textContent = '';

    // Шаг 1: погода и сезон
    const season = await updateWeatherAndDetermineNorm();
    const norm = season === 'winter'
        ? parseFloat(normWinterInput.value) || 12
        : parseFloat(normSummerInput.value) || 10;

    // Шаг 2: убедимся, что видео готово и имеет размеры
    if (video.videoWidth === 0 || video.videoHeight === 0) {
        rawTextDiv.textContent = 'Ошибка: камера не передаёт изображение. Перезапустите камеру.';
        captureButton.disabled = false;
        captureButton.textContent = '📸 Сфотографировать и распознать';
        return;
    }

    // Шаг 3: захват кадра через canvas
    let canvas;
    try {
        canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        rawTextDiv.textContent = '✅ Кадр захвачен. Загружаю языковой пакет...';
    } catch (e) {
        rawTextDiv.textContent = 'Ошибка при создании снимка: ' + e.message;
        captureButton.disabled = false;
        captureButton.textContent = '📸 Сфотографировать и распознать';
        return;
    }

    // Шаг 4: распознавание с таймаутом и fallback
    let text = '';
    try {
        // Пытаемся русский
        text = await recognizeWithTimeout(canvas, 'rus', 45000);
    } catch (e) {
        if (e.message === 'TIMEOUT_RUS' || e.message.includes('tesseract')) {
            rawTextDiv.textContent = '⚠ Русский пакет долго грузится, пробую английский...';
            try {
                text = await recognizeWithTimeout(canvas, 'eng', 30000);
            } catch (e2) {
                rawTextDiv.textContent = 'Ошибка при распознавании (английский): ' + e2.message;
                captureButton.disabled = false;
                captureButton.textContent = '📸 Сфотографировать и распознать';
                return;
            }
        } else {
            rawTextDiv.textContent = 'Ошибка распознавания: ' + e.message;
            captureButton.disabled = false;
            captureButton.textContent = '📸 Сфотографировать и распознать';
            return;
        }
    }

    rawTextDiv.textContent = '✅ Распознавание завершено. Обрабатываю данные...';
    calculateData(text, norm, season);

    // Восстанавливаем кнопку
    captureButton.disabled = false;
    captureButton.textContent = '📸 Сфотографировать и распознать';
}

// Вспомогательная функция распознавания с таймаутом
async function recognizeWithTimeout(image, lang, timeoutMs) {
    const worker = await Tesseract.createWorker(lang);
    rawTextDiv.textContent = `📦 Язык ${lang} загружен, распознаю...`;
    const result = await Promise.race([
        worker.recognize(image),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT_RUS')), timeoutMs)
        )
    ]);
    await worker.terminate();
    return result.data.text;
}

// =============================================
// 4. ФУНКЦИЯ ИЗВЛЕЧЕНИЯ ДАННЫХ И ПОДСЧЁТА
// =============================================
function calculateData(rawText, norm, season) {
    const пробегMatch = rawText.match(/пробег[:\s]*(\d+)/i);
    const остатокВыездMatch = rawText.match(/остаток.?при.?выезде[:\s]*(\d+)/i);
    const остатокВозвратMatch = rawText.match(/остаток.?при.?возврате[:\s]*(\d+)/i);
    const заправленоOcrMatch = rawText.match(/заправлено[:\s]*(\d+)/i);

    const пробег = пробегMatch ? parseInt(пробегMatch[1]) : 0;
    const остатокВыезд = остатокВыездMatch ? parseFloat(остатокВыездMatch[1]) : 0;
    const остатокВозврат = остатокВозвратMatch ? parseFloat(остатокВозвратMatch[1]) : 0;

    let заправлено = 0;
    const manualValue = fuelAddedManual.value.trim();
    if (manualValue !== '') {
        заправлено = parseFloat(manualValue) || 0;
    } else if (заправленоOcrMatch) {
        заправлено = parseFloat(заправленоOcrMatch[1]);
    }

    const расход = остатокВыезд + заправлено - остатокВозврат;
    const расходНа100км = пробег > 0 ? ((расход / пробег) * 100).toFixed(1) : 0;
    const нормативныйРасход = пробег > 0 ? ((пробег * norm) / 100).toFixed(1) : 0;
    const отклонение = (расход - parseFloat(нормативныйРасход)).toFixed(1);
    const сезонНазвание = season === 'winter' ? '❄️ зимняя' : '☀️ летняя';

    calculationsDiv.innerHTML = `
        <p><strong>📏 Пробег:</strong> ${пробег} км</p>
        <p><strong>⛽ Остаток при выезде:</strong> ${остатокВыезд} л</p>
        <p><strong>🛢️ Заправлено:</strong> ${заправлено} л ${manualValue !== '' ? '(вручную)' : '(из документа)'}</p>
        <p><strong>🏁 Остаток при возврате:</strong> ${остатокВозврат} л</p>
        <hr>
        <p style="font-size: 1.3em; color: #d32f2f;"><strong>Фактический расход:</strong> ${расход} л</p>
        <p><strong>📉 Факт на 100 км:</strong> ${расходНа100км} л</p>
        <hr>
        <p><strong>📊 Норма расхода (${сезонНазвание}):</strong> ${norm} л/100км</p>
        <p><strong>📌 Нормативный расход на ${пробег} км:</strong> ${нормативныйРасход} л</p>
        <p><strong>📈 Отклонение от нормы:</strong> ${отклонение} л</p>
    `;
}

// Привязка событий
startButton.addEventListener('click', startCamera);
captureButton.addEventListener('click', captureAndRecognize);
