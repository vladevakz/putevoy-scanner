// ========== ЭЛЕМЕНТЫ ==========
const video = document.getElementById('video');
const captureButton = document.getElementById('captureButton');
const startButton = document.getElementById('startButton');
const rawTextDiv = document.getElementById('rawText');
const weatherInfoDiv = document.getElementById('weatherInfo');

const startFuelInput = document.getElementById('startFuel');
const startFuelHint = document.getElementById('startFuelHint');
const endFuelInput = document.getElementById('endFuel');
const cityKmInput = document.getElementById('cityKm');
const highwayKmInput = document.getElementById('highwayKm');
const fuelAddedManual = document.getElementById('fuelAddedManual');

const normCitySummerInput = document.getElementById('normCitySummer');
const normCityWinterInput = document.getElementById('normCityWinter');
const normHwySummerInput = document.getElementById('normHwySummer');
const normHwyWinterInput = document.getElementById('normHwyWinter');
const seasonRadios = document.getElementsByName('season');

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

// ========== LOCALSTORAGE ИСТОРИЯ ==========
function getHistory() {
    try {
        const raw = localStorage.getItem('putevoyHistory');
        if (!raw) return [];
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data.filter(e => e && typeof e.date === 'string' && !isNaN(parseFloat(e.остатокВозврат))) : [];
    } catch (e) {
        localStorage.removeItem('putevoyHistory');
        return [];
    }
}

function saveHistory(arr) {
    try { localStorage.setItem('putevoyHistory', JSON.stringify(arr)); } catch (e) { alert('Хранилище переполнено'); }
}

// ========== ЗАГРУЗКА НОРМ И ОСТАТКА ==========
window.addEventListener('DOMContentLoaded', () => {
    // Восстановление норм
    const keys = ['normCitySummer','normCityWinter','normHwySummer','normHwyWinter'];
    const inputs = [normCitySummerInput, normCityWinterInput, normHwySummerInput, normHwyWinterInput];
    keys.forEach((key, i) => {
        const saved = localStorage.getItem(key);
        if (saved !== null) inputs[i].value = saved;
    });

    // Остаток при выезде из истории
    safeUpdateStartFuelFromHistory();
    updateStartFuelHint();
});

// Автосохранение норм при изменении
[normCitySummerInput, normCityWinterInput, normHwySummerInput, normHwyWinterInput].forEach((inp, i) => {
    const keys = ['normCitySummer','normCityWinter','normHwySummer','normHwyWinter'];
    inp.addEventListener('input', () => {
        try { localStorage.setItem(keys[i], inp.value); } catch (e) {}
    });
});

startFuelInput.addEventListener('input', updateStartFuelHint);

function safeUpdateStartFuelFromHistory() {
    const history = getHistory();
    if (history.length === 0) { startFuelInput.value = ''; return; }
    history.sort((a,b) => b.timestamp - a.timestamp);
    const last = history[0];
    const val = parseFloat(last.остатокВозврат);
    startFuelInput.value = !isNaN(val) ? val.toFixed(2) : '';
}

function updateStartFuelHint() {
    const manual = startFuelInput.value.trim();
    if (manual !== '') {
        const val = parseFloat(manual);
        if (isNaN(val)) { startFuelHint.textContent = 'Введите число'; return; }
        const history = getHistory();
        if (history.length) {
            history.sort((a,b) => b.timestamp - a.timestamp);
            const last = history[0];
            if (Math.abs(parseFloat(last.остатокВозврат) - val) < 0.01)
                { startFuelHint.textContent = `Из истории (${last.date})`; return; }
        }
        startFuelHint.textContent = 'Вручную';
    } else {
        const history = getHistory();
        if (history.length) {
            history.sort((a,b) => b.timestamp - a.timestamp);
            const last = history[0];
            const lastVal = parseFloat(last.остатокВозврат);
            if (!isNaN(lastVal) && lastVal > 0)
                { startFuelHint.textContent = `Будет взято из истории (${last.date})`; return; }
        }
        startFuelHint.textContent = 'Заполнится из истории';
    }
}

// ========== КАМЕРА ==========
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        video.srcObject = stream;
        await new Promise(r => { video.onloadedmetadata = r; });
        captureButton.disabled = false;
    } catch (err) { alert('Ошибка камеры: ' + err.message); }
}

// ========== ПОГОДА ==========
function getSelectedSeasonMode() {
    for (const radio of seasonRadios) if (radio.checked) return radio.value;
    return 'auto';
}

function fetchWeatherWithTimeout(ms=8000) {
    return new Promise((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => { if (!settled) { settled = true; reject(new Error('Таймаут геолокации')); } }, ms);
        fetchWeatherByLocation()
            .then(t => { if (!settled) { settled = true; clearTimeout(timer); resolve(t); } })
            .catch(err => { if (!settled) { settled = true; clearTimeout(timer); reject(err); } });
    });
}

function fetchWeatherByLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error('Нет геолокации'));
        navigator.geolocation.getCurrentPosition(
            async pos => {
                try {
                    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&current_weather=true`);
                    const data = await res.json();
                    resolve(data.current_weather.temperature);
                } catch (e) { reject(e); }
            },
            e => reject(e),
            { timeout: 5000 }
        );
    });
}

async function getSeasonAndNorms() {
    const mode = getSelectedSeasonMode();
    weatherInfoDiv.textContent = '';

    let season;
    if (mode !== 'auto') {
        season = mode;
        weatherInfoDiv.textContent = `📌 Сезон: ${mode === 'winter' ? 'Зима (вручную)' : 'Лето (вручную)'}`;
    } else {
        try {
            weatherInfoDiv.textContent = '🌍 Определяю погоду...';
            const temp = await fetchWeatherWithTimeout(8000);
            season = temp < 0 ? 'winter' : 'summer';
            weatherInfoDiv.textContent = `🌡️ Температура: ${temp}°C. Режим: ${season === 'winter' ? '❄️ Зима' : '☀️ Лето'}`;
        } catch (err) {
            weatherInfoDiv.textContent = '⚠️ Погода недоступна, взято лето';
            season = 'summer';
        }
    }

    const normCity = season === 'winter' ? parseFloat(normCityWinterInput.value) || 13 : parseFloat(normCitySummerInput.value) || 11;
    const normHwy = season === 'winter' ? parseFloat(normHwyWinterInput.value) || 11 : parseFloat(normHwySummerInput.value) || 9;
    return { season, normCity, normHwy };
}

// ========== ПРЕДОБРАБОТКА ==========
function preprocessCanvas(source) {
    const scale = 1500 / source.width;
    const canvas = document.createElement('canvas');
    canvas.width = 1500;
    canvas.height = Math.floor(source.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
        const gray = (data[i] + data[i+1] + data[i+2]) / 3;
        const val = gray > 127 ? 255 : 0;
        data[i] = data[i+1] = data[i+2] = val;
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas;
}

// ========== РАСПОЗНАВАНИЕ ==========
async function captureAndRecognize() {
    if (captureButton.disabled) return;
    captureButton.disabled = true;
    captureButton.textContent = '⏳ Идёт процесс...';

    try {
        // Сезон и нормы
        rawTextDiv.textContent = '🌤 Определяю погоду...';
        const { season, normCity, normHwy } = await getSeasonAndNorms();

        if (video.videoWidth === 0 || video.videoHeight === 0) throw new Error('Камера не готова');

        rawTextDiv.textContent = '⏱ Захват кадра...';
        const srcCanvas = document.createElement('canvas');
        srcCanvas.width = video.videoWidth;
        srcCanvas.height = video.videoHeight;
        srcCanvas.getContext('2d').drawImage(video, 0, 0);
        rawTextDiv.textContent = '✅ Кадр захвачен. Улучшаю...';

        let processed;
        try { processed = preprocessCanvas(srcCanvas); } catch (e) { processed = srcCanvas; }

        rawTextDiv.textContent = '📦 Загружаю языковой пакет...';
        let text;
        try {
            text = await recognizeWithLang(processed, 'rus+eng', 45000);
        } catch (e) {
            if (e.message === 'TIMEOUT') {
                rawTextDiv.textContent = '⚠️ Русский не загрузился, английский...';
                text = await recognizeWithLang(srcCanvas, 'eng', 30000);
            } else throw e;
        }

        rawTextDiv.textContent = '✅ Распознано. Рассчитываю...';
        const data = extractData(text, season, normCity, normHwy);
        openResultModal(data);
    } catch (err) {
        rawTextDiv.textContent = 'Ошибка: ' + err.message;
    } finally {
        captureButton.disabled = false;
        captureButton.textContent = '📸 Сфотографировать и распознать';
    }
}

async function recognizeWithLang(image, lang, timeoutMs) {
    const worker = await Tesseract.createWorker(lang);
    await worker.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' });
    rawTextDiv.textContent = `📦 Язык ${lang} загружен, распознаю...`;
    const result = await Promise.race([
        worker.recognize(image),
        new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs))
    ]);
    await worker.terminate();
    return result.data.text;
}

// ========== ИЗВЛЕЧЕНИЕ ДАННЫХ И РАСЧЁТ ==========
function getLastReturnFromHistory() {
    const history = getHistory();
    if (!history.length) return { value: 0, source: 'нет истории' };
    history.sort((a,b) => b.timestamp - a.timestamp);
    const last = history[0];
    const val = parseFloat(last.остатокВозврат);
    return !isNaN(val) ? { value: val, source: `из истории (${last.date})` } : { value: 0, source: 'повреждена' };
}

function extractData(rawText, season, normCity, normHwy) {
    // Остаток при выезде
    const startMan = startFuelInput.value.trim();
    let startVal, startSrc;
    if (startMan !== '') {
        startVal = parseFloat(startMan) || 0;
        startSrc = '(вручную)';
    } else {
        const ocr = rawText.match(/остаток.?при.?выезде[:\s]*(\d+)/i);
        if (ocr) {
            startVal = parseFloat(ocr[1]);
            startSrc = '(из документа)';
        } else {
            const hist = getLastReturnFromHistory();
            startVal = hist.value;
            startSrc = hist.source;
        }
    }

    // Остаток при возврате
    const endMan = endFuelInput.value.trim();
    let endVal, endSrc;
    if (endMan !== '') {
        endVal = parseFloat(endMan) || 0;
        endSrc = '(вручную)';
    } else {
        const ocr = rawText.match(/остаток.?при.?возврате[:\s]*(\d+)/i);
        if (ocr) {
            endVal = parseFloat(ocr[1]);
            endSrc = '(из документа)';
        } else {
            endVal = 0;
            endSrc = '(не указан)';
        }
    }

    // Пробег
    const city = parseFloat(cityKmInput.value) || 0;
    const hwy = parseFloat(highwayKmInput.value) || 0;
    let probeg, probegSrc;
    if (city > 0 || hwy > 0) {
        probeg = city + hwy;
        probegSrc = `(город ${city.toFixed(1)} + трасса ${hwy.toFixed(1)})`;
    } else {
        const ocrP = rawText.match(/пробег[:\s]*(\d+)/i);
        probeg = ocrP ? parseInt(ocrP[1]) : 0;
        probegSrc = ocrP ? '(из документа)' : '(не указан)';
    }

    // Заправка
    const fuelMan = fuelAddedManual.value.trim();
    let fuelVal, fuelSrc;
    if (fuelMan !== '') {
        fuelVal = parseFloat(fuelMan) || 0;
        fuelSrc = '(вручную)';
    } else {
        const ocrF = rawText.match(/заправлено[:\s]*(\d+)/i);
        fuelVal = ocrF ? parseFloat(ocrF[1]) : 0;
        fuelSrc = ocrF ? '(из документа)' : '(0)';
    }

    // Нормативный расход
    const normCityTotal = (city * normCity) / 100;
    const normHwyTotal = (hwy * normHwy) / 100;
    const normTotal = normCityTotal + normHwyTotal;
    const avgNorm = probeg > 0 ? (normTotal / probeg) * 100 : 0;

    // Фактический расход
    const factFuel = startVal + fuelVal - endVal;
    const fact100 = probeg > 0 ? (factFuel / probeg) * 100 : 0;
    const deviation = factFuel - normTotal;

    // Дата
    const dateMatch = rawText.match(/(\d{2}[.\/-]\d{2}[.\/-]\d{2,4})/);
    let isoDate = new Date().toISOString().split('T')[0];
    if (dateMatch) {
        const parts = dateMatch[1].split(/[.\/-]/);
        if (parts.length === 3) {
            const d = parts[0].padStart(2,'0'), m = parts[1].padStart(2,'0'), y = parts[2].length===2?'20'+parts[2]:parts[2];
            isoDate = `${y}-${m}-${d}`;
        }
    }

    return {
        isoDate, season,
        startVal, startSrc,
        endVal, endSrc,
        city, hwy, probeg, probegSrc,
        fuelVal, fuelSrc,
        normCity, normHwy,
        normCityTotal: normCityTotal.toFixed(2),
        normHwyTotal: normHwyTotal.toFixed(2),
        normTotal: normTotal.toFixed(2),
        avgNorm: avgNorm.toFixed(2),
        factFuel: factFuel.toFixed(2),
        fact100: fact100.toFixed(2),
        deviation: deviation.toFixed(2)
    };
}

// ========== МОДАЛЬНОЕ ОКНО РЕЗУЛЬТАТОВ ==========
function openResultModal(data) {
    currentResultData = data;

    const seasonEmoji = data.season === 'winter' ? '❄️' : '☀️';
    let html = `
        <p><strong>📅 Дата:</strong> ${data.isoDate} ${seasonEmoji}</p>
        <p><strong>⛽ Остаток при выезде:</strong> ${data.startVal.toFixed(2)} л ${data.startSrc}</p>
        <p><strong>🛢️ Заправлено:</strong> ${data.fuelVal.toFixed(2)} л ${data.fuelSrc}</p>
        <p><strong>🏁 Остаток при возврате:</strong> ${data.endVal.toFixed(2)} л ${data.endSrc}</p>
        <p><strong>📏 Пробег общий:</strong> ${data.probeg.toFixed(2)} км ${data.probegSrc}</p>
        <hr>
        <p><strong>🏙️ Нормативный расход город:</strong> ${data.normCityTotal} л (норма ${data.normCity} л/100км)</p>
        <p><strong>🛣️ Нормативный расход трасса:</strong> ${data.normHwyTotal} л (норма ${data.normHwy} л/100км)</p>
        <p><strong>📊 Нормативный расход общий:</strong> ${data.normTotal} л</p>
        <p><strong>📐 Средняя норма:</strong> ${data.avgNorm} л/100км</p>
        <hr>
        <p style="font-size:1.3em;color:#d32f2f;"><strong>🛞 Фактический расход:</strong> ${data.factFuel} л (${data.fact100} л/100км)</p>
        <p><strong>📈 Отклонение от нормы:</strong> ${data.deviation} л</p>
    `;
    modalCalculations.innerHTML = html;
    resultModal.style.display = 'flex';
}

function closeResultModalHandler() { resultModal.style.display = 'none'; currentResultData = null; }
closeResultModal.addEventListener('click', closeResultModalHandler);
closeResultBtn.addEventListener('click', closeResultModalHandler);
window.addEventListener('click', e => { if (e.target === resultModal) closeResultModalHandler(); });

// ========== СОХРАНЕНИЕ В ИСТОРИЮ ==========
saveToHistoryBtn.addEventListener('click', () => {
    if (!currentResultData) return;
    const d = currentResultData;

    const entry = {
        date: d.isoDate,
        остатокВыезд: d.startVal.toFixed(2),
        остатокВозврат: d.endVal.toFixed(2),
        заправлено: d.fuelVal.toFixed(2),
        пробег: d.probeg.toFixed(2),
        normCity: d.normCity,
        normHwy: d.normHwy,
        season: d.season,
        расход: d.factFuel,
        расход100: d.fact100,
        timestamp: Date.now(),
        cityKm: d.city,
        highwayKm: d.hwy
    };

    const history = getHistory();
    history.push(entry);
    saveHistory(history);
    alert('✅ Сохранено!');
    safeUpdateStartFuelFromHistory();
    updateStartFuelHint();
});

// ========== ИСТОРИЯ ==========
function renderHistory() {
    const history = getHistory();
    if (!history.length) { historyList.innerHTML = '<p>История пуста.</p>'; return; }
    history.sort((a,b) => b.timestamp - a.timestamp);
    let html = '<table><thead><tr><th>Дата</th><th>Выезд</th><th>Возврат</th><th>Пробег</th><th>Расход</th><th>Нормы(г/т)</th><th></th></tr></thead><tbody>';
    history.forEach((e, i) => {
        const probegStr = (e.cityKm || e.highwayKm) ? `${e.пробег} (г${e.cityKm?.toFixed(1)||0}+т${e.highwayKm?.toFixed(1)||0})` : e.пробег;
        html += `<tr>
            <td>${e.date}</td>
            <td>${e.остатокВыезд} л</td>
            <td>${e.остатокВозврат} л</td>
            <td>${probegStr} км</td>
            <td>${e.расход} л (${e.расход100})</td>
            <td>${e.normCity}/${e.normHwy}</td>
            <td><button class="delete-entry" data-index="${i}">🗑</button></td>
        </tr>`;
    });
    html += '</tbody></table>';
    historyList.innerHTML = html;

    document.querySelectorAll('.delete-entry').forEach(btn => {
        btn.addEventListener('click', e => {
            deleteHistoryEntry(parseInt(e.target.getAttribute('data-index')));
        });
    });
}

function deleteHistoryEntry(idx) {
    const history = getHistory();
    history.sort((a,b) => b.timestamp - a.timestamp);
    history.splice(idx, 1);
    saveHistory(history);
    renderHistory();
    safeUpdateStartFuelFromHistory();
    updateStartFuelHint();
}

clearHistoryBtn.addEventListener('click', () => {
    if (confirm('Удалить всю историю?')) {
        localStorage.removeItem('putevoyHistory');
        renderHistory();
        startFuelInput.value = '';
        updateStartFuelHint();
    }
});

document.getElementById('historyButton').addEventListener('click', () => { renderHistory(); historyModal.style.display = 'flex'; });
closeHistoryModal.addEventListener('click', () => historyModal.style.display = 'none');
window.addEventListener('click', e => { if (e.target === historyModal) historyModal.style.display = 'none'; });

// ========== СТАРТ ==========
startButton.addEventListener('click', startCamera);
captureButton.addEventListener('click', captureAndRecognize);
