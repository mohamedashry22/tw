// File: src/app.js
// src/app.js

import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import morgan from 'morgan';

// Import your controllers
import authController from './controllers/authController.js';
import userController from './controllers/userController.js';
import configurationController from './controllers/configurationController.js';
import twitterController from './controllers/twitterController.js';
import { webhookRouter, eventRouter } from './controllers/webhookController.js';
import templateController from './controllers/templateController.js';
import mappingController from './controllers/mappingController.js';

import errorMiddleware from './middlewares/errorMiddleware.js';

// Load environment variables
dotenv.config();

const app = express();

// Middlewares
app.use(helmet()); // For security headers
app.use(cors()); // Enable CORS
app.use(morgan('dev')); // Logging HTTP requests
app.use(express.json()); // Parse JSON bodies
app.use(cookieParser()); // Parse cookies

// Routes
app.use('/event', eventRouter); // Webhook event endpoint
app.use('/api/auth', authController);
app.use('/api/users', userController);
app.use('/api/configuration', configurationController);
app.use('/api/twitter', twitterController);
app.use('/api/webhooks', webhookRouter); // CRUD operations for webhooks
app.use('/api/templates', templateController);
app.use('/api/mappings', mappingController);

// Error handling middleware
app.use(errorMiddleware);

export default app;

// File: src/config/database.js
import { Sequelize } from 'sequelize';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../../database.sqlite'),
  logging: true
});

export default sequelize;


// File: src/controllers/authController.js
import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import createError from 'http-errors';

const router = express.Router();

router.post('/signup', async (req, res, next) => {
  try {
    const { username, email, password, role } = req.body;

    const user = await User.create({
      username,
      email,
      passwordHash: password,
      role: role || 'admin',
    });

    res.json({
      message: 'Signup successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });

    if (!user || !(await user.validatePassword(password))) {
      throw createError(401, 'Invalid email or password');
    }

    const accessToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: '90d' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '180d' }
    );

    res
      .cookie('accessToken', accessToken, { httpOnly: true })
      .cookie('refreshToken', refreshToken, { httpOnly: true })
      .json({
        message: 'Login successful',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
      });
  } catch (error) {
    next(error);
  }
});

router.post('/refresh-token', async (req, res, next) => {
  try {
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
      throw createError(401, 'Refresh token not found');
    }

    jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, async (err, payload) => {
      if (err) {
        if (err.name === 'TokenExpiredError') {
          return next(createError(401, 'Refresh token expired'));
        } else {
          return next(createError(401, 'Invalid refresh token'));
        }
      }

      const user = await User.findByPk(payload.userId);
      if (!user) {
        return next(createError(401, 'User not found'));
      }

      const newAccessToken = jwt.sign(
        { userId: user.id },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: '90d' }
      );

      const newRefreshToken = jwt.sign(
        { userId: user.id },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: '180d' }
      );

      res
        .cookie('accessToken', newAccessToken, { httpOnly: true })
        .cookie('refreshToken', newRefreshToken, { httpOnly: true })
        .json({ message: 'Token refreshed successfully' });
    });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', async (req, res) => {
  res
    .clearCookie('accessToken')
    .clearCookie('refreshToken')
    .json({ message: 'Logout successful' });
});

export default router;

// File: src/controllers/configurationController.js
import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import adminMiddleware from '../middlewares/adminMiddleware.js';
import Configuration from '../models/Configuration.js';

const router = express.Router();

router.get('/', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const configs = await Configuration.findAll();
    res.json(configs);
  } catch (error) {
    next(error);
  }
});

router.post('/', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const { key, value } = req.body;

    if (!key || !value) {
      return res.status(400).json({ message: 'Key and value are required' });
    }

    await Configuration.upsert({ key, value });
    res.json({ message: 'Configuration updated or created', key, value });
  } catch (error) {
    next(error);
  }
});

