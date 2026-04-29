// === ЭЛЕМЕНТЫ ===
const video = document.getElementById('video');
const scanBtn = document.getElementById('scanDateBtn');
const scanStatus = document.getElementById('scanStatus');

const dateInput = document.getElementById('dateInput');
const startFuel = document.getElementById('startFuel');
const endFuel = document.getElementById('endFuel');
const cityKm = document.getElementById('cityKm');
const highwayKm = document.getElementById('highwayKm');
const fuelAdded = document.getElementById('fuelAdded');

const normCitySummer = document.getElementById('normCitySummer');
const normCityWinter = document.getElementById('normCityWinter');
const normHwySummer = document.getElementById('normHwySummer');
const normHwyWinter = document.getElementById('normHwyWinter');
const seasonRadios = document.getElementsByName('season');

const weatherInfo = document.getElementById('weatherInfo');
const liveResults = document.getElementById('liveResults');
const startFuelHint = document.getElementById('startFuelHint');

const saveBtn = document.getElementById('saveBtn');
const historyBtn = document.getElementById('historyBtn');
const historyModal = document.getElementById('historyModal');
const closeHistoryModal = document.getElementById('closeHistoryModal');
const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');

let currentWeatherSeason = 'summer';

// === СОХРАНЕНИЕ НОРМ ===
function saveNormValues() {
    localStorage.setItem('normCitySummer', normCitySummer.value);
    localStorage.setItem('normCityWinter', normCityWinter.value);
    localStorage.setItem('normHwySummer', normHwySummer.value);
    localStorage.setItem('normHwyWinter', normHwyWinter.value);
}

function loadNormValues() {
    const saved = {
        cityS: localStorage.getItem('normCitySummer'),
        cityW: localStorage.getItem('normCityWinter'),
        hwyS: localStorage.getItem('normHwySummer'),
        hwyW: localStorage.getItem('normHwyWinter')
    };
    if (saved.cityS !== null) normCitySummer.value = saved.cityS;
    if (saved.cityW !== null) normCityWinter.value = saved.cityW;
    if (saved.hwyS !== null) normHwySummer.value = saved.hwyS;
    if (saved.hwyW !== null) normHwyWinter.value = saved.hwyW;
}

[normCitySummer, normCityWinter, normHwySummer, normHwyWinter].forEach(input => {
    input.addEventListener('input', saveNormValues);
});

// === ИСТОРИЯ ===
function getHistory() {
    try { return JSON.parse(localStorage.getItem('putevoyHistory')) || []; } catch (e) { return []; }
}
function saveHistory(arr) {
    localStorage.setItem('putevoyHistory', JSON.stringify(arr));
}

// === ПОГОДА ===
function fetchWeather() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) return reject('Нет геолокации');
        navigator.geolocation.getCurrentPosition(
            async pos => {
                try {
                    const resp = await fetch(
                        `https://api.open-meteo.com/v1/forecast?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&current_weather=true`
                    );
                    const data = await resp.json();
                    resolve(data.current_weather.temperature);
                } catch (e) { reject(e); }
            },
            err => reject(err),
            { timeout: 5000 }
        );
    });
}

async function updateWeather() {
    const mode = document.querySelector('input[name="season"]:checked').value;
    if (mode === 'winter') {
        weatherInfo.textContent = '❄️ Зима (вручную)';
        return 'winter';
    }
    if (mode === 'summer') {
        weatherInfo.textContent = '☀️ Лето (вручную)';
        return 'summer';
    }
    weatherInfo.textContent = '🌍 Определяю погоду…';
    try {
        const temp = await Promise.race([
            fetchWeather(),
            new Promise((_, reject) => setTimeout(() => reject('Timeout'), 7000))
        ]);
        const season = temp < 0 ? 'winter' : 'summer';
        weatherInfo.textContent = `🌡️ ${temp}°C → ${season === 'winter' ? '❄️ Зима' : '☀️ Лето'}`;
        return season;
    } catch (e) {
        weatherInfo.textContent = '⚠️ Погода недоступна, взято лето';
        return 'summer';
    }
}

