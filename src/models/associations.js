
import User from './User.js';
import Webhook from './Webhook.js';
import Template from './Template.js';
import Mapping from './Mapping.js';

export default function applyAssociations() {
  User.hasMany(Template, { foreignKey: 'userId', as: 'templates' });
  Template.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  User.hasMany(Webhook, { foreignKey: 'userId', as: 'webhooks' });
  Webhook.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  Webhook.hasMany(Mapping, { foreignKey: 'webhookId', as: 'mappings' });
  Mapping.belongsTo(Webhook, { foreignKey: 'webhookId', as: 'webhook' });

  Template.hasMany(Mapping, { foreignKey: 'templateId', as: 'mappings' });
  Mapping.belongsTo(Template, { foreignKey: 'templateId', as: 'template' });
}