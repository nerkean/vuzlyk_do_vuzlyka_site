// process-image.js
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

// --- Конфигурация ---
// Размеры и качество, как в вашем adminRoutes.js
const SIZES = {
    large: { width: 1000, quality: 80 },
    medium: { width: 600, quality: 75 },
    thumb: { width: 300, quality: 70 }
};
const OUTPUT_FORMAT = 'webp'; // Формат вывода

// --- Получение аргументов командной строки ---
// process.argv[0] = 'node'
// process.argv[1] = 'process-image.js'
// process.argv[2] = inputImagePath
// process.argv[3] = outputDirectory (необязательно)

const inputImagePath = process.argv[2];
const outputDirectory = process.argv[3] || path.join(__dirname, 'processed_images'); // Папка по умолчанию

// --- Валидация аргументов ---
if (!inputImagePath) {
    console.error('\x1b[31m%s\x1b[0m', 'Помилка: Не вказано шлях до вхідного зображення.');
    console.log('\x1b[36m%s\x1b[0m', 'Використання: node process-image.js <шлях_до_вхідного_файлу> [шлях_до_вихідної_папки]');
    process.exit(1); // Выход с кодом ошибки
}

// --- Основная функция обработки ---
async function processImage() {
    try {
        // 1. Проверка существования входного файла
        console.log(`\x1b[34m%s\x1b[0m`, `Перевірка файлу: ${inputImagePath}`);
        await fs.access(inputImagePath, fs.constants.R_OK); // Проверяем доступность для чтения
        console.log(`\x1b[32m%s\x1b[0m`, 'Вхідний файл знайдено.');

        // 2. Создание выходной папки, если ее нет
        console.log(`\x1b[34m%s\x1b[0m`, `Перевірка/створення вихідної папки: ${outputDirectory}`);
        await fs.mkdir(outputDirectory, { recursive: true });
        console.log(`\x1b[32m%s\x1b[0m`, 'Вихідна папка готова.');

        // 3. Чтение входного файла в буфер
        console.log(`\x1b[34m%s\x1b[0m`, 'Читання вхідного файлу...');
        const imageBuffer = await fs.readFile(inputImagePath);
        console.log(`\x1b[32m%s\x1b[0m`, 'Файл успішно прочитано.');

        // 4. Подготовка базового имени файла для вывода
        const inputFileBasename = path.parse(inputImagePath).name;
        const timestamp = Date.now(); // Добавляем временную метку для уникальности
        const baseOutputFilename = `${inputFileBasename}-${timestamp}`;

        // 5. Обработка и сохранение разных размеров
        console.log(`\x1b[34m%s\x1b[0m`, 'Обробка зображення за допомогою Sharp...');
        const imageProcessor = sharp(imageBuffer); // Создаем объект sharp

        const outputPaths = {};

        for (const [sizeName, options] of Object.entries(SIZES)) {
            const outputFilename = `${baseOutputFilename}-${sizeName}.${OUTPUT_FORMAT}`;
            const outputPath = path.join(outputDirectory, outputFilename);

            console.log(` -> Створення версії '${sizeName}' (${options.width}px, quality: ${options.quality})...`);

            await imageProcessor
                .clone() // Важно клонировать для каждой операции!
                .resize({ width: options.width, withoutEnlargement: true }) // Изменяем размер
                .toFormat(OUTPUT_FORMAT, { quality: options.quality }) // Устанавливаем формат и качество
                .toFile(outputPath); // Сохраняем файл

            outputPaths[sizeName] = outputPath;
            console.log(`    \x1b[32mЗбережено:\x1b[0m ${outputPath}`);
        }

        console.log('\n\x1b[1m\x1b[32m%s\x1b[0m', 'Обробку завершено успішно!');
        console.log('\x1b[33m%s\x1b[0m', 'Створені файли:');
        for(const sizeName in outputPaths) {
            console.log(` - ${sizeName.padEnd(6)}: ${outputPaths[sizeName]}`);
        }

    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', '\nСталася помилка під час обробки:');
        if (error.code === 'ENOENT') {
            console.error(`Помилка: Вхідний файл не знайдено за шляхом "${inputImagePath}"`);
        } else {
            console.error(error.message);
            // console.error(error.stack); // Раскомментируйте для детального стека ошибки
        }
        process.exit(1); // Выход с кодом ошибки
    }
}

// --- Запуск обработки ---
processImage();