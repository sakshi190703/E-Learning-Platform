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

// MongoDB Connection with connection pooling for serverless
const mongoUrl = process.env.MONGO_URL;
let isConnected = false;

async function connectToDatabase() {
    if (isConnected && mongoose.connection.readyState === 1) {
        return;
    }
    
    if (!mongoUrl) {
        console.error('MongoDB URL not found in environment variables. Please set MONGO_URL in .env');
        throw new Error('MongoDB URL not configured');
    }
    
    try {
        await mongoose.connect(mongoUrl, {
            serverSelectionTimeoutMS: 3000, // 3 second timeout for serverless
            socketTimeoutMS: 3000,
            maxPoolSize: 1, // Limit connection pool for serverless
            bufferCommands: false // Disable mongoose buffering for serverless
        });
        isConnected = true;
        console.log('Connected to MongoDB');
    } catch (err) {
        console.error('MongoDB connection error:', err);
        isConnected = false;
        throw err;
    }
}

// Initialize connection
if (!process.env.VERCEL) {
    // Only auto-connect in local development
    connectToDatabase().catch(err => {
        console.error('Failed to initialize database connection:', err);
    });
} else {
    // Configure mongoose for serverless
    mongoose.set('bufferCommands', false);
}

// Express Configuration
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.engine('ejs', ejsMate);
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

// Handle uploads directory - serverless functions can't write to disk
const uploadDir = process.env.VERCEL ? '/tmp/uploads' : path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  try {
    fs.mkdirSync(uploadDir, { recursive: true });
  } catch (err) {
    console.warn('Could not create uploads directory:', err.message);
  }
}

// Session Configuration
const sessionStore = process.env.VERCEL 
    ? undefined // Use memory store for serverless
    : MongoStore.create({ 
        mongoUrl: process.env.MONGO_URL,
        touchAfter: 24 * 3600 // lazy session update
    });

app.use(session({
    secret: process.env.SESSION_SECRET || 'Sakshi@123',
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
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

// Database connection middleware for serverless
app.use(async (req, res, next) => {
    if (process.env.VERCEL) {
        try {
            await connectToDatabase();
        } catch (err) {
            console.error('Database connection failed:', err);
            return res.status(500).send('Database connection failed');
        }
    }
    next();
});

// Routes
// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', async (req, res) => {
    try {
        res.render('home');
    } catch (err) {
        console.error('Error rendering home page:', err);
        res.status(500).send('Error loading page');
    }
});

app.use('/', authRoutes);
app.use('/student', studentRoutes);
app.use('/instructor', instructorRoutes);

// Error Handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something went wrong! Check the console for details.');
});

// // Start Server
// const port = process.env.PORT || 3000;
// app.listen(port, () => {
//     console.log(`Server running on port ${port}`);
// });

// module.exports = app;


if (process.env.VERCEL) {
    // On Vercel, just export the app — don't start a server
    module.exports = app;
} else {
    // Local development
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
}
