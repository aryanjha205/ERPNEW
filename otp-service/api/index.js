const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
    }
});

app.post('/api/otp/send-otp', async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) {
        return res.status(400).json({ error: 'Email and OTP are required' });
    }

    const mailOptions = {
        from: process.env.SMTP_USER,
        to: email,
        subject: 'Your Verification OTP - AI Voice ERP',
        text: `Your OTP for verification is: ${otp}. It will expire in 5 minutes.`
    };

    try {
        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: 'OTP sent successfully' });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ success: false, error: 'Failed to send OTP' });
    }
});

// Export the Express app for Vercel Serverless Function
module.exports = app;
