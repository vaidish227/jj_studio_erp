const KitMessageLog = require("../models/KitMessageLog.model");
const KitCampaign   = require("../models/KitCampaign.model");
const KitWorkflow   = require("../models/KitWorkflow.model");
const KitEnrollment = require("../models/KitEnrollment.model");
const KitTriggerEvent = require("../models/KitTriggerEvent.model");
const KitTemplate   = require("../models/KitTemplate.model");
const MailLog       = require("../../mail/models/MailLog.model");
const WhatsAppLog   = require("../../whatsapp/models/WhatsAppLog.model");
const CRMClient     = require("../../crm/models/CRMClient.model");
const { resolveDateRange, DateRangeError } = require("../../../shared/dateRange/resolveDateRange");

const pct = (num, den) => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0);
const countMap = (rows) => Object.fromEntries(rows.map((r) => [r._id, r.n]));

/**
 * Resolve dashboard query → an optional createdAt window for FLOW metrics.
 * Returns `null` when no date params are supplied (back-compat: unbounded).
 * 'all_time' resolves to epoch→now ⇒ a no-op bound. Reuses the shared resolver.
 * @throws {DateRangeError}
 */
const resolveCreatedAtMatch = (query) => {
  const { preset, from, to } = query || {};
  if (!preset && !from && !to) return null;
  const { start, end } = resolveDateRange({
    preset: preset != null ? String(preset).toLowerCase() : undefined,
    from,
    to,
  });
  return { createdAt: { $gte: start, $lte: end } };
};

/**
 * GET /api/kit/analytics/overview
 *
 * Note on data sources: delivery/read status lives in the real provider logs
 * (MailLog/WhatsAppLog), filtered to KIT-attributed sends via relatedTo.module.
 * Read/delivered depend on provider webhooks, so they may under-report — counts
 * are shown honestly rather than inflated.
 */
