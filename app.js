const express = require('express');

const app = express();

// Init Middleware
// This allows the app to accept JSON data in request bodies
app.use(express.json({ extended: false }));

// Define Routes
// This single line directs all requests starting with /api to your router file.
app.use('/api', require('./routes/api'));

// Export just the app so it can be used by server.js and your test files
module.exports = app;