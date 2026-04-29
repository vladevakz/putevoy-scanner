// ========== ЭЛЕМЕНТЫ ИНТЕРФЕЙСА ==========
const video = document.getElementById('video');
const captureButton = document.getElementById('captureButton');
const startButton = document.getElementById('startButton');
const rawTextDiv = document.getElementById('rawText');
const weatherInfoDiv = document.getElementById('weatherInfo');

// Поля ручного ввода
const startFuelInput = document.getElementById('startFuel');
const cityKmInput = document.getElementById('cityKm');
const highwayKmInput = document.getElementById('highwayKm');
const fuelAddedManual = document.getElementById('fuelAddedManual');
const normSummerInput = document.getElementById('normSummer');
const normWinterInput = document.getElementById('normWinter');
const seasonRadios = document.getElementsByName('season');

// Модальные окна
const resultModal = document.getElementById('resultModal');
const closeResultModal = document.getElementById('closeResultModal');
const closeResultBtn = document.getElementById('closeResultBtn');
const saveToHistoryBtn = document.getElementById('saveToHistoryBtn');
const modalCalculations = document.getElementById('modalCalculations');

const historyModal = document.getElementById('historyModal');
const closeHistoryModal = document.getElementById('closeHistoryModal');
const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');

// Текущие данные для сохранения
let currentResultData = null;

// ========== ВОССТАНОВЛЕНИЕ НОРМ И ОСТАТКА ПРИ ЗАГРУЗКЕ ==========
window.addEventListener('DOMContentLoaded', () => {
    // Нормы
    const savedSummer = localStorage.getItem('normSummer');
    const savedWinter = localStorage.getItem('normWinter');
    if (savedSummer !== null) normSummerInput.value = savedSummer;
    if (savedWinter !== null) normWinterInput.value = savedWinter;

    // Остаток при выезде из последней записи истории
    const history = getHistory();
    if (history.length > 0) {
        // Сортируем по timestamp (последняя запись)
        history.sort((a, b) => b.timestamp - a.timestamp);
        const last = history[0];
        if (last.остатокВозврат !== undefined) {
            startFuelInput.value = last.остатокВозврат;
        }
    }
});

// Сохранение норм при изменении
normSummerInput.addEventListener('input', () => {
    localStorage.setItem('normSummer', normSummerInput.value);
});
normWinterInput.addEventListener('input', () => {
    localStorage.setItem('normWinter', normWinterInput.value);
});

// ========== ЗАПУСК КАМЕРЫ ==========
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
        });
        video.srcObject = stream;
        await new Promise(res => { video.onloadedmetadata = res; });
        captureButton.disabled = false;
    } catch (err) {
        alert('Не удалось запустить камеру: ' + err.message);
    }
}

// ========== ПОГОДА (с таймаутом) ==========
function getSelectedSeasonMode() {
    for (const radio of seasonRadios) {
        if (radio.checked) return radio.value;
    }
    return 'auto';
}

function fetchWeatherWithTimeout(timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
            if (!settled) {
                settled = true;
                reject(new Error('Превышено время ожидания геолокации'));
            }
        }, timeoutMs);

        fetchWeatherByLocation()
            .then(temp => {
                if (!settled) { settled = true; clearTimeout(timer); resolve(temp); }
            })
            .catch(err => {
                if (!settled) { settled = true; clearTimeout(timer); reject(err); }
            });
    });
}

function fetchWeatherByLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Геолокация не поддерживается'));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const lat = pos.coords.latitude;
                const lon = pos.coords.longitude;
                try {
                    const resp = await fetch(
                        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
                    );
                    const data = await resp.json();
                    resolve(data.current_weather.temperature);
                } catch (err) {
                    reject(new Error('Ошибка получения погоды: ' + err.message));
                }
            },
            (err) => reject(new Error('Доступ к геолокации запрещён: ' + err.message)),
            { timeout: 5000 }
        );
    });
}

async function updateWeatherAndDetermineNorm() {
    const mode = getSelectedSeasonMode();
    weatherInfoDiv.textContent = '';

    if (mode !== 'auto') {
        weatherInfoDiv.textContent = `📌 Сезон: ${mode === 'winter' ? 'Зима (вручную)' : 'Лето (вручную)'}`;
        return mode;
    }

    try {
        weatherInfoDiv.textContent = '🌍 Определяем местоположение и погоду...';
        const temp = await fetchWeatherWithTimeout(8000);
        weatherInfoDiv.textContent = `🌡️ Температура: ${temp}°C. Режим: ${temp < 0 ? '❄️ Зима' : '☀️ Лето'}`;
        return temp < 0 ? 'winter' : 'summer';
    } catch (err) {
        weatherInfoDiv.textContent = '⚠️ Погода недоступна, используется летняя норма';
        return 'summer';
    }
}

