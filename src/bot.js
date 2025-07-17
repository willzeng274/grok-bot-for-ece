const { Client, GatewayIntentBits, AttachmentBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getRandomPrompt, SERIOUS_PROMPT } = require('./prompts');
require('dotenv').config();

// Debug environment variables
console.log('🔍 Environment Check:');
console.log(`DISCORD_TOKEN exists: ${!!process.env.DISCORD_TOKEN}`);
console.log(`GEMINI_API_KEY exists: ${!!process.env.GEMINI_API_KEY}`);

let seriousMode = false;

// Initialize Discord client with all necessary intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions
    ]
});

// Initialize Gemini AI with both text and a stable image model
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const textModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
const imageModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash-preview-image-generation" }); // Using the required preview model

// System prompts are now loaded from prompts.js for maximum variety

// Rate limiting to prevent spam
const userCooldowns = new Map();
const COOLDOWN_TIME = 3000; // 3 seconds

// Helper function to fetch recent message context
async function getMessageContext(message, limit = 10) {
    try {
        const messages = await message.channel.messages.fetch({ limit: limit + 1 }); // +1 to include current message
        const messageHistory = Array.from(messages.values())
            .reverse() // Chronological order
            .slice(0, -1) // Remove the current message
            .map(msg => {
                // Use nickname if available (in servers), otherwise use username
                const displayName = msg.member ? msg.member.displayName : msg.author.username;
                let content = `${displayName}: "${msg.content}"`;
                
                // Add information about attachments/images
                if (msg.attachments && msg.attachments.size > 0) {
                    const attachmentInfo = Array.from(msg.attachments.values())
                        .map(att => {
                            if (att.contentType && att.contentType.startsWith('image/')) {
                                return `[sent image: ${att.name || 'image'}]`;
                            } else if (att.contentType && att.contentType.startsWith('video/')) {
                                return `[sent video: ${att.name || 'video'}]`;
                            } else {
                                return `[sent file: ${att.name || 'file'}]`;
                            }
                        }).join(' ');
                    content += ` ${attachmentInfo}`;
                }
                
                // Add information about embeds (like generated images)
                if (msg.embeds && msg.embeds.length > 0) {
                    const embedInfo = msg.embeds
                        .map(embed => {
                            if (embed.image) {
                                return `[embedded image]`;
                            } else if (embed.video) {
                                return `[embedded video]`;
                            } else {
                                return `[embed]`;
                            }
                        }).join(' ');
                    content += ` ${embedInfo}`;
                }
                
                return content;
            })
            .join('\n');
        
        return messageHistory || "No recent message context available.";
    } catch (error) {
        console.error('Error fetching message context:', error);
        return "Could not fetch message context.";
    }
}

// Helper function to generate image using the Imagen model
async function generateImageAttachment(imagePrompt) {
    try {
        console.log(`🎨 Generating image with working method: "${imagePrompt}"`);
        
        // Use the WORKING method discovered in testing: responseModalities!
        const result = await imageModel.generateContent({
            contents: [{ parts: [{ text: `Create a funny meme-style image: ${imagePrompt}` }] }],
            generationConfig: {
                responseModalities: ["IMAGE", "TEXT"]
            }
        });
        
        const response = await result.response;
        
        if (response.candidates && response.candidates[0]) {
            const candidate = response.candidates[0];
            if (candidate.content && candidate.content.parts) {
                for (const part of candidate.content.parts) {
                    if (part.inlineData && part.inlineData.data) {
                        console.log('🎨 Image data found using working method!');
                        console.log(`🎨 MIME type: ${part.inlineData.mimeType}`);
                        
                        const imageBuffer = Buffer.from(part.inlineData.data, 'base64');
                        
                        // Create descriptive filename based on the image prompt
                        const sanitizedPrompt = imagePrompt
                            .toLowerCase()
                            .replace(/[^a-z0-9\s]/g, '') // Remove special characters
                            .replace(/\s+/g, '-') // Replace spaces with dashes
                            .substring(0, 50); // Limit length
                        
                        // Determine file extension from MIME type
                        let extension = 'png'; // default
                        if (part.inlineData.mimeType) {
                            if (part.inlineData.mimeType.includes('jpeg')) extension = 'jpg';
                            else if (part.inlineData.mimeType.includes('gif')) extension = 'gif';
                            else if (part.inlineData.mimeType.includes('webp')) extension = 'webp';
                        }
                        
                        const fileName = `${sanitizedPrompt}.${extension}`;

                        return new AttachmentBuilder(imageBuffer, { 
                            name: fileName,
                            description: `AI-generated image: ${imagePrompt}`
                        });
                    }
                }
            }
        }

        console.log('⚠️ No image data found in response');
        return null;

    } catch (error) {
        console.error('❌ Error during image generation:', error);
        return null;
    }
}