router.delete('/:key', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const { key } = req.params;

    const result = await Configuration.destroy({ where: { key } });

    if (result === 0) {
      return res.status(404).json({ message: 'Configuration not found' });
    }

    res.json({ message: 'Configuration deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;

// File: src/controllers/mappingController.js
// src/controllers/mappingController.js

import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import Mapping from '../models/Mapping.js';
import Webhook from '../models/Webhook.js';
import Template from '../models/Template.js';

const router = express.Router();

// Middleware to check ownership
async function checkOwnership(req, res, next) {
  const userId = req.user.id;
  const mapping = await Mapping.findByPk(req.params.id, {
    include: [
      {
        model: Webhook,
        where: { userId },
      },
      {
        model: Template,
        where: { userId },
      },
    ],
  });
  if (!mapping) {
    return res.status(404).json({ message: 'Mapping not found' });
  }
  req.mapping = mapping;
  next();
}

// List all mappings
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const mappings = await Mapping.findAll({
      include: [
        {
          model: Webhook,
          where: { userId },
        },
        {
          model: Template,
          where: { userId },
        },
      ],
    });
    res.json(mappings);
  } catch (error) {
    next(error);
  }
});

// Create a new mapping
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { webhookId, templateId, mappingJson } = req.body;

    // Verify ownership of webhook and template
    const webhook = await Webhook.findOne({ where: { id: webhookId, userId } });
    const template = await Template.findOne({ where: { id: templateId, userId } });

    if (!webhook || !template) {
      return res.status(400).json({ message: 'Invalid webhook or template' });
    }

    const mapping = await Mapping.create({
      webhookId,
      templateId,
      mappingJson: JSON.stringify(mappingJson),
    });

    res.status(201).json(mapping);
  } catch (error) {
    next(error);
  }
});

// Get a specific mapping
router.get('/:id', authMiddleware, checkOwnership, async (req, res) => {
  res.json(req.mapping);
});

// Update a specific mapping
router.put('/:id', authMiddleware, checkOwnership, async (req, res, next) => {
  try {
    const { mappingJson } = req.body;
    await req.mapping.update({ mappingJson: JSON.stringify(mappingJson) });
    res.json(req.mapping);
  } catch (error) {
    next(error);
  }
});

// Delete a specific mapping
router.delete('/:id', authMiddleware, checkOwnership, async (req, res, next) => {
  try {
    await req.mapping.destroy();
    res.json({ message: 'Mapping deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;

// File: src/controllers/templateController.js
// src/controllers/templateController.js

import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import Template from '../models/Template.js';

const router = express.Router();

// Middleware to check ownership
async function checkOwnership(req, res, next) {
  const userId = req.user.id;
  const template = await Template.findByPk(req.params.id);
  if (!template || template.userId !== userId) {
    return res.status(404).json({ message: 'Template not found' });
  }
  req.template = template;
  next();
}

// List all templates
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const templates = await Template.findAll({ where: { userId } });
    res.json(templates);
  } catch (error) {
    next(error);
  }
});

// Create a new template
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { name, content } = req.body;

    const template = await Template.create({
      userId,
      name,
      content,
    });

    res.status(201).json(template);
  } catch (error) {
    next(error);
  }
});

// Get a specific template
router.get('/:id', authMiddleware, checkOwnership, async (req, res) => {
  res.json(req.template);
});

// Update a specific template
router.put('/:id', authMiddleware, checkOwnership, async (req, res, next) => {
  try {
    const { name, content } = req.body;
    await req.template.update({ name, content });
    res.json(req.template);
  } catch (error) {
    next(error);
  }
});

