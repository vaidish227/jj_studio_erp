/**
 * Show a per-channel delivery toast after a proposal approval auto-send.
 * Reads the `delivery` payload returned by the backend's updateProposalStatus
 * controller and renders the most informative message possible.
 *
 * Backend shape:
 *   delivery: {
 *     email:    { sent, error, recipient },
 *     whatsapp: { sent, error, recipient },
 *     finalStatus,
 *     emailSent, emailError, recipientEmail  // flat aliases (legacy)
 *   }
 */
export function showDeliveryToast(toast, delivery) {
  const email = delivery?.email || {};
  const whatsapp = delivery?.whatsapp || {};
  const pdf = delivery?.pdf || {};

  // A short suffix that calls out the PDF attachment / PDF failure status,
  // so the user knows whether the proposal document actually went out.
  let pdfNote = '';
  if (pdf.generated && (email.pdfAttached || whatsapp.pdfAttached)) {
    pdfNote = ' (with PDF attached)';
  } else if (!pdf.generated && pdf.error) {
    pdfNote = ` (⚠ PDF could not be generated: ${pdf.error})`;
  }

  const both = email.sent && whatsapp.sent;
  const onlyEmail = email.sent && !whatsapp.sent;
  const onlyWA = !email.sent && whatsapp.sent;
  const neither = !email.sent && !whatsapp.sent;

  if (both) {
    toast.success(
      `✓ Approved & sent on Email (${email.recipient}) + WhatsApp (${whatsapp.recipient})${pdfNote}`,
      7000
    );
    return;
  }

  if (onlyEmail) {
    toast.success(
      `✓ Approved & emailed to ${email.recipient}${pdfNote}. WhatsApp failed${whatsapp.error ? `: ${whatsapp.error}` : ''}.`,
      8000
    );
    return;
  }

  if (onlyWA) {
    toast.success(
      `✓ Approved & sent on WhatsApp (${whatsapp.recipient})${pdfNote}. Email failed${email.error ? `: ${email.error}` : ''}.`,
      8000
    );
    return;
  }

  if (neither) {
    const parts = [];
    if (email.error) parts.push(`Email: ${email.error}`);
    if (whatsapp.error) parts.push(`WhatsApp: ${whatsapp.error}`);
    toast.error(
      `Approved, but delivery failed on both channels. ${parts.join(' • ')}. Use "Send to Client" to retry.`,
      9000
    );
    return;
  }

  // Defensive fallback if backend returned no delivery telemetry at all
  toast.success('Proposal approved.');
}
