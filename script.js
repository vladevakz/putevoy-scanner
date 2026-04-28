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
let currentTemperature = null;   // температура с API
let weatherFetchAttempted = false;

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
    return 'auto'; // по умолчанию
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
                    // Open-Meteo API (бесплатно, без ключа)
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
        // Ручной выбор – просто показываем, какой сезон принудительно
        const seasonName = mode === 'winter' ? 'Зима (вручную)' : 'Лето (вручную)';
        weatherInfoDiv.textContent = `📌 Сезон: ${seasonName}`;
        return mode;
    }

    // Автоматический режим: запрашиваем погоду
    try {
        weatherInfoDiv.textContent = '🌍 Определяем местоположение и погоду...';
        const temp = await fetchWeatherByLocation();
        currentTemperature = temp;
        weatherInfoDiv.textContent = `🌡️ Температура: ${temp}°C. Режим: ${temp < 0 ? '❄️ Зима' : '☀️ Лето'}`;
        return temp < 0 ? 'winter' : 'summer';
    } catch (err) {
        // Если не удалось – fallback на летнюю норму с уведомлением
        weatherInfoDiv.textContent = '⚠️ Погода недоступна, используется летняя норма';
        return 'summer';
    }
}

// =============================================
// 3. РАСПОЗНАВАНИЕ И РАСЧЁТ
// =============================================
async function captureAndRecognize() {
    rawTextDiv.textContent = 'Идёт распознавание...';
    calculationsDiv.textContent = '';

    // Сначала определяем сезон (и получаем погоду, если нужно)
    const season = await updateWeatherAndDetermineNorm();

    // Получаем норму из соответствующего поля
    const norm = season === 'winter'
        ? parseFloat(normWinterInput.value) || 12
        : parseFloat(normSummerInput.value) || 10;

    // Запускаем распознавание
    const worker = await Tesseract.createWorker('rus');
    const { data: { text } } = await worker.recognize(video);
    rawTextDiv.textContent = text;
    await worker.terminate();

    // Рассчитываем
    calculateData(text, norm, season);
}

// =============================================
// 4. ФУНКЦИЯ ИЗВЛЕЧЕНИЯ ДАННЫХ И ПОДСЧЁТА
// =============================================
function calculateData(rawText, norm, season) {
    // Парсим данные из текста (регулярки)
    const пробегMatch = rawText.match(/пробег[:\s]*(\d+)/i);
    const остатокВыездMatch = rawText.match(/остаток.?при.?выезде[:\s]*(\d+)/i);
    const остатокВозвратMatch = rawText.match(/остаток.?при.?возврате[:\s]*(\d+)/i);
    const заправленоOcrMatch = rawText.match(/заправлено[:\s]*(\d+)/i);

    const пробег = пробегMatch ? parseInt(пробегMatch[1]) : 0;
    const остатокВыезд = остатокВыездMatch ? parseFloat(остатокВыездMatch[1]) : 0;
    const остатокВозврат = остатокВозвратMatch ? parseFloat(остатокВозвратMatch[1]) : 0;

    // Заправка: берём из ручного поля, если заполнено; иначе – из OCR
    let заправлено = 0;
    const manualValue = fuelAddedManual.value.trim();
    if (manualValue !== '') {
        заправлено = parseFloat(manualValue) || 0;
    } else if (заправленоOcrMatch) {
        заправлено = parseFloat(заправленоOcrMatch[1]);
    }

    // Фактический расход
    const расход = остатокВыезд + заправлено - остатокВозврат;
    const расходНа100км = пробег > 0 ? ((расход / пробег) * 100).toFixed(1) : 0;

    // Нормативный расход (л) = пробег * норма / 100
    const нормативныйРасход = пробег > 0 ? ((пробег * norm) / 100).toFixed(1) : 0;
    const отклонение = (расход - parseFloat(нормативныйРасход)).toFixed(1);
    const сезонНазвание = season === 'winter' ? '❄️ зимняя' : '☀️ летняя';

    // Вывод результатов
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

// При ручном переключении радио можно сбросить погоду (необязательно)
for (const radio of seasonRadios) {
    radio.addEventListener('change', () => {
        if (radio.value !== 'auto') {
            weatherInfoDiv.textContent = '';
        }
    });
}
