// Элементы интерфейса
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

// ===== СОХРАНЕНИЕ НОРМ =====
function saveNormValues() {
    localStorage.setItem('normCitySummer', normCitySummer.value);
    localStorage.setItem('normCityWinter', normCityWinter.value);
    localStorage.setItem('normHwySummer', normHwySummer.value);
    localStorage.setItem('normHwyWinter', normHwyWinter.value);
}
function loadNormValues() {
    const saved = {
        cs: localStorage.getItem('normCitySummer'),
        cw: localStorage.getItem('normCityWinter'),
        hs: localStorage.getItem('normHwySummer'),
        hw: localStorage.getItem('normHwyWinter')
    };
    if (saved.cs !== null) normCitySummer.value = saved.cs;
    if (saved.cw !== null) normCityWinter.value = saved.cw;
    if (saved.hs !== null) normHwySummer.value = saved.hs;
    if (saved.hw !== null) normHwyWinter.value = saved.hw;
}
[normCitySummer, normCityWinter, normHwySummer, normHwyWinter].forEach(input => {
    input.addEventListener('input', saveNormValues);
});

// ===== ИСТОРИЯ =====
function getHistory() {
    try { return JSON.parse(localStorage.getItem('putevoyHistory')) || []; } catch (e) { return []; }
}
function saveHistory(arr) {
    localStorage.setItem('putevoyHistory', JSON.stringify(arr));
}

