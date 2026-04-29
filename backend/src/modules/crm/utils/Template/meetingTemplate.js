const getMeetingTemplate = (clientName, meetingType, meetingDate, meetingTime, notes) => {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px; overflow: hidden;">
      <div style="background-color: #D4AF37; color: #fff; padding: 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">Meeting Confirmation</h1>
        <p style="margin: 5px 0 0; opacity: 0.9;">JJ Studio Interior Design</p>
      </div>
      
      <div style="padding: 30px;">
        <p style="font-size: 16px;">Hello <strong>${clientName}</strong>,</p>
        <p>Your meeting has been successfully scheduled with JJ Studio. Please find the details below:</p>
        
        <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <table style="width: 100%;">
            <tr>
              <td style="padding: 5px 0; color: #666; width: 120px;">Meeting Type:</td>
              <td style="padding: 5px 0; font-weight: bold;">${meetingType.charAt(0).toUpperCase() + meetingType.slice(1)}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0; color: #666;">Date:</td>
              <td style="padding: 5px 0; font-weight: bold;">${meetingDate}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0; color: #666;">Time:</td>
              <td style="padding: 5px 0; font-weight: bold;">${meetingTime}</td>
            </tr>
            ${notes ? `
            <tr>
              <td style="padding: 5px 0; color: #666; vertical-align: top;">Notes:</td>
              <td style="padding: 5px 0;">${notes}</td>
            </tr>
            ` : ''}
          </table>
        </div>
        
        <p>We look forward to meeting you and discussing your project in detail.</p>
        <p>If you need to reschedule or have any questions, please contact us at <a href="mailto:jjstudio.interior@gmail.com" style="color: #D4AF37; text-decoration: none;">jjstudio.interior@gmail.com</a>.</p>
        
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #999; font-size: 12px;">
          <p>© 2025 JJ Studio Interior Design. All rights reserved.</p>
        </div>
      </div>
    </div>
  `;
};

module.exports = getMeetingTemplate;