// Define the image generation tool for Gemini function calling
const imageGenerationFunction = {
    name: "generate_roast_image",
    description: "RARELY generate images. ONLY when the user explicitly asks for visual content like 'image', 'pic', 'meme', 'show me', 'draw', etc. Default to text-only responses.",
    parameters: {
        type: "object",
        properties: {
            image_description: {
                type: "string",
                description: "A detailed image generation prompt (3-10 words) describing the specific image you want created. Examples: 'confused person staring at computer screen', 'cat wearing glasses looking disappointed'"
            },
            should_generate: {
                type: "boolean", 
                description: "Set to true ONLY if the user explicitly requested visual content or an image. Default should be false for most responses."
            }
        },
        required: ["image_description", "should_generate"]
    }
};

// Connection event logging
client.on('debug', (info) => {
    // Reduce debug noise, only log important stuff
    if (info.includes('Heartbeat') || info.includes('heartbeat')) return;
    console.log(`🔧 Debug: ${info}`);
});

client.on('warn', (info) => {
    console.log(`⚠️ Warning: ${info}`);
});

client.on('error', (error) => {
    console.error('❌ Discord client error:', error);
});

client.on('ready', () => {
    console.log(`🔥 ${client.user.tag} is online and ready to roast! 🔥`);
    console.log(`Bot ID: ${client.user.id}`);
    console.log(`Connected to ${client.guilds.cache.size} guilds`);
    
    // List guilds for debugging
    client.guilds.cache.forEach(guild => {
        console.log(`📍 Connected to guild: ${guild.name} (ID: ${guild.id})`);
    });
    
    client.user.setActivity('Roasting with AI-generated memes', { type: 'PLAYING' });
    console.log('✅ Bot is fully ready and listening for messages!');
});

// Test event to see if ANY events are working
client.on('guildCreate', (guild) => {
    console.log(`🆕 Joined new guild: ${guild.name}`);
});

