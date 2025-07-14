const express = require('express');
const User = require('../models/user');
const Listing = require('../models/listing');
const Assignment = require('../models/assignment');
const Test = require('../models/test');
const router = express.Router();
const multer = require('multer');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'uploads/'); // Ensure this directory exists
    },
    filename: (req, file, cb) => {
      cb(null, Date.now() + '-' + file.originalname);
    }
  });
  const upload = multer({ storage });

// Middleware to ensure user is a student
const isStudent = (req, res, next) => {
    if (req.isAuthenticated() && req.user.role === 'student') {
        return next();
    }
    req.flash('error', 'Unauthorized access.');
    res.redirect('/login');
};

// Dashboard
router.get('/dashboard', isStudent, async (req, res) => {
    const user = await User.findById(req.user._id)
        .populate('enrolledCourses.course')
        .populate({
            path: 'submittedAssignments.assignment',
            populate: { path: 'course' }
          })
          .populate({
            path: 'testScores.test',
            populate: { path: 'course' }
          });
    res.render('profile/student', { user });
});

// Enroll in Course
router.post('/courses/:id/enroll', isStudent, async (req, res) => {
    const { id } = req.params;
    const user = await User.findById(req.user._id);
    if (user.enrolledCourses.some(ec => ec.course.toString() === id)) {
        req.flash('error', 'Already enrolled in this course.');
        return res.redirect('/listings');
    }
    user.enrolledCourses.push({ course: id });
    await user.save();
    req.flash('success', 'Successfully enrolled in course!');
    res.redirect('/student/dashboard');
});

// Unenroll from Course
router.post('/courses/:id/unenroll', isStudent, async (req, res) => {
    const { id } = req.params;
    await User.findByIdAndUpdate(req.user._id, {
        $pull: { enrolledCourses: { course: id } }
    });
    req.flash('success', 'Successfully unenrolled from course.');
    res.redirect('/student/dashboard');
});

