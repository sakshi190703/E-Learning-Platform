require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const methodOverride = require('method-override');
const ejsMate = require('ejs-mate');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const flash = require('connect-flash');
const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/student');
const instructorRoutes = require('./routes/instructor');
const User = require('./models/user');
const app = express();
const fs = require('fs');

// MongoDB Connection
const mongoUrl = process.env.MONGO_URL;
async function main() {
    if (!mongoUrl) {
        console.error('MongoDB URL not found in environment variables. Please set MONGO_URL in .env');
        process.exit(1);
    }
    try {
        await mongoose.connect(mongoUrl); // Remove useNewUrlParser and useUnifiedTopology
        console.log('Connected to MongoDB');
    } catch (err) {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    }
}
main();

// Express Configuration
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.engine('ejs', ejsMate);
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Session Configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'Sakshi@123',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URL }),
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

passport.use(new LocalStrategy({
    usernameField: 'email',    // because your form sends email
    passwordField: 'password'
}, async (email, password, done) => {
    try {
        const user = await User.findOne({ email });

        if (!user) {
            return done(null, false, { message: 'No user with that email address' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return done(null, false, { message: 'Password incorrect' });
        }

        return done(null, user); // success
    } catch (err) {
        return done(err);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err);
    }
});



app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

// Flash and User Middleware
app.use((req, res, next) => {
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    res.locals.currentUser = req.user;
    next();
});

// Debug Middleware for Redirects
app.use((req, res, next) => {
    console.log(`Request URL: ${req.url}`);
    next();
});

// Routes
app.get('/', (req, res) => {
    res.render('home');
});

app.use('/', authRoutes);
app.use('/student', studentRoutes);
app.use('/instructor', instructorRoutes);

// Error Handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something went wrong! Check the console for details.');
});

// Start Server
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});