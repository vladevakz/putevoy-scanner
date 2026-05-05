// ===== ЭЛЕМЕНТЫ =====
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
const historyMonth = document.getElementById('historyMonth');

// Точки
const pointsBtn = document.getElementById('pointsBtn');
const pointsModal = document.getElementById('pointsModal');
const closePointsModal = document.getElementById('closePointsModal');
const pointDate = document.getElementById('pointDate');
const pointCount = document.getElementById('pointCount');
const addPointBtn = document.getElementById('addPointBtn');
const pointsList = document.getElementById('pointsList');
const pointsTotalDiv = document.getElementById('pointsTotal');
const clearPointsBtn = document.getElementById('clearPointsBtn');

let currentWeatherSeason = 'summer';

// ===== НОРМЫ =====
function saveNormValues() {
    try {
        localStorage.setItem('normCitySummer', normCitySummer.value);
        localStorage.setItem('normCityWinter', normCityWinter.value);
        localStorage.setItem('normHwySummer', normHwySummer.value);
        localStorage.setItem('normHwyWinter', normHwyWinter.value);
    } catch (e) {
        console.warn('Не удалось сохранить нормы', e);
    }
}
function loadNormValues() {
    try {
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
    } catch (e) {
        console.warn('Не удалось загрузить нормы', e);
    }
}
[normCitySummer, normCityWinter, normHwySummer, normHwyWinter].forEach(i => i.addEventListener('input', saveNormValues));

// ===== ИСТОРИЯ (топливо) =====
function getHistory() {
    try {
        const raw = localStorage.getItem('putevoyHistory');
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        console.error('Ошибка чтения истории', e);
        return [];
    }
}
function saveHistory(arr) {
    try {
        localStorage.setItem('putevoyHistory', JSON.stringify(arr));
    } catch (e) {
        alert('Не удалось сохранить историю. Возможно, переполнено хранилище.');
        console.error(e);
    }
}

// ===== ТОЧКИ =====
function getPointsHistory() {
    try {
        const raw = localStorage.getItem('pointsHistory');
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        console.error('Ошибка чтения точек', e);
        return [];
    }
}
function savePointsHistory(arr) {
    try {
        localStorage.setItem('pointsHistory', JSON.stringify(arr));
    } catch (e) {
        alert('Не удалось сохранить точки. Хранилище переполнено или недоступно.');
        console.error(e);
    }
}

function renderPoints() {
    try {
        const points = getPointsHistory();
        points.sort((a, b) => a.date.localeCompare(b.date) || (a.timestamp || 0) - (b.timestamp || 0));
        let total = 0;
        let html = '<table><tr><th>Дата</th><th>Кол-во</th><th></th></tr>';
        points.forEach((p, i) => {
            total += p.count;
            html += `<tr>
                <td>${p.date}</td>
                <td>${p.count}</td>
                <td><button class="delete-point" data-index="${i}">🗑</button></td>
            </tr>`;
        });
        html += '</table>';
        pointsList.innerHTML = html;
        pointsTotalDiv.textContent = `Всего точек: ${total}`;

        document.querySelectorAll('.delete-point').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.getAttribute('data-index'));
                deletePoint(idx);
            });
        });
    } catch (e) {
        console.error('Ошибка отрисовки точек', e);
        pointsList.innerHTML = '<p style="color:red;">Ошибка загрузки точек</p>';
    }
}

function deletePoint(idx) {
    try {
        const points = getPointsHistory();
        points.sort((a, b) => a.date.localeCompare(b.date) || (a.timestamp || 0) - (b.timestamp || 0));
        if (idx >= 0 && idx < points.length) {
            points.splice(idx, 1);
            savePointsHistory(points);
            renderPoints();
        }
    } catch (e) {
        console.error(e);
    }
}

