
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// File paths
const dataDirectory = path.join(__dirname, 'data');
const publicDirectory = path.join(__dirname, 'public');
const studentsFile = path.join(dataDirectory, 'students.json');
const attendanceFile = path.join(dataDirectory, 'attendance.json');

// Create required folders and files
fs.mkdirSync(dataDirectory, { recursive: true });

if (!fs.existsSync(studentsFile)) {
    fs.writeFileSync(studentsFile, '[]', 'utf8');
}

if (!fs.existsSync(attendanceFile)) {
    fs.writeFileSync(attendanceFile, '[]', 'utf8');
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(publicDirectory));

// Read JSON file
function readJSON(file) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
        console.error('Error reading file:', file, error.message);
        throw error;
    }
}

// Write JSON file
function writeJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

// --------------------------------------------------
// 1. GET ALL STUDENTS
// --------------------------------------------------
app.get('/api/students', (req, res) => {
    try {
        const students = readJSON(studentsFile);
        res.json(students);
    } catch (error) {
        res.status(500).json({
            error: 'Unable to retrieve students.'
        });
    }
});

// --------------------------------------------------
// 2. ADD A NEW STUDENT
// --------------------------------------------------
app.post('/api/students', (req, res) => {
    try {
        const { rollNo, name, department } = req.body;

        if (
            typeof rollNo !== 'string' || !rollNo.trim() ||
            typeof name !== 'string' || !name.trim() ||
            typeof department !== 'string' || !department.trim()
        ) {
            return res.status(400).json({
                error: 'Please enter roll number, name, and department.'
            });
        }

        const students = readJSON(studentsFile);
        const normalizedRollNo = rollNo.trim().toLowerCase();

        const duplicate = students.some(student =>
            student.rollNo.toLowerCase() === normalizedRollNo
        );

        if (duplicate) {
            return res.status(409).json({
                error: 'This roll number already exists.'
            });
        }

        students.push({
            rollNo: rollNo.trim(),
            name: name.trim(),
            department: department.trim()
        });

        writeJSON(studentsFile, students);

        res.status(201).json({
            message: 'Student added successfully!'
        });
    } catch (error) {
        console.error('Add student error:', error.message);
        res.status(500).json({
            error: 'Unable to add student.'
        });
    }
});

// --------------------------------------------------
// 3. UPDATE STUDENT DETAILS
// --------------------------------------------------
app.put('/api/students/:rollNo', (req, res) => {
    try {
        const rollNo = req.params.rollNo;
        const { name, department } = req.body;

        if (
            typeof name !== 'string' || !name.trim() ||
            typeof department !== 'string' || !department.trim()
        ) {
            return res.status(400).json({
                error: 'Name and department are required.'
            });
        }

        const students = readJSON(studentsFile);
        const student = students.find(s => s.rollNo === rollNo);

        if (!student) {
            return res.status(404).json({
                error: 'Student not found.'
            });
        }

        student.name = name.trim();
        student.department = department.trim();

        writeJSON(studentsFile, students);

        res.json({
            message: 'Student updated successfully!'
        });
    } catch (error) {
        res.status(500).json({
            error: 'Unable to update student.'
        });
    }
});

// --------------------------------------------------
// 4. GET ATTENDANCE FOR A SELECTED DATE
// --------------------------------------------------
app.get('/api/attendance', (req, res) => {
    try {
        const { date } = req.query;

        if (
            typeof date !== 'string' ||
            !/^\d{4}-\d{2}-\d{2}$/.test(date)
        ) {
            return res.status(400).json({
                error: 'Please provide a valid date (YYYY-MM-DD).'
            });
        }

        const attendance = readJSON(attendanceFile);

        res.json(attendance.filter(record => record.date === date));
    } catch (error) {
        res.status(500).json({
            error: 'Unable to retrieve attendance.'
        });
    }
});

