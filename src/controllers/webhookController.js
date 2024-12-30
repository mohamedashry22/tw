
import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import Webhook from '../models/Webhook.js';
import EventData from '../models/Event.js';
import { v4 as uuidv4 } from 'uuid';
import twitterService from '../services/twitterService.js';
import { doesMessageMatchTemplate, parseAlertMessage, replaceTokens } from '../utils/parser.js';

// import { extractData } from '../utils/dataExtractor.js';
// import { renderTemplate } from '../utils/templateRenderer.js';

const webhookRouter = express.Router();
const eventRouter = express.Router(); 


eventRouter.post('/:endpointId', async (req, res, next) => {
  try {
    const { endpointId } = req.params;
    console.log('Received webhook for endpoint:', endpointId);

    const webhook = await Webhook.findOne({
      where: { endpointUrl: endpointId, isActive: true },
    });

    if (!webhook) {
      return res.status(404).json({ message: 'Webhook endpoint not found or inactive' });
    }

    const eventData = req.body.message;

    console.log('Received event data:upd', eventData);

    const mappings = await webhook.getMappings();
    console.log(`Processing ${mappings.length} mappings`);

    for (const mapping of mappings) {
      const template = await mapping.getTemplate();
      const mappingJson = JSON.parse(mapping.mappingJson);
      
      console.log('Using mapping:', mappingJson);

      if (!doesMessageMatchTemplate(mapping.alert, mapping.alertToken, JSON.parse(mapping.mappingJson))) {
        console.error('Message does not match the template for mapping:', mapping);
        return res.status(400).json({ message: 'Alert Message does not match the Alert Token, check spaces, alert token must have {{nameId}}' });
      }

      const extractedData = parseAlertMessage(
        eventData,
        mapping.alertToken,
        JSON.parse(mapping.mappingJson),
      );

      console.log('finalContent' , extractedData)

      let existingEvents = [];
      if (extractedData.nameId) {
        existingEvents = await EventData.findAll({ where: { eventName: extractedData.nameId } });
        await EventData.create({
          data: eventData,
          eventName: extractedData.nameId,
          price: extractedData.close || extractedData.price,
        });
      }      

      const newEventPrice = extractedData.close || extractedData.price;
      let totalPriceIncrease = 0;
      let priceDifferencesCount = 0;
      let overallPriceIncreasePercentage = 0;

      existingEvents.forEach((event) => {
        const oldEventPrice = event.price;
        if (oldEventPrice > 0) {
          const priceIncrease = ((newEventPrice - oldEventPrice) / oldEventPrice) * 100;
          totalPriceIncrease += priceIncrease;
          priceDifferencesCount++;
        }
      });
    
      if (priceDifferencesCount > 0) {
        overallPriceIncreasePercentage = totalPriceIncrease / priceDifferencesCount;
      } else {
        overallPriceIncreasePercentage = 0;
      }
    
      let formattedProfitLoss = '0%';
      if (overallPriceIncreasePercentage !== 0) {
        const sign = overallPriceIncreasePercentage > 0 ? '+' : '';
        formattedProfitLoss = `${sign}${overallPriceIncreasePercentage.toFixed(2)}%`;
      }

      let templateContent = template.content;
      if (overallPriceIncreasePercentage !== 0) {
        console.log("it goes with profitLoss.");
        extractedData.profitLoss = formattedProfitLoss;
        templateContent = template.contentClose;
      }
      
     let tweetContent = replaceTokens(templateContent, extractedData);

      console.log('Generated tweet:', tweetContent);
      tweetContent = tweetContent.replace(/\\n/g, '\n');
      await twitterService.postTweet(tweetContent, webhook.userId, {
        originalEvent: eventData,
        extractedData,
        webhookEndpoint: endpointId
      });
    }

    res.json({ message: 'Webhook event processed successfully' });
  } catch (error) {
    console.error('Error processing webhook event:', error);
    next(error);
  }
});


async function checkOwnership(req, res, next) {
  // const userId = req.user.id;
  const webhook = await Webhook.findByPk(req.params.id);
  if (!webhook) {
    // if (!webhook || webhook.userId !== userId) {
    return res.status(404).json({ message: 'Webhook not found' });
  }
  req.webhook = webhook;
  next();
}

webhookRouter.use(authMiddleware);

webhookRouter.get('/', async (req, res, next) => {
  try {
    // const userId = req.user.id;
    // const webhooks = await Webhook.findAll({ where: { userId } });
    const webhooks = await Webhook.findAll();
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