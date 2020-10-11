if (process.env.DEV_MODE) {
    require('dotenv').config();
}
const { App } = require('@slack/bolt');

const app = new App({
    token: process.env.SLACK_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET
});

const MENTION_REGEX = /(\s|^)(@\w+)/g;
const PAGE_REGEX = /^\d+\/\d+$/;

app.command('/post-list', async ({ command, ack, say }) => {
    await ack();

    const { messages, mentions } = command.text
        .split('\n')
        .filter(Boolean)
        .reduce(
            (acc, msg) => {
                const trimmedMsg = msg.trim();
                if (trimmedMsg.startsWith('@')) {
                    // mention
                    trimmedMsg
                        .match(MENTION_REGEX)
                        .map((msg) => msg.trim())
                        .forEach(msg => acc.mentions.add(msg));
                } else if (trimmedMsg.startsWith('Урок')) {
                    // last line of block
                    acc.messages.push(`${acc.currentMessage}*${trimmedMsg}*\n`);
                    acc.currentMessage = '';
                } else if (
                    acc.currentMessage === '' &&
                    trimmedMsg.match(PAGE_REGEX) &&
                    acc.messages.length
                ) {
                    // crutch for pagination on the separate line
                    acc.messages[acc.messages.length - 1] += `${trimmedMsg}\n`;
                } else {
                    acc.currentMessage += `${trimmedMsg}\n`;
                }
                return acc;
            },
            { messages: [], mentions: new Set(), currentMessage: '' }
        );

    const mentionsString = Array.from(mentions).join(' ');

    for (const message of messages) {
        // do not use Promise.all to ensue messages order
        try {
            await say({
                channel: command.channel_id,
                text: `${message} ${mentionsString}`,
                link_names: true
            });
        } catch {}
    }
});

(async () => {
    const { PORT = 3000 } = process.env;
    await app.start(PORT);
    console.log(`⚡️ App is running on port ${PORT}!`);
})();