// Delete a specific template
router.delete('/:id', authMiddleware, checkOwnership, async (req, res, next) => {
  try {
    await req.template.destroy();
    res.json({ message: 'Template deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;

// File: src/controllers/twitterController.js
import express from 'express';
import createError from 'http-errors';
import twitterService, { RateLimitError, TwitterApiError } from '../services/twitterService.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import adminMiddleware from '../middlewares/adminMiddleware.js';
import Log from '../models/Log.js';
import sequelize from '../config/database.js';
import {
  startCronJob,
  stopCronJob,
  isCronJobRunning,
} from '../services/schedulerService.js';

const router = express.Router();

function calculateWaitTime(retryCount) {
  const base = 1000; // 1 second
  const maxWait = 15 * 60 * 1000; // 15 minutes
  const waitTime = Math.min(base * Math.pow(2, retryCount), maxWait);
  return waitTime;
}

router.post('/tweet', authMiddleware, async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { status } = req.body;
    if (!status || status.length === 0) {
      throw createError(400, 'Status is required');
    }

    const userId = req.user.id;

    try {
      const tweetData = await twitterService.postTweet(status);

      await Log.create(
        {
          status,
          type: 'success',
          userId,
          lastAttemptedAt: new Date(),
        },
        { transaction }
      );

      await transaction.commit();
      res.json({
        message: 'Tweet posted successfully',
        tweetData,
      });
    } catch (error) {
      await Log.create(
        {
          status,
          type: 'failure',
          errorMessage: error.message,
          errorCode: error.code,
          userId,
          retryCount: 0,
          lastAttemptedAt: new Date(),
        },
        { transaction }
      );

      await transaction.commit();
      res.status(500).json({
        message: 'Failed to post tweet. It has been saved for retry.',
      });
    }
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
});

router.post('/retry-failed-tweets', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const failedTweets = await Log.findAll({
      where: { userId, type: 'failure' },
    });

    const results = [];

    for (const failedTweet of failedTweets) {
      const MAX_RETRIES = 5;
      if (failedTweet.retryCount >= MAX_RETRIES) {
        continue;
      }

      try {
        const tweetData = await twitterService.postTweet(failedTweet.status);

        await failedTweet.update({
          type: 'success',
          errorMessage: null,
          errorCode: null,
          retryCount: failedTweet.retryCount + 1,
          lastAttemptedAt: new Date(),
        });

        results.push({
          status: 'success',
          tweetId: tweetData.id,
          logId: failedTweet.id,
        });
      } catch (error) {
        await failedTweet.update({
          errorMessage: error.message,
          errorCode: error.code,
          retryCount: failedTweet.retryCount + 1,
          lastAttemptedAt: new Date(),
        });

        results.push({
          status: 'failed',
          logId: failedTweet.id,
          error: error.message,
        });
      }
    }

    res.json({
      message: 'Retry operation completed',
      results,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/retry-failed-tweet/:id', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const logId = req.params.id;

    const failedTweet = await Log.findOne({
      where: { id: logId, userId, type: 'failure' },
    });

    if (!failedTweet) {
      return res.status(404).json({ message: 'Failed tweet not found' });
    }

    const MAX_RETRIES = 5;
    if (failedTweet.retryCount >= MAX_RETRIES) {
      return res.status(400).json({ message: 'Max retries exceeded' });
    }

    try {
      const tweetData = await twitterService.postTweet(failedTweet.status);

      await failedTweet.update({
        type: 'success',
        errorMessage: null,
        errorCode: null,
        retryCount: failedTweet.retryCount + 1,
        lastAttemptedAt: new Date(),
      });

      res.json({
        message: 'Failed tweet retried successfully',
        tweetData,
      });
    } catch (error) {
      await failedTweet.update({
        errorMessage: error.message,
        errorCode: error.code,
        retryCount: failedTweet.retryCount + 1,
        lastAttemptedAt: new Date(),
      });

      res.status(500).json({
        message: 'Retry failed',
        error: error.message,
      });
    }
  } catch (error) {
    next(error);
  }
});

router.post('/resend-successful-tweet/:id', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const logId = req.params.id;

    const successfulTweet = await Log.findOne({
      where: { id: logId, userId, type: 'success' },
    });

    if (!successfulTweet) {
      return res.status(404).json({ message: 'Successful tweet not found' });
    }

    try {
      const tweetData = await twitterService.postTweet(successfulTweet.status);

      await Log.create({
        status: successfulTweet.status,
        type: 'success',
        userId,
        lastAttemptedAt: new Date(),
      });

      res.json({
        message: 'Tweet resent successfully',
        tweetData,
      });
    } catch (error) {
      await Log.create({
        status: successfulTweet.status,
        type: 'failure',
        errorMessage: error.message,
        errorCode: error.code,
        userId,
        retryCount: 0,
        lastAttemptedAt: new Date(),
      });

      res.status(500).json({
        message: 'Failed to resend tweet',
        error: error.message,
      });
    }
  } catch (error) {
    next(error);
  }
});

router.get('/successful-tweets', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const successfulTweets = await Log.findAll({
      where: { userId, type: 'success' },
    });

    res.json(successfulTweets);
  } catch (error) {
    next(error);
  }
});

