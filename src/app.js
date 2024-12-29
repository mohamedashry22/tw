import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import morgan from 'morgan';

import authController from './controllers/authController.js';
import userController from './controllers/userController.js';
import configurationController from './controllers/configurationController.js';
import twitterController from './controllers/twitterController.js';
import { webhookRouter, eventRouter } from './controllers/webhookController.js';
import templateController from './controllers/templateController.js';
import mappingController from './controllers/mappingController.js';
import eventController from './controllers/EventController.js';

import errorMiddleware from './middlewares/errorMiddleware.js';

dotenv.config();

const app = express();

app.use(helmet());
const corsOptions = {
    origin: 'http://45.32.135.95:3000',
    credentials: true,
    allowedHeaders: 'Content-Type,Authorization',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  };
  
  app.use(cors(corsOptions));
// app.use(cors()); 
app.use(morgan('dev'));
app.use(express.json());
app.use(cookieParser());

app.use('/', eventRouter);
app.use('/api/auth', authController);
app.use('/api/users', userController);
app.use('/api/configuration', configurationController);
app.use('/api/twitter', twitterController);
app.use('/api/webhooks', webhookRouter);
app.use('/api/templates', templateController);
app.use('/api/mappings', mappingController);
app.use('/api/eventData', eventController);

app.use(errorMiddleware);

export default app;