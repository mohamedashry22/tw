
import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import Webhook from '../models/Webhook.js';
import EventData from '../models/Event.js';
import { v4 as uuidv4 } from 'uuid';
import twitterService from '../services/twitterService.js';

// import { extractData } from '../utils/dataExtractor.js';
// import { renderTemplate } from '../utils/templateRenderer.js';

const webhookRouter = express.Router();
const eventRouter = express.Router(); 


export function webhookToJson(message) {
  const nameIdMatch = message.match(/^([^:]+):/); // Matches the part before the colon
  const actionMatch = message.match(/order (\w+)/); // Matches "buy" or "sell"
  const contractsMatch = message.match(/order \w+ ([\d.]+)/); // Matches the number after "order action"
  const tickerMatch = message.match(/filled on ([^\s.]+)/); // Matches the part after "filled on"
  const symbolMatch = message.match(/Symbol = (\w+)/); // Matches the symbol after "Symbol ="
  const priceMatch = message.match(/price = ([\d.]+)/); // Matches the price after "price ="
  const timeframeMatch = message.match(/Timefame\s*=?\s*(\d+)/); // Matches the timeframe, allowing for optional "="

  return {
    nameId: nameIdMatch?.[1].trim() || null,
    action: actionMatch?.[1] || null,
    contracts: contractsMatch ? parseFloat(contractsMatch[1]) : null,
    ticker: tickerMatch?.[1] || null,
    symbol: symbolMatch?.[1] || null,
    price: priceMatch ? parseFloat(priceMatch[1]) : null,
    timeframe: timeframeMatch?.[1] ? parseInt(timeframeMatch[1], 10) : null,
  };
}


// Global variable to hold the overall price increase percentage
let overallPriceIncreasePercentage = 0;

export async function extractData(eventData, mappingJson) {
  const parsedData = webhookToJson(eventData);

  // Find existing events with the same eventName
  const existingEvents = await EventData.findAll({ where: { eventName: parsedData.nameId } });

  // Create a new event with the same eventName
  const eventToCreate = await EventData.create({
    data: eventData,
    eventName: parsedData.nameId,
  });

  // Perform calculations between the new event and existing events
  const newEventPrice = parsedData.price;
  let totalPriceIncrease = 0;
  let priceDifferencesCount = 0;

  // Calculate the percentage price increase between the new event and each existing event
  existingEvents.forEach(event => {
    const oldEventPrice = event.data.price; // Assuming 'data' contains price
    if (oldEventPrice > 0) {
      const priceIncrease = ((newEventPrice - oldEventPrice) / oldEventPrice) * 100; // Percentage increase
      totalPriceIncrease += priceIncrease;
      priceDifferencesCount++;
    }
  });

  // Calculate the average price increase percentage
  if (priceDifferencesCount > 0) {
    overallPriceIncreasePercentage = totalPriceIncrease / priceDifferencesCount;
  }

  const result = {};

  // Create the strategy object structure
  const strategyData = {
    strategy: {
      order: {
        action: parsedData.action,
        contracts: parsedData.contracts
      }
    },
    syminfo: {
      basecurrency: parsedData.symbol
    },
    ticker: parsedData.ticker,
    close: newEventPrice,
    interval: parsedData.timeframe
  };

  mappingJson = JSON.parse(mappingJson);

  // Map the data according to mappingJson
  for (const [key, path] of Object.entries(mappingJson)) {
    let value = path.split('.').reduce((obj, key) => obj?.[key], strategyData);
    result[path] = value;
  }

  // Return the result and the global variable with the calculated price increase percentage
  result.priceIncreasePercentage = overallPriceIncreasePercentage;

  return result;
}

// export function renderTemplate(template, data) {
//   return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
//     const value = path.split('.').reduce((obj, key) => obj?.[key], data);
//     return value !== undefined ? value : match;
//   });
// }

export function renderTemplate(template, data) {
  return template.replace(/{{\s*([\w.]+)\s*}}/g, (_, key) => {
    // Use jsonpath to resolve the key
    const results = [data[key]];
    // jsonpath.query returns an array, use the first value if found
    return results.length ? results[0] : `{{${key}}}`;
  });
}


eventRouter.post('/event/:endpointId', async (req, res, next) => {
  try {
    const { endpointId } = req.params;
    overallPriceIncreasePercentage = 0;
    console.log('Received webhook for endpoint:', endpointId);
    
    const webhook = await Webhook.findOne({
      where: { endpointUrl: endpointId, isActive: true },
    });

    if (!webhook) {
      return res.status(404).json({ message: 'Webhook endpoint not found or inactive' });
    }

    // For this example, assuming the eventData is a string
    const eventData = req.body.message;

    console.log('Received event data:', eventData);

    const mappings = await webhook.getMappings();
    console.log(`Processing ${mappings.length} mappings`);

    for (const mapping of mappings) {
      const template = await mapping.getTemplate();
      const mappingJson = JSON.parse(mapping.mappingJson);
      
      console.log('Using mapping:', mappingJson);
      
      const extractedData = await extractData(eventData, mappingJson);
      console.log('Extracted data:', extractedData);
      
      let tweetContent = renderTemplate(template.content, extractedData);
      console.log('Generated tweet:', tweetContent);
      tweetContent = tweetContent.replace(/\\n/g, '\n');
      console.log('overallPriceIncreasePercentage', overallPriceIncreasePercentage);
      await twitterService.postTweet(tweetContent);
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