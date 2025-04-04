require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session');
const compression = require('compression');

const Product = require('./models/Product');
const Order = require('./models/Order');

const app = express();
const PORT = process.env.PORT || 5500;

const DB_URI = process.env.MONGODB_URI;

mongoose.connect(DB_URI)
    .then(() => console.log('Успішно підключено до MongoDB'))
    .catch(err => console.error('Помилка підключення до MongoDB:', err));

mongoose.connection.on('error', err => {
    console.error('Помилка з\'єднання MongoDB:', err);
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(compression());
app.use(express.static(path.join(__dirname, 'public')));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
            secure: process.env.NODE_ENV === 'production',
            maxAge: 1000 * 60 * 60 * 24 * 7
        }
}));

app.use((req, res, next) => {
        res.locals.cartItemCount = req.session.cart ? req.session.cart.reduce((sum, item) => sum + item.quantity, 0) : 0;
        next();
});

app.get('/', async (req, res) => {
        console.log('[LOG] Обробка маршруту /');
        try {
                const featuredProducts = await Product.find({ isFeatured: true }).limit(4);
                res.render('index', {
                        pageTitle: 'Мамина Вишивка - Головна',
                        featuredProducts: featuredProducts
                });
        } catch (error) {
                console.error("Помилка отримання товарів для головної:", error);
                res.status(500).send("Помилка сервера");
        }
});

app.get('/product/:id', async (req, res) => {
        console.log(`[LOG] Обробка маршруту /product/${req.params.id}`);
        try {
                const productId = req.params.id;
                if (!mongoose.Types.ObjectId.isValid(productId)) {
                         return res.status(404).send('Товар не знайдено (неправильний ID)');
                }
                const product = await Product.findById(productId);
                if (!product) {
                        return res.status(404).send('Товар не знайдено');
                }
                const similarProducts = await Product.find({ category: product.category, _id: { $ne: product._id } }).limit(4);
                const reviews = [];
                res.render('product-detail', {
                        pageTitle: `${product.name} - Мамина Вишивка`,
                        product: product,
                        similarProducts: similarProducts,
                        reviews: reviews
                });
        } catch (error) {
                console.error(`Помилка отримання товару ${req.params.id}:`, error);
                res.status(500).send("Помилка сервера");
        }
});

app.get('/catalog', async (req, res) => {
        console.log('[LOG] Обробка маршруту /catalog');
        try {
                const products = await Product.find({});
                const catalogTitle = "Каталог Вишивки Ручної Роботи - Вузлик"; 
                const catalogDescription = "Каталог вишивки ручної роботи від 'Вузлик'. Знайдіть ексклюзивні вишиванки, традиційні рушники, сорочки та аксесуари. Українська якість та краса.";
                const catalogHeading = "Каталог";
        
                res.render('catalog', { 
                    pageTitle: catalogTitle,
                    pageHeading: catalogHeading,
                    metaDescription: catalogDescription, 
                    products: products,
                    count: products.length 
                });

        } catch (error) {
                console.error("Помилка отримання товарів для каталогу:", error);
                res.status(500).send("Помилка сервера");
        }
});

app.post('/cart/add', async (req, res) => {
        const { productId, quantity } = req.body;
        const qty = parseInt(quantity) || 1;

        try {
                if (!req.session.cart) {
                        req.session.cart = [];
                }

                const product = await Product.findById(productId);
                if (!product) {
                        return res.status(404).json({ success: false, message: 'Товар не знайдено' });
                }

                const existingItemIndex = req.session.cart.findIndex(item => item.productId === productId);

                if (existingItemIndex > -1) {
                        req.session.cart[existingItemIndex].quantity += qty;
                } else {
                        req.session.cart.push({
                                productId: productId,
                                name: product.name,
                                price: product.price,
                                image: product.images[0],
                                quantity: qty
                        });
                }

                const newCartItemCount = req.session.cart.reduce((sum, item) => sum + item.quantity, 0);
                console.log('Оновлений кошик в сесії:', req.session.cart);
                res.json({ success: true, message: 'Товар додано до кошика', cartItemCount: newCartItemCount });

        } catch (error) {
                console.error('Помилка додавання товару в кошик:', error);
                res.status(500).json({ success: false, message: 'Помилка сервера' });
        }
});

app.get('/cart', (req, res) => {
        console.log('[LOG] Обробка маршруту GET /cart');
        const cart = req.session.cart || [];

        let subtotal = 0;
        cart.forEach(item => {
                const price = parseFloat(item.price) || 0;
                const quantity = parseInt(item.quantity) || 0;
                item.lineTotal = price * quantity;
                subtotal += item.lineTotal;
        });

        const total = subtotal;

        res.render('cart', {
                pageTitle: 'Ваш кошик',
                cartItems: cart,
                subtotal: subtotal.toFixed(2),
                total: total.toFixed(2),
                cartItemCount: cart.reduce((sum, item) => sum + item.quantity, 0)
        });
});

app.post('/cart/update', (req, res) => {
        const { productId, quantity } = req.body;
        const newQuantity = parseInt(quantity);

        console.log(`[LOG] Оновлення кошика: ID=${productId}, Кількість=${newQuantity}`);

        if (!req.session.cart || !productId || isNaN(newQuantity) || newQuantity < 1) {
                return res.status(400).json({ success: false, message: 'Неправильні дані запиту' });
        }

        const itemIndex = req.session.cart.findIndex(item => item.productId === productId);

        if (itemIndex > -1) {
                req.session.cart[itemIndex].quantity = newQuantity;

                let subtotal = 0;
                req.session.cart.forEach(item => {
                        const price = parseFloat(item.price) || 0;
                        const quantity = parseInt(item.quantity) || 0;
                        item.lineTotal = price * quantity;
                        subtotal += item.lineTotal;
                });
                const total = subtotal;
                const newCartItemCount = req.session.cart.reduce((sum, item) => sum + item.quantity, 0);

                res.json({
                        success: true,
                        message: 'Кількість оновлено',
                        cartItemCount: newCartItemCount,
                        subtotal: subtotal.toFixed(2),
                        total: total.toFixed(2),
                        itemLineTotal: req.session.cart[itemIndex].lineTotal.toFixed(2)
                });
        } else {
                res.status(404).json({ success: false, message: 'Товар не знайдено в кошику' });
        }
});

