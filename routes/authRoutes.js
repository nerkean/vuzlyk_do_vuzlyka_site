const express = require('express');
const passport = require('passport');
const User = require('../models/User');
const Order = require('../models/Order');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Review = require('../models/Review');

const router = express.Router();

function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) { return next(); }
    res.redirect('/login');
}

router.get('/register', (req, res) => {
    res.render('register', { pageTitle: 'Реєстрація' });
});

router.post('/register', async (req, res, next) => {
    const { email, password, name, confirmPassword } = req.body;
    const errors = [];

    if (!email || !password || !name || !confirmPassword) {
        errors.push({ msg: 'Будь ласка, заповніть усі поля.' });
    }
    if (password !== confirmPassword) {
        errors.push({ msg: 'Паролі не співпадають.' });
    }
    if (password && password.length < 5) {
        errors.push({ msg: 'Пароль повинен містити принаймні 5 символів.' });
    }
    if (password && !/[A-Z]/.test(password)) {
        errors.push({ msg: 'Пароль повинен містити принаймні одну велику літеру.' });
    }
    if (password && !/[0-9]/.test(password)) {
        errors.push({ msg: 'Пароль повинен містити принаймні одну цифру.' });
    }

    if (errors.length > 0) {
        return res.render('register', {
            pageTitle: 'Реєстрація',
            errors: errors,
            name: name,
            email: email
        });
    }

    try {
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            errors.push({ msg: 'Цей email вже зареєстровано.' });
            return res.render('register', {
                pageTitle: 'Реєстрація',
                errors: errors,
                name: name,
                email: email
            });
        }

        const newUser = new User({ name, email, password });
        await newUser.save();

        console.log('Новий користувач зареєстрований:', newUser.email);

        req.login(newUser, (err) => {
            if (err) {
                console.error('Помилка автоматичного входу після реєстрації:', err);
                return next(err);
            }
            console.log('Користувач автоматично залогінений після реєстрації:', newUser.email);
            res.redirect('/');
        });

    } catch (error) {
        console.error('Помилка при реєстрації:', error);
        if (error.name === 'ValidationError') {
            const mongooseErrors = Object.values(error.errors).map(el => ({ msg: el.message }));
            return res.render('register', {
                pageTitle: 'Реєстрація',
                errors: mongooseErrors,
                name: name,
                email: email
            });
        }
        next(error);
    }
});

router.get('/login', (req, res) => {
    const loginError = req.query.error === '1' ? 'Неправильний email або пароль.' : null;
    res.render('login', { pageTitle: 'Вхід', error: loginError });
});

router.post('/login', passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login?error=1',
}));

router.get('/profile', isLoggedIn, async (req, res, next) => {
    try {
        const userId = req.user._id;

        const [userOrders, userReviews] = await Promise.all([
            Order.find({ userId: userId }).sort({ createdAt: -1 }).lean(),
            Review.find({ userId: userId }).select('productId').lean()
        ]);

        const reviewedProductIds = new Set(userReviews.map(review => review.productId.toString()));

        res.render('profile', {
            pageTitle: 'Мій профіль',
            user: req.user,
            orders: userOrders,
            reviewedProductIds: reviewedProductIds
        });
    } catch (error) {
        console.error("Помилка завантаження даних профілю:", error);
        next(error);
    }
});

router.get('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) {
            console.error('Помилка при виході:', err);
            return next(err);
        }
        console.log('Користувач вийшов з системи.');
        res.redirect('/');
    });
});

router.get('/product/:id/review', isLoggedIn, async (req, res, next) => {
    const productId = req.params.id;
    const userId = req.user._id;

    try {
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(404).render('404', { message: 'Неправильний ID товару.' });
        }
        const product = await Product.findById(productId).lean();
        if (!product) {
            return res.status(404).render('404', { message: 'Товар не знайдено.' });
        }

        const purchase = await Order.findOne({
            userId: userId,
            'items.productId': productId,
            status: 'Виконано'
        }).select('_id').lean();

        if (!purchase) {
            console.log(`User ${userId} hasn't purchased product ${productId} or order not completed.`);
            return res.redirect(`/product/${productId}?error=not_purchased`);
        }

        const existingReview = await Review.findOne({
            productId: productId,
            userId: userId
        }).select('_id').lean();

        if (existingReview) {
            console.log(`User ${userId} already reviewed product ${productId}.`);
            return res.redirect(`/product/${productId}?error=already_reviewed`);
        }

        res.render('new-review', {
            pageTitle: `Відгук на ${product.name}`,
            product: product,
            user: req.user
        });

    } catch (error) {
        console.error(`Error getting review page for product ${productId}:`, error);
        next(error);
    }
});

router.get('/auth/google', passport.authenticate('google', {
    scope: ['profile', 'email']
}));

router.get('/auth/google/callback', passport.authenticate('google', {
    failureRedirect: '/login',
}), (req, res) => {
    console.log('Google authentication successful, user:', req.user?.email);
    res.redirect('/');
});

module.exports = router;