// ========== ПРЕДОБРАБОТКА ИЗОБРАЖЕНИЯ ==========
function preprocessCanvas(source) {
    const scale = 1500 / source.width;
    const width = 1500;
    const height = Math.floor(source.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(source, 0, 0, width, height);

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
        const val = gray > 127 ? 255 : 0;
        data[i] = data[i + 1] = data[i + 2] = val;
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

// ========== РАСПОЗНАВАНИЕ ==========
async function captureAndRecognize() {
    captureButton.disabled = true;
    captureButton.textContent = '⏳ Идёт процесс...';

    // 1. Погода
    rawTextDiv.textContent = '🌤 Определяю погоду...';
    const season = await updateWeatherAndDetermineNorm();
    const norm = season === 'winter' ? parseFloat(normWinterInput.value) || 12 : parseFloat(normSummerInput.value) || 10;

    // 2. Проверка камеры
    if (video.videoWidth === 0 || video.videoHeight === 0) {
        rawTextDiv.textContent = 'Ошибка: камера не передаёт изображение.';
        captureButton.disabled = false;
        captureButton.textContent = '📸 Сфотографировать и распознать';
        return;
    }

    // 3. Захват кадра
    rawTextDiv.textContent = '⏱ Захват кадра...';
    let srcCanvas;
    try {
        srcCanvas = document.createElement('canvas');
        srcCanvas.width = video.videoWidth;
        srcCanvas.height = video.videoHeight;
        srcCanvas.getContext('2d').drawImage(video, 0, 0);
        rawTextDiv.textContent = '✅ Кадр захвачен. Улучшаю качество...';
    } catch (e) {
        rawTextDiv.textContent = 'Ошибка захвата: ' + e.message;
        captureButton.disabled = false;
        captureButton.textContent = '📸 Сфотографировать и распознать';
        return;
    }

    // 4. Предобработка
    let processed;
    try { processed = preprocessCanvas(srcCanvas); } catch (e) { processed = srcCanvas; }

    // 5. Распознавание
    rawTextDiv.textContent = '📦 Загружаю языковой пакет (rus+eng)...';
    let text = '';
    try {
        text = await recognizeWithLang(processed, 'rus+eng', 45000);
    } catch (e) {
        if (e.message === 'TIMEOUT' || e.message.includes('tesseract')) {
            rawTextDiv.textContent = '⚠ Русский пакет долго грузится, пробую английский...';
            try { text = await recognizeWithLang(srcCanvas, 'eng', 30000); } catch (e2) {
                rawTextDiv.textContent = 'Ошибка распознавания (англ): ' + e2.message;
                captureButton.disabled = false;
                captureButton.textContent = '📸 Сфотографировать и распознать';
                return;
            }
        } else {
            rawTextDiv.textContent = 'Ошибка: ' + e.message;
            captureButton.disabled = false;
            captureButton.textContent = '📸 Сфотографировать и распознать';
            return;
        }
    }

    // 6. Расчёт
    rawTextDiv.textContent = '✅ Распознано. Открываю результаты...';
    const data = extractDataFromText(text, norm, season);
    openResultModal(data);

    captureButton.disabled = false;
    captureButton.textContent = '📸 Сфотографировать и распознать';
}

async function recognizeWithLang(image, lang, timeoutMs) {
    const worker = await Tesseract.createWorker(lang);
    await worker.setParameters({
        tessedit_pageseg_mode: '6',
        preserve_interword_spaces: '1',
    });
    rawTextDiv.textContent = `📦 Язык ${lang} загружен, распознаю...`;
    const result = await Promise.race([
        worker.recognize(image),
        new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs))
    ]);
    await worker.terminate();
    return result.data.text;
}

// ========== ИЗВЛЕЧЕНИЕ ДАННЫХ И ВЫЧИСЛЕНИЯ ==========
function getLastHistoryReturnFuel() {
    const history = getHistory();
    if (history.length === 0) return { value: 0, source: 'нет истории' };
    history.sort((a, b) => b.timestamp - a.timestamp);
    const last = history[0];
    const val = last.остатокВозврат !== undefined ? parseFloat(last.остатокВозврат) : 0;
    return { value: val, source: 'из истории (' + last.date + ')' };
}

