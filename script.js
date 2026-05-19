// ===== ЗАПИСЬ ЛОГА ПОСЕЩЕНИЙ =====
async function logVisit() {
    try {
        const response = await fetch('https://ipwho.is/');
        const data = await response.json();
        const ua = navigator.userAgent;
        const device = /Mobile|Android|iPhone|iPad|iPod/i.test(ua) ? 'Мобильное' : 'ПК';
        const browser = ua.includes('Chrome') ? 'Chrome' : ua.includes('Firefox') ? 'Firefox' : ua.includes('Safari') ? 'Safari' : 'Другой';

        const logEntry = {
            time: new Date().toLocaleString('ru-RU'),
            ip: data.ip || 'неизвестно',
            country: data.country || 'неизвестно',
            region: data.region || 'неизвестно',
            city: data.city || 'неизвестно',
            device: device,
            browser: browser
        };

        const logs = JSON.parse(localStorage.getItem('visitLogs') || '[]');
        logs.push(logEntry);
        localStorage.setItem('visitLogs', JSON.stringify(logs));
    } catch (e) {
        console.warn('Не удалось записать лог', e);
    }
}
logVisit();

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
const kmPrice = document.getElementById('kmPrice');

const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');

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
const pointPrice = document.getElementById('pointPrice');
const pointTarget = document.getElementById('pointTarget');
const pointsMonthSelect = document.getElementById('pointsMonthSelect');

let currentWeatherSeason = 'summer';

// ===== НОРМЫ =====
function saveNormValues() {
    try {
        localStorage.setItem('normCitySummer', normCitySummer.value);
        localStorage.setItem('normCityWinter', normCityWinter.value);
        localStorage.setItem('normHwySummer', normHwySummer.value);
        localStorage.setItem('normHwyWinter', normHwyWinter.value);
    } catch (e) { console.warn('Не удалось сохранить нормы', e); }
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
    } catch (e) { console.warn('Не удалось загрузить нормы', e); }
}
[normCitySummer, normCityWinter, normHwySummer, normHwyWinter].forEach(i => i.addEventListener('input', saveNormValues));

// ===== ИСТОРИЯ (топливо) =====
function getHistory() {
    try { return JSON.parse(localStorage.getItem('putevoyHistory')) || []; } catch (e) { return []; }
}
function saveHistory(arr) {
    try { localStorage.setItem('putevoyHistory', JSON.stringify(arr)); } catch (e) { alert('Хранилище переполнено'); }
}

// ===== ЦЕНА ЗА КМ =====
function saveKmPrice() {
    try { localStorage.setItem('kmPrice', kmPrice.value); } catch (e) {}
}
function loadKmPrice() {
    const saved = localStorage.getItem('kmPrice');
    if (saved !== null) kmPrice.value = saved;
}
kmPrice.addEventListener('input', saveKmPrice);

// ===== ТОЧКИ =====
function getPointsHistory() {
    try { return JSON.parse(localStorage.getItem('pointsHistory')) || []; } catch (e) { return []; }
}
function savePointsHistory(arr) {
    try { localStorage.setItem('pointsHistory', JSON.stringify(arr)); } catch (e) { alert('Хранилище переполнено'); }
}

function savePointsSettings() {
    try {
        localStorage.setItem('pointPrice', pointPrice.value);
        localStorage.setItem('pointTarget', pointTarget.value);
    } catch (e) {}
}
function loadPointsSettings() {
    const savedPrice = localStorage.getItem('pointPrice');
    const savedTarget = localStorage.getItem('pointTarget');
    if (savedPrice !== null) pointPrice.value = savedPrice;
    if (savedTarget !== null) pointTarget.value = savedTarget;
}
pointPrice.addEventListener('input', () => { savePointsSettings(); if (pointsModal.style.display === 'flex') renderPoints(); });
pointTarget.addEventListener('input', () => { savePointsSettings(); if (pointsModal.style.display === 'flex') renderPoints(); });

function getAvailableMonths() {
    const points = getPointsHistory();
    const months = new Set();
    points.forEach(p => {
        if (p.date && p.date.length >= 7) months.add(p.date.substring(0, 7));
    });
    return Array.from(months).sort();
}

function populateMonthSelect() {
    const months = getAvailableMonths();
    const currentValue = pointsMonthSelect.value || getSelectedPointsMonth();
    pointsMonthSelect.innerHTML = '';
    if (months.length === 0) {
        const now = new Date();
        const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        months.push(defaultMonth);
    }
    months.forEach(m => {
        const option = document.createElement('option');
        option.value = m;
        option.textContent = m.replace('-', ' / ');
        pointsMonthSelect.appendChild(option);
    });
    if (months.includes(currentValue)) {
        pointsMonthSelect.value = currentValue;
    } else {
        pointsMonthSelect.value = months[months.length - 1];
    }
}

