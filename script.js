// ========== ЭЛЕМЕНТЫ ИНТЕРФЕЙСА ==========
const video = document.getElementById('video');
const captureButton = document.getElementById('captureButton');
const startButton = document.getElementById('startButton');
const rawTextDiv = document.getElementById('rawText');
const weatherInfoDiv = document.getElementById('weatherInfo');

// Поля ввода
const startFuelInput = document.getElementById('startFuel');
const startFuelHint = document.getElementById('startFuelHint');
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

let currentResultData = null;

// ========== БЕЗОПАСНАЯ РАБОТА С LOCALSTORAGE ==========
function getHistory() {
    try {
        const raw = localStorage.getItem('putevoyHistory');
        if (!raw) return [];
        const data = JSON.parse(raw);
        // Фильтруем только валидные записи (объекты с датой и числовыми полями)
        return Array.isArray(data) ? data.filter(entry => {
            return entry && typeof entry.date === 'string' && !isNaN(parseFloat(entry.остатокВозврат));
        }) : [];
    } catch (e) {
        console.warn('Ошибка чтения истории, сбрасываем', e);
        localStorage.removeItem('putevoyHistory');
        return [];
    }
}

function saveHistory(historyArray) {
    try {
        localStorage.setItem('putevoyHistory', JSON.stringify(historyArray));
    } catch (e) {
        alert('Не удалось сохранить историю: возможно, переполнено хранилище. Попробуйте удалить старые записи.');
        console.error(e);
    }
}

// ========== ВОССТАНОВЛЕНИЕ ПРИ ЗАГРУЗКЕ ==========
window.addEventListener('DOMContentLoaded', () => {
    // Нормы
    try {
        const savedSummer = localStorage.getItem('normSummer');
        const savedWinter = localStorage.getItem('normWinter');
        if (savedSummer !== null) normSummerInput.value = savedSummer;
        if (savedWinter !== null) normWinterInput.value = savedWinter;
    } catch (e) {}

    // Остаток при выезде
    safeUpdateStartFuelFromHistory();
    updateStartFuelHint();
});

normSummerInput.addEventListener('input', () => {
    try { localStorage.setItem('normSummer', normSummerInput.value); } catch (e) {}
});
normWinterInput.addEventListener('input', () => {
    try { localStorage.setItem('normWinter', normWinterInput.value); } catch (e) {}
});

startFuelInput.addEventListener('input', updateStartFuelHint);

function safeUpdateStartFuelFromHistory() {
    try {
        const history = getHistory();
        if (history.length === 0) {
            startFuelInput.value = '';
            return;
        }
        // Последняя запись
        history.sort((a, b) => b.timestamp - a.timestamp);
        const last = history[0];
        const returnFuel = parseFloat(last.остатокВозврат);
        if (!isNaN(returnFuel)) {
            startFuelInput.value = returnFuel.toFixed(2);
        } else {
            startFuelInput.value = '';
        }
    } catch (e) {
        startFuelInput.value = '';
    }
}

