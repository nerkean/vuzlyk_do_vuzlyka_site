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

const User = require('./models/User');
const Product = require('./models/Product');
const Review = require('./models/Review');
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
    secret: process.env.SESSION_SECRET || 'replace_this_with_a_real_secret_key_in_env',
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

app.use((req, res, next) => {
  res.locals.cartItemCount = req.session.cart ? req.session.cart.reduce((sum, item) => sum + item.quantity, 0) : 0;
  res.locals.currentUser = req.user;
  res.locals.isAdmin = req.session.isAdmin || false;
  next();
});

function checkAdminAuth(req, res, next) {
  if (req.session && req.session.isAdmin) {
      res.locals.isAdmin = true;
      return next();
  } else {
      console.log('Спроба доступу до адмін-ресурсу без авторизації.');
      res.redirect('/admin/login');
  }
}

function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
      return next();
  }
  console.log('Доступ запрещен! Пользователь не аутентифицирован. Перенаправление на /login.');
  res.redirect('/login');
}

const authRoutes = require('./routes/authRoutes');
app.use('/', authRoutes);

app.get('/', async (req, res) => {
  try {
      const featuredProducts = await Product.find({ isFeatured: true }).limit(4);
      res.render('index', { featuredProducts });
  } catch (error) {
      console.error("Помилка отримання товарів для головної:", error);
      res.status(500).render('500');
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
          infoMessage: null
      });
  } catch (error) {
      console.error(`Помилка отримання товару ${productId}:`, error);
      next(error);
  }
});

