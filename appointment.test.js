const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('./app'); // Import the Express app

// Import Mongoose models
const User = require('./models/User');
const Availability = require('./models/Availability');
const Appointment = require('./models/Appointment');

jest.setTimeout(30000);

// --- Test Data ---
const studentA1Data = { name: 'Student A1', email: 'a1@test.edu', password: 'password123', role: 'student' };
const studentA2Data = { name: 'Student A2', email: 'a2@test.edu', password: 'password123', role: 'student' };
const professorP1Data = { name: 'Professor P1', email: 'p1@test.edu', password: 'password123', role: 'professor' };

// Professor's two time slots
const timeSlotT1 = { date: '2025-12-01', timeSlot: '02:00 PM' };
const timeSlotT2 = { date: '2025-12-01', timeSlot: '03:00 PM' };

let mongoServer;

// --- Test Hooks ---
beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

// --- The Single E2E Test Case ---
describe('College Appointment System E2E Flow', () => {
    it('should complete the full user flow as specified', async () => {
        // --- Step 1 & 2: Authenticate Users ---
        console.log('STEP 1 & 2: Authenticating Student A1 and Professor P1...');
        const studentA1Res = await request(app).post('/api/auth/register').send(studentA1Data);
        const studentA1Token = studentA1Res.body.token;
        const studentA1Id = jwt.decode(studentA1Token).user.id;
        expect(studentA1Res.statusCode).toBe(201);

        const profRes = await request(app).post('/api/auth/register').send(professorP1Data);
        const professorP1Token = profRes.body.token;
        const professorP1Id = jwt.decode(professorP1Token).user.id;
        expect(profRes.statusCode).toBe(201);
        console.log('...Student A1 and Professor P1 authenticated successfully.');

        // --- Step 3: Professor P1 specifies availability ---
        console.log('STEP 3: Professor P1 specifying time slots...');
        const availRes1 = await request(app).post(`/api/professors/${professorP1Id}/availability`).set('x-auth-token', professorP1Token).send(timeSlotT1);
        const availabilityIdT1 = availRes1.body._id;
        expect(availRes1.statusCode).toBe(201);

        const availRes2 = await request(app).post(`/api/professors/${professorP1Id}/availability`).set('x-auth-token', professorP1Token).send(timeSlotT2);
        const availabilityIdT2 = availRes2.body._id;
        expect(availRes2.statusCode).toBe(201);
        console.log('...Professor P1 availability set.');

        // --- Step 4: Student A1 views available time slots ---
        console.log('STEP 4: Student A1 viewing available slots...');
        const viewSlotsRes = await request(app).get(`/api/professors/${professorP1Id}/availability`).set('x-auth-token', studentA1Token);
        expect(viewSlotsRes.statusCode).toBe(200);
        expect(viewSlotsRes.body.length).toBe(2); // Should see both T1 and T2
        console.log('...Student A1 can see 2 available slots.');

        // --- Step 5: Student A1 books an appointment for time T1 ---
        console.log('STEP 5: Student A1 booking appointment for time T1...');
        const bookA1Res = await request(app).post('/api/appointments').set('x-auth-token', studentA1Token).send({ availabilityId: availabilityIdT1 });
        const appointmentA1Id = bookA1Res.body._id;
        expect(bookA1Res.statusCode).toBe(201);
        expect(bookA1Res.body.student).toBe(studentA1Id);
        console.log('...Student A1 booked appointment successfully.');

        // --- Step 6: Student A2 authenticates ---
        console.log('STEP 6: Authenticating Student A2...');
        const studentA2Res = await request(app).post('/api/auth/register').send(studentA2Data);
        const studentA2Token = studentA2Res.body.token;
        expect(studentA2Res.statusCode).toBe(201);
        console.log('...Student A2 authenticated successfully.');

        // --- Step 7: Student A2 books an appointment for time T2 ---
        console.log('STEP 7: Student A2 booking appointment for time T2...');
        const bookA2Res = await request(app).post('/api/appointments').set('x-auth-token', studentA2Token).send({ availabilityId: availabilityIdT2 });
        expect(bookA2Res.statusCode).toBe(201);
        console.log('...Student A2 booked appointment successfully.');

        // --- Step 8: Professor P1 cancels the appointment with Student A1 ---
        console.log('STEP 8: Professor P1 canceling appointment with Student A1...');
        const cancelRes = await request(app).put(`/api/appointments/${appointmentA1Id}/cancel`).set('x-auth-token', professorP1Token);
        expect(cancelRes.statusCode).toBe(200);
        expect(cancelRes.body.msg).toBe('Appointment successfully canceled');
        console.log('...Appointment canceled successfully.');

        // --- Step 9: Student A1 checks their appointments ---
        console.log('STEP 9: Student A1 checking their appointments...');
        const checkA1ApptsRes = await request(app).get(`/api/students/${studentA1Id}/appointments`).set('x-auth-token', studentA1Token);
        expect(checkA1ApptsRes.statusCode).toBe(200);
        expect(checkA1ApptsRes.body.length).toBe(0); // Should have no appointments
        console.log('...Student A1 has no pending appointments, as expected. Flow complete!');
    });
});