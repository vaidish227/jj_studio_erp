const getReferrerTemplate = (referrerName, clientName) => `
  <p>Dear ${referrerName},</p>

  <p>
  Thank you for referring ${clientName} to JJ Studio by Deepa Bagaria. 
  We truly value your trust and confidence in our work.
  </p>

  <p>
  Your recommendation reinforces our commitment to delivering high-quality design and execution solutions. 
  We will ensure that your reference is handled with the highest level of professionalism, attention, and care.
  </p>

  <p>
  We sincerely appreciate your continued support and association with us.
  </p>

  <br/>

  <p>Warm regards,</p>
  <p><b>Team JJ Studio</b></p>
`;

module.exports = getReferrerTemplate;