function updateStartFuelHint() {
    const manualValue = startFuelInput.value.trim();
    if (manualValue !== '') {
        const val = parseFloat(manualValue);
        if (isNaN(val)) {
            startFuelHint.textContent = 'Введите число';
            return;
        }
        // Проверим, совпадает ли с историческим значением
        try {
            const history = getHistory();
            if (history.length > 0) {
                history.sort((a, b) => b.timestamp - a.timestamp);
                const last = history[0];
                const lastReturn = parseFloat(last.остатокВозврат);
                if (!isNaN(lastReturn) && Math.abs(lastReturn - val) < 0.01) {
                    startFuelHint.textContent = `Из истории (${last.date})`;
                    return;
                }
            }
        } catch (e) {}
        startFuelHint.textContent = 'Вручную';
    } else {
        // Поле пустое – посмотрим, что подставится при расчёте
        try {
            const history = getHistory();
            if (history.length > 0) {
                history.sort((a, b) => b.timestamp - a.timestamp);
                const last = history[0];
                const lastReturn = parseFloat(last.остатокВозврат);
                if (!isNaN(lastReturn) && lastReturn > 0) {
                    startFuelHint.textContent = `Будет взято из истории (${last.date})`;
                    return;
                }
            }
        } catch (e) {}
        startFuelHint.textContent = 'Заполнится из истории';
    }
}

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
                try {
                    const resp = await fetch(
                        `https://api.open-meteo.com/v1/forecast?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&current_weather=true`
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
    const canvas = document.createElement('canvas');
    canvas.width = 1500;
    canvas.height = Math.floor(source.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
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
    // Защита от двойного нажатия
    if (captureButton.disabled) return;
    captureButton.disabled = true;
    captureButton.textContent = '⏳ Идёт процесс...';

    try {
        // 1. Погода
        rawTextDiv.textContent = '🌤 Определяю погоду...';
        const season = await updateWeatherAndDetermineNorm();
        const norm = season === 'winter' ? parseFloat(normWinterInput.value) || 12 : parseFloat(normSummerInput.value) || 10;

        // 2. Камера
        if (video.videoWidth === 0 || video.videoHeight === 0) {
            throw new Error('Камера не передаёт изображение. Перезапустите камеру.');
        }

        // 3. Захват кадра
        rawTextDiv.textContent = '⏱ Захват кадра...';
        const srcCanvas = document.createElement('canvas');
        srcCanvas.width = video.videoWidth;
        srcCanvas.height = video.videoHeight;
        srcCanvas.getContext('2d').drawImage(video, 0, 0);
        rawTextDiv.textContent = '✅ Кадр захвачен. Улучшаю качество...';

        // 4. Предобработка
        let processed;
        try { processed = preprocessCanvas(srcCanvas); } catch (e) { processed = srcCanvas; }

        // 5. Распознавание
        rawTextDiv.textContent = '📦 Загружаю языковой пакет...';
        let text;
        try {
            text = await recognizeWithLang(processed, 'rus+eng', 45000);
        } catch (e) {
            if (e.message === 'TIMEOUT') {
                rawTextDiv.textContent = '⚠ Русский пакет не загрузился, пробую английский...';
                text = await recognizeWithLang(srcCanvas, 'eng', 30000);
            } else {
                throw e;
            }
        }

        rawTextDiv.textContent = '✅ Распознано. Открываю результаты...';
        const data = extractDataFromText(text, norm, season);
        openResultModal(data);

    } catch (err) {
        console.error(err);
        rawTextDiv.textContent = 'Ошибка: ' + err.message;
    } finally {
        captureButton.disabled = false;
        captureButton.textContent = '📸 Сфотографировать и распознать';
    }
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
    const val = parseFloat(last.остатокВозврат);
    if (!isNaN(val)) {
        return { value: val, source: `из истории (${last.date})` };
    }
    return { value: 0, source: 'история повреждена' };
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
            startFuelSource = hist.source;
        }
    }

    // --- Пробег ---
    const cityKm = parseFloat(cityKmInput.value) || 0;
    const highwayKm = parseFloat(highwayKmInput.value) || 0;
    let пробег, пробегИсточник;
    if (cityKm > 0 || highwayKm > 0) {
        пробег = cityKm + highwayKm;
        пробегИсточник = `(город ${cityKm.toFixed(1)} + трасса ${highwayKm.toFixed(1)})`;
    } else {
        const ocrПробег = rawText.match(/пробег[:\s]*(\d+)/i);
        пробег = ocrПробег ? parseInt(ocrПробег[1]) : 0;
        пробегИсточник = ocrПробег ? '(из документа)' : '(не указан)';
    }

    // --- Заправка ---
    const manualFuel = fuelAddedManual.value.trim();
    let заправлено, заправкаИсточник;
    if (manualFuel !== '') {
        заправлено = parseFloat(manualFuel) || 0;
        заправкаИсточник = '(вручную)';
    } else {
        const ocrFuel = rawText.match(/заправлено[:\s]*(\d+)/i);
        заправлено = ocrFuel ? parseFloat(ocrFuel[1]) : 0;
        заправкаИсточник = ocrFuel ? '(из документа)' : '(0)';
    }

    // --- Остаток при возврате ---
    const ocrReturn = rawText.match(/остаток.?при.?возврате[:\s]*(\d+)/i);
    const остатокВозврат = ocrReturn ? parseFloat(ocrReturn[1]) : 0;

    // --- Расчёт ---
    const расход = остатокВыезд + заправлено - остатокВозврат;
    const расходFixed = расход.toFixed(2);
    const расходНа100км = пробег > 0 ? ((расход / пробег) * 100).toFixed(2) : '0.00';
    const нормативныйРасход = пробег > 0 ? ((пробег * norm) / 100).toFixed(2) : '0.00';
    const отклонение = пробег > 0 ? (расход - parseFloat(нормативныйРасход)).toFixed(2) : '0.00';
    const сезонНазвание = season === 'winter' ? '❄️ зимняя' : '☀️ летняя';

    // Дата
    const dateMatch = rawText.match(/(\d{2}[.\/-]\d{2}[.\/-]\d{2,4})/);
    let isoDate = new Date().toISOString().split('T')[0];
    if (dateMatch) {
        const parts = dateMatch[1].split(/[.\/-]/);
        if (parts.length === 3) {
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
            isoDate = `${year}-${month}-${day}`;
        }
    }

    return {
        rawText,
        остатокВыезд, startFuelSource,
        пробег, пробегИсточник,
        заправлено, заправкаИсточник,
        остатокВозврат,
        расход: расходFixed, расходНа100км, нормативныйРасход, отклонение,
        norm, season, сезонНазвание,
        isoDate,
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

    const history = getHistory();
    history.push(entry);
    saveHistory(history);
    alert('✅ Сохранено!');
    // Автоматически обновляем поле остатка при выезде для следующего ввода
    safeUpdateStartFuelFromHistory();
    updateStartFuelHint();
});

// ========== МОДАЛЬНОЕ ОКНО ИСТОРИИ ==========
function renderHistory() {
    const history = getHistory();
    if (history.length === 0) {
        historyList.innerHTML = '<p>История пуста.</p>';
        return;
    }
    history.sort((a, b) => b.timestamp - a.timestamp);
    let html = '<table><thead><tr><th>Дата</th><th>Выезд</th><th>Пробег</th><th>Расход</th><th>Норма</th><th>Сезон</th><th></th></tr></thead><tbody>';
    history.forEach((entry, index) => {
        const probegStr = (entry.cityKm || entry.highwayKm)
            ? `${entry.пробег} (г${entry.cityKm?.toFixed(1)||0}+т${entry.highwayKm?.toFixed(1)||0})`
            : entry.пробег;
        html += `<tr>
            <td>${entry.date}</td>
            <td>${entry.остатокВыезд} л</td>
            <td>${probegStr} км</td>
            <td>${entry.расход} л</td>
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
    saveHistory(history);
    renderHistory();
}

clearHistoryBtn.addEventListener('click', () => {
    if (confirm('Удалить всю историю?')) {
        localStorage.removeItem('putevoyHistory');
        renderHistory();
        // Очищаем поле остатка
        startFuelInput.value = '';
        updateStartFuelHint();
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
