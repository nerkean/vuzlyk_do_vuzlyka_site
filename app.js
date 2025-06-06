require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session');
const compression = require('compression');
const nodemailer = require('nodemailer');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const MongoStore = require('connect-mongo');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const methodOverride = require('method-override');
const helmet = require('helmet');
const axios = require('axios');
const cloudinary = require('cloudinary').v2;
const { SitemapStream, streamToPromise } = require('sitemap');
const { Readable } = require('stream');

const User = require('./models/User');
const Product = require('./models/Product');
const Review = require('./models/Review');
const Order = require('./models/Order');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5500;
const DB_URI = process.env.MONGODB_URI;

mongoose.connect(DB_URI)
    .then(() => console.log('Успішно підключено до MongoDB'))
    .catch(err => console.error('Помилка підключення до MongoDB:', err));

mongoose.connection.on('error', err => {
    console.error('Помилка з\'єднання MongoDB:', err);
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                ...helmet.contentSecurityPolicy.getDefaultDirectives(), // Залишає default-src 'self' та інші
                "script-src": [
                    "'self'",
                    "https://cdn.jsdelivr.net",
                    "https://cdnjs.cloudflare.com",
                    "https://unpkg.com", // Для AOS, Swiper та інших бібліотек з unpkg
                    "https://www.googletagmanager.com",
                    "https://www.google-analytics.com",
                    "https://ssl.google-analytics.com",
                    "https://maps.googleapis.com",      // API Google Карт
                    "https://maps.gstatic.com",         // Статичні ресурси карт (іконки, тайли)
                    "https://*.google.com",             // Загальний для інших сервісів Google (може перекривати деякі maps.googleapis.com)
                    "https://*.google.com.ua",          // Для регіональних сервісів Google
                    "https://*.googleadservices.com",   // Google Ads
                    "https://www.googleadservices.com", // Google Ads
                    "https://*.doubleclick.net",        // Рекламні сервіси
                    "https://tpc.googlesyndication.com",// Рекламні сервіси
                    "https://pagead2.googlesyndication.com", // Рекламні сервіси
                    "https://cdn.tailwindcss.com",
                    "https://www.google.com/recaptcha/",      // Для API reCAPTCHA
                    "https://www.gstatic.com/recaptcha/",      // Якщо використовуєш Tailwind CSS з CDN
                    "'unsafe-inline'"                   // Для вбудованих скриптів та обробників подій (намагайся мінімізувати)
                ],
                "script-src-attr": [
                    "'unsafe-inline'" // Дозволяє inline обробники типу onclick, якщо вони є
                ],
                "style-src": [
                    "'self'",
                    "https://fonts.googleapis.com",    // Google Fonts
                    "https://cdn.jsdelivr.net",        // Bootstrap, Swiper
                    "https://cdnjs.cloudflare.com",    // Font Awesome, AOS
                    "https://unpkg.com",              // AOS, Swiper
                    "https://fonts.gstatic.com",      // Google Fonts (gstatic)
                    "https://maps.googleapis.com",    // Для стилів, що завантажуються API Карт
                    "'unsafe-inline'"                 // Для вбудованих стилів та стилів карт
                ],
                "font-src": [
                    "'self'",
                    "https://fonts.gstatic.com",      // Google Fonts
                    "https://cdnjs.cloudflare.com",    // Font Awesome
                    "https://maps.gstatic.com",       // Шрифти, які можуть використовуватися на Картах
                    "data:"                           // Для вбудованих шрифтів (якщо є)
                ],
                "img-src": [
                    "'self'",
                    "data:",                           // Для base64 зображень
                    "https://res.cloudinary.com",     // Твої зображення з Cloudinary
                    "https://www.google-analytics.com",// Пікселі Google Analytics
                    "https://*.google.com",
                    "https://www.google.com",
                    "https://www.google.com.ua",
                    "https://*.google.com.ua",
                    "https://*.googleadservices.com",
                    "https://www.googleadservices.com",
                    "https://*.doubleclick.net",
                    "https://*.googlesyndication.com",
                    "https://pagead2.googlesyndication.com",
                    "https://googleads.g.doubleclick.net",
                    "https://www.googletagmanager.com",
                    "https://maps.googleapis.com",    // Статичні карти, Street View
                    "https://maps.gstatic.com",       // Тайли карти, іконки
                    "https://csi.gstatic.com",        // Зображення/пікселі для сервісів Google
                    "maps.google.com"     // Може використовуватися для деяких елементів карт
                ],
                "media-src": [ // Якщо є відео/аудіо
                    "'self'",
                    "https://res.cloudinary.com"
                ],
                "connect-src": [
                    "'self'",
                    "https://res.cloudinary.com",     // API запити до Cloudinary
                    "https://www.google-analytics.com",
                    "https://*.google-analytics.com", // Для Google Analytics
                    "https://www.googletagmanager.com",
                    "https://*.google.com",
                    "https://www.google.com",
                    "https://www.google.com.ua",
                    "https://*.google.com.ua",
                    "https://*.googleadservices.com",
                    "https://www.googleadservices.com",
                    "https://*.doubleclick.net",
                    "https://*.googlesyndication.com",
                    "https://pagead2.googlesyndication.com",
                    "https://googleads.g.doubleclick.net",
                    "https://maps.googleapis.com",    // Запити API Карт (геокодування, маршрути)
                    "https://maps.google.com",   // Запити Карт
                    "https://*. cerebrospinal.googleapis.com" // Іноді використовується для сервісів Google Maps
                ],
                "frame-src": [ // Для вбудованих фреймів
                    "'self'",
                    "https://www.googletagmanager.com",
                    "https://*.google.com",          // Дозволяє фрейми з усіх піддоменів google.com (включаючи карти)
                    "https://maps.google.com",   // Для карт
                    "https://*.doubleclick.net",
                    "https://bid.g.doubleclick.net",
                     "https://www.google.com/recaptcha/",      // Для віджета reCAPTCHA
                    "https://recaptcha.google.com/"
                ],
                "object-src": ["'none'"], // Забороняє <object>, <embed>, <applet>
                "worker-src": ["'self'"], // Якщо використовуєш Web Workers
                "form-action": ["'self'"], // Дозволяє формам відправлятися тільки на твій домен
            }
        },
        crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
        crossOriginEmbedderPolicy: { policy: "unsafe-none" },
        referrerPolicy: { policy: "strict-origin-when-cross-origin" }
    })
);
app.use(compression());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true })); 
app.use(methodOverride('_method'))
app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: DB_URI,
        collectionName: 'sessions',
        ttl: 60 * 60 * 24 * 7
    }),
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 24 * 7,
        httpOnly: true
    }
}));

