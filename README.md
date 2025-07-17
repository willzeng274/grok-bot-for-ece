# 🔥 Grok Bot - The Savage Discord Roaster

A Discord bot that uses Google's Gemini AI to roast users with the attitude of a sassy Twitter user. This bot doesn't help - it judges, mocks, and delivers witty comebacks instead of answering questions.

## ✨ Features

- 🤖 **AI-Powered Roasts**: Uses Google Gemini to generate creative, funny insults
- 🐦 **Twitter Personality**: Channels the energy of a sarcastic social media user
- ⏰ **Rate Limiting**: Prevents spam with cooldown periods
- 🛡️ **Safe Roasting**: Funny but not harmful - avoids genuinely offensive content
- 💬 **Mention-Based**: Only responds when mentioned or in DMs
- 🎭 **Fallback Humor**: Has backup roasts when AI fails

## 🚀 Setup

### Prerequisites

- Node.js 18+ installed
- A Discord account and server
- Google Gemini API access (free tier available)

### 1. Clone and Install

```bash
# Clone the repository
git clone <your-repo-url>
cd grok-bot

# Install dependencies with bun (preferred) or npm
bun install
# or
npm install
```

### 2. Create Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Go to the "Bot" section
4. Click "Add Bot"
5. Copy the bot token (you'll need this for `.env`)
6. Under "Privileged Gateway Intents", enable:
   - Message Content Intent
   - Server Members Intent (optional)

### 3. Get Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click "Create API Key"
3. Copy the API key (you'll need this for `.env`)

### 4. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
cp config.example.env .env
```

Edit `.env` and add your actual tokens:

```env
# Discord Bot Configuration
DISCORD_TOKEN=your_actual_discord_bot_token

# Google Gemini AI Configuration
GEMINI_API_KEY=your_actual_gemini_api_key
```

### 5. Invite Bot to Server

1. In Discord Developer Portal, go to "OAuth2" > "URL Generator"
2. Select scopes:
   - `bot`
   - `applications.commands`
3. Select bot permissions:
   - Send Messages
   - Read Message History
   - Use Slash Commands
   - Mention Everyone (optional)
4. Copy the generated URL and open it to invite the bot

### 6. Run the Bot

```bash
# Development mode (with auto-restart)
bun run dev
# or
npm run dev

# Production mode
bun start
# or
npm start
```

## 📖 Usage

### In Servers
- Mention the bot: `@GrokBot what's the weather?`
- The bot will roast you instead of answering

### In DMs
- Just send any message directly to the bot
- It will respond with a roast

### Example Interactions

**User**: `@GrokBot how do I cook pasta?`

**Bot**: `Bestie really came to a roast bot asking for cooking tips like I'm Gordon Ramsay 💀 Here's a recipe: boil water, add pasta, try not to burn down your kitchen. Revolutionary stuff, I know 🍝`

**User**: `@GrokBot what's 2+2?`

**Bot**: `Imagine needing AI assistance for elementary math that kindergarteners solve with finger counting 😭 Next you're gonna ask me how to breathe or walk in a straight line`

## ⚙️ Configuration

### Cooldown Settings
Edit `COOLDOWN_TIME` in `src/bot.js` to change rate limiting (default: 3 seconds)

### Personality Tuning
Modify the `ROAST_PROMPT` in `src/bot.js` to adjust the bot's personality and roasting style

### Response Triggers
Currently responds to:
- Direct mentions in servers
- All messages in DMs

You can modify the trigger logic in the `messageCreate` event handler.

## 🔧 Troubleshooting

### Common Issues

1. **Bot doesn't respond**
   - Check if bot has proper permissions
   - Verify environment variables are set correctly
   - Ensure bot is online (check console for "ready" message)

2. **API Errors**
   - Verify Gemini API key is valid and has quota
   - Check Discord token is correct
   - Look at console error messages

3. **Permission Errors**
   - Bot needs "Send Messages" and "Read Message History" permissions
   - Make sure Message Content Intent is enabled

### Debug Mode

Add debug logging by setting:
```env
NODE_ENV=development
```

## 📝 License

MIT License - feel free to roast responsibly!

## ⚠️ Disclaimer

This bot is for entertainment purposes. While it aims to be funny rather than harmful, use responsibly and respect Discord's Terms of Service and community guidelines. 