// === КАМЕРА ===
async function initCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        video.srcObject = stream;
        scanBtn.disabled = false;
    } catch (err) {
        scanBtn.disabled = true;
        scanStatus.textContent = 'нет';
    }
}

scanBtn.addEventListener('click', async () => {
    scanBtn.disabled = true;
    scanStatus.textContent = '...';
    try {
        const worker = await Tesseract.createWorker('rus+eng');
        const { data: { text } } = await worker.recognize(video);
        await worker.terminate();

        const dateMatch = text.match(/(\d{2}[./-]\d{2}[./-]\d{4})/);
        if (dateMatch) {
            const parts = dateMatch[1].split(/[./-]/);
            if (parts.length === 3) {
                const [d, m, y] = parts;
                dateInput.value = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
                scanStatus.textContent = '✅';
            } else scanStatus.textContent = '❌';
        } else scanStatus.textContent = '❌';
    } catch (e) { scanStatus.textContent = '!'; }
    scanBtn.disabled = false;
});

// === ЖИВОЙ РАСЧЁТ ===
function getActiveNorm(season) {
    const city = season === 'winter' ? parseFloat(normCityWinter.value) || 13 : parseFloat(normCitySummer.value) || 11;
    const hwy = season === 'winter' ? parseFloat(normHwyWinter.value) || 11 : parseFloat(normHwySummer.value) || 9;
    return { city, hwy };
}

function updateLiveResults() {
    const start = parseFloat(startFuel.value) || 0;
    const end = parseFloat(endFuel.value) || 0;
    const city = parseFloat(cityKm.value) || 0;
    const hwy = parseFloat(highwayKm.value) || 0;
    const fuel = parseFloat(fuelAdded.value) || 0;
    const season = currentWeatherSeason;

    const norms = getActiveNorm(season);
    const normCityTotal = (city * norms.city) / 100;
    const normHwyTotal = (hwy * norms.hwy) / 100;
    const normTotal = normCityTotal + normHwyTotal;
    const probeg = city + hwy;
    const avgNorm = probeg > 0 ? (normTotal / probeg) * 100 : 0;

    const factFuel = start + fuel - end;
    const fact100 = probeg > 0 ? (factFuel / probeg) * 100 : 0;
    const deviation = factFuel - normTotal;

    // Предупреждение, если возврат не указан или равен 0
    let warning = '';
    if (end === 0 && (city > 0 || hwy > 0)) {
        warning = '<p style="color: #dc3545; margin: 4px 0;">⚠️ Возврат не указан – расход завышен! Впишите реальный остаток в баке после поездки.</p>';
    }

    liveResults.innerHTML = `
        <p style="margin:0 0 4px;">⛽ Выезд: ${start.toFixed(2)} л | 🛢️ Заправ: ${fuel.toFixed(2)} л | 🏁 Возврат: ${end.toFixed(2)} л</p>
        <p style="margin:0 0 4px;">${season === 'winter' ? '❄️' : '☀️'} Нормы: г.${norms.city} / т.${norms.hwy} | Ср.норма: ${avgNorm.toFixed(2)} л/100км</p>
        <p style="margin:0 0 4px;"><strong>Расход: ${factFuel.toFixed(2)} л (${fact100.toFixed(2)} л/100км) | Откл: ${deviation.toFixed(2)} л</strong></p>
        ${warning}
    `;
}

// Слушаем все поля
document.querySelectorAll('input[type="number"], input[type="date"]').forEach(input => {
    input.addEventListener('input', updateLiveResults);
});

// Сезон
seasonRadios.forEach(r => r.addEventListener('change', async () => {
    currentWeatherSeason = await updateWeather();
    updateLiveResults();
}));

// === ОСТАТОК ПРИ ВЫЕЗДЕ ИЗ ИСТОРИИ ===
function setStartFuelFromHistory() {
    const history = getHistory();
    if (history.length === 0) {
        startFuel.value = '';
        startFuelHint.textContent = '';
        return;
    }
    history.sort((a, b) => b.timestamp - a.timestamp);
    const last = history[0];
    const returnFuel = last.остатокВозврат !== undefined ? parseFloat(last.остатокВозврат) : NaN;
    if (!isNaN(returnFuel)) {
        startFuel.value = returnFuel.toFixed(2);
        if (returnFuel === 0) {
            startFuelHint.textContent = `из ${last.date} (был 0)`;
        } else {
            startFuelHint.textContent = `из ${last.date}`;
        }
    } else {
        startFuel.value = '';
        startFuelHint.textContent = 'нет данных';
    }
}

