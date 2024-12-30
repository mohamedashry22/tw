
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


export async function extractData(eventData, mappingJson) {
  let overallPriceIncreasePercentage = 0;
  const parsedData = webhookToJson(eventData);

  const existingEvents = await EventData.findAll({ where: { eventName: parsedData.nameId } });

  await EventData.create({
    data: eventData,
    eventName: parsedData.nameId,
    price: parsedData.price,
  });

  const newEventPrice = parsedData.price;
  let totalPriceIncrease = 0;
  let priceDifferencesCount = 0;

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

  const strategyData = {
    strategy: {
      order: {
        action: parsedData.action,
        contracts: parsedData.contracts,
      },
    },
    syminfo: {
      basecurrency: parsedData.symbol,
    },
    ticker: parsedData.ticker,
    close: newEventPrice,
    interval: parsedData.timeframe,
    profitLoss: formattedProfitLoss,
  };

  mappingJson = JSON.parse(mappingJson);

  if (overallPriceIncreasePercentage !== 0) {
    mappingJson.profitLoss = 'profitLoss';
  }

  const result = {};

  for (const [key, path] of Object.entries(mappingJson)) {
    let value = path.split('.').reduce((obj, key) => obj?.[key], strategyData);
    result[key] = value;
  }

  return result;
}


function replaceTokens(content, extractedData, mappingJSON) {
  let mappingObj = JSON.parse(mappingJSON);

  if (extractedData.profitLoss !== 0) {
    mappingObj.profitLoss = 'profitLoss';
  }

  function escapeRegExp(string) {
    return string.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&');
  }

  for (let mappingKey in mappingObj) {
    let mappingValue = mappingObj[mappingKey];

    let token = '{{' + mappingValue + '}}';

    let value = extractedData[mappingKey];

    if (value === undefined) {
      console.warn('No value for key', mappingKey);
      continue;
    }

    let valueStr = value.toString();

    let regex = new RegExp(escapeRegExp(token), 'g');

    content = content.replace(regex, valueStr);
  }

  return content;
}



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

    console.log('Received event data:', eventData);

    const mappings = await webhook.getMappings();
    console.log(`Processing ${mappings.length} mappings`);

    for (const mapping of mappings) {
      const template = await mapping.getTemplate();
      const mappingJson = JSON.parse(mapping.mappingJson);
      
      console.log('Using mapping:', mappingJson);
      
      const extractedData = await extractData(eventData, mappingJson);
      console.log('Extracted data:', extractedData);

      let templateContent = template.content;
        if ( extractedData.profitLoss)         
        {
          console.log("it goes with profitLoss.");
          templateContent = template.contentClose;
        } else {
          console.log("it goes without profitLoss.");
        }
      
      let tweetContent = replaceTokens(templateContent, extractedData, mappingJson);
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