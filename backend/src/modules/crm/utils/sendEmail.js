require("dotenv").config();
const nodemailer = require("nodemailer");

const sendEmail = async ({ to, subject, html }) => {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  if (!emailUser || !emailPass) {
    throw new Error("Email service is not configured. Set EMAIL_USER and EMAIL_PASS in the backend environment.");
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: emailUser,
      pass: emailPass,
    },
  });

  await transporter.sendMail({
    from: emailUser,
    to,
    subject,
    html,
  });

  console.log(" Email sent to:", to);
};

module.exports = sendEmail;