router.get('/failed-tweets', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const failedTweets = await Log.findAll({
      where: { userId, type: 'failure' },
    });

    res.json(failedTweets);
  } catch (error) {
    next(error);
  }
});

router.post('/start-cron', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    startCronJob();
    res.json({ message: 'Cron job started.' });
  } catch (error) {
    next(error);
  }
});

router.post('/stop-cron', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    stopCronJob();
    res.json({ message: 'Cron job stopped.' });
  } catch (error) {
    next(error);
  }
});

router.get('/cron-status', authMiddleware, async (req, res, next) => {
  try {
    const status = isCronJobRunning();
    res.json({ cronRunning: status });
  } catch (error) {
    next(error);
  }
});

export default router;

// File: src/controllers/userController.js
import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import adminMiddleware from '../middlewares/adminMiddleware.js';
import User from '../models/User.js';

const router = express.Router();

router.get('/', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'username', 'email', 'role', 'createdAt', 'updatedAt'],
    });
    res.json(users);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await User.destroy({ where: { id } });

    if (result === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;

// File: src/controllers/webhookController.js
// src/controllers/webhookController.js

import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import Webhook from '../models/Webhook.js';
import { v4 as uuidv4 } from 'uuid';
import twitterService from '../services/twitterService.js';
import { extractData } from '../utils/dataExtractor.js';
import { renderTemplate } from '../utils/templateRenderer.js';

const webhookRouter = express.Router();
const eventRouter = express.Router(); // Router for webhook events

// Public endpoint to receive webhook events
eventRouter.post('event/:endpointId', async (req, res, next) => {
  try {
    const { endpointId } = req.params;

    console.log(endpointId);

    const webhook = await Webhook.findOne({
      where: { endpointUrl: endpointId, isActive: true },
    });

    if (!webhook) {
      return res.status(404).json({ message: 'Webhook endpoint not found or inactive' });
    }

    // Process the webhook event
    const eventData = req.body;

    // Retrieve the mappings for this webhook
    const mappings = await webhook.getMappings();

    for (const mapping of mappings) {
      const template = await mapping.getTemplate();

      // Extract data based on mapping
      const mappingJson = JSON.parse(mapping.mappingJson);

      const extractedData = extractData(eventData, mappingJson);

      // Render the template with the extracted data
      const tweetContent = renderTemplate(template.content, extractedData);

      // Post the tweet
      await twitterService.postTweet(tweetContent);

      // Log the success or handle errors as needed
    }

    res.json({ message: 'Webhook event processed' });
  } catch (error) {
    console.error('Error processing webhook event:', error);
    next(error);
  }
});

// Middleware to check ownership
async function checkOwnership(req, res, next) {
  const userId = req.user.id;
  const webhook = await Webhook.findByPk(req.params.id);
  if (!webhook || webhook.userId !== userId) {
    return res.status(404).json({ message: 'Webhook not found' });
  }
  req.webhook = webhook;
  next();
}

// Apply authentication middleware to CRUD routes
webhookRouter.use(authMiddleware);

// List all webhooks
webhookRouter.get('/', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const webhooks = await Webhook.findAll({ where: { userId } });
    res.json(webhooks);
  } catch (error) {
    next(error);
  }
});