app.use(passport.initialize());
app.use(passport.session());

if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        if (req.headers['x-forwarded-proto'] !== 'https') {
            console.log(`[HTTPS Redirect] Redirecting http://${req.headers.host}${req.originalUrl} to https`);
            return res.redirect(['https://', req.get('Host'), req.originalUrl].join(''));
        }
        next();
    });
}

passport.use(new LocalStrategy(
  { usernameField: 'email' },
  async (email, password, done) => {
      try {
          const user = await User.findOne({ email: email.toLowerCase() });
          if (!user) return done(null, false, { message: 'Неправильний email або пароль.' });
          const isMatch = await user.comparePassword(password);
          if (!isMatch) return done(null, false, { message: 'Неправильний email або пароль.' });
          return done(null, user);
      } catch (error) {
          return done(error);
      }
  }
));

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback",
    passReqToCallback: true
  },
  async (req, accessToken, refreshToken, profile, done) => {
    console.log('Google Profile Received:', profile);
    try {
      let user = await User.findOne({ googleId: profile.id });
      if (user) {
        console.log('User found by Google ID:', user.email);
        return done(null, user);
      } else {
        console.log('User not found by Google ID, creating new user...');
        const email = profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null;
        const name = profile.displayName || profile._json?.name || 'Google User';
        const photo = profile.photos && profile.photos.length > 0 ? profile.photos[0].value : null;
        if (!email) {
            console.error('Google did not return an email address.');
            return done(null, false, { message: 'Не вдалося отримати email від Google.' });
        }
        const newUser = new User({
          googleId: profile.id,
          email: email.toLowerCase(),
          name: name,
          profilePicture: photo
        });
        await newUser.save();
        console.log('New user created via Google:', newUser.email);
        return done(null, newUser);
      }
    } catch (error) {
      console.error('Error in Google OAuth Strategy:', error);
      return done(error, false);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
      const user = await User.findById(id);
      done(null, user);
  } catch (error) {
      done(error, null);
  }
});

const AVAILABLE_CURRENCIES = ['UAH', 'EUR', 'USD'];
const EXCHANGE_RATES = {
    UAH: 1,
    USD: 1 / 41.0,
    EUR: 1 / 46.8 
};
const CURRENCY_SYMBOLS = {
    UAH: '₴',
    USD: '$',
    EUR: '€'
};
let currentRates = { ...EXCHANGE_RATES };

async function fetchAndUpdateRates() {
    console.log('[LOG] Спроба оновити курси валют з API НБУ...');
    try {
        const response = await axios.get('https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json');
        const nbuRates = response.data;

        const usdRate = nbuRates.find(rate => rate.cc === 'USD')?.rate;
        const eurRate = nbuRates.find(rate => rate.cc === 'EUR')?.rate;

        if (usdRate && eurRate) {
            currentRates = {
                UAH: 1,
                USD: 1 / usdRate,
                EUR: 1 / eurRate
            };
            console.log('[LOG] Курси валют успішно оновлено:', currentRates);
        } else {
            console.warn('[WARN] Не вдалося знайти USD або EUR у відповіді API НБУ. Використовуються старі курси.');
        }
    } catch (error) {
        console.error('[ERROR] Помилка отримання курсів валют з API НБУ:', error.message);
    }
}
fetchAndUpdateRates();

const updateInterval = 6 * 60 * 60 * 1000;
setInterval(fetchAndUpdateRates, updateInterval);