app.post('/cart/remove', (req, res) => {
        const { productId } = req.body;
        console.log(`[LOG] Видалення з кошика: ID=${productId}`);

        if (!req.session.cart || !productId) {
                return res.status(400).json({ success: false, message: 'Неправильні дані запиту' });
        }

        req.session.cart = req.session.cart.filter(item => item.productId !== productId);

        let subtotal = 0;
        req.session.cart.forEach(item => {
                const price = parseFloat(item.price) || 0;
                const quantity = parseInt(item.quantity) || 0;
                item.lineTotal = price * quantity;
                subtotal += item.lineTotal;
        });
        const total = subtotal;
        const newCartItemCount = req.session.cart.reduce((sum, item) => sum + item.quantity, 0);

        res.json({
                success: true,
                message: 'Товар видалено',
                cartItemCount: newCartItemCount,
                subtotal: subtotal.toFixed(2),
                total: total.toFixed(2)
        });
});

app.get('/api/products', async (req, res) => {
        console.log('[LOG] Обробка API запиту GET /api/products');
        console.log('Query params:', req.query);

        try {
                const page = parseInt(req.query.page) || 1;
                const limit = 12;
                const skip = (page - 1) * limit;

                const filterQuery = {};
                if (req.query.price_from || req.query.price_to) {
                        filterQuery.price = {};
                        if (req.query.price_from) {
                                filterQuery.price.$gte = parseInt(req.query.price_from);
                        }
                        if (req.query.price_to) {
                                filterQuery.price.$lte = parseInt(req.query.price_to);
                        }
                }
                if (req.query.status) {
                        const statuses = Array.isArray(req.query.status) ? req.query.status : [req.query.status];
                        if (statuses.length > 0) {
                                 const mappedStatuses = statuses.map(s => s === 'available' ? 'В наявності' : (s === 'order' ? 'Під замовлення' : null)).filter(Boolean);
                                 if(mappedStatuses.length > 0) {
                                        filterQuery.status = { $in: mappedStatuses };
                                 }
                        }
                }
                if (req.query.tags) {
                        const tags = Array.isArray(req.query.tags) ? req.query.tags : [req.query.tags];
                        if (tags.length > 0) {
                                filterQuery.tags = { $in: tags };
                        }
                }
                console.log('Mongo Filter Query:', filterQuery);

                let sortQuery = {};
                const sortOption = req.query.sort || 'default';
                switch (sortOption) {
                        case 'price_asc':
                                sortQuery = { price: 1 };
                                break;
                        case 'price_desc':
                                sortQuery = { price: -1 };
                                break;
                        case 'newest':
                                sortQuery = { createdAt: -1 };
                                break;
                        default:
                                sortQuery = {};
                }
                 console.log('Mongo Sort Query:', sortQuery);

                const totalProducts = await Product.countDocuments(filterQuery);
                console.log('Total products found:', totalProducts);

                const products = await Product.find(filterQuery)
                                                                            .sort(sortQuery)
                                                                            .skip(skip)
                                                                            .limit(limit);

                res.json({
                        success: true,
                        products: products,
                        currentPage: page,
                        totalPages: Math.ceil(totalProducts / limit),
                        totalProducts: totalProducts
                });

        } catch (error) {
                console.error("Помилка API отримання товарів для каталогу:", error);
                res.status(500).json({ success: false, message: "Помилка сервера" });
        }
});

app.get('/checkout', (req, res) => {
        console.log('[LOG] Обробка маршруту GET /checkout');
        const cart = req.session.cart || [];

        if (cart.length === 0) {
                console.log('Кошик порожній, перенаправлення до кошика.');
                return res.redirect('/cart');
        }

        let subtotal = 0;
        cart.forEach(item => {
                const price = parseFloat(item.price) || 0;
                const quantity = parseInt(item.quantity) || 0;
                subtotal += price * quantity;
        });
        const total = subtotal;

        const cartItemsForRender = cart.map(item => ({ ...item, lineTotal: (parseFloat(item.price) * parseInt(item.quantity)).toFixed(2) }));

        res.render('checkout', {
                pageTitle: 'Оформлення замовлення',
                cartItems: cartItemsForRender,
                subtotal: subtotal.toFixed(2),
                total: total.toFixed(2)
        });
});

app.get('/order/success', async (req, res) => {
        res.render('order-success', {
                pageTitle: 'Замовлення успішно оформлено'
        });
});

app.get('/privacy-policy', (req, res) => {
        res.render('privacy-policy', { pageTitle: 'Політика Конфіденційності' });
});

app.get('/terms', (req, res) => {
        res.render('terms-of-service', { pageTitle: 'Умови Обслуговування' });
});

app.use((req, res, next) => {
    console.log(`[LOG 5] Запит ${req.url} дійшов до обробника 404`);
    res.status(404).send("Сторінку не знайдено (404)");
});

app.listen(PORT, () => {
    console.log(`Сервер запущено на порту ${PORT}`);
});