addPointBtn.addEventListener('click', () => {
    const date = pointDate.value;
    const count = parseInt(pointCount.value);
    if (!date) {
        alert('Выберите дату');
        return;
    }
    if (isNaN(count) || count < 0) {
        alert('Введите корректное количество (0 или больше)');
        return;
    }
    const entry = {
        date: date,
        count: count,
        timestamp: Date.now()
    };
    try {
        const points = getPointsHistory();
        points.push(entry);
        savePointsHistory(points);
        pointCount.value = '';
        renderPoints();
    } catch (e) {
        alert('Не удалось добавить точку');
        console.error(e);
    }
});

clearPointsBtn.addEventListener('click', () => {
    if (confirm('Удалить все точки?')) {
        try {
            savePointsHistory([]);
            renderPoints();
        } catch (e) {
            console.error(e);
        }
    }
});

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
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 7000))
        ]);
        const season = temp < 0 ? 'winter' : 'summer';
        weatherInfo.textContent = `🌡️ ${temp}°C → ${season === 'winter' ? '❄️ Зима' : '☀️ Лето'}`;
        return season;
    } catch (e) {
        weatherInfo.textContent = '⚠️ Погода недоступна, взято лето';
        return 'summer';
    }
}

// ===== АВТОЗАПОЛНЕНИЕ ПРОБЕГА И ВЫЕЗДА =====
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

    const calcReturn = fuelStart + fuelAddedVal - normTotal;
    const factFuel = normTotal;
    const fact100 = dayProbeg > 0 ? (factFuel / dayProbeg) * 100 : 0;

    liveResults.innerHTML = `
        <p style="margin:0 0 4px;">🚩 <b>Пробег:</b> ${odoStart.toFixed(1)} → ${odoEnd.toFixed(1)} км (за день: ${dayProbeg.toFixed(1)} км)</p>
        <p style="margin:0 0 4px;">⛽ <b>Выезд:</b> ${fuelStart.toFixed(2)} л | 🛢️ <b>Заправ:</b> ${fuelAddedVal.toFixed(2)} л | 🏁 <span class="highlight-red">Возврат: ${calcReturn.toFixed(2)} л</span></p>
        <p style="margin:0 0 4px;">${season === 'winter' ? '❄️' : '☀️'} Нормы: г.${norms.city.toFixed(1)} / т.${norms.hwy.toFixed(1)}</p>
        <p style="margin:0 0 4px;">📊 Норм. расход: город ${normCityL.toFixed(2)} + трасса ${normHwyL.toFixed(2)} = <b>${normTotal.toFixed(2)} л</b> (ср. ${avgNorm.toFixed(2)})</p>
        <p style="margin:0 0 4px;">🛞 <span class="highlight-red">Факт. расход: ${factFuel.toFixed(2)} л (${fact100.toFixed(2)} л/100км)</span></p>
    `;

    updateHints();
}

function updateHints() {
    const history = getHistory();
    if (history.length) {
        history.sort((a, b) => b.timestamp - a.timestamp);
        const last = history[0];

        const odoVal = parseFloat(startOdometer.value);
        const lastEnd = parseFloat(last.конечныйПробег);
        if (!isNaN(lastEnd) && !isNaN(odoVal) && Math.abs(lastEnd - odoVal) < 0.01) {
            startOdometerHint.textContent = `из ${last.date}`;
        } else if (!isNaN(odoVal)) {
            startOdometerHint.textContent = 'вручную';
        }

        const fuelVal = parseFloat(startFuel.value);
        const lastReturn = parseFloat(last.остатокВозврат);
        if (!isNaN(lastReturn) && !isNaN(fuelVal) && Math.abs(lastReturn - fuelVal) < 0.01) {
            startFuelHint.textContent = `из ${last.date}`;
        } else if (!isNaN(fuelVal)) {
            startFuelHint.textContent = 'вручную';
        }
    }
}

// ===== ФИЛЬТР МЕСЯЦА (sessionStorage) =====
function getSelectedMonth() {
    // sessionStorage хранит строку YYYY-MM
    const saved = sessionStorage.getItem('historyMonth');
    if (saved) return saved;
    // По умолчанию текущий месяц
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function setSelectedMonth(month) {
    sessionStorage.setItem('historyMonth', month);
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

    // Открываем историю с текущим выбранным месяцем
    const month = getSelectedMonth();
    historyMonth.value = month;
    renderHistory(month);
    historyModal.style.display = 'flex';
});

