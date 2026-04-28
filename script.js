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

// Глобальные переменные для погоды
let currentTemperature = null;

// =============================================
// 1. ЗАПУСК КАМЕРЫ
// =============================================
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
        });
        video.srcObject = stream;
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
        currentTemperature = temp;
        weatherInfoDiv.textContent = `🌡️ Температура: ${temp}°C. Режим: ${temp < 0 ? '❄️ Зима' : '☀️ Лето'}`;
        return temp < 0 ? 'winter' : 'summer';
    } catch (err) {
        weatherInfoDiv.textContent = '⚠️ Погода недоступна, используется летняя норма';
        return 'summer';
    }
}

// =============================================
// 3. РАСПОЗНАВАНИЕ И РАСЧЁТ (улучшено для телефона)
// =============================================
async function captureAndRecognize() {
    // Меняем текст кнопки, чтобы было видно, что пошёл процесс
    captureButton.disabled = true;
    captureButton.textContent = '⏳ Распознаю...';
    rawTextDiv.textContent = 'Идёт распознавание. Пожалуйста, держите телефон неподвижно...';
    calculationsDiv.textContent = '';

    const season = await updateWeatherAndDetermineNorm();
    const norm = season === 'winter'
        ? parseFloat(normWinterInput.value) || 12
        : parseFloat(normSummerInput.value) || 10;

    try {
        // === Захват кадра через canvas (самый надёжный способ на мобильных) ===
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Пробуем русский, если долго – переключаем на английский
        let text = '';
        try {
            const worker = await Tesseract.createWorker('rus');
            const result = await Promise.race([
                worker.recognize(canvas),
                new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_RUS')), 45000))
            ]);
            text = result.data.text;
            await worker.terminate();
        } catch (e) {
            if (e.message === 'TIMEOUT_RUS') {
                rawTextDiv.textContent = 'Русский язык долго загружается, пробую английский...';
                const worker = await Tesseract.createWorker('eng');
                const result = await worker.recognize(canvas);
                text = result.data.text;
                await worker.terminate();
            } else {
                throw e;
            }
        }

        rawTextDiv.textContent = text;
        calculateData(text, norm, season);

    } catch (err) {
        console.error(err);
        rawTextDiv.textContent = 'Ошибка: ' + err.message;
        calculationsDiv.textContent = 'Попробуйте ещё раз. Если ошибка повторяется, проверьте доступ к интернету (для первой загрузки языкового пакета).';
    } finally {
        captureButton.disabled = false;
        captureButton.textContent = '📸 Сфотографировать и распознать';
    }
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