// Submit Assignment
router.get('/assignments/:id/submit', isStudent, async (req, res) => {
    const { id } = req.params;
    const assignment = await Assignment.findById(id).populate('course');
    if (!assignment) {
        req.flash('error', 'Assignment not found.');
        return res.redirect('/student/dashboard');
    }
    // Check if the student has already submitted the assignment
  const user = await User.findById(req.user._id);
  const assignmentSubmission = user.submittedAssignments.find(sub => sub.assignment.equals(id));

  if (assignmentSubmission) {
    // Render results if already submitted
    return res.render('assignments/results', { assignment, assignmentSubmission });
  }
    res.render('assignments/submit', { assignment });
});
router.post('/assignments/:id/submit', isStudent, upload.single('submission'), async (req, res) => {
    try {
      const { id } = req.params;
      const assignment = await Assignment.findById(id).populate('course');
      if (!assignment) {
        req.flash('error', 'Assignment not found.');
        return res.redirect('/student/dashboard');
      }
  
      // Check for prior submission to prevent duplicates
      const user = await User.findById(req.user._id);
      const existingSubmission = user.submittedAssignments.find(sub => sub.assignment.equals(id));
      if (existingSubmission) {
        req.flash('error', 'You have already submitted this assignment.');
        return res.redirect(`/student/assignments/${id}/results`);
      }
  
      // Save submission (text or file)
      const submission = req.file ? req.file.path : req.body.submission; // Use file path if uploaded, else text
      if (!submission) {
        req.flash('error', 'Please provide a submission (text or file).');
        return res.redirect(`/student/assignments/${id}/submit`);
      }
  
      await User.findByIdAndUpdate(req.user._id, {
        $push: {
          submittedAssignments: {
            assignment: id,
            submission,
            submittedAt: Date.now()
          }
        }
    });

    req.flash('success', 'Assignment submitted successfully!');
    res.redirect(`/student/assignments/${id}/results`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to submit assignment. Please try again.');
    res.redirect(`/student/assignments/${id}/submit`);
  }
});

router.get('/assignments/:id/results', isStudent, async (req, res) => {
    try {
  const { id } = req.params;
  const assignment = await Assignment.findById(id).populate('course');
  if (!assignment) {
    req.flash('error', 'Assignment not found.');
    return res.redirect('/student/dashboard');
  }

  const user = await User.findById(req.user._id);
  const assignmentSubmission = user.submittedAssignments.find(sub => sub.assignment.equals(id));
  if (!assignmentSubmission) {
    req.flash('error', 'No submission found for this assignment.');
    return res.redirect(`/student/assignments/${id}/submit`);
  }

  res.render('assignments/results', { assignment, assignmentSubmission });
} catch (err) {
    console.error(err);
    req.flash('error', 'Failed to load assignment results.');
    res.redirect('/student/dashboard');
  }
});

// Take Test
router.get('/tests/:id/take', isStudent, async (req, res) => {
    const { id } = req.params;
    const test = await Test.findById(id).populate('course');
    if (!test) {
        req.flash('error', 'Test not found.');
        return res.redirect('/student/dashboard'); // Adjust to your student dashboard route
      }
      const user = await User.findById(req.user._id);
      const testAttempt = user.testScores.find(score => score.test.equals(id));
    
      if (testAttempt) {
        // Test already submitted, render results or submitted answers
        return res.render('tests/results', { test, testAttempt });
      }
    res.render('tests/take', { test });
});

router.post('/tests/:id/submit', isStudent, async (req, res) => {
    try {
    const { id } = req.params;
    const answers = req.body.answers || {};
    const test = await Test.findById(id);
    let score = 0;
    test.questions.forEach((q, i) => {
        if (answers[i] === q.correctAnswer) score += 1;
    });
    const formattedAnswers = test.questions.map((q, i) => ({
      questionId: q._id,
      selectedAnswer: answers[i] || null
    }));
    await User.findByIdAndUpdate(req.user._id, {
        $push: {
            testScores: {
                test: id,
                score: (score / test.questions.length) * 100,
                answers:formattedAnswers,
      submittedAt: Date.now(),
      gradedAt: Date.now() // Mark as graded
            }
        }
    });
    req.flash('success', 'Test submitted successfully!');
    res.redirect('/student/dashboard');
} catch (err) {
    console.error(err);
    req.flash('error', 'Failed to submit test. Please try again.');
    res.redirect(`/student/tests/${id}`);
  }
});

// Render test results
router.get('/tests/:id/results', isStudent, async (req, res) => {
    const { id } = req.params;
    const test = await Test.findById(id).populate('course');
    if (!test) {
      req.flash('error', 'Test not found.');
      return res.redirect('/student/dashboard');
    }
  
    const user = await User.findById(req.user._id);
    const testAttempt = user.testScores.find(score => score.test.equals(id));
    if (!testAttempt) {
      req.flash('error', 'No submission found for this test.');
      return res.redirect(`/student/tests/${id}`);
    }
  
    res.render('tests/results', { test, testAttempt });
  });

// Delete Account
router.delete('/account', isStudent, async (req, res) => {
    await User.findByIdAndDelete(req.user._id);
    req.logout((err) => {
        if (err) throw err;
        req.flash('success', 'Account deleted successfully.');
        res.redirect('/login');
    });
});

// Course Listings
router.get('/listings', isStudent, async (req, res) => {
    const allListings = await Listing.find({});
    res.render('listings/index', { allListings });
});

// Show Course
router.get('/listings/:id', isStudent, async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id)
        .populate('createdBy')
        .populate({
            path: 'createdBy',
            match: { role: 'instructor' }
        });
    const assignments = await Assignment.find({ course: id });
    const tests = await Test.find({ course: id });
    res.render('listings/show', { listing, assignments, tests });
});

module.exports = router;