// === СОХРАНЕНИЕ В ИСТОРИЮ ===
saveBtn.addEventListener('click', () => {
    const startVal = parseFloat(startFuel.value) || 0;
    const endVal = parseFloat(endFuel.value) || 0;
    const fuelVal = parseFloat(fuelAdded.value) || 0;
    const cityVal = parseFloat(cityKm.value) || 0;
    const hwyVal = parseFloat(highwayKm.value) || 0;

    // Проверка на забытый возврат
    if (endVal === 0 && (cityVal > 0 || hwyVal > 0)) {
        if (!confirm('Вы не указали остаток при возврате (0 л). Расход может быть завышен. Продолжить?')) {
            return;
        }
    }

    const entry = {
        date: dateInput.value || new Date().toISOString().split('T')[0],
        остатокВыезд: startVal.toFixed(2),
        остатокВозврат: endVal.toFixed(2),
        заправлено: fuelVal.toFixed(2),
        пробег: (cityVal + hwyVal).toFixed(2),
        расход: (startVal + fuelVal - endVal).toFixed(2),
        timestamp: Date.now(),
        season: currentWeatherSeason,
    };

    const history = getHistory();
    history.push(entry);
    saveHistory(history);
    alert('✅ Сохранено!');
    setStartFuelFromHistory();
    updateLiveResults();
});

// === МОДАЛЬНОЕ ОКНО ИСТОРИИ ===
function renderHistory() {
    const history = getHistory();
    if (!history.length) { historyList.innerHTML = '<p>Пусто</p>'; return; }
    history.sort((a, b) => b.timestamp - a.timestamp);
    let html = '<table><tr><th>Дата</th><th>Выезд</th><th>Возвр</th><th>Пробег</th><th>Расход</th></tr>';
    history.forEach((e, i) => {
        html += `<tr>
            <td>${e.date}</td><td>${e.остатокВыезд}</td><td>${e.остатокВозврат}</td>
            <td>${e.пробег}</td><td>${e.расход}</td>
            <td><button class="delete-entry" data-index="${i}">🗑</button></td>
        </tr>`;
    });
    html += '</table>';
    historyList.innerHTML = html;
    document.querySelectorAll('.delete-entry').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.index);
            deleteHistoryEntry(idx);
        });
    });
}

function deleteHistoryEntry(idx) {
    const history = getHistory();
    history.sort((a, b) => b.timestamp - a.timestamp);
    history.splice(idx, 1);
    saveHistory(history);
    renderHistory();
    setStartFuelFromHistory();
}

historyBtn.addEventListener('click', () => { renderHistory(); historyModal.style.display = 'flex'; });
closeHistoryModal.addEventListener('click', () => historyModal.style.display = 'none');
clearHistoryBtn.addEventListener('click', () => {
    if (confirm('Удалить всю историю?')) {
        localStorage.removeItem('putevoyHistory');
        renderHistory();
        setStartFuelFromHistory();
    }
});
window.addEventListener('click', e => { if (e.target === historyModal) historyModal.style.display = 'none'; });

// === СТАРТ ===
(async function () {
    loadNormValues();
    dateInput.value = new Date().toISOString().split('T')[0];
    setStartFuelFromHistory();
    currentWeatherSeason = await updateWeather();
    updateLiveResults();
    initCamera();

    startFuel.addEventListener('input', () => {
        const val = parseFloat(startFuel.value);
        if (!isNaN(val)) {
            const history = getHistory();
            if (history.length) {
                history.sort((a, b) => b.timestamp - a.timestamp);
                const last = history[0];
                const lastReturn = parseFloat(last.остатокВозврат);
                if (!isNaN(lastReturn) && Math.abs(lastReturn - val) < 0.01)
                    startFuelHint.textContent = `из ${last.date}`;
                else startFuelHint.textContent = 'вручную';
            }
        }
        updateLiveResults();
    });
})();
