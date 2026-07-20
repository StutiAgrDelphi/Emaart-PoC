import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { handleChat } from './chat';
import { handleInsights } from './insights';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.post('/chat', handleChat);
app.post('/insights', handleInsights);

const port = process.env.PORT || 3001;
app.listen(port, () => {
    console.log(`Chat backend listening on port ${port}`);
});