// Create a new webhook
webhookRouter.post('/', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { name, description } = req.body;

    const endpointId = uuidv4(); // Generate a unique endpoint ID

    const webhook = await Webhook.create({
      userId,
      name,
      description,
      endpointUrl: endpointId,
      isActive: true,
    });

    res.status(201).json(webhook);
  } catch (error) {
    next(error);
  }
});

// Get a specific webhook
webhookRouter.get('/:id', checkOwnership, async (req, res) => {
  res.json(req.webhook);
});

// Update a specific webhook
webhookRouter.put('/:id', checkOwnership, async (req, res, next) => {
  try {
    const { name, description, isActive } = req.body;
    await req.webhook.update({ name, description, isActive });
    res.json(req.webhook);
  } catch (error) {
    next(error);
  }
});

// Delete a specific webhook
webhookRouter.delete('/:id', checkOwnership, async (req, res, next) => {
  try {
    await req.webhook.destroy();
    res.json({ message: 'Webhook deleted' });
  } catch (error) {
    next(error);
  }
});

export { webhookRouter, eventRouter };

// File: src/middlewares/adminMiddleware.js
import createError from 'http-errors';

function adminMiddleware(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    next(createError(403, 'Forbidden: Admins only'));
  }
}

export default adminMiddleware;

// File: src/middlewares/authMiddleware.js
import jwt from 'jsonwebtoken';
import createError from 'http-errors';
import User from '../models/User.js';

function authMiddleware(req, res, next) {
  const { accessToken } = req.cookies;

  if (!accessToken) {
    return next(createError(401, 'Access token not found'));
  }

  jwt.verify(accessToken, process.env.JWT_ACCESS_SECRET, async (err, payload) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return next(createError(401, 'Access token expired'));
      } else {
        return next(createError(401, 'Invalid access token'));
      }
    }

    const user = await User.findByPk(payload.userId);
    if (!user) {
      return next(createError(401, 'User not found'));
    }

    req.user = { id: payload.userId, role: user.role };
    next();
  });
}

export default authMiddleware;

// File: src/middlewares/errorMiddleware.js
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Error');

function errorMiddleware(err, req, res, next) {
  logger.error(err.message, { stack: err.stack });
  const status = err.status || 500;
  res.status(status).json({
    status,
    message: err.message || 'Internal Server Error',
  });
}

export default errorMiddleware;

// File: src/middlewares/loggerMiddleware.js
import { createLogger } from '../utils/logger.js';

const logger = createLogger('HTTP');

function loggerMiddleware(req, res, next) {
  logger.info(`${req.method} ${req.url}`);
  next();
}

export default loggerMiddleware;

// File: src/models/Configuration.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Configuration = sequelize.define(
  'Configuration',
  {
    id: {
      type: DataTypes.STRING,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    key: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    value: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  },
  {
    tableName: 'configurations',
    timestamps: true,
  }
);

export default Configuration;

// File: src/models/FailedTweet.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import User from './User.js';

const FailedTweet = sequelize.define(
  'FailedTweet',
  {
    id: {
      type: DataTypes.STRING,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    status: {
      type: DataTypes.STRING(280),
      allowNull: false,
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    errorCode: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    retryCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    lastAttemptedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    tableName: 'failed_tweets',
    timestamps: true,
  }
);

FailedTweet.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(FailedTweet, { foreignKey: 'userId' });

export default FailedTweet;

// File: src/models/Log.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import User from './User.js';

const Log = sequelize.define(
  'Log',
  {
    id: {
      type: DataTypes.STRING,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    status: {
      type: DataTypes.STRING(280),
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM('success', 'failure'),
      allowNull: false,
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    errorCode: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    retryCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    lastAttemptedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    tableName: 'logs',
    timestamps: true,
  }
);

Log.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(Log, { foreignKey: 'userId' });

export default Log;

// File: src/models/Mapping.js
// src/models/Mapping.js

import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Mapping = sequelize.define(
  'Mapping',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    webhookId: {
      type: DataTypes.INTEGER, // Changed to INTEGER
      allowNull: false,
    },
    templateId: {
      type: DataTypes.INTEGER, // Changed to INTEGER
      allowNull: false,
    },
    mappingJson: {
      type: DataTypes.TEXT, // JSON content as a string
      allowNull: false,
    },
  },
  {
    tableName: 'mappings',
    timestamps: true,
  }
);

export default Mapping;

// File: src/models/Template.js
// src/models/Template.js

import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Template = sequelize.define(
  'Template',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER, // Changed to INTEGER
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT, // Template content with placeholders
      allowNull: false,
    },
  },
  {
    tableName: 'templates',
    timestamps: true,
  }
);

export default Template;

// File: src/models/User.js
// src/models/User.js

import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import bcrypt from 'bcryptjs';

const User = sequelize.define(
  'User',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.STRING,
      defaultValue: 'user',
    },
  },
  {
    tableName: 'users',
    timestamps: true,
  }
);


