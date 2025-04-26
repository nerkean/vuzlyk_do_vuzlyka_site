const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Order = require('../models/Order');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');

const uploadDir = path.join(__dirname, '..', 'public', 'images', 'uploads');
fs.mkdir(uploadDir, { recursive: true })
    .then(() => console.log(`Папка для завантажень існує або створена: ${uploadDir}`))
    .catch(err => console.error(`Помилка створення папки ${uploadDir}:`, err));

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const mimetype = allowedTypes.test(file.mimetype);
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
        return cb(null, true);
    }
    cb(new Error('Дозволено завантажувати лише файли зображень (jpg, jpeg, png, gif, webp)!'), false);
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: fileFilter
});

function checkAdminAuth(req, res, next) {
    if (req.session && req.session.isAdmin) {
        return next();
    }
    res.redirect('/admin/login');
}

router.get('/login', (req, res) => {
    if (req.session.isAdmin) return res.redirect('/admin/orders');
    res.render('admin/login', {
        error: req.query.error === '1' ? 'Неправильний логін або пароль.' : null
    });
});

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const adminUser = process.env.ADMIN_USER;
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminUser || !adminPassword) {
        console.error("ПОМИЛКА: ADMIN_USER або ADMIN_PASSWORD не встановлені в .env");
        return res.redirect('/admin/login?error=2');
    }
    if (username === adminUser && password === adminPassword) {
        req.session.isAdmin = true;
        console.log('Admin logged in successfully.');
        res.redirect('/admin/orders');
    } else {
        console.log('Admin login failed.');
        res.redirect('/admin/login?error=1');
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error("Помилка при виході:", err);
        }
        res.clearCookie('connect.sid');
        console.log('Admin logged out.');
        res.redirect('/admin/login');
    });
});

router.get('/orders', checkAdminAuth, async (req, res) => {
    try {
        const orders = await Order.find().sort({ receivedAt: -1 }).lean();
        res.render('admin/orders', {
            orders: orders,
            pageTitle: "Керування Замовленнями"
        });
    } catch (error) {
        console.error("Помилка завантаження замовлень:", error);
        res.status(500).render('admin/error', { message: 'Не вдалося завантажити замовлення' });
    }
});

router.post('/orders/:id/update-status', checkAdminAuth, async (req, res) => {
    const orderId = req.params.id;
    const { newStatus } = req.body;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
        return res.status(400).json({ success: false, message: 'Неправильний ID замовлення.' });
    }
    const allowedStatuses = ['Новий', 'В обробці', 'Узгоджено', 'Виконано', 'Скасовано'];
    if (!newStatus || !allowedStatuses.includes(newStatus)) {
        return res.status(400).json({ success: false, message: 'Неприпустимий статус замовлення.' });
    }
    try {
        const updatedOrder = await Order.findByIdAndUpdate(orderId, { status: newStatus }, { new: true });
        if (!updatedOrder) {
            return res.status(404).json({ success: false, message: 'Замовлення не знайдено.' });
        }
        res.json({ success: true, message: 'Статус оновлено', newStatus: updatedOrder.status });
    } catch (error) {
        console.error(`Помилка оновлення статусу замовлення ${orderId}:`, error);
        res.status(500).json({ success: false, message: 'Помилка сервера при оновленні статусу.' });
    }
});

router.delete('/orders/:id', checkAdminAuth, async (req, res) => {
    const orderId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
        return res.status(400).json({ success: false, message: 'Неправильний ID замовлення.' });
    }
    try {
        const deletedOrder = await Order.findByIdAndDelete(orderId);
        if (!deletedOrder) {
            return res.status(404).json({ success: false, message: 'Замовлення не знайдено.' });
        }
        res.json({ success: true, message: 'Замовлення видалено' });
    } catch (error) {
        console.error(`Помилка видалення замовлення ${orderId}:`, error);
        res.status(500).json({ success: false, message: 'Помилка сервера при видаленні замовлення.' });
    }
});

router.get('/products', checkAdminAuth, async (req, res, next) => {
    try {
        const products = await Product.find({}).sort({ createdAt: -1 }).lean();
        res.render('admin/products', {
            pageTitle: 'Керування Товарами',
            products: products
        });
    } catch (error) {
        console.error("Помилка завантаження товарів для адмін-панелі:", error);
        next(error);
    }
});

router.get('/products/new', checkAdminAuth, (req, res) => {
    const categories = ['Вишивка'];
    res.render('admin/new-product', {
        pageTitle: 'Додати Новий Товар',
        categories: categories,
        formData: {},
        error: req.query.error || null,
        query: req.query
    });
});

