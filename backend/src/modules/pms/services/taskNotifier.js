/**
 * Task notification helper — sends mail + WhatsApp messages to a task's
 * assigned user. Extracted from Task.controller.js so both Task and Planner
 * controllers can use it without duplicating templates.
 *
 * Returns { mail?: { sent, reason? }, whatsapp?: { sent, reason? } }.
 * Best-effort: never throws, individual channel failures are captured in the
 * result object.
 */
const mailService     = require("../../mail/service/mail.service");
const whatsappService = require("../../whatsapp/service/whatsapp.service");

async function dispatchTaskNotifications({
  task,
  project,
  assignedUser,
  actorId,
  notifyMail,
  notifyWhatsApp,
}) {
  const results = {};
  const vars = {
    taskTitle:    task.title,
    projectName:  project.name,
    projectId:    project.trackingId,
    priority:     task.priority || "medium",
    dueDate:      task.dueDate ? new Date(task.dueDate).toLocaleDateString("en-IN") : "Not set",
    notes:        task.notes || "—",
    assigneeName: assignedUser.name,
  };

  if (notifyMail) {
    if (!assignedUser.email) {
      results.mail = { sent: false, reason: "no_email" };
    } else {
      try {
        await mailService.sendImmediate({
          to:      assignedUser.email,
          subject: `Task Assigned: ${task.title} — ${project.name}`,
          html: `
            <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
              <h2 style="color:#1a1a2e">Task Assigned to You</h2>
              <table style="width:100%;border-collapse:collapse">
                <tr><td style="padding:8px;font-weight:bold;color:#555">Task</td><td style="padding:8px">${vars.taskTitle}</td></tr>
                <tr style="background:#f8f8f8"><td style="padding:8px;font-weight:bold;color:#555">Project</td><td style="padding:8px">${vars.projectName} (${vars.projectId})</td></tr>
                <tr><td style="padding:8px;font-weight:bold;color:#555">Priority</td><td style="padding:8px;text-transform:capitalize">${vars.priority}</td></tr>
                <tr style="background:#f8f8f8"><td style="padding:8px;font-weight:bold;color:#555">Due Date</td><td style="padding:8px">${vars.dueDate}</td></tr>
                <tr><td style="padding:8px;font-weight:bold;color:#555">Notes</td><td style="padding:8px">${vars.notes}</td></tr>
              </table>
              <p style="color:#888;font-size:12px;margin-top:24px">Please log in to JJ Studio ERP to view full task details.</p>
            </div>
          `,
          relatedTo: { module: "pms", recordId: task._id },
          createdBy: actorId,
        });
        results.mail = { sent: true };
      } catch (e) {
        console.error("[taskNotify:mail]", e.message);
        results.mail = { sent: false, reason: e.message };
      }
    }
  }

  if (notifyWhatsApp) {
    if (!assignedUser.phone) {
      results.whatsapp = { sent: false, reason: "no_phone" };
    } else {
      try {
        await whatsappService.sendImmediate({
          to: assignedUser.phone,
          message:
            `*Task Assigned — JJ Studio ERP*\n\n` +
            `*Task:* ${vars.taskTitle}\n` +
            `*Project:* ${vars.projectName} (${vars.projectId})\n` +
            `*Priority:* ${vars.priority}\n` +
            `*Due Date:* ${vars.dueDate}\n` +
            `*Notes:* ${vars.notes}\n\n` +
            `Please check JJ Studio ERP for full details.`,
          relatedTo: { module: "pms", recordId: task._id },
          createdBy: actorId,
        });
        results.whatsapp = { sent: true };
      } catch (e) {
        console.error("[taskNotify:whatsapp]", e.message);
        results.whatsapp = { sent: false, reason: e.message };
      }
    }
  }

  return results;
}

module.exports = { dispatchTaskNotifications };