// ===== ОТОБРАЖЕНИЕ ИСТОРИИ С ФИЛЬТРОМ =====
function renderHistory(month) {
    const history = getHistory();
    if (!history.length) { historyList.innerHTML = '<p>История пуста.</p>'; return; }

    // Фильтруем записи, у которых дата начинается с month (YYYY-MM)
    const filtered = history.filter(entry => {
        if (!entry.date) return false;
        return entry.date.startsWith(month);
    });
    filtered.sort((a, b) => b.timestamp - a.timestamp);

    if (filtered.length === 0) {
        historyList.innerHTML = '<p>Нет записей за этот месяц.</p>';
        return;
    }

    let html = '<table><tr><th>Дата</th><th>Пробег нач.</th><th>Конец</th><th>Город</th><th>Трасса</th><th>Выезд</th><th>Возврат</th><th>Расход</th></tr>';
    filtered.forEach((e, i) => {
        html += `<tr>
            <td>${e.date}</td><td>${e.начальныйПробег}</td><td>${e.конечныйПробег}</td>
            <td>${e.город || 0}</td><td>${e.трасса || 0}</td>
            <td>${e.остатокВыезд}</td><td>${e.остатокВозврат}</td>
            <td>${e.расход}</td>
            <td><button class="delete-entry" data-index="${i}" data-full-index="${history.indexOf(e)}">🗑</button></td>
        </tr>`;
    });
    html += '</table>';
    historyList.innerHTML = html;

    document.querySelectorAll('.delete-entry').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Используем сохранённый индекс в оригинальном массиве
            const fullIndex = parseInt(e.target.getAttribute('data-full-index'));
            deleteHistoryEntry(fullIndex, month);
        });
    });
}

function deleteHistoryEntry(fullIndex, month) {
    const history = getHistory();
    if (fullIndex >= 0 && fullIndex < history.length) {
        history.splice(fullIndex, 1);
        saveHistory(history);
        renderHistory(month);
        setStartOdometerFromHistory();
        setStartFuelFromHistory();
        updateLiveResults();
    }
}

// ===== ОТКРЫТИЕ ИСТОРИИ ПО КНОПКЕ =====
historyBtn.addEventListener('click', () => {
    const month = getSelectedMonth();
    historyMonth.value = month;
    renderHistory(month);
    historyModal.style.display = 'flex';
});

// ===== ЗАКРЫТИЕ МОДАЛЬНОГО ОКНА =====
closeHistoryModal.addEventListener('click', () => historyModal.style.display = 'none');
window.addEventListener('click', (e) => {
    if (e.target === historyModal) historyModal.style.display = 'none';
    if (e.target === pointsModal) pointsModal.style.display = 'none';
});

// ===== ОЧИСТКА ВСЕЙ ИСТОРИИ =====
clearHistoryBtn.addEventListener('click', () => {
    if (confirm('Удалить всю историю расчётов?')) {
        try {
            localStorage.removeItem('putevoyHistory');
            renderHistory(getSelectedMonth());
            setStartOdometerFromHistory();
            setStartFuelFromHistory();
            updateLiveResults();
        } catch (e) {
            console.error(e);
        }
    }
});

// ===== ФИЛЬТР МЕСЯЦА (изменение) =====
historyMonth.addEventListener('change', () => {
    const month = historyMonth.value;
    setSelectedMonth(month);
    renderHistory(month);
});

// ===== ТОЧКИ (без изменений) =====
pointsBtn.addEventListener('click', () => {
    pointDate.value = new Date().toISOString().split('T')[0];
    renderPoints();
    pointsModal.style.display = 'flex';
});
closePointsModal.addEventListener('click', () => pointsModal.style.display = 'none');

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
    // Установим значение месяца по умолчанию в поле (при открытии страницы)
    historyMonth.value = getSelectedMonth();
});