app.use((req, res, next) => {
    res.locals.gaMeasurementId = process.env.GA_MEASUREMENT_ID;
    res.locals.isProduction = process.env.NODE_ENV === 'production';
    res.locals.cartItemCount = req.session.cart ? req.session.cart.reduce((sum, item) => sum + item.quantity, 0) : 0;
    res.locals.currentUser = req.user;
    res.locals.isAdmin = req.session.isAdmin || false;
    res.locals.selectedCurrency = req.session.currency || 'UAH';
    res.locals.exchangeRates = currentRates; // Використовуємо оновлені currentRates
    res.locals.currencySymbols = CURRENCY_SYMBOLS;
    res.locals.formatPrice = app.locals.formatPrice;
    res.locals.baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`; // Додано для baseUrl
    res.locals.googleMapsApiKey = process.env.Maps_API_KEY; // <-- ДОДАНО КЛЮЧ КАРТ
    res.locals.googleMapsApiKey = process.env.Maps_API_KEY;
    res.locals.reCaptchaV2SiteKey = process.env.RECAPTCHA_V2_SITE_KEY;
    next();
});


app.use((req, res, next) => {
    let currentCurrency = 'UAH';
    const queryCurrency = req.query.currency?.toUpperCase();

    if (queryCurrency && AVAILABLE_CURRENCIES.includes(queryCurrency)) {
        req.session.currency = queryCurrency;
        currentCurrency = queryCurrency;
    } else if (req.session.currency && AVAILABLE_CURRENCIES.includes(req.session.currency)) {
        currentCurrency = req.session.currency;
    }

    const currentIndex = AVAILABLE_CURRENCIES.indexOf(currentCurrency);
    const nextIndex = (currentIndex + 1) % AVAILABLE_CURRENCIES.length;
    res.locals.nextCurrency = AVAILABLE_CURRENCIES[nextIndex];

    res.locals.selectedCurrency = currentCurrency;
    res.locals.exchangeRates = currentRates;
    res.locals.currencySymbols = CURRENCY_SYMBOLS;
    next();
});

app.use((req, res, next) => {
    res.locals.cartItemCount = req.session.cart ? req.session.cart.reduce((sum, item) => sum + item.quantity, 0) : 0;
    res.locals.currentUser = req.user;
    res.locals.isAdmin = req.session.isAdmin || false;
    res.locals.gaMeasurementId = process.env.GA_MEASUREMENT_ID;
    res.locals.isProduction = process.env.NODE_ENV === 'production';
    res.locals.formatPrice = app.locals.formatPrice; 

    next();
});

function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
      return next();
  }
  console.log('Доступ запрещен! Пользователь не аутентифицирован. Перенаправление на /login.');
  res.redirect('/login');
}

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
app.use('/admin', adminRoutes); 
app.use('/', authRoutes);

app.get('/', async (req, res, next) => {
    try {
        const baseUrl = process.env.BASE_URL || 'https://vuzlyk.com';
        const canonicalUrlForHomepage = baseUrl + '/';

        const featuredProducts = await Product.find({ isFeatured: true })
            .select('name price maxPrice images slug') 
            .limit(4)
            .lean();

        res.render('index', {
           featuredProducts: featuredProducts,
           canonicalUrl: canonicalUrlForHomepage,
           baseUrl: baseUrl,
           selectedCurrency: res.locals.selectedCurrency,
           exchangeRates: res.locals.exchangeRates,
           currencySymbols: res.locals.currencySymbols,
           pageName: 'home' 
        });
    } catch (error) {
        console.error("Помилка отримання товарів для головної:", error);
        next(error);
    }
});

app.get('/product/:id', async (req, res, next) => {
  console.log(`[LOG] Обробка маршруту /product/${req.params.id}`);
  const productId = req.params.id;
  const userId = req.user?._id;
  try {
      if (!mongoose.Types.ObjectId.isValid(productId)) {
          console.log(`[WARN] Неправильний ID товару: ${productId}`);
          return res.status(404).render('404');
      }
      const [product, reviews] = await Promise.all([
          Product.findById(productId).lean(),
          Review.find({ productId: productId }).sort({ createdAt: -1 }).populate('userId', 'name').lean()
      ]);
      if (!product) {
          console.log(`[WARN] Товар з ID ${productId} не знайдено.`);
          return res.status(404).render('404');
      }
      let averageRating = 0;
      let ratingCount = product.ratingCount || 0;
      if (ratingCount > 0 && product.ratingSum) {
          averageRating = Math.round((product.ratingSum / ratingCount) * 10) / 10;
      }
      let canReview = false;
      let hasReviewed = false;
      if (userId) {
          const [purchase, existingReview] = await Promise.all([
              Order.findOne({ userId: userId, 'items.productId': productId, status: 'Виконано' }).select('_id').lean(),
              Review.findOne({ productId: productId, userId: userId }).select('_id').lean()
          ]);
          canReview = !!purchase;
          hasReviewed = !!existingReview;
          console.log(`User <span class="math-inline">{req.user.email}: canReview=${canReview}, hasReviewed=${hasReviewed} for product ${productId}`);
      }
      const similarProducts = product.category ? await Product.find({
          category: product.category,
          _id: { $ne: product._id }
      }).limit(4).lean() : [];
      const isCustomProduct = productId === process.env.CUSTOM_PRODUCT_ID;
      const metaDesc = product.metaDescription
      ? product.metaDescription.substring(0, 170) 
      : `${product.name} - вишивка ручної роботи від Вузлик. ${product.description ? product.description.substring(0, 100) + '...' : ''}`; 

       const baseUrl = process.env.BASE_URL || 'https://vuzlyk.com';
      let descriptionForJsonLd = product.description || '';
      descriptionForJsonLd = descriptionForJsonLd.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();

      const productSchema = {
        "@context": "https://schema.org/",
        "@type": "Product",
        "name": product.name,
        "description": descriptionForJsonLd,
        "image": product.images && product.images.length > 0
          ? product.images.map(imgSet => {
              if (imgSet && imgSet.large && imgSet.large.url) return new URL(imgSet.large.url, baseUrl).href;
              if (imgSet && imgSet.medium && imgSet.medium.url) return new URL(imgSet.medium.url, baseUrl).href;
              if (imgSet && imgSet.thumb && imgSet.thumb.url) return new URL(imgSet.thumb.url, baseUrl).href;
              return null; 
            }).filter(url => url !== null) 
          : [],
        "sku": product.sku || `VUZLYK-${product._id}`, 
        "brand": {
          "@type": "Organization",
          "name": "Вузлик до вузлика",
          "url": baseUrl 
        },
        "offers": {
          "@type": "Offer",
          "url": `${baseUrl}/product/${product._id}`, 
          "priceCurrency": res.locals.selectedCurrency || "UAH",
          "price": (product.price * (res.locals.exchangeRates[res.locals.selectedCurrency || "UAH"] || 1)).toFixed(2),
          "availability": product.status === 'В наявності' ? "https://schema.org/InStock" : "https://schema.org/PreOrder",
          "itemCondition": "https://schema.org/NewCondition"
        }
      };

      if (ratingCount > 0) {
        productSchema.aggregateRating = {
          "@type": "AggregateRating",
          "ratingValue": averageRating,
          "reviewCount": ratingCount
        };
      }

      if (reviews && reviews.length > 0) {
        productSchema.review = reviews.map(review => ({
          "@type": "Review",
          "author": {
            "@type": "Person", 
            "name": review.userId ? review.userId.name : "Анонімний користувач" 
          },
          "datePublished": review.createdAt ? new Date(review.createdAt).toISOString() : undefined,
          "reviewBody": review.text,
          "reviewRating": {
            "@type": "Rating",
            "ratingValue": review.rating.toString()
          }
        })).filter(r => r.reviewRating.ratingValue && r.datePublished); 
      }
      
      if (product.materials && product.materials.length > 0) {
        productSchema.material = product.materials; 
      }

      if (product.colors && product.colors.length > 0) {
        productSchema.color = product.colors; 
      }

      if (product.category) {
        productSchema.category = product.category;
      }

      productSchema.additionalProperty = [];

      if (product.creation_time_info) {
        productSchema.additionalProperty.push({
          "@type": "PropertyValue",
          "name": "Термін виготовлення",
          "value": product.creation_time_info
        });
      }

      if (product.dimensions) {
        if (product.dimensions.width && product.dimensions.height) {
          productSchema.additionalProperty.push({
            "@type": "PropertyValue",
            "name": "Розміри (ШxВ, см)",
            "value": `${product.dimensions.width} x ${product.dimensions.height}`
          });
        }
        if (product.dimensions.size_name) {
            productSchema.additionalProperty.push({
            "@type": "PropertyValue",
            "name": "Розмір виробу",
            "value": product.dimensions.size_name
            });
        }
      }

      if (product.care_instructions) {
        productSchema.additionalProperty.push({
          "@type": "PropertyValue",
          "name": "Інструкції по догляду",
          "value": product.care_instructions
        });
      }
      
      if (productSchema.additionalProperty.length === 0) {
        delete productSchema.additionalProperty;
      }

      if (product.livePhotoUrl) {
        productSchema.video = {
          "@type": "VideoObject",
          "name": `Живе фото ${product.name}`,
          "description": `Анімація або відео товару ${product.name}`,
          "thumbnailUrl": product.images && product.images.length > 0 && product.images[0].medium ? new URL(product.images[0].medium.url, baseUrl).href : undefined,
          "contentUrl": new URL(product.livePhotoUrl, baseUrl).href,
          "uploadDate": product.createdAt ? new Date(product.createdAt).toISOString() : undefined 
        };
        if (product.livePhotoUrl.endsWith('.gif')) {
           if (!productSchema.image) productSchema.image = [];
           productSchema.image.push(new URL(product.livePhotoUrl, baseUrl).href);
        }
      }

      res.render('product-detail', {
        product: product,
        reviews: reviews, 
        averageRating: averageRating,
        ratingCount: ratingCount,
        similarProducts: similarProducts,
        isCustomProduct: isCustomProduct,
        canReview: canReview,
        hasReviewed: hasReviewed,
        currentUser: req.user,
        infoMessage: null, 
        pageTitle: product.metaTitle || product.name, 
        metaDescription: metaDesc,
        productLD: productSchema 
      });
  } catch (error) {
      console.error(`Помилка отримання товару ${productId}:`, error);
      next(error);
  }
});

app.get('/catalog', async (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 12; 
    const sortOption = req.query.sort || 'default';
    const filters = {};
    if (req.query.price_from) filters.price_from = req.query.price_from;
    if (req.query.price_to) filters.price_to = req.query.price_to;
    if (req.query.status) filters.status = Array.isArray(req.query.status) ? req.query.status : [req.query.status];
    if (req.query.tags) filters.tags = Array.isArray(req.query.tags) ? req.query.tags : [req.query.tags];

    try {
        const skip = (page - 1) * limit;
        const sortQuery = getSortQuery(sortOption); 

        const filterQuery = {}; 

        const products = await Product.find(filterQuery)
            .sort(sortQuery)
            .skip(skip)
            .limit(limit)
            .lean(); 

        const totalProducts = await Product.countDocuments(filterQuery);
        const totalPages = Math.ceil(totalProducts / limit);

        const firstProductImageUrl = (products.length > 0 && products[0].images && products[0].images.length > 0)
                                   ? (products[0].images[0].medium || products[0].images[0].thumb)
                                   : null;

        const pageTitle = 'Каталог Вишивки Ручної Роботи';
        const pageHeading = pageTitle; 

        res.render('catalog', {
            pageTitle: pageTitle,
            pageHeading: pageHeading,
            products: products,
            currentPage: page,
            totalPages: totalPages,
            limit: limit,
            count: totalProducts, 
            firstProductImageUrl: firstProductImageUrl,
            originalUrl: req.originalUrl,
            selectedCurrency: res.locals.selectedCurrency,
            exchangeRates: res.locals.exchangeRates,
            currencySymbols: res.locals.currencySymbols,
            query: req.query 
        });
    } catch (error) {
        console.error("Помилка при завантаженні каталогу:", error);
        next(error);
    }
});

function getSortQuery(sortOption) {
    switch (sortOption) {
        case 'price_asc': return { price: 1 };
        case 'price_desc': return { price: -1 };
        case 'newest': return { createdAt: -1 };
        default: return { createdAt: -1 }; 
    }
}

app.post('/cart/add', async (req, res) => {
    const { productId, quantity } = req.body;
    const qty = parseInt(quantity) || 1;
    try {
        if (!req.session.cart) {
            req.session.cart = [];
        }
        const product = await Product.findById(productId).lean();

        if (!product) {
            console.warn(`[WARN] Спроба додати неіснуючий товар ${productId} до кошика.`);
            return res.status(404).json({ success: false, message: 'Товар не знайдено' });
        }

        let imageForCart = '/images/placeholder.svg';
        if (product.images && product.images.length > 0) {
            const firstImageSet = product.images[0];
            if (firstImageSet.thumb && firstImageSet.thumb.url) { 
                imageForCart = firstImageSet.thumb.url; 
            } else if (firstImageSet.medium && firstImageSet.medium.url) { 
                imageForCart = firstImageSet.medium.url;
                console.warn(`[WARN] Для товару ${productId} в кошику використано medium зображення, бо thumb відсутнє.`);
            }
        }

        const existingItemIndex = req.session.cart.findIndex(item => item.productId === productId);

        if (existingItemIndex > -1) {
            req.session.cart[existingItemIndex].quantity += qty;
            req.session.cart[existingItemIndex].image = imageForCart; 
            req.session.cart[existingItemIndex].price = product.price;
            req.session.cart[existingItemIndex].name = product.name;
        } else {
            req.session.cart.push({
                productId: productId,
                name: product.name,
                price: product.price,
                image: imageForCart,
                quantity: qty
            });
        }

        const newCartItemCount = req.session.cart.reduce((sum, item) => sum + item.quantity, 0);
        console.log('Оновлений кошик в сесії:', req.session.cart);

        res.json({
            success: true,
            message: 'Товар додано до кошика',
            cartItemCount: newCartItemCount,
            selectedCurrency: res.locals.selectedCurrency,
            exchangeRates: res.locals.exchangeRates,
            currencySymbols: res.locals.currencySymbols
        });

    } catch (error) {
        console.error('Помилка додавання товару в кошик:', error);
        res.status(500).json({ success: false, message: 'Помилка сервера' });
    }
});

app.get('/cart', (req, res) => {
  console.log('[LOG] Обробка маршруту GET /cart');
  const cart = req.session.cart || [];
  let subtotal = 0;
  const cartItemsForRender = cart.map(item => {
      const price = parseFloat(item.price);
      const quantity = parseInt(item.quantity);
      const validPrice = (typeof price === 'number' && isFinite(price) && price >= 0) ? price : 0;
      const validQuantity = (typeof quantity === 'number' && isFinite(quantity) && quantity >= 0) ? quantity : 0;
      const lineTotal = validPrice * validQuantity;
      subtotal += lineTotal;
      return {
          ...item,
          price: validPrice,
          quantity: validQuantity,
          lineTotal: lineTotal
      };
  }).filter(item => item && item.productId);
  const total = subtotal;
  res.render('cart', {
      pageTitle: 'Ваш кошик - Вузлик',
      cartItems: cartItemsForRender,
      subtotal: subtotal, 
      total: total,     
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
      let itemLineTotal = 0;
      req.session.cart.forEach((item, index) => {
          const price = parseFloat(item.price) || 0;
          const quantity = parseInt(item.quantity) || 0;
          const currentLineTotal = price * quantity;
          item.lineTotal = currentLineTotal;
          subtotal += currentLineTotal;
          if (index === itemIndex) {
              itemLineTotal = currentLineTotal;
          }
      });
      const total = subtotal;
      const newCartItemCount = req.session.cart.reduce((sum, item) => sum + item.quantity, 0);
      res.json({
          success: true,
          message: 'Кількість оновлено',
          cartItemCount: newCartItemCount,
          itemLineTotal: itemLineTotal, 
          subtotal: subtotal,     
          total: total,         
          selectedCurrency: res.locals.selectedCurrency,
          exchangeRates: res.locals.exchangeRates,
          currencySymbols: res.locals.currencySymbols
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
      subtotal += price * quantity;
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
    const rates = res.locals.exchangeRates || { UAH: 1, USD: 1/39.5, EUR: 1/41.0 };
    const filterCurrency = res.locals.selectedCurrency || 'UAH';

    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const skip = (page - 1) * limit;
        const filterQuery = {};

        const filterCurrency = (req.query.currency || 'UAH').toUpperCase();
        const priceFromInput = req.query.price_from;
        const priceToInput = req.query.price_to;

        if (priceFromInput || priceToInput) {
            filterQuery.price = {};
            const rateFromUAH = rates[filterCurrency] || 1;
            const rateToUAH = rateFromUAH !== 0 ? (1 / rateFromUAH) : null;

            if (rateToUAH) {
                if (priceFromInput) {
                    const priceFromNum = parseFloat(priceFromInput);
                    if (!isNaN(priceFromNum)) {
                        filterQuery.price.$gte = Math.floor(priceFromNum * rateToUAH);
                    }
                }
                if (priceToInput) {
                    const priceToNum = parseFloat(priceToInput);
                    if (!isNaN(priceToNum)) {
                        filterQuery.price.$lte = Math.ceil(priceToNum * rateToUAH);
                    }
                }
            } else if (filterCurrency === 'UAH') {
                if (priceFromInput) {
                    const priceFromNum = parseInt(priceFromInput);
                    if (!isNaN(priceFromNum)) filterQuery.price.$gte = priceFromNum;
                }
                if (priceToInput) {
                    const priceToNum = parseInt(priceToInput);
                    if (!isNaN(priceToNum)) filterQuery.price.$lte = priceToNum;
                }
            } else {
                delete filterQuery.price;
            }

            if (Object.keys(filterQuery.price || {}).length === 0) {
                delete filterQuery.price;
            }
        }
        if (req.query.status) {
            const statuses = Array.isArray(req.query.status) ? req.query.status : [req.query.status];
            if (statuses.length > 0) {
                const mappedStatuses = statuses.map(s => s === 'available' ? 'В наявності' : (s === 'pid_zamovlennya' ? 'Під замовлення' : null)).filter(Boolean);
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
        const totalProducts = await Product.countDocuments(filterQuery);
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
        res.status(500).json({ success: false, message: "Помилка сервера" });
    }
});

app.get('/checkout', (req, res) => {
    const cart = req.session.cart || [];
    let subtotal = 0;
    const cartItemsForRender = cart.map(item => {
        const price = parseFloat(item.price);
        const quantity = parseInt(item.quantity);
        const validPrice = (typeof price === 'number' && isFinite(price) && price >= 0) ? price : 0;
        const validQuantity = (typeof quantity === 'number' && isFinite(quantity) && quantity >= 0) ? quantity : 0;
        const lineTotal = validPrice * validQuantity;
        subtotal += lineTotal;
        return { ...item, price: validPrice, quantity: validQuantity, lineTotal: lineTotal };
    }).filter(item => item && item.productId);

    const total = subtotal;

    res.render('checkout', {
        pageTitle: 'Оформлення Замовлення - Вузлик',
        cartItems: cartItemsForRender,
        subtotal: subtotal,
        total: total,
        currentUser: req.user
    });
});


app.get('/sitemap.xml', async (req, res) => {
    res.header('Content-Type', 'application/xml');
    const links = [
      { url: '/', changefreq: 'daily', priority: 1.0 },
      { url: '/catalog', changefreq: 'daily', priority: 0.8 },
      { url: '/about', changefreq: 'monthly', priority: 0.5 },
      { url: '/faq', changefreq: 'monthly', priority: 0.5 },
      { url: '/terms', changefreq: 'yearly', priority: 0.3 },
      { url: '/privacy-policy', changefreq: 'yearly', priority: 0.3 },
    ];
  
    try {
      const products = await Product.find({}).select('_id updatedAt').lean();
      products.forEach(product => {
        links.push({
          url: `/product/${product._id}`,
          changefreq: 'weekly',
          priority: 0.7,
          lastmod: product.updatedAt 
        });
      });
  
      const stream = new SitemapStream({ hostname: 'https://vuzlyk.com' }); 
      const data = await streamToPromise(Readable.from(links).pipe(stream));
      res.send(data.toString());
  
    } catch (error) {
      console.error("Помилка генерації sitemap:", error);
      res.status(500).end();
    }
  });

app.post('/order/place', async (req, res) => {
    const cart = req.session.cart || [];
    if (!cart || cart.length === 0) {
        return res.redirect('/cart');
    }
    const {
        email, phone, full_name,
        shippingMethod, shipping_city, shipping_np_warehouse, shipping_address1,
        custom_description, comments,
        saveInfo
    } = req.body;
    if (!email || !phone || !full_name || !shippingMethod) {
        return res.redirect('/checkout?error=' + encodeURIComponent('Будь ласка, заповніть всі обов\'язкові поля.'));
    }
    const orderData = {
        contactInfo: { email, phone, name: full_name },
        shipping: {
            method: shippingMethod,
            city: shipping_city || null,
            warehouse: shipping_np_warehouse || null,
            address: shipping_address1 || null,
        },
        items: cart.map(item => ({
            name: item.name, productId: item.productId,
            quantity: item.quantity, price: item.price
        })),
        customDescription: custom_description || 'Не вказано',
        comments: comments || 'Немає',
        receivedAt: new Date(),
        status: 'Новий'
    };
    orderData.totalAmount = orderData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    if (req.isAuthenticated() && req.user) {
        orderData.userId = req.user._id;
        if (saveInfo === 'on') {
            const contactToSave = {
                name: orderData.contactInfo.name,
                phone: orderData.contactInfo.phone
            };
            const shippingToSave = {
                method: orderData.shipping.method,
                city: orderData.shipping.city,
                warehouse: orderData.shipping.warehouse,
                address: orderData.shipping.address
            };
            try {
                await User.findByIdAndUpdate(req.user._id, {
                    $set: {
                        defaultContactInfo: contactToSave,
                        defaultShippingInfo: shippingToSave
                    }
                });
            } catch (updateError) {}
        }
    }
    try {
        const newOrder = new Order(orderData);
        await newOrder.save();
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || !process.env.ADMIN_EMAIL) {
            throw new Error('Email configuration missing.');
        } else {
            const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: parseInt(process.env.SMTP_PORT, 10),
                secure: process.env.SMTP_SECURE === 'true', 
                auth: {
                    user: process.env.EMAIL_USER, 
                    pass: process.env.EMAIL_PASS,
                },
            });

            const accentColor = '#b9936c';
            const accentDarkColor = '#a07e5a';
            const textColor = '#333333';
            const lightTextColor = '#555555';
            const bgColor = '#f4f4f4';
            const borderColor = '#dddddd';
            const whiteColor = '#ffffff';
            const headingFont = 'Montserrat, Arial, sans-serif';
            const bodyFont = 'Roboto, Arial, sans-serif';
            const emailHtmlAdmin = `
                <!DOCTYPE html>
                <html lang="uk">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Новий запит на замовлення</title>
                    <style>
                        body { margin: 0; padding: 0; background-color: ${bgColor}; font-family: ${bodyFont}; }
                        .email-wrapper { background-color: ${bgColor}; padding: 20px 10px; }
                        .email-container { background-color: ${whiteColor}; max-width: 600px; margin: 0 auto; padding: 25px 30px; border-radius: 8px; border: 1px solid ${borderColor}; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
                        h1 { color: ${textColor}; font-family: ${headingFont}; font-size: 22px; margin-top: 0; margin-bottom: 20px; text-align: center; }
                        h2 { color: ${accentDarkColor}; font-family: ${headingFont}; font-size: 18px; margin-top: 25px; margin-bottom: 10px; border-bottom: 1px solid ${borderColor}; padding-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
                        p { color: ${lightTextColor}; font-size: 15px; line-height: 1.65; margin: 5px 0 12px 0; }
                        p strong { color: ${textColor}; font-weight: 600; }
                        ul { list-style: none; padding: 0; margin: 10px 0 15px 0; }
                        li { margin-bottom: 10px; padding-left: 18px; position: relative; color: ${lightTextColor}; font-size: 15px; line-height: 1.6; }
                        li::before { content: '•'; color: ${accentColor}; position: absolute; left: 0; top: 1px; font-weight: bold; font-size: 16px; }
                        a { color: ${accentColor}; text-decoration: underline; }
                        a:hover { color: ${accentDarkColor}; }
                        hr { border: none; border-top: 1px solid ${borderColor}; margin: 30px 0; }
                        .footer { font-size: 12px; color: #aaaaaa; text-align: center; margin-top: 30px; }
                    </style>
                </head>
                <body>
                    <div class="email-wrapper">
                        <div class="email-container">
                            <h1>Новий запит на замовлення (#${Date.now()})</h1>
                            <h2>Контактна інформація</h2>
                            <p><strong>Ім'я:</strong> ${orderData.contactInfo.name}</p>
                            <p><strong>Email:</strong> <a href="mailto:${orderData.contactInfo.email}">${orderData.contactInfo.email}</a></p>
                            <p><strong>Телефон:</strong> <a href="tel:${orderData.contactInfo.phone}">${orderData.contactInfo.phone}</a></p>
                            <h2>Доставка</h2>
                            <p><strong>Метод:</strong> ${orderData.shipping.method || 'не вказано'}</p>
                            <p><strong>Місто:</strong> ${orderData.shipping.city || 'не вказано'}</p>
                            <p><strong>Відділення НП:</strong> ${orderData.shipping.warehouse || 'не вказано'}</p>
                            <p><strong>Адреса:</strong> ${orderData.shipping.address || 'не вказано'}</p>
                            <h2>Товари</h2>
                            <ul>
                                ${orderData.items.map(item => `<li><strong>${item.name}</strong> (ID: ${item.productId || 'N/A'}) <br> Кількість: ${item.quantity} шт. x ${item.price} грн</li>`).join('')}
                            </ul>
                            ${orderData.customDescription !== 'Не вказано' ? `
                            <h2>Опис для "Своя вишивка"</h2>
                            <p>${orderData.customDescription.replace(/\n/g, '<br>')}</p>
                            ` : ''}
                            ${orderData.comments !== 'Немає' ? `
                            <h2>Коментар клієнта</h2>
                            <p>${orderData.comments.replace(/\n/g, '<br>')}</p>
                            ` : ''}
                            <p><strong>Отримано:</strong> ${orderData.receivedAt.toLocaleString('uk-UA', { dateStyle: 'long', timeStyle: 'short' })}</p>
                            <hr>
                            <p class="footer">Це автоматично згенерований лист з сайту Vuzlyk.</p>
                        </div>
                    </div>
                </body>
                </html>
            `;
 const mailOptionsAdmin = {
                from: `"Сайт Vuzlyk" <${process.env.EMAIL_USER}>`, // Відправник info@vuzlyk.com
                to: process.env.ADMIN_EMAIL,
                subject: `Новий запит на замовлення з сайту Vuzlyk (#${newOrder._id} - ${orderData.contactInfo.name})`,
                html: emailHtmlAdmin
            };
            
            transporter.sendMail(mailOptionsAdmin, (error, info) => {
                if (error) {
                    return console.error('[Order Email Admin] Помилка відправки листа адміністратору:', error);
                }
                console.log('[Order Email Admin] Лист адміністратору успішно відправлено: ' + info.response);
            });

            const customerSubject = `Ваш запит на замовлення #${newOrder._id} на Vuzlyk отримано!`;
            const customerEmailHtml = `
                <!DOCTYPE html>
                <html lang="uk">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Ваш запит отримано</title>
                    <style>
                        body { margin: 0; padding: 0; background-color: ${bgColor}; font-family: ${bodyFont}; }
                        .email-wrapper { background-color: ${bgColor}; padding: 20px 10px; }
                        .email-container { background-color: ${whiteColor}; max-width: 600px; margin: 0 auto; padding: 25px 30px; border-radius: 8px; border: 1px solid ${borderColor}; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
                        h1 { color: ${textColor}; font-family: ${headingFont}; font-size: 20px; margin-top: 0; margin-bottom: 20px; text-align: center; }
                        h2 { color: ${accentDarkColor}; font-family: ${headingFont}; font-size: 18px; margin-top: 25px; margin-bottom: 10px; border-bottom: 1px solid ${borderColor}; padding-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
                        p { color: ${lightTextColor}; font-size: 15px; line-height: 1.65; margin: 10px 0 15px 0; }
                        p strong { color: ${textColor}; font-weight: 600; }
                        ul { list-style: none; padding: 0; margin: 15px 0; }
                        li { margin-bottom: 8px; padding-left: 18px; position: relative; color: ${lightTextColor}; font-size: 14px; line-height: 1.5; }
                        li::before { content: '•'; color: ${accentColor}; position: absolute; left: 0; top: 1px; font-weight: bold; font-size: 16px; }
                        a { color: ${accentColor}; text-decoration: underline; }
                        a:hover { color: ${accentDarkColor}; }
                        hr { border: none; border-top: 1px solid ${borderColor}; margin: 25px 0; }
                        .footer { font-size: 12px; color: #aaaaaa; text-align: center; margin-top: 25px; }
                    </style>
                </head>
                <body>
                    <div class="email-wrapper">
                        <div class="email-container">
                            <h1>Дякуємо за ваш запит, ${orderData.contactInfo.name}!</h1>
                            <p>Ми отримали ваш запит на замовлення №${newOrder._id} на сайті Vuzlyk.</p>
                            <p><strong>Ваш запит містить наступні позиції:</strong></p>
                            <ul>
                                ${orderData.items.map(item => `<li>${item.name} (${item.quantity} шт.)</li>`).join('')}
                            </ul>
                            ${orderData.customDescription !== 'Не вказано' ? `<p><strong>Ваш опис для "Своя вишивка":</strong> <em>${orderData.customDescription.replace(/\n/g, '<br>')}</em></p>` : ''}
                            ${orderData.comments !== 'Немає' ? `<p><strong>Ваш коментар:</strong> <em>${orderData.comments.replace(/\n/g, '<br>')}</em></p>` : ''}
                            <hr>
                            <p><strong>Що далі?</strong></p>
                            <p>Ми зв'яжемося з вами найближчим робочим часом за вказаними контактами (${orderData.contactInfo.email} або ${orderData.contactInfo.phone}) для уточнення всіх деталей, узгодження остаточної вартості та термінів виконання.</p>
                            <p>Будь ласка, очікуйте на наш дзвінок або лист.</p>
                            <p class="footer">З найкращими побажаннями, <br>Команда Vuzlyk</p>
                        </div>
                    </div>
                </body>
                </html>
            `;

  const mailOptionsCustomer = {
                from: `"Вузлик до вузлика" <${process.env.EMAIL_USER}>`,
                to: orderData.contactInfo.email,
                subject: customerSubject,
                html: customerEmailHtml
            };

            transporter.sendMail(mailOptionsCustomer, (error, info) => {
                if (error) {
                    return console.error('[Order Email Customer] Помилка відправки листа клієнту:', error);
                }
                console.log('[Order Email Customer] Лист клієнту успішно відправлено: ' + info.response);
            });
        }
        req.session.cart = [];
        res.redirect('/order/request-sent');
    } catch (error) {
        return res.redirect('/checkout?error=submission');
    }
});

app.get('/order/request-sent', (req, res) => {
  res.render('order-request-sent');
});

app.get('/privacy-policy', (req, res) => { res.render('privacy-policy'); });
app.get('/terms', (req, res) => { res.render('terms-of-service'); });
app.get('/faq', (req, res) => { res.render('faq'); });
const blogAdminRoutes = require('./routes/blogAdminRoutes');
app.use('/admin/blog', blogAdminRoutes); 
const blogRoutes = require('./routes/blogRoutes');
app.use('/blog', blogRoutes);
app.get('/about', (req, res) => {
  try {
      res.render('about');
  } catch (error) {
      console.error("Помилка при рендерингу сторінки /about:", error);
      res.status(500).render('500');
  }
});

app.get('/contacts', (req, res) => {
    res.render('contacts', {
        pageTitle: "Контакти - Вузлик до вузлика", 
        query: req.query,
        formData: {} 
    });
});

app.post('/contacts/send', async (req, res) => {
   console.log('[Contact Form V2] Received body:', JSON.stringify(req.body, null, 2));

    // Тепер токен буде в req.body['g-recaptcha-response']
    const { name, email, phone, subject, message } = req.body;
    const recaptchaToken = req.body['g-recaptcha-response'];

    // 1. Перевірка токена reCAPTCHA
    if (!process.env.RECAPTCHA_V2_SECRET_KEY) {
        console.error('[Contact Form V2] RECAPTCHA_V2_SECRET_KEY не налаштовано на сервері.');
        // ... обробка помилки конфігурації ...
        return res.redirect('/contacts?error=' + encodeURIComponent('Помилка конфігурації сервера reCAPTCHA.') /* ... */);
    }

    if (!recaptchaToken) {
        console.warn('[Contact Form V2] reCAPTCHA token (g-recaptcha-response) відсутній або порожній.');
        return res.redirect('/contacts?error=' + encodeURIComponent('Будь ласка, пройдіть перевірку "Я не робот".') /* ... */);
    }

    try {
        const secretKey = process.env.RECAPTCHA_V2_SECRET_KEY;
        const verificationURL = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${recaptchaToken}&remoteip=${req.ip}`;

        const recaptchaResponse = await axios.post(verificationURL);
        const recaptchaData = recaptchaResponse.data;

        console.log('[Contact Form V2] reCAPTCHA verification response:', recaptchaData);

        if (!recaptchaData.success) {
            console.warn('[Contact Form V2] Перевірка reCAPTCHA не пройдена:', recaptchaData['error-codes']);
            let userErrorMessage = 'Перевірка "Я не робот" не пройдена. Спробуйте ще раз.';
            // ... (можна додати більш детальну обробку error-codes, якщо потрібно) ...
            return res.redirect('/contacts?error=' + encodeURIComponent(userErrorMessage) /* ... */);
        }

        // Якщо дійшли сюди, reCAPTCHA v2 пройдена успішно.
        // Видаляємо перевірку score та action, оскільки вони специфічні для v3.
        console.log('[Contact Form V2] reCAPTCHA успішно пройдена.');

        if (!name || !email || !message) {
            return res.redirect('/contacts?error=' + encodeURIComponent('Будь ласка, заповніть усі обов\'язкові поля (ім\'я, email, повідомлення).') + `&name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}&phone=${encodeURIComponent(phone || '')}&subject=${encodeURIComponent(subject || '')}&message=${encodeURIComponent(message)}`);
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.redirect('/contacts?error=' + encodeURIComponent('Будь ласка, введіть коректний email.') + `&name=${encodeURIComponent(name)}&phone=${encodeURIComponent(phone || '')}&subject=${encodeURIComponent(subject || '')}&message=${encodeURIComponent(message)}`);
        }

        const mailSubject = subject ? `Повідомлення з сайту Вузлик: ${subject}` : `Нове повідомлення з контактної форми Вузлик від ${name}`;
        const mailText = `
Ім'я: ${name}
Email: ${email}
Телефон: ${phone || 'Не вказано'}
Тема: ${subject || 'Без теми'}

Повідомлення:
${message}
    `;
        const mailHtml = `
        <p><strong>Ім'я:</strong> ${name}</p>
        <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
        <p><strong>Телефон:</strong> ${phone || 'Не вказано'}</p>
        <p><strong>Тема:</strong> ${subject || 'Без теми'}</p>
        <hr>
        <p><strong>Повідомлення:</strong></p>
        <p style="white-space: pre-wrap;">${message}</p>
    `;

        if (!process.env.SMTP_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS || !process.env.ADMIN_EMAIL) {
            console.error('Відсутні налаштування SMTP для відправки контактної форми.');
            return res.redirect('/contacts?error=' + encodeURIComponent('Помилка сервера. Не вдалося відправити повідомлення.'));
        }
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT, 10),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });
        await transporter.sendMail({
            from: `"${name} (Сайт Вузлик)" <${process.env.EMAIL_USER}>`,
            replyTo: email,
            to: process.env.ADMIN_EMAIL,
            subject: mailSubject,
            text: mailText,
            html: mailHtml,
        });

console.log(`[Contact Form V2] Повідомлення від ${name} (${email}) успішно відправлено.`);
        res.redirect('/contacts?success=true');

    } catch (error) {
        console.error('Помилка обробки контактної форми або reCAPTCHA V2 (зовнішній catch):', error);
        res.redirect('/contacts?error=' + encodeURIComponent('Сталася помилка при відправці повідомлення. Спробуйте пізніше.') /* ... */);
    }
});

app.post('/api/products/:id/reviews', isLoggedIn, async (req, res) => {
  const productId = req.params.id;
  const userId = req.user._id;
  const { rating, text } = req.body;
  if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.redirect(`/product/${productId}/review?error=invalid_id`);
  }
  const ratingNum = parseInt(rating);
  if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.redirect(`/product/${productId}/review?error=invalid_rating`);
  }
  try {
      const purchase = await Order.findOne({ userId: userId, 'items.productId': productId, status: 'Виконано' }).select('_id').lean();
      if (!purchase) {
          console.warn(`Attempt to review product ${productId} by user ${userId} without completed purchase.`);
          return res.redirect(`/product/${productId}?error=not_purchased`);
      }
      const existingReview = await Review.findOne({ productId: productId, userId: userId }).select('_id').lean();
      if (existingReview) {
          console.warn(`User ${userId} attempt to review product ${productId} again.`);
          return res.redirect(`/product/${productId}?error=already_reviewed`);
      }
      const productExists = await Product.findById(productId, '_id');
      if (!productExists) {
          return res.redirect(`/catalog?error=product_not_found`);
      }
      const newReview = new Review({
          productId: productId,
          userId: userId,
          rating: ratingNum,
          text: text ? String(text).trim() : ''
      });
      await newReview.save();
      await Product.findByIdAndUpdate(
          productId,
          { $inc: { ratingSum: ratingNum, ratingCount: 1 } }
      );
      console.log(`New review for product ${productId} by user ${userId} saved.`);
      res.redirect(`/product/${productId}?review=success`);
  } catch (error) {
      console.error(`Error saving review for product ${productId} by user ${userId}:`, error);
      if (error.code === 11000) {
          return res.redirect(`/product/${productId}?error=already_reviewed`);
      }
      res.redirect(`/product/${productId}/review?error=server_error`);
  }
});

app.use((req, res, next) => {
  console.log(`[LOG] Запит ${req.url} не знайдено (404)`);
  res.status(404).render('404');
});

app.use((err, req, res, next) => {
    const timestamp = new Date().toISOString();
    console.error(`[ERROR HANDLER] Timestamp: ${timestamp}`);
    console.error(`[ERROR HANDLER] Route: ${req.method} ${req.originalUrl}`);
    if (req.user) {
      console.error(`[ERROR HANDLER] User ID: ${req.user._id}`);
    }
    console.error(`[ERROR HANDLER] Error: ${err.name || 'UnknownError'} | Status: ${err.status || 500} | Message: ${err.message || 'No message'}`);
  
    if (process.env.NODE_ENV !== 'production') {
         console.error('[ERROR HANDLER] Stack:', err.stack);
    } else if (err.stack) {
         console.error('[ERROR HANDLER] Stack (first line):', err.stack.split('\n')[0]);
    }
  
    let statusCode = typeof err.status === 'number' && err.status >= 400 && err.status < 600 ? err.status : 500;
    let userMessage = 'На жаль, на сервері сталася несподівана помилка. Будь ласка, спробуйте пізніше.';
    let errorDetailsForJson = { message: userMessage }; 
  
    if (err.name === 'ValidationError' && mongoose?.Error?.ValidationError && err instanceof mongoose.Error.ValidationError) {
         statusCode = 400;
         userMessage = 'Будь ласка, перевірте правильність введених даних.';
         errorDetailsForJson = {
              message: userMessage,
              errors: Object.values(err.errors).map(el => ({ field: el.path, message: el.message }))
         };
         console.error('[ERROR HANDLER] Mongoose Validation Errors:', JSON.stringify(errorDetailsForJson.errors));
    } else if (err.name === 'CastError' && mongoose?.Error?.CastError && err instanceof mongoose.Error.CastError) {
         statusCode = 400; 
         userMessage = 'Неправильний формат запитуваних даних.';
         errorDetailsForJson = { message: userMessage, reason: 'Invalid data format, possibly ID.' };
    }

    if (process.env.NODE_ENV !== 'production') {
        userMessage = err.message || userMessage;
        if (!errorDetailsForJson.errors) { 
            errorDetailsForJson = { message: userMessage, stack: err.stack };
        }
    }
  
    res.status(statusCode);
  
    if (req.accepts(['html', 'json']) === 'json' || req.originalUrl.startsWith('/api/')) {
        res.json({ success: false, ...errorDetailsForJson });
    } else {
        if (statusCode === 404) { 
            res.render('404', {
                pageTitle: 'Сторінку Не Знайдено',
                message: userMessage 
            });
        } else { 
            res.render('500', { 
                pageTitle: 'Помилка',
                message: userMessage 
            });
        }
    }
  });

/**
 * @param {number} amountUAH 
 * @param {string} targetCurrency 
 * @param {object} rates 
 * @param {object} symbols 
 * @returns {string} 
 */
app.locals.formatPrice = (amountUAH, targetCurrency, rates, symbols) => {
    const baseAmount = typeof amountUAH === 'number' ? amountUAH : 0;
    const currency = (targetCurrency && rates && rates[targetCurrency]) ? targetCurrency : 'UAH';
    const rate = (rates && rates[currency]) ? rates[currency] : 1;
    const symbol = (symbols && symbols[currency]) ? symbols[currency] : 'грн'; 

    const convertedAmount = baseAmount * rate;
    const formattedAmount = convertedAmount.toFixed(2);

    if (currency === 'UAH') {
        return `${formattedAmount} ${symbol}`;
    } else if (currency === 'USD') {
        return `${symbol}${formattedAmount}`;
    } else if (currency === 'EUR') {
        return `${symbol}${formattedAmount}`;
    } else {
        return `${formattedAmount} ${currency}`;
    }
};

app.listen(PORT, () => {
  console.log(`Сервер запущено на порту ${PORT}`);
});