client.on('messageCreate', async (message) => {
    // ALWAYS log when this event fires
    console.log('\n🎯 === MESSAGE CREATE EVENT FIRED ===');
    // Use nickname if available (in servers), otherwise use username  
    const authorDisplayName = message.member ? message.member.displayName : message.author.username;
    console.log(`📨 From: ${authorDisplayName} (${message.author.username}#${message.author.discriminator})`);
    console.log(`📍 Guild: ${message.guild ? message.guild.name : 'DM'}`);
    console.log(`💬 Content: "${message.content}"`);
    console.log(`🤖 Author is bot: ${message.author.bot}`);
    
    // Don't respond to bots or own messages
    if (message.author.bot) {
        console.log('❌ Ignoring bot message');
        return;
    }
    
    const isDM = !message.guild;
    const isMentioned = message.mentions.has(client.user);
    const shouldRespond = isDM || isMentioned;
    
    console.log(`🎯 Should respond: ${shouldRespond} (DM: ${isDM}, Mentioned: ${isMentioned})`);
    
    if (!shouldRespond) {
        console.log('❌ Not mentioned and not a DM, ignoring');
        return;
    }
    
    // Check cooldown
    const userId = message.author.id;
    const now = Date.now();
    const cooldownAmount = COOLDOWN_TIME;
    
    if (userCooldowns.has(userId)) {
        const expirationTime = userCooldowns.get(userId) + cooldownAmount;
        if (now < expirationTime) {
            const timeLeft = (expirationTime - now) / 1000;
            console.log(`⏰ User ${authorDisplayName} on cooldown for ${timeLeft.toFixed(1)}s`);
            return message.reply(`Chill out! Wait ${timeLeft.toFixed(1)} more seconds before getting roasted again 💀`);
        }
    }
    
    userCooldowns.set(userId, now);
    setTimeout(() => userCooldowns.delete(userId), cooldownAmount);
    
    try {
        console.log('🔥 Generating roast...');
        await message.channel.sendTyping();
        
        const messageContext = await getMessageContext(message, 8);
        let userMessage = message.content.replace(`<@${client.user.id}>`, '').trim();

        if (!userMessage) {
            userMessage = "just mentioned me with no message";
        }
        
        console.log(`📝 Processing message: "${userMessage}"`);
        console.log(`📚 Context: ${messageContext}`);
        
        // Check for commands
        let selectedPrompt;
        
        if (userMessage.toLowerCase().startsWith('grok help')) {
            // Simple help command
            await message.reply(`hi im grok you can use \`@Grok seriously\` when you need me to be serious and \`@Grok stop\` to deactivate serious mode`);
            return;
        } else if (userMessage.toLowerCase().startsWith('seriously')) {
            seriousMode = true;
            // Remove the command from the message
            userMessage = userMessage.replace(/^seriously\s*/i, '').trim() || "🧠 SERIOUS MODE ACTIVATED. How can I help you?";
        } else if (userMessage.toLowerCase().startsWith('stop')) {
            // Deactivate serious mode and return to random personality
            seriousMode = false;
            await message.reply(`🎭 SERIOUS MODE DEACTIVATED. Back to chaos mode!`);
            return;
        }
        
        // Select prompt based on global serious mode state
        if (seriousMode) {
            selectedPrompt = SERIOUS_PROMPT;
            console.log(`🧠 Using SERIOUS MODE`);
        } else {
            // Get a random personality for this message
            selectedPrompt = getRandomPrompt();
            console.log(`🎭 Selected personality: ${selectedPrompt.split('\n')[0].substring(0, 50)}...`);
        }
        
        // Create the full prompt with context
        const fullPrompt = `${selectedPrompt}

RECENT CONVERSATION CONTEXT:
${messageContext}

CURRENT USER MESSAGE: "${userMessage}"
USERNAME: ${authorDisplayName}

${seriousMode ? 
    'Respond helpfully according to your serious mode guidelines above. Focus on being genuinely useful and supportive. Generate helpful images if they would aid understanding.' :
    'Respond according to your personality above, using the conversation context to make it specific and targeted. Consider if this deserves a funny image to go with your response.'
}:`;
        
        // Generate response using Gemini text model with function calling
        const result = await textModel.generateContent({
            contents: [{
                role: 'user',
                parts: [{ text: fullPrompt }]
            }],
            tools: [{
                functionDeclarations: [imageGenerationFunction]
            }]
        });
        
        const response = await result.response;
        let responseText = "";
        let shouldGenerateImage = false;
        let imageDescription = "";
        
        const candidate = response.candidates[0];
        
        for (const part of candidate.content.parts) {
            if (part.text) {
                responseText += part.text;
            } else if (part.functionCall) {
                const functionCall = part.functionCall;
                console.log(`🎨 Function called: ${functionCall.name}`);
                console.log(`🎨 Function args:`, functionCall.args);
                
                if (functionCall.name === 'generate_roast_image') {
                    shouldGenerateImage = functionCall.args.should_generate;
                    imageDescription = functionCall.args.image_description;
                }
            }
        }
        
        console.log(`💀 Generated response: "${responseText}"`);
        
        const messageOptions = {
            content: responseText.length > 2000 ? responseText.substring(0, 1997) + "..." : responseText
        };
        
        if (shouldGenerateImage && imageDescription) {
            console.log(`🎨 Generating image based on function call: "${imageDescription}"`);
            const imageAttachment = await generateImageAttachment(imageDescription);
            
            if (imageAttachment) {
                messageOptions.files = [imageAttachment];
                console.log('🖼️ Image attachment created successfully');
            } else {
                console.log('⚠️ Failed to generate image, sending text only');
                messageOptions.content += '\n\n*(tried to generate a meme for this but failed 💀)*';
            }
        }
        
        if (messageOptions.content) {
            await message.reply(messageOptions);
            console.log('✅ Roast sent successfully!');
        } else {
            console.log('⚠️ Empty text response, not sending message.');
        }
        
    } catch (error) {
        console.error('❌ Error generating roast:', error);
        await message.reply(`Something went wrong while generating your roast: ${error.message || 'Unknown error'}`);
    }
});

process.on('unhandledRejection', error => {
    console.error('❌ Unhandled promise rejection:', error);
});

// Login to Discord
if (!process.env.DISCORD_TOKEN) {
    console.error('❌ DISCORD_TOKEN not found in environment variables!');
    process.exit(1);
}

if (!process.env.GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY not found in environment variables!');
    process.exit(1);
}

console.log('🚀 Starting bot...');
client.login(process.env.DISCORD_TOKEN)
    .then(() => {
        console.log('🔗 Login successful!');
    })
    .catch(error => {
        console.error('❌ Login failed:', error);
        process.exit(1);
    });