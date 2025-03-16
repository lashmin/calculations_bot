const express = require('express');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const ngrok = require('ngrok');
const axios = require('axios');
require('dotenv').config();  // Load .env variables

const token = process.env.TELEGRAM_BOT_TOKEN;
const SERVER_URL = process.env.SERVER_URL;
const port = process.env.PORT || 8443;
const url = 'https://0e02-89-216-209-214.ngrok-free.app';

const userStates = {};

(async function () {
    try {
        console.log(`ngrok URL: ${url}`);
        const webhookUrl = `${url}/bot${token}`;
        const response = await axios.post(`https://api.telegram.org/bot${token}/setWebhook`, { url: webhookUrl });
        console.log(`Webhook set to: ${webhookUrl}`);
        console.log('Webhook response:', response.data);

        const bot = new TelegramBot(token, { webHook: { port: port } });

        // Command: /start (Main Menu)
        bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const realTelegramId = msg.from.id;
    const referralId = match && match[1] ? parseInt(match[1].trim(), 10) || null : null;
    const username = msg.from.username || 'N/A';
    console.log(referralId);

    // Construct payload for the server
    const payload = {
        referral_id: referralId,
        real_telegram_id: realTelegramId,
        username: username
    };

    try {
        const response = await axios.post(`${SERVER_URL}/connect-client`, payload);
        console.log('Referral data sent successfully:', response.data);
        
        bot.sendMessage(chatId, referralId 
    ? `This is your referral number: **${referralId}**` 
    : `No referral number detected.`, { parse_mode: "Markdown" });
    } catch (error) {
        console.error('Error sending referral data:', error);
        bot.sendMessage(chatId, 'There was an error processing your referral information.');
    }

    // Continue with the main menu
    userStates[chatId] = { state: 'main_menu' };
    bot.sendMessage(chatId, "\uD83D\uDD14 Notification\n\nPlease choose an option:", {
        reply_markup: {
            inline_keyboard: [
                [{ text: '\uD83D\uDCC5 Book', callback_data: 'book' }],
                [{ text: '\uD83D\uDCD6 Learn Conditions', callback_data: 'learn' }],
                [{ text: '\uD83C\uDFE2 About the Company', callback_data: 'about' }],
                [{ text: '\uD83D\uDCDE Need help', callback_data: 'help' }]
            ]
        }
    });
});


        // Handle all callback queries for inline buttons
        bot.on('callback_query', (query) => {
            const chatId = query.message.chat.id;
            const data = query.data;
            console.log(`Callback query received: ${data}`);

            if (data === 'book') {
                handleBook(chatId);
            } else if (data === 'contact_us') {
                handleContactUs(chatId);
            } else if (data.startsWith('submit_request')) {
                const [_, file, text] = data.split('|');
                handleSubmitRequest(chatId, file, text);
            } else if (data === 'back_to_main') {
                handleBackToMain(chatId);
            } else if (data.startsWith('enter_date')) {
                const [_, file, text] = data.split('|');
                handleEnterDate(chatId, file, text);
            } else if (data === 'submit') {
                handleSubmit(chatId);
            } else if (data === 'learn') {
                handleLearnConditions(chatId);
            } else if (data === 'about') {
                handleAboutCompany(chatId);
            } else if (data === 'help') {
                handleNeedHelp(chatId);
            }
        });

        function handleBook(chatId) {
            userStates[chatId] = { state: 'book' };
            bot.sendMessage(chatId, "\uD83D\uDD14 Notification\n\nPress 'Contact us', and a manager will contact you to discuss the details.\nOr submit a request via the bot.", {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '\uD83D\uDCDE Contact us', callback_data: 'contact_us' }],
                        [{ text: '\uD83D\uDCE9 Submit request', callback_data: 'submit_request' }],
                        [{ text: '\uD83D\uDD19 Back', callback_data: 'back_to_main' }] // Back button
                    ]
                }
            });
        }

        function handleContactUs(chatId) {
            userStates[chatId] = { state: 'contact_us' };
            bot.sendMessage(chatId, "\uD83D\uDD14 Notification\n\nThank you! Our manager will contact you.", {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '\uD83D\uDD19 Back', callback_data: 'book' }], // Back to Layer 2 (Book)
                        [{ text: '\uD83C\uDFE0 To menu', callback_data: 'back_to_main' }] // Back to Layer 1 (Main menu)
                    ]
                }
            });
        }

        function handleSubmitRequest(chatId, file = 'No file added', text = 'No entry') {
            userStates[chatId] = { state: 'submit_request', file, text };
            bot.sendMessage(chatId, "\uD83D\uDD14 Notification\n\nAttach a file or enter a request.", {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '\uD83D\uDD19 Back', callback_data: 'book' }], // Back to Layer 2 (Book)
                        [{ text: '\uD83C\uDFE0 To menu', callback_data: 'back_to_main' }] // Back to Layer 1 (Main menu)
                    ]
                }
            });

            // Remove any existing listeners for 'message' event
            bot.removeAllListeners('message');

            // Set up a listener for the next message or file
            bot.once('message', (msg) => {
                const text = msg.caption || msg.text || 'No entry'; // Handle caption text
                const file = msg.document ? msg.document.file_name : (msg.photo ? 'Photo attached' : 'No file added');

                userStates[chatId] = { state: 'enter_date', file, text };
                bot.sendMessage(chatId, `\uD83D\uDD14 Notification\n\nFile: ${file}\nRequest: ${text}\nPlease specify the date.`, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '\uD83D\uDD19 Back', callback_data: `submit_request|${file}|${text}` }],
                            [{ text: '\uD83C\uDFE0 To menu', callback_data: 'back_to_main' }]
                        ]
                    }
                });

                handleDateInput(chatId, file, text);
            });
        }

        function handleBackToMain(chatId) {
            userStates[chatId] = { state: 'main_menu' };
            bot.sendMessage(chatId, "\uD83D\uDD14 Notification\n\nPlease choose an option:", {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '\uD83D\uDCC5 Book', callback_data: 'book' }],
                        [{ text: '\uD83D\uDCD6 Learn Conditions', callback_data: 'learn' }],
                        [{ text: '\uD83C\uDFE2 About the Company', callback_data: 'about' }],
                        [{ text: '\uD83D\uDCDE Need help', callback_data: 'help' }]
                    ]
                }
            });
        }

        function handleEnterDate(chatId, file, text) {
            userStates[chatId] = { state: 'enter_date', file, text };
            bot.sendMessage(chatId, `\uD83D\uDD14 Notification\n\nPlease specify the date.`, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '\uD83D\uDD19 Back', callback_data: `submit_request|${file}|${text}` }],
                        [{ text: '\uD83C\uDFE0 To menu', callback_data: 'back_to_main' }]
                    ]
                }
            });

            handleDateInput(chatId, file, text);
        }

        function handleSubmit(chatId) {
            userStates[chatId] = { state: 'submitted' };
            bot.sendMessage(chatId, "\uD83D\uDD14 Notification\n\nRequest submitted!", {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '\uD83C\uDFE0 To menu', callback_data: 'back_to_main' }]
                    ]
                }
            });
        }

        function handleDateInput(chatId, file = 'No file added', text = 'No entry') {
            // Remove any existing listeners for 'message' event
            bot.removeAllListeners('message');

            // Define the listener function
            function handleDateInputListener(dateMsg) {
                if (dateMsg.document || dateMsg.caption || dateMsg.photo) {
                    bot.sendMessage(chatId, "\uD83D\uDD14 Notification\n\nPlease enter a date as text, not as a file or with a caption.", {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '\uD83D\uDD19 Back', callback_data: `enter_date|${file}|${text}` }],
                                [{ text: '\uD83C\uDFE0 To menu', callback_data: 'back_to_main' }]
                            ]
                        }
                    });
                    handleDateInput(chatId, file, text); // Wait for the correct text input again
                } else {
                    const dateText = dateMsg.text || 'No date specified';

                    userStates[chatId] = { state: 'submitted', file, text, date: dateText };
                    bot.sendMessage(chatId, `\uD83D\uDD14 Notification\n\nFile: ${file}\nRequest: ${text}\nDate: ${dateText}`, {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '✅ Submit', callback_data: 'submit' }],
                                [{ text: '\uD83D\uDD19 Back', callback_data: `enter_date|${file}|${text}` }],
                                [{ text: '\uD83C\uDFE0 To menu', callback_data: 'back_to_main' }]
                            ]
                        }
                    });
                }
            }

            // Set up the listener for the date input
            bot.once('message', handleDateInputListener);
        }

        function handleLearnConditions(chatId) {
            userStates[chatId] = { state: 'learn_conditions' };
            bot.sendMessage(chatId, "We operate on a prepayment basis only.\nAnything else?", {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '\uD83D\uDCC5 Book', callback_data: 'book' }],
                        [{ text: '\uD83D\uDCD6 Learn Conditions', callback_data: 'learn' }],
                        [{ text: '\uD83C\uDFE2 About the Company', callback_data: 'about' }],
                        [{ text: '\uD83D\uDCDE Need help', callback_data: 'help' }]
                    ]
                }
            });
        }

        function handleAboutCompany(chatId) {
            userStates[chatId] = { state: 'about_company' };
            bot.sendMessage(chatId, "Our name is [Company Name].\nWe were founded on [Date].\nWe specialize in...\nOur website", {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '\uD83D\uDCC5 Book', callback_data: 'book' }],
                        [{ text: '\uD83D\uDCD6 Learn Conditions', callback_data: 'learn' }],
                        [{ text: '\uD83C\uDFE2 About the Company', callback_data: 'about' }],
                        [{ text: '\uD83D\uDCDE Need help', callback_data: 'help' }]
                    ]
                }
            });
        }

        function handleNeedHelp(chatId) {
            userStates[chatId] = { state: 'need_help' };
            bot.sendMessage(chatId, "If you have any questions, write to @contact.com", {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '\uD83D\uDCC5 Book', callback_data: 'book' }],
                        [{ text: '\uD83D\uDCD6 Learn Conditions', callback_data: 'learn' }],
                        [{ text: '\uD83C\uDFE2 About the Company', callback_data: 'about' }],
                        [{ text: '\uD83D\uDCDE Need help', callback_data: 'help' }]
                    ]
                }
            });
        }

        // Command: /getusers
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

            console.log(`Received /adduser command from chatId: ${chatId} with info: ${telegram_id, username, full_name, phone}`);

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

        // Express setup
        const app = express();
        app.use(bodyParser.json());

        // Webhook route
        app.post(`/bot${token}`, (req, res) => {
            bot.processUpdate(req.body);
            res.sendStatus(200);
        });

        // Server status check
        app.get('/', (req, res) => {
            res.send('Server is running! Telegram bot is active.');
        });

        app.listen(port, () => {
            console.log(`Server is running on port ${port}`);
        });

    } catch (error) {
        console.error('Error starting the bot:', error);
    }
})();