app.get('/catalog', async (req, res) => {
  try {
      const initialProducts = await Product.find({}).limit(12);
      const catalogDescription = "Каталог...";
      const catalogHeading = "Каталог";
      let firstProductImageUrl = null;
      if (initialProducts.length > 0 && initialProducts[0].images?.length > 0) {
          firstProductImageUrl = initialProducts[0].images[0];
      }
      res.render('catalog', {
          pageHeading: catalogHeading,
          metaDescription: catalogDescription,
          products: initialProducts,
          count: initialProducts.length,
          firstProductImageUrl: firstProductImageUrl
      });
  } catch (error) {
      console.error("Помилка отримання товарів для каталогу:", error);
      res.status(500).render('500');
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
              image: product.images && product.images.length > 0 ? product.images[0] : '/images/placeholder.png',
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
  const finalSubtotal = (typeof subtotal === 'number' && isFinite(subtotal)) ? subtotal.toFixed(2) : '0.00';
  const finalTotal = (typeof total === 'number' && isFinite(total)) ? total.toFixed(2) : '0.00';
  res.render('cart', {
      pageTitle: 'Ваш кошик - Вузлик',
      cartItems: cartItemsForRender,
      subtotal: finalSubtotal,
      total: finalTotal
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
          subtotal: subtotal.toFixed(2),
          total: total.toFixed(2),
          itemLineTotal: itemLineTotal.toFixed(2)
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
  console.log('[LOG] Обробка API запиту GET /api/products');
  console.log('Query params:', req.query);
  try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 12;
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
      console.log('Mongo Filter Query:', JSON.stringify(filterQuery));
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
  const finalSubtotal = (typeof subtotal === 'number' && isFinite(subtotal)) ? subtotal.toFixed(2) : '0.00';
  const finalTotal = (typeof total === 'number' && isFinite(total)) ? total.toFixed(2) : '0.00';
  res.render('checkout', {
      cartItems: cartItemsForRender,
      subtotal: finalSubtotal,
      total: finalTotal
  });
});

app.post('/order/place', async (req, res) => {
  console.log('[LOG] Обробка POST /order/place (новий флоу з email)');
  const cart = req.session.cart || [];
  if (!cart || cart.length === 0) {
      return res.redirect('/cart');
  }
  const {
      email, phone, full_name,
      shippingMethod, shipping_city, shipping_np_warehouse, shipping_address1,
      custom_description, comments
  } = req.body;
  if (!email || !phone || !full_name || !shippingMethod) {
       console.error('Помилка валідації форми оформлення');
       return res.redirect('/checkout?error=validation');
  }
  const orderData = {
      contactInfo: { email, phone, name: full_name },
      shipping: {
          method: shippingMethod, city: shipping_city,
          warehouse: shipping_np_warehouse, address: shipping_address1,
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
  if (req.isAuthenticated()) {
      orderData.userId = req.user._id;
      console.log(`Замовлення буде пов'язане з користувачем: ${req.user.email} (ID: ${req.user._id})`);
  } else {
      console.log('Замовлення від гостя (користувач не залогінений).');
  }
  try {
      const newOrder = new Order(orderData);
      await newOrder.save();
      console.log(`Замовлення ${newOrder._id} збережено в БД.`);
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || !process.env.ADMIN_EMAIL) {
          console.error('ПОМИЛКА: Не встановлені змінні середовища для відправки email.');
          throw new Error('Email configuration missing.');
      } else {
          const transporter = nodemailer.createTransport({
              service: 'gmail',
              auth: {
                  user: process.env.EMAIL_USER,
                  pass: process.env.EMAIL_PASS
              }
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
          const emailHtml = `
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
              from: `"Сайт Vuzlyk" <${process.env.EMAIL_USER}>`,
              to: process.env.ADMIN_EMAIL,
              subject: `Новий запит на замовлення з сайту Vuzlyk (${orderData.contactInfo.name})`,
              html: emailHtml
          };
          await transporter.sendMail(mailOptionsAdmin);
          console.log('Email адміністратору відправлено.');
      }
      req.session.cart = [];
      console.log('Кошик очищено.');
      res.redirect('/order/request-sent');
  } catch (error) {
      console.error('Помилка при відправці email або обробці запиту:', error);
      return res.redirect('/checkout?error=submission');
  }
});

app.get('/order/request-sent', (req, res) => {
  res.render('order-request-sent');
});

app.get('/privacy-policy', (req, res) => { res.render('privacy-policy'); });
app.get('/terms', (req, res) => { res.render('terms-of-service'); });
app.get('/faq', (req, res) => { res.render('faq'); });
app.get('/about', (req, res) => {
  try {
      res.render('about');
  } catch (error) {
      console.error("Помилка при рендерингу сторінки /about:", error);
      res.status(500).render('500');
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

app.get('/admin/login', (req, res) => {
  if (req.session.isAdmin) return res.redirect('/admin/orders');
  res.render('admin/login', { error: req.query.error === '1' ? 'Неправильний логін або пароль.' : null });
});

app.post('/admin/login', async (req, res) => {
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

app.get('/admin/logout', (req, res) => {
  req.session.destroy(err => {
      if (err) {
          console.error("Помилка при виході:", err);
      }
      res.clearCookie('connect.sid');
      console.log('Admin logged out.');
      res.redirect('/admin/login');
  });
});

app.get('/admin/orders', checkAdminAuth, async (req, res) => {
  try {
      const orders = await Order.find().sort({ receivedAt: -1 }).lean();
      res.render('admin/orders', { orders: orders });
  } catch (error) {
      console.error("Помилка завантаження замовлень для адмін-панелі:", error);
      res.status(500).render('admin/error', { message: 'Не вдалося завантажити замовлення' });
  }
});

app.post('/admin/orders/:id/update-status', checkAdminAuth, async (req, res) => {
  const orderId = req.params.id;
  const { newStatus } = req.body;
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ success: false, message: 'Неправильний ID замовлення.' });
  }
  const allowedStatuses = ['Новий', 'В обробці', 'Узгоджено', 'Виконано', 'Скасовано'];
  if (!newStatus || !allowedStatuses.includes(newStatus)) {
      return res.status(400).json({ success: false, message: 'Неприпустимий статус замовлення.' });
  }
  console.log(`Запит на оновлення статусу замовлення ${orderId} на ${newStatus}`);
  try {
      const updatedOrder = await Order.findByIdAndUpdate(
          orderId,
          { status: newStatus },
          { new: true }
      );
      if (!updatedOrder) {
          return res.status(404).json({ success: false, message: 'Замовлення не знайдено.' });
      }
      console.log(`Статус замовлення ${orderId} оновлено на ${newStatus}`);
      res.json({ success: true, message: 'Статус оновлено', newStatus: updatedOrder.status });
  } catch (error) {
      console.error(`Помилка оновлення статусу замовлення ${orderId}:`, error);
      res.status(500).json({ success: false, message: 'Помилка сервера при оновленні статусу.' });
  }
});

app.delete('/admin/orders/:id', checkAdminAuth, async (req, res) => {
  const orderId = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ success: false, message: 'Неправильний ID замовлення.' });
  }
  console.log(`Запит на видалення замовлення ${orderId}`);
  try {
      const deletedOrder = await Order.findByIdAndDelete(orderId);
      if (!deletedOrder) {
          return res.status(404).json({ success: false, message: 'Замовлення не знайдено.' });
      }
      console.log(`Замовлення ${orderId} видалено.`);
      res.json({ success: true, message: 'Замовлення видалено' });
  } catch (error) {
      console.error(`Помилка видалення замовлення ${orderId}:`, error);
      res.status(500).json({ success: false, message: 'Помилка сервера при видаленні замовлення.' });
  }
});

app.use((req, res, next) => {
  console.log(`[LOG] Запит ${req.url} не знайдено (404)`);
  res.status(404).render('404');
});

app.use((err, req, res, next) => {
  console.error("Сталася помилка сервера:", err.stack);
  res.status(500).render('500');
});

app.listen(PORT, () => {
  console.log(`Сервер запущено на порту ${PORT}`);
});
