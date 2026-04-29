// Элементы
const dateInput = document.getElementById('dateInput');
const startOdometer = document.getElementById('startOdometer');
const startOdometerHint = document.getElementById('startOdometerHint');
const startFuel = document.getElementById('startFuel');
const startFuelHint = document.getElementById('startFuelHint');
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

const saveBtn = document.getElementById('saveBtn');
const historyBtn = document.getElementById('historyBtn');
const historyModal = document.getElementById('historyModal');
const closeHistoryModal = document.getElementById('closeHistoryModal');
const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');

let currentWeatherSeason = 'summer';

// ===== НОРМЫ =====
function saveNormValues() {
    localStorage.setItem('normCitySummer', normCitySummer.value);
    localStorage.setItem('normCityWinter', normCityWinter.value);
    localStorage.setItem('normHwySummer', normHwySummer.value);
    localStorage.setItem('normHwyWinter', normHwyWinter.value);
}
function loadNormValues() {
    const s = {
        cs: localStorage.getItem('normCitySummer'),
        cw: localStorage.getItem('normCityWinter'),
        hs: localStorage.getItem('normHwySummer'),
        hw: localStorage.getItem('normHwyWinter')
    };
    if (s.cs !== null) normCitySummer.value = s.cs;
    if (s.cw !== null) normCityWinter.value = s.cw;
    if (s.hs !== null) normHwySummer.value = s.hs;
    if (s.hw !== null) normHwyWinter.value = s.hw;
}
[normCitySummer, normCityWinter, normHwySummer, normHwyWinter].forEach(i => i.addEventListener('input', saveNormValues));

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
                    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&current_weather=true`);
                    const d = await r.json();
                    resolve(d.current_weather.temperature);
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
        const temp = await Promise.race([fetchWeather(), new Promise((_, reject) => setTimeout(() => reject(new Error('T')), 7000))]);
        const season = temp < 0 ? 'winter' : 'summer';
        weatherInfo.textContent = `🌡️ ${temp}°C → ${season === 'winter' ? '❄️ Зима' : '☀️ Лето'}`;
        return season;
    } catch (e) {
        weatherInfo.textContent = '⚠️ Погода недоступна, взято лето';
        return 'summer';
    }
}

// ===== АВТОЗАПОЛНЕНИЕ НАЧАЛЬНОГО ПРОБЕГА И ВЫЕЗДА =====
function setStartOdometerFromHistory() {
    const history = getHistory();
    if (!history.length) {
        startOdometer.value = '';
        startOdometerHint.textContent = '';
        return;
    }
    history.sort((a, b) => b.timestamp - a.timestamp);
    const last = history[0];
    const lastEndOdo = parseFloat(last.конечныйПробег);
    if (!isNaN(lastEndOdo)) {
        startOdometer.value = lastEndOdo.toFixed(1);
        startOdometerHint.textContent = `из ${last.date}`;
    } else {
        startOdometer.value = '';
        startOdometerHint.textContent = '';
    }
}

function setStartFuelFromHistory() {
    const history = getHistory();
    if (!history.length) {
        startFuel.value = '';
        startFuelHint.textContent = '';
        return;
    }
    history.sort((a, b) => b.timestamp - a.timestamp);
    const last = history[0];
    const lastReturn = parseFloat(last.остатокВозврат);
    if (!isNaN(lastReturn)) {
        startFuel.value = lastReturn.toFixed(2);
        startFuelHint.textContent = `из ${last.date}`;
    } else {
        startFuel.value = '';
        startFuelHint.textContent = '';
    }
}

// ===== ЖИВОЙ РАСЧЁТ =====
function getActiveNorm(season) {
    const city = season === 'winter' ? parseFloat(normCityWinter.value) || 13 : parseFloat(normCitySummer.value) || 11;
    const hwy = season === 'winter' ? parseFloat(normHwyWinter.value) || 11 : parseFloat(normHwySummer.value) || 9;
    return { city, hwy };
}

function updateLiveResults() {
    const odoStart = parseFloat(startOdometer.value) || 0;
    const fuelStart = parseFloat(startFuel.value) || 0;
    const city = parseFloat(cityKm.value) || 0;
    const hwy = parseFloat(highwayKm.value) || 0;
    const fuelAddedVal = parseFloat(fuelAdded.value) || 0;
    const season = currentWeatherSeason;
    const norms = getActiveNorm(season);

    const dayProbeg = city + hwy;
    const odoEnd = odoStart + dayProbeg;

    const normCityL = (city * norms.city) / 100;
    const normHwyL = (hwy * norms.hwy) / 100;
    const normTotal = normCityL + normHwyL;
    const avgNorm = dayProbeg > 0 ? (normTotal / dayProbeg) * 100 : 0;

    const calcReturn = fuelStart + fuelAddedVal - normTotal; // расчётный возврат
    const factFuel = normTotal; // фактический расход равен нормативному
    const fact100 = dayProbeg > 0 ? (factFuel / dayProbeg) * 100 : 0;

    liveResults.innerHTML = `
        <p style="margin:0 0 4px;">🚩 <b>Нач. пробег:</b> ${odoStart.toFixed(1)} км → 🏁 <b>Конечный:</b> ${odoEnd.toFixed(1)} км (за день: ${dayProbeg.toFixed(1)} км)</p>
        <p style="margin:0 0 4px;">⛽ <b>Выезд:</b> ${fuelStart.toFixed(2)} л | 🛢️ <b>Заправ:</b> ${fuelAddedVal.toFixed(2)} л | 🏁 <b>Возврат:</b> ${calcReturn.toFixed(2)} л</p>
        <p style="margin:0 0 4px;">${season === 'winter' ? '❄️' : '☀️'} Нормы: г.${norms.city.toFixed(1)} / т.${norms.hwy.toFixed(1)}</p>
        <p style="margin:0 0 4px;">📊 Норм. расход: город ${normCityL.toFixed(2)} + трасса ${normHwyL.toFixed(2)} = <b>${normTotal.toFixed(2)} л</b> (ср. ${avgNorm.toFixed(2)} л/100км)</p>
        <p style="margin:0 0 4px;">🛞 <b>Факт. расход:</b> ${factFuel.toFixed(2)} л (${fact100.toFixed(2)} л/100км)</p>
    `;

    updateHints();
}

function updateHints() {
    // Подсказка для начального пробега
    const odoVal = parseFloat(startOdometer.value);
    const history = getHistory();
    if (history.length) {
        history.sort((a, b) => b.timestamp - a.timestamp);
        const lastEnd = parseFloat(history[0].конечныйПробег);
        if (!isNaN(lastEnd) && !isNaN(odoVal) && Math.abs(lastEnd - odoVal) < 0.01) {
            startOdometerHint.textContent = `из ${history[0].date}`;
        } else if (!isNaN(odoVal)) {
            startOdometerHint.textContent = 'вручную';
        }
    }

    // Подсказка для остатка топлива
    const fuelVal = parseFloat(startFuel.value);
    if (history.length) {
        history.sort((a, b) => b.timestamp - a.timestamp);
        const lastReturn = parseFloat(history[0].остатокВозврат);
        if (!isNaN(lastReturn) && !isNaN(fuelVal) && Math.abs(lastReturn - fuelVal) < 0.01) {
            startFuelHint.textContent = `из ${history[0].date}`;
        } else if (!isNaN(fuelVal)) {
            startFuelHint.textContent = 'вручную';
        }
    }
}

// ===== СОХРАНЕНИЕ =====
saveBtn.addEventListener('click', () => {
    const odoStart = parseFloat(startOdometer.value) || 0;
    const cityVal = parseFloat(cityKm.value) || 0;
    const hwyVal = parseFloat(highwayKm.value) || 0;
    const fuelStartVal = parseFloat(startFuel.value) || 0;
    const fuelAddedVal = parseFloat(fuelAdded.value) || 0;
    const season = currentWeatherSeason;
    const norms = getActiveNorm(season);
    const dayProbeg = cityVal + hwyVal;
    const odoEnd = odoStart + dayProbeg;
    const normTotal = (cityVal * norms.city) / 100 + (hwyVal * norms.hwy) / 100;
    const returnVal = fuelStartVal + fuelAddedVal - normTotal;

    const entry = {
        date: dateInput.value || new Date().toISOString().split('T')[0],
        начальныйПробег: odoStart.toFixed(1),
        конечныйПробег: odoEnd.toFixed(1),
        город: cityVal.toFixed(1),
        трасса: hwyVal.toFixed(1),
        остатокВыезд: fuelStartVal.toFixed(2),
        заправлено: fuelAddedVal.toFixed(2),
        остатокВозврат: returnVal.toFixed(2),
        расход: normTotal.toFixed(2),
        timestamp: Date.now(),
        season: season,
    };
    const history = getHistory();
    history.push(entry);
    saveHistory(history);
    alert('✅ Сохранено!');
    setStartOdometerFromHistory();
    setStartFuelFromHistory();
    updateLiveResults();
});

// ===== МОДАЛЬНОЕ ОКНО ИСТОРИИ =====
function renderHistory() {
    const history = getHistory();
    if (!history.length) { historyList.innerHTML = '<p>История пуста.</p>'; return; }
    history.sort((a, b) => b.timestamp - a.timestamp);
    let html = '<table><tr><th>Дата</th><th>Пробег нач.</th><th>Конец</th><th>Город</th><th>Трасса</th><th>Выезд</th><th>Возврат</th><th>Расход</th></tr>';
    history.forEach((e, i) => {
        html += `<tr>
            <td>${e.date}</td><td>${e.начальныйПробег}</td><td>${e.конечныйПробег}</td>
            <td>${e.город || 0}</td><td>${e.трасса || 0}</td>
            <td>${e.остатокВыезд}</td><td>${e.остатокВозврат}</td>
            <td>${e.расход}</td>
            <td><button class="delete-entry" data-index="${i}">🗑</button></td>
        </tr>`;
    });
    html += '</table>';
    historyList.innerHTML = html;
    document.querySelectorAll('.delete-entry').forEach(b => {
        b.addEventListener('click', (ev) => deleteHistoryEntry(parseInt(ev.target.dataset.index)));
    });
}

function deleteHistoryEntry(idx) {
    const history = getHistory();
    history.sort((a, b) => b.timestamp - a.timestamp);
    history.splice(idx, 1);
    saveHistory(history);
    renderHistory();
    setStartOdometerFromHistory();
    setStartFuelFromHistory();
    updateLiveResults();
}

historyBtn.addEventListener('click', () => { renderHistory(); historyModal.style.display = 'flex'; });
closeHistoryModal.addEventListener('click', () => historyModal.style.display = 'none');
clearHistoryBtn.addEventListener('click', () => {
    if (confirm('Удалить всю историю?')) {
        localStorage.removeItem('putevoyHistory');
        renderHistory();
        setStartOdometerFromHistory();
        setStartFuelFromHistory();
        updateLiveResults();
    }
});
window.addEventListener('click', e => { if (e.target === historyModal) historyModal.style.display = 'none'; });

// ===== СЛУШАТЕЛИ ПОЛЕЙ =====
document.querySelectorAll('#startOdometer, #startFuel, #cityKm, #highwayKm, #fuelAdded, #dateInput').forEach(input => {
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
    setStartOdometerFromHistory();
    setStartFuelFromHistory();
    currentWeatherSeason = await updateWeather();
    updateLiveResults();
});