// --------------------------------------------------
// 5. SAVE ATTENDANCE FOR SEVEN PERIODS
// --------------------------------------------------
app.post('/api/attendance', (req, res) => {
    try {
        const { date, records } = req.body;

        if (
            typeof date !== 'string' ||
            !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
            !Array.isArray(records)
        ) {
            return res.status(400).json({
                error: 'Invalid date or attendance records.'
            });
        }

        const students = readJSON(studentsFile);
        const attendance = readJSON(attendanceFile);
        const submittedRollNumbers = new Set();

        // Validate every submitted record before saving
        for (const record of records) {
            if (!record || typeof record.rollNo !== 'string') {
                return res.status(400).json({
                    error: 'Invalid student record.'
                });
            }

            if (submittedRollNumbers.has(record.rollNo)) {
                return res.status(400).json({
                    error: 'Duplicate student in attendance submission.'
                });
            }

            submittedRollNumbers.add(record.rollNo);

            const studentExists = students.some(
                student => student.rollNo === record.rollNo
            );

            if (!studentExists) {
                return res.status(400).json({
                    error: 'Student not found: ' + record.rollNo
                });
            }

            if (
                !Array.isArray(record.periods) ||
                record.periods.length !== 7 ||
                !record.periods.every(status =>
                    status === 'Present' || status === 'Absent'
                )
            ) {
                return res.status(400).json({
                    error: 'Mark Present or Absent for all seven periods.'
                });
            }
        }

        // Replace records for the same date and submitted students.
        // Keep other students and other dates unchanged.
        const remaining = attendance.filter(record =>
            record.date !== date ||
            !submittedRollNumbers.has(record.rollNo)
        );

        for (const record of records) {
            remaining.push({
                date,
                rollNo: record.rollNo,
                periods: record.periods
            });
        }

        writeJSON(attendanceFile, remaining);

        res.json({
            message: 'Attendance saved successfully!'
        });
    } catch (error) {
        console.error('Save attendance error:', error.message);
        res.status(500).json({
            error: 'Unable to save attendance.'
        });
    }
});

// --------------------------------------------------
// 6. MONTHLY ATTENDANCE REPORT
// --------------------------------------------------
app.get('/api/monthly-report', (req, res) => {
    try {
        const { month } = req.query;

        if (
            typeof month !== 'string' ||
            !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)
        ) {
            return res.status(400).json({
                error: 'Select a valid month in YYYY-MM format.'
            });
        }

        const students = readJSON(studentsFile);
        const attendance = readJSON(attendanceFile);

        const monthlyRecords = attendance.filter(record =>
            typeof record.date === 'string' &&
            record.date.startsWith(month)
        );

        const report = students.map(student => {
            const studentRecords = monthlyRecords.filter(
                record => record.rollNo === student.rollNo
            );

            let present = 0;
            let absent = 0;

            studentRecords.forEach(record => {
                if (!Array.isArray(record.periods)) return;

                record.periods.forEach(status => {
                    if (status === 'Present') present++;
                    else if (status === 'Absent') absent++;
                });
            });

            const total = present + absent;

            const percentage = total > 0
                ? Number(((present / total) * 100).toFixed(2))
                : 0;

            return {
                rollNo: student.rollNo,
                name: student.name,
                department: student.department,
                present,
                absent,
                total,
                percentage,
                lowAttendance: total > 0 && percentage < 75
            };
        });

        res.json(report);
    } catch (error) {
        console.error('Monthly report error:', error.message);
        res.status(500).json({
            error: 'Unable to generate monthly report.'
        });
    }
});

// --------------------------------------------------
// 7. HOME PAGE
// --------------------------------------------------
app.get('/', (req, res) => {
    res.sendFile(path.join(publicDirectory, 'index.html'));
});

// --------------------------------------------------
// START SERVER
// --------------------------------------------------
app.listen(PORT, () => {
    console.log(`Attendance app running on port ${PORT}`);
});
