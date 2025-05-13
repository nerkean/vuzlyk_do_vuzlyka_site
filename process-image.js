const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');

// 1. Определяем конфигурацию размеров и качества (аналогично твоему коду)
const SIZES_CONFIG = {
    large: { width: 1000, quality: 80 },
    medium: { width: 600, quality: 75 },
    thumb: { width: 300, quality: 70 }
};

// 2. Определяем папку для сохранения обработанных изображений
// Можешь изменить 'processed_images_output' на любое другое имя или путь
const outputDir = path.join(__dirname, 'images', 'uploads');

/**
 * Обрабатывает одно изображение, создавая его версии в разных размерах.
 * @param {string} inputImagePath - Путь к исходному изображению.
 * @param {string} targetOutputDir - Папка, куда будут сохранены обработанные изображения.
 */
async function processImage(inputImagePath, targetOutputDir) {
    try {
        // Проверяем, существует ли файл и доступен ли он
        await fs.access(inputImagePath);

        const originalFilename = path.basename(inputImagePath);
        const baseFilename = path.parse(originalFilename).name; // Имя файла без расширения

        console.log(`Обработка файла: ${originalFilename}...`);
        console.log(`Результаты будут сохранены в: ${targetOutputDir}`);

        // Читаем исходное изображение
        const imageBuffer = await fs.readFile(inputImagePath);
        const imageProcessor = sharp(imageBuffer);

        // Обрабатываем для каждого заданного размера
        for (const [sizeName, options] of Object.entries(SIZES_CONFIG)) {
            const newFilename = `${baseFilename}-${sizeName}.webp`; // Новое имя файла, например, "myimage-large.webp"
            const outputPath = path.join(targetOutputDir, newFilename);

            console.log(`  Создание версии "${sizeName}": ${newFilename}`);

            await imageProcessor
                .clone() // Клонируем объект sharp для каждой операции, чтобы избежать модификации исходного
                .resize({ width: options.width, withoutEnlargement: true }) // Изменяем размер, не увеличивая, если изображение меньше
                .webp({ quality: options.quality }) // Конвертируем в WebP с заданным качеством
                .toFile(outputPath); // Сохраняем файл

            console.log(`    Сохранено: ${outputPath}`);
        }

        console.log(`Файл ${originalFilename} успешно обработан.`);

    } catch (error) {
        console.error(`Ошибка при обработке изображения ${inputImagePath}:`, error.message);
        if (error.code === 'ENOENT') {
            console.error('Исходный файл не найден.');
        }
        // Здесь можно добавить логику для очистки частично созданных файлов при ошибке, если это необходимо
    }
}

/**
 * Главная функция скрипта.
 */
async function main() {
    // Получаем пути к изображениям из аргументов командной строки
    const args = process.argv.slice(2); // Исключаем 'node' и путь к скрипту

    if (args.length === 0) {
        console.error('Использование: node process-images.js <путь_к_изображению_1> [путь_к_изображению_2 ...]');
        console.error('Пример: node process-images.js ./мое-фото.jpg ./другое-фото.png');
        process.exit(1); // Выход с кодом ошибки
    }

    // Создаем папку для выходных файлов, если она еще не существует
    try {
        await fs.mkdir(outputDir, { recursive: true });
        console.log(`Папка для результатов (${outputDir}) создана или уже существует.`);
    } catch (err) {
        console.error(`Ошибка при создании папки ${outputDir}:`, err);
        process.exit(1); // Выход, если не удалось создать папку
    }

    // Обрабатываем каждое указанное изображение
    for (const imagePath of args) {
        // path.resolve преобразует относительный путь в абсолютный
        await processImage(path.resolve(imagePath), outputDir);
    }

    console.log('Все указанные изображения обработаны.');
}

// Запускаем главную функцию
main();