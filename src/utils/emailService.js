const nodemailer = require("nodemailer");

/**
 * Send an email using Nodemailer with Gmail SMTP
 * @param {string} to - The recipient's email address
 * @param {string} subject - The subject of the email
 * @param {string} html - The HTML content of the email
 * @returns {Promise<any>}
 */
const sendEmail = async (to, subject, html) => {
  if (!process.env.EMAIL_SENDER || !process.env.EMAIL_PASS) {
    console.warn("EMAIL_SENDER or EMAIL_PASS is missing in .env.");
    return { data: null, error: "SMTP credentials not configured" };
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_SENDER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"CodeCanvas" <${process.env.EMAIL_SENDER}>`,
      to: to,
      subject: subject,
      html: html,
    };

    const info = await transporter.sendMail(mailOptions);
    return { data: info, error: null };
  } catch (error) {
    console.error("Error sending email via Nodemailer:", error);
    return { data: null, error };
  }
};

const sendRecruiterWelcomeEmail = async (email, name) => {
  const subject = "Welcome to CodeCanvas - Your Recruiter Account";
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #ff9800;">Welcome to CodeCanvas!</h2>
      <p>Hi ${name || 'there'},</p>
      <p>Your recruiter account has been successfully created.</p>
      <p>You can now log in and start creating hiring drives and managing candidates.</p>
      <br>
      <p>Best regards,<br>CodeCanvas Team</p>
    </div>
  `;
  return sendEmail(email, subject, html);
};

const sendCandidateWelcomeEmail = async (email, name) => {
  const subject = "Welcome to CodeCanvas!";
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <h2 style="color: #ff9800;">Welcome to CodeCanvas!</h2>
      <p>Hi ${name || 'there'},</p>
      <p>Thank you for joining CodeCanvas. We are thrilled to have you on board!</p>
      <p>To get the most out of our platform, we highly recommend completing your profile.</p>
      <div style="margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/student/profile" style="background-color: #ff9800; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Complete Your Profile</a>
      </div>
      <p>Once your profile is complete, we'll start matching you with exciting roles that fit your skills and experience perfectly.</p>
      <br>
      <p>Best regards,<br><strong>CodeCanvas Team</strong></p>
    </div>
  `;
  return sendEmail(email, subject, html);
};

const sendShortlistEmail = async (email, name, jobTitle) => {
  const subject = `Congratulations! You've been shortlisted for ${jobTitle}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; line-height: 1.6;">
      <h2 style="color: #4caf50;">Great News, ${name || 'Candidate'}!</h2>
      <p>We are thrilled to inform you that your application for the <strong>${jobTitle}</strong> drive has been shortlisted by the recruitment team.</p>
      <p>The recruiter is currently reviewing your profile in more detail and will be in touch with you shortly regarding the next steps in the hiring process.</p>
      <p>Keep an eye on your inbox and your CodeCanvas dashboard for further updates!</p>
      <div style="margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/student" style="background-color: #4caf50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">View Dashboard</a>
      </div>
      <br>
      <p>Best regards,<br>CodeCanvas Team</p>
    </div>
  `;
  return sendEmail(email, subject, html);
};

const sendRejectEmail = async (email, name, jobTitle) => {
  const subject = `Update on your application for ${jobTitle}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; line-height: 1.6;">
      <h2>Application Update</h2>
      <p>Hi ${name || 'Candidate'},</p>
      <p>Thank you for taking the time to apply for the <strong>${jobTitle}</strong> drive.</p>
      <p>While your profile is impressive, the team has decided to move forward with other candidates whose qualifications more closely align with the specific needs of this role at this time.</p>
      <p>We highly encourage you to keep applying to other opportunities on CodeCanvas!</p>
      <div style="margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/student" style="background-color: #3f3f46; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Find More Drives</a>
      </div>
      <br>
      <p>Best wishes in your job search,<br>CodeCanvas Team</p>
    </div>
  `;
  return sendEmail(email, subject, html);
};

const sendWaitlistEmail = async (email, name, jobTitle) => {
  const subject = `You are on the Waitlist for ${jobTitle}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; line-height: 1.6;">
      <h2 style="color: #ff9800;">Application Update</h2>
      <p>Hi ${name || 'Candidate'},</p>
      <p>We wanted to let you know that the recruitment team has placed your application for the <strong>${jobTitle}</strong> drive on their waitlist.</p>
      <p>This means your profile is still under active consideration. If a spot opens up, they may reach out to you to continue the process.</p>
      <p>We'll notify you as soon as there is another update!</p>
      <div style="margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/student" style="background-color: #ff9800; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">View Dashboard</a>
      </div>
      <br>
      <p>Best regards,<br>CodeCanvas Team</p>
    </div>
  `;
  return sendEmail(email, subject, html);
};

const sendStageUpdateEmail = async (email, name, jobTitle, stageName) => {
  const subject = `You've advanced to: ${stageName}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; line-height: 1.6;">
      <h2 style="color: #3b82f6;">Congratulations, ${name || 'Candidate'}! 🎉</h2>
      <p>Great news! You have successfully advanced to the next round for the <strong>${jobTitle}</strong> hiring drive.</p>
      <p>Your new stage is: <strong>${stageName}</strong></p>
      <p>Please log in to your dashboard to view any pending assessments or interview schedules required for this round.</p>
      <div style="margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/student" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">View Next Steps</a>
      </div>
      <br>
      <p>Best of luck!<br>CodeCanvas Team</p>
    </div>
  `;
  return sendEmail(email, subject, html);
};

const sendRoundResultEmail = async (email, name, jobTitle, score) => {
  const subject = `Round Result Received for ${jobTitle}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; line-height: 1.6;">
      <h2 style="color: #8b5cf6;">Assessment Completed! 🏁</h2>
      <p>Hi ${name || 'Candidate'},</p>
      <p>Your assessment for the <strong>${jobTitle}</strong> hiring drive has been successfully submitted and evaluated.</p>
      <p>Your recorded score for this round is: <strong style="font-size: 18px; color: #10b981;">${score}</strong></p>
      <p>The recruitment team will review your performance and update your application status shortly.</p>
      <div style="margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/student" style="background-color: #8b5cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">View Dashboard</a>
      </div>
      <br>
      <p>Great job!<br>CodeCanvas Team</p>
    </div>
  `;
  return sendEmail(email, subject, html);
};

const sendSelectedEmail = async (email, name, jobTitle) => {
  const subject = `Offer/Selection for ${jobTitle} at CodeCanvas`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; line-height: 1.6;">
      <h2 style="color: #10b981;">Congratulations, ${name || 'Candidate'}! 🎉</h2>
      <p>We are absolutely thrilled to inform you that you have been <strong>selected</strong> for the <strong>${jobTitle}</strong> role!</p>
      <p>Our team was incredibly impressed by your profile and performance throughout the hiring process. We will be reaching out to you very soon with the official offer details and next steps for onboarding.</p>
      <p>Please log in to your dashboard to review any pending tasks.</p>
      <div style="margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/student" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">View Dashboard</a>
      </div>
      <br>
      <p>Welcome aboard!<br>CodeCanvas Team</p>
    </div>
  `;
  return sendEmail(email, subject, html);
};

module.exports = {
  sendEmail,
  sendRecruiterWelcomeEmail,
  sendCandidateWelcomeEmail,
  sendShortlistEmail,
  sendRejectEmail,
  sendWaitlistEmail,
  sendStageUpdateEmail,
  sendRoundResultEmail,
  sendSelectedEmail,
};
