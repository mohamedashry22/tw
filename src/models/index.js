
import sequelize from '../config/database.js';

import User from './User.js';
import Webhook from './Webhook.js';
import Template from './Template.js';
import Mapping from './Mapping.js';
import EventData from './Event.js';

import applyAssociations from './associations.js';
import Log from './Log.js';

applyAssociations();

const db = {
  sequelize,
  User,
  Webhook,
  Template,
  Mapping,
  Log,
  EventData
};

export default db;