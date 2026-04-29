const getMeetingRescheduleTemplate = (clientName, meetingType, oldDate, newDate, newTime, notes) => {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px; overflow: hidden;">
      <div style="background-color: #333; color: #fff; padding: 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">Meeting Rescheduled</h1>
        <p style="margin: 5px 0 0; opacity: 0.9;">JJ Studio Interior Design</p>
      </div>
      
      <div style="padding: 30px;">
        <p style="font-size: 16px;">Hello <strong>${clientName}</strong>,</p>
        <p>Your meeting with JJ Studio has been rescheduled. Please note the updated details below:</p>
        
        <div style="background-color: #fff9e6; border: 1px solid #ffeeba; padding: 15px; border-radius: 8px; margin: 20px 0; font-size: 14px;">
           <span style="color: #856404;"><strong>Old Schedule:</strong> ${oldDate}</span>
        </div>

        <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 5px solid #D4AF37;">
          <table style="width: 100%;">
            <tr>
              <td style="padding: 5px 0; color: #666; width: 120px;">Meeting Type:</td>
              <td style="padding: 5px 0; font-weight: bold;">${meetingType.charAt(0).toUpperCase() + meetingType.slice(1)}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0; color: #666;">New Date:</td>
              <td style="padding: 5px 0; font-weight: bold;">${newDate}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0; color: #666;">New Time:</td>
              <td style="padding: 5px 0; font-weight: bold;">${newTime}</td>
            </tr>
            ${notes ? `
            <tr>
              <td style="padding: 5px 0; color: #666; vertical-align: top;">Notes:</td>
              <td style="padding: 5px 0;">${notes}</td>
            </tr>
            ` : ''}
          </table>
        </div>
        
        <p>We apologize for any inconvenience caused and look forward to our discussion.</p>
        <p>If this new time doesn't work for you, please let us know at <a href="mailto:jjstudio.interior@gmail.com" style="color: #D4AF37; text-decoration: none;">jjstudio.interior@gmail.com</a>.</p>
        
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #999; font-size: 12px;">
          <p>© 2025 JJ Studio Interior Design. All rights reserved.</p>
        </div>
      </div>
    </div>
  `;
};

module.exports = getMeetingRescheduleTemplate;