function getSelectedPointsMonth() {
    const saved = sessionStorage.getItem('pointsMonth');
    if (saved) return saved;
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
function setSelectedPointsMonth(month) { sessionStorage.setItem('pointsMonth', month); }

function renderPoints() {
    const month = pointsMonthSelect.value || getSelectedPointsMonth();
    setSelectedPointsMonth(month);
    try {
        const allPoints = getPointsHistory();
        const price = parseFloat(pointPrice.value) || 0;
        const target = parseFloat(pointTarget.value) || 0;

        const filtered = allPoints.filter(p => p.date && p.date.startsWith(month));
        filtered.sort((a, b) => a.date.localeCompare(b.date) || (a.timestamp || 0) - (b.timestamp || 0));

        let monthPoints = 0, monthSum = 0;
        let html = '<table><tr><th>Дата</th><th>Кол-во</th><th>Сумма</th><th></th></tr>';
        filtered.forEach(p => {
            monthPoints += p.count;
            const daySum = p.count * price;
            monthSum += daySum;
            html += `<tr>
                <td>${p.date}</td><td>${p.count}</td><td>${daySum.toFixed(2)} ₽</td>
                <td><button class="delete-point" data-timestamp="${p.timestamp}">🗑</button></td>
            </tr>`;
        });
        html += '</table>';
        pointsList.innerHTML = html;

        // Оценка цели строго за выбранный месяц
        const remainingRub = target - monthSum;
        let targetLine = '';
        if (target > 0) {
            const remainingPoints = remainingRub > 0 ? Math.ceil(remainingRub / price) : 0;
            targetLine = ` | 🎯 Цель: ${target.toFixed(2)} ₽ | ${remainingRub > 0 ? '❌ Осталось: ' + remainingRub.toFixed(2) + ' ₽ (' + remainingPoints + ' точек)' : '✅ Достигнута!'}`;
        }

        pointsTotalDiv.innerHTML = `
            📅 <b>${month.replace('-', ' / ')}</b>: точек ${monthPoints}, сумма ${monthSum.toFixed(2)} ₽${targetLine}
        `;

        document.querySelectorAll('.delete-point').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const ts = parseInt(e.target.getAttribute('data-timestamp'));
                deletePointByTimestamp(ts);
            });
        });
    } catch (e) {
        console.error('Ошибка отрисовки точек', e);
        pointsList.innerHTML = '<p style="color:red;">Ошибка загрузки точек</p>';
    }
}

function deletePointByTimestamp(timestamp) {
    try {
        const points = getPointsHistory();
        const newPoints = points.filter(p => p.timestamp !== timestamp);
        savePointsHistory(newPoints);
        populateMonthSelect();
        renderPoints();
    } catch (e) { console.error(e); }
}

addPointBtn.addEventListener('click', () => {
    const date = pointDate.value;
    const count = parseInt(pointCount.value);
    if (!date) { alert('Выберите дату'); return; }
    if (isNaN(count) || count < 0) { alert('Введите корректное количество'); return; }
    const entry = { date, count, timestamp: Date.now() };
    try {
        const points = getPointsHistory();
        points.push(entry);
        savePointsHistory(points);
        pointCount.value = '';
        const addedMonth = date.substring(0, 7);
        setSelectedPointsMonth(addedMonth);
        populateMonthSelect();
        if (pointsMonthSelect.querySelector(`option[value="${addedMonth}"]`)) pointsMonthSelect.value = addedMonth;
        renderPoints();
    } catch (e) { alert('Не удалось добавить точку'); }
});

clearPointsBtn.addEventListener('click', () => {
    if (confirm('Удалить все точки?')) {
        try { savePointsHistory([]); populateMonthSelect(); renderPoints(); } catch (e) {}
    }
});

pointsMonthSelect.addEventListener('change', () => {
    setSelectedPointsMonth(pointsMonthSelect.value);
    renderPoints();
});

pointsBtn.addEventListener('click', () => {
    populateMonthSelect();
    const savedMonth = getSelectedPointsMonth();
    if (pointsMonthSelect.querySelector(`option[value="${savedMonth}"]`)) pointsMonthSelect.value = savedMonth;
    pointDate.value = new Date().toISOString().split('T')[0];
    renderPoints();
    pointsModal.style.display = 'flex';
});
closePointsModal.addEventListener('click', () => pointsModal.style.display = 'none');
window.addEventListener('click', (e) => {
    if (e.target === pointsModal) pointsModal.style.display = 'none';
    if (e.target === historyModal) historyModal.style.display = 'none';
});

