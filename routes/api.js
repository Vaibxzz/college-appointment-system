// routes/api.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Import our Mongoose models
const User = require('../models/User');
const Availability = require('../models/Availability');
const Appointment = require('../models/Appointment');

// A secret key for JWT. In a real app, this should be in your .env file.
const JWT_SECRET = 'your_super_secret_jwt_key';

// Middleware to protect routes and verify the JWT token
const protect = (req, res, next) => {
    // Get the token from the header
    const token = req.header('x-auth-token');

    // Check if no token exists
    if (!token) {
        return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    // Verify the token
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded.user;
        next();
    } catch (err) {
        res.status(401).json({ msg: 'Token is not valid' });
    }
};

/**
 * @route   POST /api/auth/register
 * @desc    Register a user (student or professor)
 * @access  Public
 */
router.post('/auth/register', async (req, res) => {
    // Get user data from the request body
    const { name, email, password, role } = req.body;

    // Basic validation
    if (!name || !email || !password || !role) {
        return res.status(400).json({ msg: 'Please enter all fields' });
    }

    try {
        // Check if user already exists
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ msg: 'User already exists' });
        }

        // Create a new user instance
        user = new User({
            name,
            email,
            password,
            role,
        });

        // Hash the password using bcrypt
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);

        // Save the user to the database
        await user.save();

        // Create a JWT payload
        const payload = {
            user: {
                id: user.id,
                role: user.role,
            },
        };

        // Sign the token and send it back
        jwt.sign(
            payload,
            JWT_SECRET,
            { expiresIn: 360000 }, // Token expires in a long time for development
            (err, token) => {
                if (err) throw err;
                res.status(201).json({ token, msg: 'User registered successfully' });
            }
        );
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and get token
 * @access  Public
 */
router.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Check if the user exists
        let user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        // Compare the submitted password with the hashed password in the database
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        // Create and send the JWT token
        const payload = {
            user: {
                id: user.id,
                role: user.role,
            },
        };

        jwt.sign(
            payload,
            JWT_SECRET,
            { expiresIn: 360000 },
            (err, token) => {
                if (err) throw err;
                res.status(200).json({ token, msg: 'Login successful' });
            }
        );
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

/**
 * @route   POST /api/professors/:id/availability
 * @desc    Professor specifies available time slots
 * @access  Private (Professor only)
 */
router.post('/professors/:id/availability', protect, async (req, res) => {
    // Check if the user is a professor and the correct one
    if (req.user.role !== 'professor' || req.user.id !== req.params.id) {
        return res.status(403).json({ msg: 'Forbidden: You are not authorized to set this availability' });
    }

    const { date, timeSlot } = req.body;

    try {
        // Create a new availability instance
        const newAvailability = new Availability({
            professor: req.params.id,
            date,
            timeSlot,
            isBooked: false,
        });

        await newAvailability.save();
        res.status(201).json(newAvailability);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

/**
 * @route   GET /api/professors/:id/availability
 * @desc    Get all available time slots for a specific professor
 * @access  Private
 */
router.get('/professors/:id/availability', protect, async (req, res) => {
    try {
        // Find availability slots for the professor that are not yet booked
        const availability = await Availability.find({
            professor: req.params.id,
            isBooked: false,
        }).populate('professor', 'name'); // Populate professor name for display

        res.status(200).json(availability);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

/**
 * @route   POST /api/appointments
 * @desc    Student books an appointment
 * @access  Private (Student only)
 */
router.post('/appointments', protect, async (req, res) => {
    // Check if the user is a student
    if (req.user.role !== 'student') {
        return res.status(403).json({ msg: 'Forbidden: Only students can book appointments' });
    }

    const { availabilityId } = req.body;

    try {
        // Find the availability slot and check if it's already booked
        let availability = await Availability.findById(availabilityId);
        if (!availability || availability.isBooked) {
            return res.status(400).json({ msg: 'Slot is not available' });
        }

        // Mark the availability as booked
        availability.isBooked = true;
        await availability.save();

        // Create a new appointment
        const newAppointment = new Appointment({
            student: req.user.id,
            professor: availability.professor,
            availability: availability._id,
            date: availability.date,
            timeSlot: availability.timeSlot,
        });

        await newAppointment.save();
        res.status(201).json(newAppointment);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

/**
 * @route   PUT /api/appointments/:id/cancel
 * @desc    Professor cancels an appointment
 * @access  Private (Professor only)
 */
router.put('/appointments/:id/cancel', protect, async (req, res) => {
    // Check if the user is a professor
    if (req.user.role !== 'professor') {
        return res.status(403).json({ msg: 'Forbidden: Only professors can cancel appointments' });
    }

    try {
        // Find the appointment to be canceled
        let appointment = await Appointment.findById(req.params.id);
        if (!appointment) {
            return res.status(404).json({ msg: 'Appointment not found' });
        }

        // Find the related availability slot
        let availability = await Availability.findById(appointment.availability);
        if (availability) {
            // Un-book the slot
            availability.isBooked = false;
            await availability.save();
        }

        // Delete the appointment record
        await Appointment.findByIdAndDelete(req.params.id);
        
        res.status(200).json({ msg: 'Appointment successfully canceled' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});


/**
 * @route   GET /api/students/:id/appointments
 * @desc    Student views their booked appointments
 * @access  Private (Student only)
 */
router.get('/students/:id/appointments', protect, async (req, res) => {
    // Check if the user is the correct student
    if (req.user.role !== 'student' || req.user.id !== req.params.id) {
        return res.status(403).json({ msg: 'Forbidden: You are not authorized to view these appointments' });
    }

    try {
        const appointments = await Appointment.find({ student: req.params.id })
            .populate('professor', 'name') // Populate professor's name
            .sort({ date: 1, timeSlot: 1 }); // Sort by date and time

        res.status(200).json(appointments);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});


module.exports = router;
