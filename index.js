const express = require('express');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

require('dotenv').config();  // Load .env variables

const token = process.env.TELEGRAM_BOT_TOKEN;  // Get bot token from .env
const SERVER_URL = process.env.SERVER_URL;  // Get API URL from .env

// URL provided by ngrok, e.g., https://abc123.ngrok.io
const url = 'https://7ec8-24-135-88-130.ngrok-free.app';
const port = process.env.PORT || 8443;

console.log('TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN);
console.log('SERVER_URL:', process.env.SERVER_URL);
console.log('PORT:', process.env.PORT);

// Create bot in webhook mode
const bot = new TelegramBot(token, { webHook: { port: port } });

// Set webhook using public URL
bot.setWebHook(`${url}/bot${token}`);

bot.onText(/\/getusers/, async (msg) => {
  const chatId = msg.chat.id;
  console.log(`Received /getusers command from chatId: ${chatId}`);

  try {
    console.log('Fetching users from:', `${SERVER_URL}/users`);
    const response = await fetch(`${SERVER_URL}/users`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) throw new Error(`Server error: ${response.statusText}`);

    const data = await response.json();
    console.log('Fetched users:', data);
    bot.sendMessage(chatId, `User List: ${JSON.stringify(data)}`);
  } catch (error) {
    console.error('Error fetching users:', error);
    bot.sendMessage(chatId, `Failed to retrieve user list. Error: ${error.message}`);
  }
});

// Command: /adduser
bot.onText(/\/adduser/, async (msg) => {
  const chatId = msg.chat.id;
  const telegram_id = msg.from.id;
  const username = msg.from.username || '';
  const full_name = `${msg.from.first_name || ''} ${msg.from.last_name || ''}`.trim();
  const phone = msg.contact ? msg.contact.phone_number : 'none'; // Check if phone number is available

  console.log(`Received /adduser command from chatId: ${chatId} with info: ${telegram_id}, ${username}, ${full_name}, ${phone}`);

  try {
    const response = await fetch(`${SERVER_URL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegram_id, username, full_name, phone })
    });

    if (!response.ok) throw new Error(`Server error: ${response.statusText}`);

    const data = await response.json();
    console.log('User added:', data);
    bot.sendMessage(chatId, `User added successfully: ${JSON.stringify(data)}`);
  } catch (error) {
    console.error('Error adding user:', error);
    bot.sendMessage(chatId, `Failed to add user. Error: ${error.message}`);
  }
});

// Command: /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  console.log(`Received /start command from chatId: ${chatId}`);
  bot.sendMessage(chatId, 'Welcome to the bot! Use /help to see available commands.');
});

// Command: /help
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const helpMessage = `Available commands:
    
  /start - Start the bot
  /help - Show this help message
  /echo <text> - Echo back your text
  /getusers - Get the list of users
  /adduser - Add a new user`;
  bot.sendMessage(chatId, helpMessage);
});

// Command: /echo - Echoes back the provided text
bot.onText(/\/echo (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const response = match[1]; // capture the text after /echo
  bot.sendMessage(chatId, `You said: ${response}`);
});

// Create Express application
const app = express();
app.use(bodyParser.json());

// Route where Telegram sends updates
app.post(`/bot${token}`, (req, res) => {
  console.log('Received webhook request:', req.body);
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Additional route to check if the server is running
app.get('/', (req, res) => {
  res.send('Server is running! Telegram bot is active.');
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
