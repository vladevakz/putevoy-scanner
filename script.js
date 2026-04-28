// Получаем ссылки на элементы страницы
const video = document.getElementById('video');
const captureButton = document.getElementById('captureButton');
const startButton = document.getElementById('startButton');
const rawTextDiv = document.getElementById('rawText');
const calculationsDiv = document.getElementById('calculations');

// =============================================
// 1. ФУНКЦИЯ ЗАПУСКА КАМЕРЫ
// =============================================
async function startCamera() {
    try {
        // Запрашиваем доступ к задней камере (facingMode: 'environment')
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
        });
        video.srcObject = stream;
        // Включаем кнопку распознавания, когда камера готова
        captureButton.disabled = false;
    } catch (err) {
        alert('Не удалось запустить камеру: ' + err.message);
    }
}

// =============================================
// 2. ФУНКЦИЯ РАСПОЗНАВАНИЯ И РАСЧЁТА
// =============================================
async function captureAndRecognize() {
    // Показываем пользователю, что началась работа
    rawTextDiv.textContent = 'Идёт распознавание...';
    calculationsDiv.textContent = '';

    // Создаём экземпляр Tesseract для русского языка ('rus')
    const worker = await Tesseract.createWorker('rus');
    
    // Запускаем распознавание. Передаём video – он возьмёт текущий кадр
    const { data: { text } } = await worker.recognize(video);
    
    // Показываем «сырой» текст, который нашёл движок (для отладки)
    rawTextDiv.textContent = text;
    
    // Освобождаем ресурсы, чтобы не грузить телефон
    await worker.terminate();
    
    // Вызываем функцию, которая попытается найти цифры и посчитать
    calculateData(text);
}

// =============================================
// 3. ФУНКЦИЯ ПАРСИНГА И РАСЧЁТА ДАННЫХ ПУТЕВОГО ЛИСТА
// =============================================
function calculateData(rawText) {
    // ВАЖНО: вам может понадобиться настроить регулярные выражения 
    // под точный формат ваших путевых листов.
    // Ниже – наиболее универсальные паттерны для поиска чисел.
    
    // Ищем числа рядом со словами. \s* — возможный пробел, :? — возможно двоеточие.
    // Обратите внимание: мы используем флаг i (игнорировать регистр букв)
    const пробегMatch = rawText.match(/пробег[:\s]*(\d+)/i);
    const остатокВыездMatch = rawText.match(/остаток.?при.?выезде[:\s]*(\d+)/i);
    const остатокВозвратMatch = rawText.match(/остаток.?при.?возврате[:\s]*(\d+)/i);
    const заправленоMatch = rawText.match(/заправлено[:\s]*(\d+)/i);
    
    // Извлекаем числа, если нашли. Если нет – подставляем 0.
    const пробег = пробегMatch ? parseInt(пробегMatch[1]) : 0;
    const остатокВыезд = остатокВыездMatch ? parseFloat(остатокВыездMatch[1]) : 0;
    const остатокВозврат = остатокВозвратMatch ? parseFloat(остатокВозвратMatch[1]) : 0;
    const заправлено = заправленоMatch ? parseFloat(заправленоMatch[1]) : 0;
    
    // Рассчитываем расход
    const расход = остатокВыезд + заправлено - остатокВозврат;
    const расходНа100км = пробег > 0 ? ((расход / пробег) * 100).toFixed(1) : 0;
    
    // Выводим результаты в красивом виде
    calculationsDiv.innerHTML = `
        <p><strong>📏 Пробег:</strong> ${пробег} км</p>
        <p><strong>⛽ Остаток при выезде:</strong> ${остатокВыезд} л</p>
        <p><strong>🛢 Заправлено:</strong> ${заправлено} л</p>
        <p><strong>🏁 Остаток при возврате:</strong> ${остатокВозврат} л</p>
        <hr>
        <p style="font-size: 1.3em; color: #d32f2f;"><strong>Общий расход:</strong> ${расход} л</p>
        <p><strong>📉 Расход на 100 км:</strong> ${расходНа100км} л</p>
    `;
}

// =============================================
// 4. ПРИВЯЗЫВАЕМ КНОПКИ К ДЕЙСТВИЯМ
// =============================================
startButton.addEventListener('click', startCamera);
captureButton.addEventListener('click', captureAndRecognize);
