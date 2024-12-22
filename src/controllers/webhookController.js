
import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import Webhook from '../models/Webhook.js';
import { v4 as uuidv4 } from 'uuid';
import twitterService from '../services/twitterService.js';
import { extractData } from '../utils/dataExtractor.js';
import { renderTemplate } from '../utils/templateRenderer.js';

const webhookRouter = express.Router();
const eventRouter = express.Router(); 

eventRouter.post('/event/:endpointId', async (req, res, next) => {
  try {
    const { endpointId } = req.params;

    console.log(endpointId);

    const webhook = await Webhook.findOne({
      where: { endpointUrl: endpointId, isActive: true },
    });

    if (!webhook) {
      return res.status(404).json({ message: 'Webhook endpoint not found or inactive' });
    }

    const eventData = req.body;

    const mappings = await webhook.getMappings();

    for (const mapping of mappings) {
      const template = await mapping.getTemplate();

      const mappingJson = JSON.parse(mapping.mappingJson);

      const extractedData = extractData(eventData, mappingJson);

      const tweetContent = renderTemplate(template.content, extractedData);

      await twitterService.postTweet(tweetContent);
    }

    res.json({ message: 'Webhook event processed' });
  } catch (error) {
    console.error('Error processing webhook event:', error);
    next(error);
  }
});

async function checkOwnership(req, res, next) {
  const userId = req.user.id;
  const webhook = await Webhook.findByPk(req.params.id);
  if (!webhook || webhook.userId !== userId) {
    return res.status(404).json({ message: 'Webhook not found' });
  }
  req.webhook = webhook;
  next();
}

webhookRouter.use(authMiddleware);

webhookRouter.get('/', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const webhooks = await Webhook.findAll({ where: { userId } });
    res.json(webhooks);
  } catch (error) {
    next(error);
  }
});

webhookRouter.post('/', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { name, description } = req.body;

    const endpointId = uuidv4();

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

webhookRouter.get('/:id', checkOwnership, async (req, res) => {
  res.json(req.webhook);
});

webhookRouter.put('/:id', checkOwnership, async (req, res, next) => {
  try {
    const { name, description, isActive } = req.body;
    await req.webhook.update({ name, description, isActive });
    res.json(req.webhook);
  } catch (error) {
    next(error);
  }
});

webhookRouter.delete('/:id', checkOwnership, async (req, res, next) => {
  try {
    await req.webhook.destroy();
    res.json({ message: 'Webhook deleted' });
  } catch (error) {
    next(error);
  }
});

export { webhookRouter, eventRouter };