// ===== ПОГОДА =====
async function fetchWeather() {
    if (!navigator.geolocation) throw new Error('Нет геолокации');
    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
            async pos => {
                try {
                    const resp = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&current_weather=true`);
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
    if (mode === 'winter') { weatherInfo.textContent = '❄️ Зима (вручную)'; return 'winter'; }
    if (mode === 'summer') { weatherInfo.textContent = '☀️ Лето (вручную)'; return 'summer'; }
    weatherInfo.textContent = '🌍 Определяю погоду…';
    try {
        const temp = await Promise.race([fetchWeather(), new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 7000))]);
        const season = temp < 0 ? 'winter' : 'summer';
        weatherInfo.textContent = `🌡️ ${temp}°C → ${season === 'winter' ? '❄️ Зима' : '☀️ Лето'}`;
        return season;
    } catch (e) {
        weatherInfo.textContent = '⚠️ Погода недоступна, взято лето';
        return 'summer';
    }
}

// ===== КАМЕРА =====
async function initCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        video.srcObject = stream;
        scanBtn.disabled = false;
    } catch (err) { scanBtn.disabled = true; scanStatus.textContent = 'нет'; }
}
scanBtn.addEventListener('click', async () => {
    scanBtn.disabled = true; scanStatus.textContent = '...';
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

// ===== ЖИВОЙ РАСЧЁТ =====
function getActiveNorm(season) {
    const city = season === 'winter' ? parseFloat(normCityWinter.value) || 13 : parseFloat(normCitySummer.value) || 11;
    const hwy = season === 'winter' ? parseFloat(normHwyWinter.value) || 11 : parseFloat(normHwySummer.value) || 9;
    return { city, hwy };
}

function updateLiveResults() {
    const start = parseFloat(startFuel.value) || 0;
    const endManual = endFuel.value.trim() === '' ? NaN : parseFloat(endFuel.value);
    const city = parseFloat(cityKm.value) || 0;
    const hwy = parseFloat(highwayKm.value) || 0;
    const fuel = parseFloat(fuelAdded.value) || 0;
    const season = currentWeatherSeason;

    const norms = getActiveNorm(season);
    const normCityL = (city * norms.city) / 100;
    const normHwyL = (hwy * norms.hwy) / 100;
    const normTotal = normCityL + normHwyL;
    const probeg = city + hwy;
    const avgNorm = probeg > 0 ? (normTotal / probeg) * 100 : 0;

    // Если возврат не указан, рассчитываем его по норме
    const autoEnd = start + fuel - normTotal;
    const end = isNaN(endManual) ? autoEnd : endManual;
    const endSource = isNaN(endManual) ? '(расчётный)' : '(вручную)';

    const factFuel = start + fuel - end;
    const fact100 = probeg > 0 ? (factFuel / probeg) * 100 : 0;
    const deviation = factFuel - normTotal;
    const deviationSign = deviation > 0 ? 'перерасход' : (deviation < 0 ? 'экономия' : 'норма');

    // Подсказка о завтрашнем выезде (берём end, который будет сохранён)
    let tomorrowHint = '';
    if (!isNaN(end)) {
        tomorrowHint = `<p style="margin:4px 0;font-size:13px;color:#007aff;">📌 Завтрашний выезд: ${end.toFixed(2)} л ${endSource}</p>`;
    }

    let warning = '';
    if (isNaN(endManual) && (city > 0 || hwy > 0)) {
        warning = '<p style="color:#2e7d32;margin:4px 0;">ℹ️ Возврат рассчитан автоматически по нормативу.</p>';
    }

    liveResults.innerHTML = `
        <p style="margin:0 0 4px;">⛽ <b>Выезд:</b> ${start.toFixed(2)} л | 🛢️ <b>Заправ:</b> ${fuel.toFixed(2)} л | 🏁 <b>Возврат:</b> ${end.toFixed(2)} л ${endSource}</p>
        <p style="margin:0 0 4px;">${season === 'winter' ? '❄️' : '☀️'} Нормы: г.${norms.city.toFixed(1)} / т.${norms.hwy.toFixed(1)}</p>
        <p style="margin:0 0 4px;">📊 Норм. расход: город ${normCityL.toFixed(2)} л + трасса ${normHwyL.toFixed(2)} л = <b>${normTotal.toFixed(2)} л</b> (ср. ${avgNorm.toFixed(2)} л/100км)</p>
        <p style="margin:0 0 4px;">🛞 <b>Факт. расход:</b> ${factFuel.toFixed(2)} л (${fact100.toFixed(2)} л/100км) | <i>${deviationSign} ${Math.abs(deviation).toFixed(2)} л</i></p>
        ${tomorrowHint}
        ${warning}
    `;
    updateStartFuelHint();
}

function updateStartFuelHint() {
    const val = parseFloat(startFuel.value);
    const history = getHistory();
    if (history.length === 0) { startFuelHint.textContent = ''; return; }
    history.sort((a, b) => b.timestamp - a.timestamp);
    const lastReturn = parseFloat(history[0].остатокВозврат);
    if (!isNaN(lastReturn) && !isNaN(val) && Math.abs(lastReturn - val) < 0.01) {
        startFuelHint.textContent = `из ${history[0].date}`;
    } else if (!isNaN(val)) {
        startFuelHint.textContent = 'вручную';
    } else {
        startFuelHint.textContent = '';
    }
}

function setStartFuelFromHistory() {
    const history = getHistory();
    if (history.length === 0) { startFuel.value = ''; startFuelHint.textContent = ''; return; }
    history.sort((a, b) => b.timestamp - a.timestamp);
    const lastReturn = parseFloat(history[0].остатокВозврат);
    if (!isNaN(lastReturn)) {
        startFuel.value = lastReturn.toFixed(2);
        startFuelHint.textContent = `из ${history[0].date}`;
    } else {
        startFuel.value = '';
        startFuelHint.textContent = '';
    }
}

// ===== СОХРАНЕНИЕ =====
saveBtn.addEventListener('click', () => {
    const startVal = parseFloat(startFuel.value) || 0;
    const endManual = endFuel.value.trim() === '' ? NaN : parseFloat(endFuel.value);
    const cityVal = parseFloat(cityKm.value) || 0;
    const hwyVal = parseFloat(highwayKm.value) || 0;
    const fuelVal = parseFloat(fuelAdded.value) || 0;

    // Рассчитываем нормативный расход
    const season = currentWeatherSeason;
    const norms = getActiveNorm(season);
    const normTotal = (cityVal * norms.city) / 100 + (hwyVal * norms.hwy) / 100;

    // Если возврат не введён, считаем по норме
    const endVal = isNaN(endManual) ? startVal + fuelVal - normTotal : endManual;

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
    updateLiveResults();
});

// ===== МОДАЛЬНОЕ ОКНО ИСТОРИИ =====
function renderHistory() {
    const history = getHistory();
    if (!history.length) { historyList.innerHTML = '<p>История пуста.</p>'; return; }
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
        btn.addEventListener('click', (e) => deleteHistoryEntry(parseInt(e.target.dataset.index)));
    });
}

function deleteHistoryEntry(idx) {
    const history = getHistory();
    history.sort((a, b) => b.timestamp - a.timestamp);
    history.splice(idx, 1);
    saveHistory(history);
    renderHistory();
    updateLiveResults();
}

historyBtn.addEventListener('click', () => { renderHistory(); historyModal.style.display = 'flex'; });
closeHistoryModal.addEventListener('click', () => historyModal.style.display = 'none');
clearHistoryBtn.addEventListener('click', () => {
    if (confirm('Удалить всю историю?')) {
        localStorage.removeItem('putevoyHistory');
        renderHistory();
        updateLiveResults();
    }
});
window.addEventListener('click', e => { if (e.target === historyModal) historyModal.style.display = 'none'; });

// ===== СЛУШАТЕЛИ =====
document.querySelectorAll('#startFuel, #endFuel, #cityKm, #highwayKm, #fuelAdded, #dateInput').forEach(input => {
    input.addEventListener('input', updateLiveResults);
});
seasonRadios.forEach(r => r.addEventListener('change', async () => {
    currentWeatherSeason = await updateWeather();
    updateLiveResults();
}));

// ===== СТАРТ =====
window.addEventListener('DOMContentLoaded', async () => {
    loadNormValues();
    dateInput.value = new Date().toISOString().split('T')[0];
    setStartFuelFromHistory();
    currentWeatherSeason = await updateWeather();
    updateLiveResults();
    initCamera();
});
