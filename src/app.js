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

import errorMiddleware from './middlewares/errorMiddleware.js';

dotenv.config();

const app = express();

app.use(helmet());
app.use(express.json());
app.use(express.text()); 

console.log('process.env.FRONTEND_URL-trace-log-app.js', process.env.FRONTEND_URL)

const corsOptions = {
  origin: process.env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['set-cookie']
};

app.options('*', cors(corsOptions));

app.use(cors(corsOptions));
app.use(morgan('dev'));
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'API is running!'
  });
});

const isDev = process.env.NODE_ENV === 'development';

console.log('isDev Env', isDev, "process.env.NODE_ENV" + process.env.NODE_ENV);

const routePrefix = (path) => (isDev ? `/api${path}` : path);

app.use(routePrefix('/auth'), authController);
app.use(routePrefix('/users'), userController);
app.use(routePrefix('/configuration'), configurationController);
app.use(routePrefix('/twitter'), twitterController);
app.use(routePrefix('/webhooks'), webhookRouter);
app.use(routePrefix('/templates'), templateController);
app.use(routePrefix('/mappings'), mappingController);

app.use(routePrefix('/'), eventRouter);

app.use(errorMiddleware);

export default app;