const getOverview = async (req, res) => {
  try {
    const KIT = { "relatedTo.module": "kit" };
    // FLOW metrics (delivery/messages) honor the selected range; state counts
    // below stay all-time snapshots (D2). `dateMatch` is null ⇒ unbounded.
    const dateMatch = resolveCreatedAtMatch(req.query);
    const mailMatch = dateMatch ? { ...KIT, ...dateMatch } : KIT;
    const waMatch   = dateMatch ? { ...KIT, ...dateMatch } : KIT;
    const kitMsgMatch = dateMatch || {};
    const triggerMatch = dateMatch || {};

    const [
      kitMessages, activeCampaigns, totalCampaigns, activeWorkflows,
      activeEnrollments, completedEnrollments, triggerEvents,
      mailRows, waRows, kitMsgRows,
    ] = await Promise.all([
      KitMessageLog.countDocuments(kitMsgMatch),                              // flow: KIT messages in range
      KitCampaign.countDocuments({ status: "active" }),                       // snapshot (all-time)
      KitCampaign.countDocuments({}),                                         // snapshot
      KitWorkflow.countDocuments({ isActive: true }),                         // snapshot
      KitEnrollment.countDocuments({ status: "active" }),                     // snapshot
      KitEnrollment.countDocuments({ status: "completed" }),                  // snapshot
      KitTriggerEvent.countDocuments(triggerMatch),                           // flow: events fired in range
      MailLog.aggregate([{ $match: mailMatch }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
      WhatsAppLog.aggregate([{ $match: waMatch }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
      KitMessageLog.aggregate([{ $match: kitMsgMatch }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
    ]);

    const mail = countMap(mailRows);   // sent / failed / bounced
    const wa   = countMap(waRows);     // sent / delivered / read / failed
    const kitMsg = countMap(kitMsgRows); // queued / failed (KIT-side)

    const mailSent   = mail.sent || 0;
    const mailFailed = (mail.failed || 0) + (mail.bounced || 0);
    const waSent     = (wa.sent || 0) + (wa.delivered || 0) + (wa.read || 0);
    const waFailed   = wa.failed || 0;
    const waRead     = wa.read || 0;
    const waDelivered = (wa.delivered || 0) + (wa.read || 0);

    const totalSent   = mailSent + waSent;
    const totalFailed = mailFailed + waFailed + (kitMsg.failed || 0);

    res.status(200).json({
      message: "Overview fetched",
      data: {
        totals: {
          kitMessages,
          activeCampaigns, totalCampaigns,
          activeWorkflows,
          activeEnrollments, completedEnrollments,
          triggerEvents,
        },
        delivery: {
          totalSent, totalFailed,
          sendSuccessRate: pct(totalSent, totalSent + totalFailed),
          email:    { sent: mailSent, failed: mailFailed },
          whatsapp: { sent: waSent, failed: waFailed, delivered: waDelivered, read: waRead, readRate: pct(waRead, waSent) },
          kitSideFailures: kitMsg.failed || 0,
        },
      },
    });
  } catch (err) {
    if (err instanceof DateRangeError) {
      return res.status(400).json({ error: err.code, message: err.message });
    }
    console.error("[kit.analytics.overview]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/kit/analytics/campaigns
 * Per-campaign funnel + lead-to-sale attribution (enrolled leads that converted).
 */
const getCampaignAnalytics = async (req, res) => {
  try {
    const dateMatch = resolveCreatedAtMatch(req.query); // null ⇒ unbounded
    // Enrollment funnel + conversion, joined to the lead's CRM status.
    // The createdAt $match runs BEFORE the $lookup, narrowing the enrolment set
    // (and therefore the number of CRMClient joins) when a range is selected.
    const funnel = await KitEnrollment.aggregate([
      ...(dateMatch ? [{ $match: dateMatch }] : []),
      {
        $lookup: {
          from: CRMClient.collection.name,
          localField: "entityId",
          foreignField: "_id",
          as: "lead",
        },
      },
      {
        $group: {
          _id: "$campaignId",
          enrolled:  { $sum: 1 },
          active:    { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } },
          completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
          converted: {
            $sum: {
              $cond: [
                { $anyElementTrue: { $map: { input: "$lead", as: "l", in: { $eq: ["$$l.status", "converted"] } } } },
                1, 0,
              ],
            },
          },
        },
      },
    ]);

    // Message volume per campaign (KIT-attributed sends).
    const msgRows = await KitMessageLog.aggregate([
      { $match: { campaignId: { $ne: null }, ...(dateMatch || {}) } },
      { $group: { _id: "$campaignId", n: { $sum: 1 } } },
    ]);
    const msgMap = countMap(msgRows);

    const campaigns = await KitCampaign.find({}).select("name status audience").lean();
    const funnelMap = Object.fromEntries(funnel.map((f) => [String(f._id), f]));

    const data = campaigns.map((c) => {
      const f = funnelMap[String(c._id)] || { enrolled: 0, active: 0, completed: 0, converted: 0 };
      return {
        campaignId: c._id,
        name: c.name,
        status: c.status,
        audience: c.audience,
        enrolled:  f.enrolled,
        active:    f.active,
        completed: f.completed,
        converted: f.converted,
        conversionRate: pct(f.converted, f.enrolled),
        messages:  msgMap[String(c._id)] || 0,
      };
    });

    // Sort by enrolled desc so the busiest campaigns surface first.
    data.sort((a, b) => b.enrolled - a.enrolled);

    res.status(200).json({ message: "Campaign analytics fetched", data });
  } catch (err) {
    if (err instanceof DateRangeError) {
      return res.status(400).json({ error: err.code, message: err.message });
    }
    console.error("[kit.analytics.campaigns]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/kit/analytics/templates
 * Per-template usage (how many KIT messages each template produced).
 */
const getTemplateAnalytics = async (req, res) => {
  try {
    const dateMatch = resolveCreatedAtMatch(req.query); // null ⇒ unbounded
    const rows = await KitMessageLog.aggregate([
      { $match: { templateId: { $ne: null }, ...(dateMatch || {}) } },
      { $group: { _id: "$templateId", sends: { $sum: 1 }, failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } } } },
    ]);

    const templates = await KitTemplate.find({}).select("name channel category").lean();
    const tMap = Object.fromEntries(templates.map((t) => [String(t._id), t]));

    const data = rows
      .map((r) => {
        const t = tMap[String(r._id)] || {};
        return { templateId: r._id, name: t.name || "(deleted)", channel: t.channel, category: t.category, sends: r.sends, failed: r.failed };
      })
      .sort((a, b) => b.sends - a.sends);

    res.status(200).json({ message: "Template analytics fetched", data });
  } catch (err) {
    if (err instanceof DateRangeError) {
      return res.status(400).json({ error: err.code, message: err.message });
    }
    console.error("[kit.analytics.templates]", err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getOverview, getCampaignAnalytics, getTemplateAnalytics };
