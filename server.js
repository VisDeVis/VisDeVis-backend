const express = require('express');
const Stripe = require('stripe');
const cors = require('cors');
const nodemailer = require('nodemailer');
const QRCode = require('qrcode');
require('dotenv').config();

const app = express();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY); // Use your actual Stripe secret key

app.use(express.json());
app.use(cors());

// Nodemailer setup for sending emails
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // Your email
        pass: process.env.EMAIL_PASS  // Your email password
    }
});

app.post('/create-checkout-session', async (req, res) => {
    try {
        if (!req.body.event || !req.body.email) {
            return res.status(400).json({ error: "Event name and user email are required" });
        }
        
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'eur',
                    product_data: { name: req.body.event },
                    unit_amount: 5000, // Example: €50.00 (5000 cents)
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.FRONTEND_URL}/cancel`,
            metadata: {
                event: req.body.event,
                email: req.body.email
            }
        });
        res.json({ id: session.id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/confirm-payment', async (req, res) => {
    try {
        const session = await stripe.checkout.sessions.retrieve(req.body.session_id);
        if (!session || session.payment_status !== 'paid') {
            return res.status(400).json({ error: "Payment not completed" });
        }
        
        const qrCodeUrl = await QRCode.toDataURL(`${session.metadata.event} - ${session.metadata.email}`);
        
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: session.metadata.email,
            subject: `Your Ticket for ${session.metadata.event}`,
            html: `<h1>Thank you for your purchase!</h1><p>Your ticket for ${session.metadata.event} is attached.</p><img src='${qrCodeUrl}' />`
        });
        
        res.json({ message: "Ticket sent successfully" });
    } catch (error) {
        res.status(500).json({ error: "An error occurred while processing the confirmation" });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
