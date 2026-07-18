const nodemailer = require("nodemailer");

const sendEmail = async (to, subject, html) => {
    try {
        const transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        await transporter.sendMail({
            from: `${process.env.COMPANY_NAME} <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html,
        });

        console.log("Email sent successfully");
    } catch (error) {
        console.error("Email sending failed:", error);
    }
};

module.exports = sendEmail;