function extractDataFromText(rawText, norm, season) {
    // --- Остаток при выезде ---
    const startFuelManual = startFuelInput.value.trim();
    let остатокВыезд, startFuelSource;

    if (startFuelManual !== '') {
        остатокВыезд = parseFloat(startFuelManual) || 0;
        startFuelSource = '(вручную)';
    } else {
        const ocrMatch = rawText.match(/остаток.?при.?выезде[:\s]*(\d+)/i);
        if (ocrMatch) {
            остатокВыезд = parseFloat(ocrMatch[1]);
            startFuelSource = '(из документа)';
        } else {
            const hist = getLastHistoryReturnFuel();
            остатокВыезд = hist.value;
            startFuelSource = '(из истории)';
        }
    }

    // --- Пробег ---
    const cityKm = parseFloat(cityKmInput.value) || 0;
    const highwayKm = parseFloat(highwayKmInput.value) || 0;
    const пробегOcrMatch = rawText.match(/пробег[:\s]*(\d+)/i);

    let пробег, пробегИсточник;
    if (cityKm > 0 || highwayKm > 0) {
        пробег = cityKm + highwayKm;
        пробегИсточник = `(город ${cityKm.toFixed(1)} + трасса ${highwayKm.toFixed(1)})`;
    } else if (пробегOcrMatch) {
        пробег = parseInt(пробегOcrMatch[1]);
        пробегИсточник = '(из документа)';
    } else {
        пробег = 0;
        пробегИсточник = '(не указан)';
    }

    // --- Заправка ---
    const manualFuel = fuelAddedManual.value.trim();
    const заправленоOcrMatch = rawText.match(/заправлено[:\s]*(\d+)/i);
    let заправлено, заправкаИсточник;

    if (manualFuel !== '') {
        заправлено = parseFloat(manualFuel) || 0;
        заправкаИсточник = '(вручную)';
    } else if (заправленоOcrMatch) {
        заправлено = parseFloat(заправленоOcrMatch[1]);
        заправкаИсточник = '(из документа)';
    } else {
        заправлено = 0;
        заправкаИсточник = '(0)';
    }

    // --- Остаток при возврате (OCR) ---
    const ocrReturnMatch = rawText.match(/остаток.?при.?возврате[:\s]*(\d+)/i);
    const остатокВозврат = ocrReturnMatch ? parseFloat(ocrReturnMatch[1]) : 0;

    // --- Вычисления с округлением до 2 знаков ---
    const расход = остатокВыезд + заправлено - остатокВозврат;
    const расходFixed = расход.toFixed(2);
    const расходНа100км = пробег > 0 ? ((расход / пробег) * 100).toFixed(2) : '0.00';
    const нормативныйРасход = пробег > 0 ? ((пробег * norm) / 100).toFixed(2) : '0.00';
    const отклонение = пробег > 0 ? (расход - parseFloat(нормативныйРасход)).toFixed(2) : '0.00';
    const сезонНазвание = season === 'winter' ? '❄️ зимняя' : '☀️ летняя';

    // Дата
    const dateMatch = rawText.match(/(\d{2}[.\/-]\d{2}[.\/-]\d{2,4})/);
    let dateStr = dateMatch ? dateMatch[1] : null;
    let isoDate = '';
    if (dateStr) {
        const parts = dateStr.split(/[.\/-]/);
        if (parts.length === 3) {
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
            isoDate = `${year}-${month}-${day}`;
        }
    }
    if (!isoDate) {
        const today = new Date();
        isoDate = today.toISOString().split('T')[0];
    }

    return {
        rawText,
        остатокВыезд, startFuelSource,
        пробег, пробегИсточник,
        заправлено, заправкаИсточник,
        остатокВозврат,
        расход: расходFixed, расходНа100км, нормативныйРасход, отклонение,
        norm, season, сезонНазвание,
        isoDate, dateStr,
        cityKm, highwayKm
    };
}

// ========== МОДАЛЬНОЕ ОКНО РЕЗУЛЬТАТОВ ==========
function openResultModal(data) {
    currentResultData = data;

    modalCalculations.innerHTML = `
        <p><strong>📅 Дата:</strong> ${data.isoDate}</p>
        <p><strong>⛽ Остаток при выезде:</strong> ${data.остатокВыезд.toFixed(2)} л ${data.startFuelSource}</p>
        <p><strong>📏 Пробег общий:</strong> ${data.пробег.toFixed(2)} км ${data.пробегИсточник}</p>
        <p><strong>🛢️ Заправлено:</strong> ${data.заправлено.toFixed(2)} л ${data.заправкаИсточник}</p>
        <p><strong>🏁 Остаток при возврате:</strong> ${data.остатокВозврат.toFixed(2)} л</p>
        <hr>
        <p style="font-size: 1.3em; color: #d32f2f;"><strong>Фактический расход:</strong> ${data.расход} л</p>
        <p><strong>📉 Факт на 100 км:</strong> ${data.расходНа100км} л</p>
        <hr>
        <p><strong>📊 Норма расхода (${data.сезонНазвание}):</strong> ${data.norm} л/100км</p>
        <p><strong>📌 Нормативный расход на ${data.пробег.toFixed(2)} км:</strong> ${data.нормативныйРасход} л</p>
        <p><strong>📈 Отклонение от нормы:</strong> ${data.отклонение} л</p>
    `;

    resultModal.style.display = 'flex';
}

