const express = require('express');
const multer = require('multer');
const User = require('../models/user');
const Listing = require('../models/listing');
const Assignment = require('../models/assignment');
const Test = require('../models/test');
const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
      cb(null, Date.now() + '-' + file.originalname);
    }
  });
  const upload = multer({ storage });

// Middleware to ensure user is an instructor
const isInstructor = (req, res, next) => {
    if (req.isAuthenticated() && req.user.role === 'instructor') {
        return next();
    }
    req.flash('error', 'Unauthorized access.');
    res.redirect('/login');
};

// Dashboard
router.get('/dashboard', isInstructor, async (req, res) => {
    const user = await User.findById(req.user._id);
    const courses = await Listing.find({ createdBy: req.user._id });
    res.render('profile/instructor', { user, courses });
});

// Create Course
router.get('/courses/new', isInstructor, (req, res) => {
    res.render('listings/new');
});

router.post('/courses/new', isInstructor, upload.single('listing[image]'), async (req, res) => {
    try {
        console.log('Form Data:', req.body.listing);
        console.log('File:', req.file);
    
        const { title, instructor, description, price } = req.body.listing;
        if (!title || !instructor || !description || !price) {
          req.flash('error', 'All fields are required.');
          return res.redirect('/instructor/courses/new');
        }
    const newListing = new Listing({
        title,
        instructor,
        description,
        price,
        image: req.file ? req.file.path : null, // Save file path if uploaded
        createdBy: req.user._id
      });   
    await newListing.save();
    req.flash('success', 'Course created successfully!');
    res.render('listings/success', { course: newListing }); // Render a success page

} catch (err) {
    console.error(err);
    req.flash('error', 'Failed to create course. Please try again.');
    res.redirect('/instructor/courses/new');
  }

});

// Edit Course
router.get('/courses/:id/edit', isInstructor, async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);
    if (!listing.createdBy.equals(req.user._id)) {
        req.flash('error', 'Unauthorized.');
        return res.redirect('/instructor/dashboard');
    }
    res.render('listings/edit', { listing });
});

router.put('/courses/:id', isInstructor, upload.single('listing[image]'), async (req, res) => {
    try {
      const { id } = req.params;
      const listing = await Listing.findById(id);
      if (!listing.createdBy.equals(req.user._id)) {
        req.flash('error', 'Unauthorized.');
        return res.redirect('/instructor/dashboard');
      }
  
      const { title, instructor, description, price } = req.body.listing;
      if (!title || !instructor || !description || !price) {
        req.flash('error', 'All fields are required.');
        return res.redirect(`/instructor/courses/${id}/edit`);
      }
  
      const updatedData = {
        title,
        instructor,
        description,
        price: Number(price),
        ...(req.file && { image: req.file.path }) // Update image only if a new file is uploaded
      };
  
      await Listing.findByIdAndUpdate(id, updatedData);
      req.flash('success', 'Course updated successfully!');
      res.redirect('/instructor/dashboard');
    } catch (err) {
      console.error(err);
      req.flash('error', 'Failed to update course. Please try again.');
      res.redirect(`/instructor/courses/${id}/edit`);
    }
  });
// Delete Course
router.delete('/courses/:id', isInstructor, async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);
    if (!listing.createdBy.equals(req.user._id)) {
        req.flash('error', 'Unauthorized.');
        return res.redirect('/instructor/dashboard');
    }
    await Listing.findByIdAndDelete(id);
    await Assignment.deleteMany({ course: id });
    await Test.deleteMany({ course: id });
    req.flash('success', 'Course deleted successfully!');
    res.redirect('/instructor/dashboard');
});

// List Tests for Grading
router.get('/courses/:courseId/tests', isInstructor, async (req, res) => {
    const { courseId } = req.params;
    const course = await Listing.findById(courseId);
    if (!course || !course.createdBy.equals(req.user._id)) {
      req.flash('error', 'Unauthorized or course not found.');
      return res.redirect('/instructor/dashboard');
        }
    const tests = await Test.find({ course: courseId });
    res.render('tests/list', { course, tests });
  });

  // List Assignments for Grading
router.get('/courses/:courseId/assignments', isInstructor, async (req, res) => {
    const { courseId } = req.params;
    const course = await Listing.findById(courseId);
    if (!course || !course.createdBy.equals(req.user._id)) {
      req.flash('error', 'Unauthorized or course not found.');
      return res.redirect('/instructor/dashboard');
    }
    const assignments = await Assignment.find({ course: courseId });
    res.render('assignments/list', { course, assignments });
  });

// Create Assignment
router.get('/courses/:id/assignments/new', isInstructor, async (req, res) => {
    const { id } = req.params;
    const course = await Listing.findById(id);
    res.render('assignments/new', { course });
});

