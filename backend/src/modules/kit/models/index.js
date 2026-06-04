/**
 * KIT models barrel — convenience import for services / controllers.
 *   const { KitCampaign, KitEnrollment } = require("../models");
 */
module.exports = {
  KitTemplate:     require("./KitTemplate.model"),
  KitCampaign:     require("./KitCampaign.model"),
  KitCampaignStep: require("./KitCampaignStep.model"),
  KitEnrollment:   require("./KitEnrollment.model"),
  KitWorkflow:     require("./KitWorkflow.model"),
  KitTriggerEvent: require("./KitTriggerEvent.model"),
  KitScheduledJob: require("./KitScheduledJob.model"),
  KitMessageLog:   require("./KitMessageLog.model"),
};