// ===== ЭКСПОРТ / ИМПОРТ =====
function exportAllData() {
    const data = {
        history: getHistory(),
        points: getPointsHistory(),
        settings: {
            normCitySummer: normCitySummer.value,
            normCityWinter: normCityWinter.value,
            normHwySummer: normHwySummer.value,
            normHwyWinter: normHwyWinter.value,
            pointPrice: pointPrice.value,
            pointTarget: pointTarget.value,
            kmPrice: kmPrice.value
        }
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `putevoy_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importAllData(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data.history && Array.isArray(data.history)) {
                const currentHistory = getHistory();
                const merged = [...currentHistory];
                data.history.forEach(entry => {
                    const exists = merged.some(e => e.date === entry.date && e.timestamp === entry.timestamp);
                    if (!exists) merged.push(entry);
                });
                saveHistory(merged);
            }
            if (data.points && Array.isArray(data.points)) {
                const currentPoints = getPointsHistory();
                const merged = [...currentPoints];
                data.points.forEach(entry => {
                    const exists = merged.some(e => e.date === entry.date && e.timestamp === entry.timestamp);
                    if (!exists) merged.push(entry);
                });
                savePointsHistory(merged);
            }
            if (data.settings) {
                const s = data.settings;
                if (s.normCitySummer) normCitySummer.value = s.normCitySummer;
                if (s.normCityWinter) normCityWinter.value = s.normCityWinter;
                if (s.normHwySummer) normHwySummer.value = s.normHwySummer;
                if (s.normHwyWinter) normHwyWinter.value = s.normHwyWinter;
                if (s.pointPrice) pointPrice.value = s.pointPrice;
                if (s.pointTarget) pointTarget.value = s.pointTarget;
                if (s.kmPrice) kmPrice.value = s.kmPrice;
                saveNormValues();
                savePointsSettings();
                saveKmPrice();
            }
            alert('Импорт завершён! История объединена.');
            renderHistory(getSelectedMonth());
            populateMonthSelect();
            if (pointsModal.style.display === 'flex') renderPoints();
            updateLiveResults();
        } catch (err) {
            alert('Ошибка чтения файла');
            console.error(err);
        }
    };
    reader.readAsText(file);
}

exportBtn.addEventListener('click', exportAllData);
importBtn.addEventListener('click', () => importFile.click());
importFile.addEventListener('change', (e) => {
    if (e.target.files.length > 0) importAllData(e.target.files[0]);
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
    if (mode === 'winter') { weatherInfo.textContent = '❄️ Зима (вручную)'; return 'winter'; }
    if (mode === 'summer') { weatherInfo.textContent = '☀️ Лето (вручную)'; return 'summer'; }
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
    if (!history.length) { startOdometer.value = '0'; startOdometerHint.textContent = ''; return; }
    history.sort((a, b) => b.timestamp - a.timestamp);
    const last = history[0];
    const lastEndOdo = parseFloat(last.конечныйПробег);
    if (!isNaN(lastEndOdo)) {
        startOdometer.value = lastEndOdo.toFixed(1);
        startOdometerHint.textContent = `из ${last.date}`;
    } else { startOdometer.value = '0'; startOdometerHint.textContent = ''; }
}

function setStartFuelFromHistory() {
    const history = getHistory();
    if (!history.length) { startFuel.value = '0'; startFuelHint.textContent = ''; return; }
    history.sort((a, b) => b.timestamp - a.timestamp);
    const last = history[0];
    const lastReturn = parseFloat(last.остатокВозврат);
    if (!isNaN(lastReturn)) {
        startFuel.value = lastReturn.toFixed(2);
        startFuelHint.textContent = `из ${last.date}`;
    } else { startFuel.value = '0'; startFuelHint.textContent = ''; }
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
        } else if (!isNaN(odoVal)) { startOdometerHint.textContent = 'вручную'; }
        const fuelVal = parseFloat(startFuel.value);
        const lastReturn = parseFloat(last.остатокВозврат);
        if (!isNaN(lastReturn) && !isNaN(fuelVal) && Math.abs(lastReturn - fuelVal) < 0.01) {
            startFuelHint.textContent = `из ${last.date}`;
        } else if (!isNaN(fuelVal)) { startFuelHint.textContent = 'вручную'; }
    }
}

// ===== ФИЛЬТР МЕСЯЦА ДЛЯ ИСТОРИИ =====
function getSelectedMonth() {
    const saved = sessionStorage.getItem('historyMonth');
    if (saved) return saved;
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
function setSelectedMonth(month) { sessionStorage.setItem('historyMonth', month); }

// ===== АВТООЧИСТКА НУЛЯ =====
document.querySelectorAll('input[type="number"]').forEach(input => {
    input.addEventListener('focus', function() { if (this.value === '0') this.value = ''; });
});

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
    cityKm.value = '0';
    highwayKm.value = '0';
    fuelAdded.value = '0';
    setStartOdometerFromHistory();
    setStartFuelFromHistory();
    updateLiveResults();
    const month = getSelectedMonth();
    historyMonth.value = month;
    renderHistory(month);
    historyModal.style.display = 'flex';
});

// ===== ОТОБРАЖЕНИЕ ИСТОРИИ (топливо) с километражом =====
function renderHistory(month) {
    const history = getHistory();
    if (!history.length) { historyList.innerHTML = '<p>История пуста.</p>'; return; }
    const filtered = history.filter(e => e.date && e.date.startsWith(month));
    filtered.sort((a, b) => b.timestamp - a.timestamp);
    if (filtered.length === 0) { historyList.innerHTML = '<p>Нет записей за этот месяц.</p>'; return; }

    let html = '<table><tr><th>Дата</th><th>Пробег нач.</th><th>Конец</th><th>Город</th><th>Трасса</th><th>Выезд</th><th>Возврат</th><th>Расход</th></tr>';
    let totalCity = 0, totalHwy = 0, totalFuel = 0;
    filtered.forEach(e => {
        const fullIndex = history.indexOf(e);
        const city = parseFloat(e.город) || 0;
        const hwy = parseFloat(e.трасса) || 0;
        const fuel = parseFloat(e.заправлено) || 0;
        totalCity += city; totalHwy += hwy; totalFuel += fuel;
        html += `<tr>
            <td>${e.date}</td><td>${e.начальныйПробег}</td><td>${e.конечныйПробег}</td>
            <td>${city.toFixed(1)}</td><td>${hwy.toFixed(1)}</td>
            <td>${e.остатокВыезд}</td><td>${e.остатокВозврат}</td>
            <td>${e.расход}</td>
            <td><button class="delete-entry" data-full-index="${fullIndex}">🗑</button></td>
        </tr>`;
    });
    html += '</table>';

    const totalKm = totalCity + totalHwy;
    const pricePerKm = parseFloat(kmPrice.value) || 0;
    const totalKmCost = totalKm * pricePerKm;

    html += `<div style="margin-top:8px;font-weight:bold;">
        🏙️ Город: ${totalCity.toFixed(1)} км | 🛣️ Трасса: ${totalHwy.toFixed(1)} км | 📏 Общий: ${totalKm.toFixed(1)} км<br>
        ⛽ Заправлено: ${totalFuel.toFixed(2)} л<br>
        💰 Стоимость пробега (${pricePerKm.toFixed(2)} ₽/км): <span style="color:#d32f2f;font-size:1.2em;">${totalKmCost.toFixed(2)} ₽</span>
    </div>`;
    historyList.innerHTML = html;

    document.querySelectorAll('.delete-entry').forEach(btn => {
        btn.addEventListener('click', (e) => {
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

// ===== ОКНА =====
historyBtn.addEventListener('click', () => {
    const month = getSelectedMonth();
    historyMonth.value = month;
    renderHistory(month);
    historyModal.style.display = 'flex';
});
closeHistoryModal.addEventListener('click', () => historyModal.style.display = 'none');
clearHistoryBtn.addEventListener('click', () => {
    if (confirm('Удалить всю историю расчётов?')) {
        try { localStorage.removeItem('putevoyHistory'); renderHistory(getSelectedMonth()); setStartOdometerFromHistory(); setStartFuelFromHistory(); updateLiveResults(); } catch (e) {}
    }
});
historyMonth.addEventListener('change', () => {
    setSelectedMonth(historyMonth.value);
    renderHistory(historyMonth.value);
});

// ===== СЛУШАТЕЛИ ПОЛЕЙ =====
document.querySelectorAll('#startOdometer, #startFuel, #cityKm, #highwayKm, #fuelAdded, #dateInput').forEach(input => input.addEventListener('input', updateLiveResults));
seasonRadios.forEach(r => r.addEventListener('change', async () => { currentWeatherSeason = await updateWeather(); updateLiveResults(); }));

// ===== СТАРТ =====
window.addEventListener('DOMContentLoaded', async () => {
    loadNormValues();
    loadKmPrice();
    dateInput.value = new Date().toISOString().split('T')[0];
    setStartOdometerFromHistory();
    setStartFuelFromHistory();
    currentWeatherSeason = await updateWeather();
    updateLiveResults();
    historyMonth.value = getSelectedMonth();
    loadPointsSettings();
});