router.post('/products', checkAdminAuth, upload.array('imageFiles', 10), async (req, res, next) => {
    const categories = ['Вишивка'];
    const formData = req.body;

    if (req.fileValidationError) {
        if (req.files) {
            await Promise.all(req.files.map(file => fs.unlink(file.path).catch(e => console.error("Failed to delete invalid file:", e))));
        }
        return res.status(400).render('admin/new-product', {
            pageTitle: 'Помилка - Додати Товар', categories, formData,
            error: req.fileValidationError
        });
    }

    if (!req.files || req.files.length === 0) {
        return res.status(400).render('admin/new-product', {
            pageTitle: 'Помилка - Додати Товар', categories, formData,
            error: 'Необхідно завантажити хоча б одне зображення.'
        });
    }

    try {
        const {
            name, description, price, maxPrice, category,
            tags, materials, colors, care_instructions, isFeatured,
            creation_time_info,
            status, metaDescription 
        } = req.body;

        if (!name || !description || !price || !category || !creation_time_info) {
            await Promise.all(req.files.map(file => fs.unlink(file.path).catch(e => console.error("Cleanup failed:", e))));
            return res.status(400).render('admin/new-product', {
                pageTitle: 'Помилка - Додати Товар', categories, formData,
                error: 'validation'
            });
        }
        const numPrice = parseFloat(price) || 0;
        const numMaxPrice = maxPrice ? (parseFloat(maxPrice) || null) : null;

        if (numMaxPrice !== null && numMaxPrice < numPrice) {
            if (req.files) { req.files.forEach(file => { try { fs.unlinkSync(file.path); } catch(e){} }); }
            return res.status(400).render('admin/new-product', {
                pageTitle: 'Помилка - Додати Товар', categories, formData,
                error: 'price_validation'
            });
        }

        const processedImagesData = [];
        const filesToDeleteOnError = [];

        for (const file of req.files) {
            const originalPath = file.path;
            const baseFilename = path.parse(file.filename).name;
            const imagePaths = {};
            const generatedFiles = [];

            let imageBuffer;
            try {
                imageBuffer = await fs.readFile(originalPath);
                await fs.unlink(originalPath);
            } catch (readOrDeleteError) {
                filesToDeleteOnError.push(originalPath);
                continue;
            }

            try {
                const sizes = {
                    large: { width: 1000, quality: 80 },
                    medium: { width: 600, quality: 75 },
                    thumb: { width: 300, quality: 70 }
                };

                const imageProcessor = sharp(imageBuffer);

                for (const [sizeName, options] of Object.entries(sizes)) {
                    const newFilename = `${baseFilename}-${sizeName}.webp`;
                    const outputPath = path.join(uploadDir, newFilename);

                    await imageProcessor
                        .clone()
                        .resize({ width: options.width, withoutEnlargement: true })
                        .webp({ quality: options.quality })
                        .toFile(outputPath);

                    const relativePath = `/images/uploads/${newFilename}`;
                    imagePaths[sizeName] = relativePath;
                    generatedFiles.push(outputPath);
                }

                processedImagesData.push(imagePaths);

            } catch (sharpError) {
                await Promise.all(generatedFiles.map(p => fs.unlink(p).catch(e => console.warn(`Не вдалося видалити ${p}:`, e))));
                throw new Error(`Помилка обробки зображення: ${file.originalname}`);
            }
        }

        if (processedImagesData.length === 0) {
            await Promise.all(filesToDeleteOnError.map(filePath => fs.unlink(filePath).catch(e => console.error("Cleanup failed for unprocessed file:", e))));
            return res.status(400).render('admin/new-product', {
                pageTitle: 'Помилка - Додати Товар', categories, formData,
                error: 'Не вдалося обробити завантажені зображення.'
            });
        }

        const processedTags = tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
        const processedMaterials = materials ? materials.split(',').map(m => m.trim()).filter(m => m) : [];
        const processedColors = colors ? colors.split(',').map(c => c.trim()).filter(c => c) : [];

        const newProduct = new Product({
            name,
            description,
            metaDescription: metaDescription ? metaDescription.trim() : null,
            price: numPrice,
            maxPrice: (numMaxPrice !== null && numMaxPrice >= numPrice) ? numMaxPrice : undefined,
            category,
            status: status || 'Під замовлення',
            images: processedImagesData,
            tags: processedTags,
            materials: processedMaterials,
            colors: processedColors,
            care_instructions,
            creation_time_info,
            isFeatured: isFeatured === 'on'
        });

        await newProduct.save();
        res.redirect('/admin/products');
    } catch (error) {
        if (req.files && error.name !== 'Error') {
            await Promise.all(req.files.map(file => fs.unlink(file.path).catch(e => console.error("Cleanup failed:", e))));
        }
        if (error.name === 'ValidationError') {
            let errorMsg = 'Помилка валідації: ';
            for (let field in error.errors) { errorMsg += `${error.errors[field].message} `; }
            return res.status(400).render('admin/new-product', {
                pageTitle: 'Помилка - Додати Товар', categories, formData,
                error: errorMsg
            });
        }
        next(error);
    }
});

