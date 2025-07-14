const express = require('express');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const User = require('../models/user');
const router = express.Router();

// Passport Configuration
passport.use(new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return done(null, false, { message: 'Incorrect email.' });
        }
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return done(null, false, { message: 'Incorrect password.' });
        }
        return done(null, user);
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

// Routes
router.get('/login', (req, res) => {
    res.render('auth/login');
});
router.post('/login', 
    (req, res, next) => {
        console.log('Email:', req.body.email);
        // console.log('Password:', req.body.password); // Don't log password
        next();
    }, 
    passport.authenticate('local', {
        failureRedirect: '/login',
        failureFlash: true
    }), 
    (req, res) => {
        if (!req.user) {
            req.flash('error', 'Authentication failed. Please try again.');
            return res.redirect('/login');
        }
        const redirectUrl = req.user.role === 'instructor' 
            ? '/instructor/dashboard' 
            : '/student/dashboard';
        req.flash('success', 'Successfully logged in!');
        res.redirect(redirectUrl);
    }
);


router.get('/signup', (req, res) => {
    res.render('auth/signup');
});

router.post('/signup', async (req, res) => {
    try {
        const { email, username, password, role } = req.body;
        if (!['student', 'instructor'].includes(role)) {
            req.flash('error', 'Invalid role selected.');
            return res.redirect('/signup');
        }
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            req.flash('error', 'Email already in use.');
            return res.redirect('/signup');
        }
        const user = new User({ email, username, password, role });
        await user.save();
        req.login(user, (err) => {
            if (err) throw err;
            req.flash('success', 'Successfully signed up!');
            res.redirect(role === 'instructor' ? '/instructor/dashboard' : '/student/dashboard');
        });
    } catch (err) {
        req.flash('error', 'Error during signup.');
        res.redirect('/signup');
    }
});

router.get('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err);
        req.flash('success', 'Successfully logged out!');
        res.redirect('/login');
    });
});

module.exports = router;