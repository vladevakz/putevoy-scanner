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

let currentWeatherSeason = 'summer'; // по умолчанию

// ===== ИСТОРИЯ =====
function getHistory() {
    try { return JSON.parse(localStorage.getItem('putevoyHistory')) || []; } catch (e) { return []; }
}
function saveHistory(arr) {
    localStorage.setItem('putevoyHistory', JSON.stringify(arr));
}

// ===== ПОГОДА =====
function fetchWeather() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) return reject('Нет геолокации');
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
    if (mode === 'winter') {
        weatherInfo.textContent = '❄️';
        return 'winter';
    }
    if (mode === 'summer') {
        weatherInfo.textContent = '☀️';
        return 'summer';
    }
    // Авто
    weatherInfo.textContent = '…';
    try {
        const temp = await Promise.race([
            fetchWeather(),
            new Promise((_, reject) => setTimeout(() => reject('Таймаут'), 7000))
        ]);
        const season = temp < 0 ? 'winter' : 'summer';
        weatherInfo.textContent = season === 'winter' ? '❄️' : '☀️';
        return season;
    } catch (e) {
        weatherInfo.textContent = '☀️';
        return 'summer';
    }
}

// ===== КАМЕРА ДЛЯ ДАТЫ =====
async function initCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        video.srcObject = stream;
        scanBtn.disabled = false;
    } catch (err) {
        scanBtn.disabled = true;
        scanStatus.textContent = 'Нет камеры';
    }
}

scanBtn.addEventListener('click', async () => {
    scanBtn.disabled = true;
    scanStatus.textContent = '…';
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
        } else scanStatus.textContent = '?';
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

    const seasonSymbol = season === 'winter' ? '❄️' : '☀️';
    liveResults.innerHTML = `
        <p>${seasonSymbol} Нормы: г.${norms.city} / т.${norms.hwy} | Ср.норма: ${avgNorm.toFixed(2)} л/100км</p>
        <p><strong>Расход: ${factFuel.toFixed(2)} л (${fact100.toFixed(2)} л/100км) | Откл: ${deviation.toFixed(2)} л</strong></p>
    `;
}

// Обработчики на все поля
document.querySelectorAll('input[type="number"], input[type="date"]').forEach(input => {
    input.addEventListener('input', updateLiveResults);
});

// Сезон меняется
seasonRadios.forEach(r => r.addEventListener('change', async () => {
    currentWeatherSeason = await updateWeather();
    updateLiveResults();
}));

// ===== ОСТАТОК ИЗ ИСТОРИИ =====
function setStartFuelFromHistory() {
    const history = getHistory();
    if (history.length === 0) {
        startFuel.value = '';
        startFuelHint.textContent = '';
        return;
    }
    history.sort((a, b) => b.timestamp - a.timestamp);
    const last = history[0];
    if (last.остатокВозврат !== undefined && !isNaN(parseFloat(last.остатокВозврат))) {
        startFuel.value = parseFloat(last.остатокВозврат).toFixed(2);
        startFuelHint.textContent = `из ${last.date}`;
    } else {
        startFuel.value = '';
        startFuelHint.textContent = 'нет данных';
    }
}

// ===== СОХРАНЕНИЕ =====
saveBtn.addEventListener('click', () => {
    const startVal = (parseFloat(startFuel.value) || 0).toFixed(2);
    const endVal = (parseFloat(endFuel.value) || 0).toFixed(2);
    const probeg = (parseFloat(cityKm.value) || 0) + (parseFloat(highwayKm.value) || 0);

    const entry = {
        date: dateInput.value || new Date().toISOString().split('T')[0],
        остатокВыезд: startVal,
        остатокВозврат: endVal,
        заправлено: (parseFloat(fuelAdded.value) || 0).toFixed(2),
        пробег: probeg.toFixed(2),
        расход: (parseFloat(startVal) + parseFloat(fuelAdded.value || 0) - parseFloat(endVal)).toFixed(2),
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

// ===== ИСТОРИЯ (МОДАЛЬНОЕ ОКНО) =====
function renderHistory() {
    const history = getHistory();
    if (!history.length) { historyList.innerHTML = '<p>Пусто</p>'; return; }
    history.sort((a, b) => b.timestamp - a.timestamp);
    let html = '<table><tr><th>Дата</th><th>Выезд</th><th>Возврат</th><th>Пробег</th><th>Расход</th></tr>';
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

// ===== СТАРТ =====
(async function () {
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
                if (Math.abs(parseFloat(last.остатокВозврат) - val) < 0.01)
                    startFuelHint.textContent = `из ${last.date}`;
                else startFuelHint.textContent = 'вручную';
            }
        }
        updateLiveResults();
    });
})();