router.get('/products/:id/edit', checkAdminAuth, async (req, res, next) => {
    try {
        const productId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.redirect('/admin/products');
        }
        const product = await Product.findById(productId).lean();
        if (!product) {
            return res.redirect('/admin/products');
        }
        const categories = ['Вишивка'];

        let errorMessage = null;
        if (req.query.error === 'validation') errorMessage = 'Будь ласка, заповніть усі обов\'язкові поля (включаючи термін виготовлення).';
        else if (req.query.error === 'price_validation') errorMessage = 'Максимальна ціна не може бути меншою за мінімальну.';
        else if (req.query.error) errorMessage = 'Сталася помилка: ' + req.query.error;

        res.render('admin/edit-product', {
            pageTitle: `Редагувати: ${product.name}`,
            productData: product,
            categories: categories,
            errorMessage: errorMessage
        });
    } catch (error) {
        console.error('Помилка отримання товару для редагування:', error);
        next(error);
    }
});

router.put('/products/:id', checkAdminAuth, async (req, res, next) => {
    const productId = req.params.id;
    try {
         if (!mongoose.Types.ObjectId.isValid(productId)) {
             return res.redirect('/admin/products?error=invalid_id');
         }

         const {
            name, description, price, maxPrice, category,
            tags, materials, colors, care_instructions, isFeatured,
            creation_time_info, status, isPriceNegotiable,
            metaDescription
        } = req.body;
        if (!name || !description || !price || !category || !creation_time_info || !status) {
            return res.redirect(`/admin/products/${productId}/edit?error=validation`);
        }

        const numPrice = (isPriceNegotiable === 'on') ? 0 : (parseFloat(price) || 0);
         let parsedMaxPrice = parseFloat(maxPrice);
         const numMaxPrice = (isPriceNegotiable === 'on' || !maxPrice || maxPrice.trim() === '' || isNaN(parsedMaxPrice))
                             ? null
                             : parsedMaxPrice;

        if (numMaxPrice !== null && numPrice > numMaxPrice) {
            return res.redirect(`/admin/products/${productId}/edit?error=price_validation`);
        }

         const processedTags = tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : undefined;
         const processedMaterials = materials ? materials.split(',').map(m => m.trim()).filter(m => m) : undefined;
         const processedColors = colors ? colors.split(',').map(c => c.trim()).filter(c => c) : undefined;

        const updatedData = {
            name,
            description,
            metaDescription: metaDescription ? metaDescription.trim() : null,
            price: numPrice,
            maxPrice: numMaxPrice,
            category,
            status: status,
            isPriceNegotiable: isPriceNegotiable === 'on',
            tags: processedTags,
            materials: processedMaterials,
            colors: processedColors,
            care_instructions,
            creation_time_info,
            isFeatured: isFeatured === 'on'
        };

         const dataToSet = {};
         for (const key in updatedData) {
             if (updatedData[key] !== undefined) {
                 dataToSet[key] = updatedData[key];
             }
         }

        const updatedProduct = await Product.findByIdAndUpdate(
            productId,
            { $set: dataToSet },
            { new: true, runValidators: true, context: 'query' }
        );

        if (!updatedProduct) {
            return res.redirect('/admin/products?error=notfound_update');
        }

        res.redirect('/admin/products');

    } catch (error) {
        const productId = req.params.id;
        if (error.name === 'ValidationError') {
            let errorMsg = Object.values(error.errors).map(el => el.message).join(' ');
            return res.redirect(`/admin/products/${productId}/edit?error=${encodeURIComponent(errorMsg.trim())}`);
        }
        next(error);
    }
});

router.post('/products/:id/delete', checkAdminAuth, async (req, res, next) => {
    const productId = req.params.id;
    try {
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.redirect('/admin/products');
        }
        const productToDelete = await Product.findById(productId);
        if (!productToDelete) {
            return res.redirect('/admin/products?error=notfound_delete');
        }

        if (productToDelete.images && productToDelete.images.length > 0) {
            productToDelete.images.forEach(imageUrl => {
                try {
                    const filename = path.basename(imageUrl);
                    const filePath = path.join(uploadDir, filename);
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                } catch (err) {
                    console.error(`Помилка видалення файлу зображення ${imageUrl}:`, err);
                }
            });
        }

        const deletedProduct = await Product.findByIdAndDelete(productId);
        res.redirect('/admin/products');
    } catch (error) {
        next(error);
    }
});

module.exports = router;