router.post('/courses/:id/assignments', isInstructor, async (req, res) => {
    const { id } = req.params;
    const { title, description } = req.body.assignment;
    const newAssignment = new Assignment({
        title,
        description,
        course: id,
        createdBy: req.user._id
    });
    await newAssignment.save();
    req.flash('success', 'Assignment created successfully!');
    res.redirect('/instructor/dashboard');
});

// Create Test
router.get('/courses/:id/tests/new', isInstructor, async (req, res) => {
    const { id } = req.params;
    const course = await Listing.findById(id);
    res.render('tests/new', { course });
});

router.post('/courses/:id/tests', isInstructor, async (req, res) => {
    const { id } = req.params;
    const { title, questions } = req.body.test;
    const newTest = new Test({
        title,
        questions: questions.map(q => ({
            question: q.question,
            options: q.options,
            correctAnswer: q.correctAnswer
        })),
        course: id,
        createdBy: req.user._id
    });
    await newTest.save();
    req.flash('success', 'Test created successfully!');
    res.redirect('/instructor/dashboard');
});

// Grade Test
router.get('/tests/:id/grade', isInstructor, async (req, res) => {
    const { id } = req.params;
    const test = await Test.findById(id).populate('course');
    const students = await User.find({
        role: 'student',
        'testScores.test': id
    }).populate('testScores.test');
    res.render('tests/grade', { test, students });
});

router.post('/tests/:id/grade/:studentId', isInstructor, async (req, res) => {
    const { id, studentId } = req.params;
    const { score } = req.body;
    await User.findByIdAndUpdate(studentId, {
        $set: {
            'testScores.$[elem].score': score,
            'testScores.$[elem].gradedAt': Date.now()
        }
    }, {
        arrayFilters: [{ 'elem.test': id }]
    });
    req.flash('success', 'Test graded successfully!');
    res.redirect(`/instructor/tests/${id}/grade`);
});

// Grade Test
router.get('/tests/:id/grade', isInstructor, async (req, res) => {
    const { id } = req.params;
    const test = await Test.findById(id).populate('course');
    if (!test || !test.createdBy.equals(req.user._id)) {
      req.flash('error', 'Unauthorized or test not found.');
      return res.redirect('/instructor/dashboard');
    }
    const students = await User.find({
      role: 'student',
      'testScores.test': id
    }).populate('testScores.test');
    res.render('tests/grade', { test, students });
  });

  router.post('/tests/:id/grade/:studentId', isInstructor, async (req, res) => {
    try {
      const { id, studentId } = req.params;
      const { score } = req.body;
      if (!score || score < 0 || score > 100) {
        req.flash('error', 'Please provide a valid score (0-100).');
        return res.redirect(`/instructor/tests/${id}/grade`);
      }
      await User.findByIdAndUpdate(studentId, {
        $set: {
          'testScores.$[elem].score': Number(score),
          'testScores.$[elem].gradedAt': Date.now()
        }
      }, {
        arrayFilters: [{ 'elem.test': id }]
      });
      req.flash('success', 'Test graded successfully!');
      res.redirect(`/instructor/tests/${id}/grade`);
    } catch (err) {
      console.error(err);
      req.flash('error', 'Failed to grade test. Please try again.');
      res.redirect(`/instructor/tests/${id}/grade`);
    }
  });

  // Grade Assignment
router.get('/assignments/:id/grade', isInstructor, async (req, res) => {
    const { id } = req.params;
    const assignment = await Assignment.findById(id).populate('course');
    if (!assignment || !assignment.createdBy.equals(req.user._id)) {
      req.flash('error', 'Unauthorized or assignment not found.');
      return res.redirect('/instructor/dashboard');
    }
    const students = await User.find({
      role: 'student',
      'submittedAssignments.assignment': id
    }).populate('submittedAssignments.assignment');
    res.render('assignments/grade', { assignment, students });
  });
  
  router.post('/assignments/:id/grade/:studentId', isInstructor, async (req, res) => {
    try {
      const { id, studentId } = req.params;
      const { score } = req.body;
      if (!score || score < 0 || score > 100) {
        req.flash('error', 'Please provide a valid score (0-100).');
        return res.redirect(`/instructor/assignments/${id}/grade`);
      }
      await User.findByIdAndUpdate(studentId, {
        $set: {
          'submittedAssignments.$[elem].score': Number(score),
          'submittedAssignments.$[elem].gradedAt': Date.now()
        }
      }, {
        arrayFilters: [{ 'elem.assignment': id }]
      });

      req.flash('success', 'Assignment graded successfully!');
    res.redirect(`/instructor/assignments/${id}/grade`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to grade assignment. Please try again.');
    res.redirect(`/instructor/assignments/${id}/grade`);
  }
});

module.exports = router;