User.beforeCreate(async (user) => {
  if (user.passwordHash) {
    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(user.passwordHash, salt);
  }
});

User.prototype.validatePassword = async function (password) {
  return bcrypt.compare(password, this.passwordHash);
};

export default User;

// File: src/models/Webhook.js
// src/models/Webhook.js

import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Webhook = sequelize.define(
  'Webhook',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER, // Changed to INTEGER
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    endpointUrl: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true, // Ensure uniqueness
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: 'webhooks',
    timestamps: true,
  }
);

export default Webhook;

// File: src/models/associations.js
// src/models/associations.js

import User from './User.js';
import Webhook from './Webhook.js';
import Template from './Template.js';
import Mapping from './Mapping.js';

export default function applyAssociations() {
  // User and Template
  User.hasMany(Template, { foreignKey: 'userId', as: 'templates' });
  Template.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  // User and Webhook
  User.hasMany(Webhook, { foreignKey: 'userId', as: 'webhooks' });
  Webhook.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  // Webhook and Mapping
  Webhook.hasMany(Mapping, { foreignKey: 'webhookId', as: 'mappings' });
  Mapping.belongsTo(Webhook, { foreignKey: 'webhookId', as: 'webhook' });

  // Template and Mapping
  Template.hasMany(Mapping, { foreignKey: 'templateId', as: 'mappings' });
  Mapping.belongsTo(Template, { foreignKey: 'templateId', as: 'template' });
}

// File: src/models/index.js
// src/models/index.js

import sequelize from '../config/database.js';

import User from './User.js';
import Webhook from './Webhook.js';
import Template from './Template.js';
import Mapping from './Mapping.js';

import applyAssociations from './associations.js';

// Apply associations
applyAssociations();

const db = {
  sequelize,
  User,
  Webhook,
  Template,
  Mapping,
};

export default db;

// File: src/repositories/configurationRepository.js
import Configuration from '../models/Configuration.js';

class ConfigurationRepository {
  async getByKey(key) {
    return await Configuration.findOne({ where: { key } });
  }

  async set(key, value) {
    const [config, created] = await Configuration.upsert({ key, value });
    return config;
  }

  async getAll() {
    return await Configuration.findAll();
  }
}

export default new ConfigurationRepository();

// File: src/server.js
import dotenv from 'dotenv';
dotenv.config();

import app from './app.js';
import sequelize from './config/database.js';
import twitterService from './services/twitterService.js';
import { seedDatabase } from './utils/seedDatabase.js';

const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await sequelize.sync({ force: false, alter: true });

    await seedDatabase();

    await twitterService.initialize();

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Error during initialization:', error);
  }
})();


// File: src/services/configurationService.js
import configurationRepository from '../repositories/configurationRepository.js';

class ConfigurationService {
  async get(key) {
    const config = await configurationRepository.getByKey(key);
    return config ? config.value : null;
  }

  async set(key, value) {
    return await configurationRepository.set(key, value);
  }

  async getAll() {
    const configs = await configurationRepository.getAll();
    return configs.map((config) => ({ key: config.key, value: config.value }));
  }
}