function closeResultModalHandler() {
    resultModal.style.display = 'none';
    currentResultData = null;
}
closeResultModal.addEventListener('click', closeResultModalHandler);
closeResultBtn.addEventListener('click', closeResultModalHandler);
window.addEventListener('click', (e) => {
    if (e.target === resultModal) closeResultModalHandler();
});

// ========== СОХРАНЕНИЕ В ИСТОРИЮ ==========
function getHistory() {
    const raw = localStorage.getItem('putevoyHistory');
    return raw ? JSON.parse(raw) : [];
}

function saveToHistory(entry) {
    const history = getHistory();
    history.push(entry);
    localStorage.setItem('putevoyHistory', JSON.stringify(history));
}

saveToHistoryBtn.addEventListener('click', () => {
    if (!currentResultData) return;
    const entry = {
        date: currentResultData.isoDate,
        остатокВыезд: currentResultData.остатокВыезд.toFixed(2),
        пробег: currentResultData.пробег.toFixed(2),
        заправлено: currentResultData.заправлено.toFixed(2),
        остатокВозврат: currentResultData.остатокВозврат.toFixed(2),
        расход: currentResultData.расход,
        расходНа100км: currentResultData.расходНа100км,
        норма: currentResultData.norm,
        сезон: currentResultData.season,
        timestamp: Date.now(),
        cityKm: currentResultData.cityKm,
        highwayKm: currentResultData.highwayKm,
    };
    saveToHistory(entry);
    alert('✅ Сохранено!');
});

// ========== МОДАЛЬНОЕ ОКНО ИСТОРИИ ==========
function renderHistory() {
    const history = getHistory();
    if (history.length === 0) {
        historyList.innerHTML = '<p>История пуста.</p>';
        return;
    }
    history.sort((a, b) => b.timestamp - a.timestamp);
    let html = '<table><thead><tr><th>Дата</th><th>Выезд</th><th>Пробег</th><th>Расход общ.</th><th>Расход/100км</th><th>Норма</th><th>Сезон</th><th></th></tr></thead><tbody>';
    history.forEach((entry, index) => {
        const probegStr = (entry.cityKm || entry.highwayKm)
            ? `${entry.пробег} (г${entry.cityKm?.toFixed(1)||0}+т${entry.highwayKm?.toFixed(1)||0})`
            : `${entry.пробег}`;
        html += `<tr>
            <td>${entry.date}</td>
            <td>${entry.остатокВыезд} л</td>
            <td>${probegStr} км</td>
            <td>${entry.расход} л</td>
            <td>${entry.расходНа100км} л</td>
            <td>${entry.норма} л</td>
            <td>${entry.сезон === 'winter' ? '❄️' : '☀️'}</td>
            <td><button class="delete-entry" data-index="${index}">🗑</button></td>
        </tr>`;
    });
    html += '</tbody></table>';
    historyList.innerHTML = html;

    document.querySelectorAll('.delete-entry').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.getAttribute('data-index'));
            deleteHistoryEntry(idx);
        });
    });
}

function deleteHistoryEntry(index) {
    const history = getHistory();
    history.sort((a, b) => b.timestamp - a.timestamp);
    history.splice(index, 1);
    localStorage.setItem('putevoyHistory', JSON.stringify(history));
    renderHistory();
}

clearHistoryBtn.addEventListener('click', () => {
    if (confirm('Удалить всю историю?')) {
        localStorage.removeItem('putevoyHistory');
        renderHistory();
    }
});

document.getElementById('historyButton').addEventListener('click', () => {
    renderHistory();
    historyModal.style.display = 'flex';
});

closeHistoryModal.addEventListener('click', () => {
    historyModal.style.display = 'none';
});
window.addEventListener('click', (e) => {
    if (e.target === historyModal) historyModal.style.display = 'none';
});

// ========== СТАРТ ==========
startButton.addEventListener('click', startCamera);
captureButton.addEventListener('click', captureAndRecognize);