export default new ConfigurationService();

// File: src/services/schedulerService.js
import cron from 'node-cron';
import twitterService from './twitterService.js';
import Log from '../models/Log.js';

let failedTweetRetryTask = null;
let isCronRunning = false;

export function startCronJob() {
  if (isCronRunning) {
    console.log('Cron job is already running.');
    return;
  }

  failedTweetRetryTask = cron.schedule('0 * * * *', async () => {
    console.log('Running failed tweet retry task');

    try {
      const failedTweets = await Log.findAll({ where: { type: 'failure' } });

      for (const failedTweet of failedTweets) {
        const MAX_RETRIES = 5;
        if (failedTweet.retryCount >= MAX_RETRIES) {
          continue;
        }

        try {
          const tweetData = await twitterService.postTweet(failedTweet.status);

          await failedTweet.update({
            type: 'success',
            errorMessage: null,
            errorCode: null,
            retryCount: failedTweet.retryCount + 1,
            lastAttemptedAt: new Date(),
          });

          console.log(`Successfully retried failed tweet ID: ${failedTweet.id}`);
        } catch (error) {
          await failedTweet.update({
            errorMessage: error.message,
            errorCode: error.code,
            retryCount: failedTweet.retryCount + 1,
            lastAttemptedAt: new Date(),
          });

          console.log(
            `Failed to retry tweet ID: ${failedTweet.id}. Error: ${error.message}`
          );
        }
      }
    } catch (error) {
      console.error('Error during failed tweet retry task', error);
    }
  });

  isCronRunning = true;
  console.log('Cron job started.');
}

export function stopCronJob() {
  if (failedTweetRetryTask) {
    failedTweetRetryTask.stop();
    failedTweetRetryTask = null;
    isCronRunning = false;
    console.log('Cron job stopped.');
  } else {
    console.log('Cron job is not running.');
  }
}

export function isCronJobRunning() {
  return isCronRunning;
}

// File: src/services/twitterService.js
import { TwitterApi } from 'twitter-api-v2';
import { createLogger } from '../utils/logger.js';
import Bottleneck from 'bottleneck';
import Configuration from '../models/Configuration.js';

const logger = createLogger('TwitterService');

const limiter = new Bottleneck({
  reservoir: 300,
  reservoirRefreshAmount: 300,
  reservoirRefreshInterval: 15 * 60 * 1000,
  minTime: 1000,
});

class TwitterService {
  constructor() {
    this.twitterClient = null;
  }

  async initialize() {
    try {
      let apiKey = await this.getConfiguration('TWITTER_API_KEY');
      let apiSecret = await this.getConfiguration('TWITTER_API_SECRET');
      let accessToken = await this.getConfiguration('TWITTER_ACCESS_TOKEN');
      let accessSecret = await this.getConfiguration('TWITTER_ACCESS_SECRET');

      const missingKeys = [];

      if (!apiKey) {
        apiKey = process.env.TWITTER_API_KEY;
        if (apiKey) {
          await this.setConfiguration('TWITTER_API_KEY', apiKey);
        } else {
          missingKeys.push('TWITTER_API_KEY');
        }
      }

      if (!apiSecret) {
        apiSecret = process.env.TWITTER_API_SECRET;
        if (apiSecret) {
          await this.setConfiguration('TWITTER_API_SECRET', apiSecret);
        } else {
          missingKeys.push('TWITTER_API_SECRET');
        }
      }

      if (!accessToken) {
        accessToken = process.env.TWITTER_ACCESS_TOKEN;
        if (accessToken) {
          await this.setConfiguration('TWITTER_ACCESS_TOKEN', accessToken);
        } else {
          missingKeys.push('TWITTER_ACCESS_TOKEN');
        }
      }

      if (!accessSecret) {
        accessSecret = process.env.TWITTER_ACCESS_SECRET;
        if (accessSecret) {
          await this.setConfiguration('TWITTER_ACCESS_SECRET', accessSecret);
        } else {
          missingKeys.push('TWITTER_ACCESS_SECRET');
        }
      }

      if (missingKeys.length > 0) {
        throw new Error(`Missing Twitter API credentials: ${missingKeys.join(', ')}`);
      }

      this.twitterClient = new TwitterApi({
        appKey: apiKey,
        appSecret: apiSecret,
        accessToken: accessToken,
        accessSecret: accessSecret,
      });

      logger.info('Twitter client initialized');
    } catch (error) {
      logger.error('Error initializing Twitter client', error);
      throw error;
    }
  }

  async getConfiguration(key) {
    const config = await Configuration.findOne({ where: { key } });
    return config ? config.value : null;
  }

  async setConfiguration(key, value) {
    await Configuration.upsert({ key, value });
  }

  async postTweet(status) {
    if (!this.twitterClient) {
      throw new Error('TwitterService is not initialized.');
    }

    try {
      const { data } = await limiter.schedule(() =>
        this.twitterClient.v2.tweet(status)
      );
      logger.info(`Tweet posted successfully: ${data.id}`);
      return data;
    } catch (error) {
      logger.error('Error posting tweet', error);

      if (
        error.code === 429 ||
        error.data?.errors?.[0]?.code === 88 ||
        error.message.includes('rate limit')
      ) {
        throw new RateLimitError('Rate limit exceeded', error);
      }

      throw new TwitterApiError(error.message, error);
    }
  }
}

class RateLimitError extends Error {
  constructor(message, originalError) {
    super(message);
    this.name = 'RateLimitError';
    if (originalError) {
      this.code = originalError.code;
      this.status = originalError.data?.status;
      this.headers = originalError.headers;
    }
  }
}

class TwitterApiError extends Error {
  constructor(message, originalError) {
    super(message);
    this.name = 'TwitterApiError';
    if (originalError) {
      this.code = originalError.code;
      this.status = originalError.data?.status;
    }
  }
}

export default new TwitterService();
export { RateLimitError, TwitterApiError };

// File: src/utils/dataExtractor.js
import jsonpath from 'jsonpath';

export function extractData(eventData, mappingJson) {
  const extractedData = {};

  for (const [templateVariable, jsonPathExpression] of Object.entries(mappingJson)) {
    const result = jsonpath.query(eventData, jsonPathExpression);

    // If the result is an array with one item, extract that item.
    if (Array.isArray(result)) {
      if (result.length === 1) {
        extractedData[templateVariable] = result[0];
      } else {
        // If multiple items, join them as a comma-separated string.
        extractedData[templateVariable] = result.join(', ');
      }
    } else {
      extractedData[templateVariable] = result;
    }
  }

  return extractedData;
}

// File: src/utils/logger.js
import winston from 'winston';

export function createLogger(label) {
  return winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.label({ label }),
      winston.format.timestamp(),
      winston.format.printf(
        ({ timestamp, level, message, label }) =>
          `${timestamp} [${label}] ${level}: ${message}`
      )
    ),
    transports: [new winston.transports.Console()],
  });
}

// File: src/utils/seedDatabase.js
import User from '../models/User.js';
import Configuration from '../models/Configuration.js';

export async function seedDatabase() {
  try {
    const adminUser = await User.findOne({ where: { username: 'admin' } });
    if (!adminUser) {
      await User.create({
        username: 'admin',
        email: 'admin@example.com',
        passwordHash: 'admin',
        role: 'admin',
      });
      console.log('Admin user created');
    }

    const normalUser = await User.findOne({ where: { username: 'user' } });
    if (!normalUser) {
      await User.create({
        username: 'user',
        email: 'user@example.com',
        passwordHash: 'user',
        role: 'user',
      });
      console.log('Normal user created');
    }
  } catch (error) {
    console.error('Error during database seeding:', error);
    throw error;
  }
}

// File: src/utils/templateRenderer.js
import Handlebars from 'handlebars';

export function renderTemplate(templateContent, data) {
  const template = Handlebars.compile(templateContent);
  return template(data);
}

