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
const BOLD_REGEX = /^\**(.*)\**$/;
const ITALIC_REGEX = /^\_*(.*)\_*$/;

const replaceWithMatch = (_, match) => match;

app.command('/post-list', async ({ command, ack, say }) => {
    await ack();

    const { messages, mentions } = command.text
        .split('\n')
        .filter(Boolean)
        .reduce(
            (acc, msg) => {
                const trimmedMsg = msg.trim();
                const unformattedMsg = trimmedMsg
                    .replace(BOLD_REGEX, replaceWithMatch)
                    .replace(ITALIC_REGEX, replaceWithMatch);
                if (unformattedMsg.startsWith('@')) {
                    // mentions
                    trimmedMsg
                        .match(MENTION_REGEX)
                        .map((msg) => msg.trim())
                        .forEach((msg) => acc.mentions.add(msg));
                } else if (unformattedMsg.startsWith('Урок')) {
                    // last line of message (bold)
                    const messageStart = acc.currentMessageLines.join('\n');
                    acc.messages.push(`${messageStart}\n*${trimmedMsg}*\n`);
                    acc.currentMessageLines = [];
                } else if (
                    acc.currentMessageLines.length === 0 &&
                    unformattedMsg.match(PAGE_REGEX) &&
                    acc.messages.length
                ) {
                    // crutch for pagination on the separate line (bold)
                    acc.messages[
                        acc.messages.length - 1
                    ] += `*${trimmedMsg}*\n`;
                } else {
                    if (acc.currentMessageLines.length === 0) {
                        // 1st line of message (no styling)
                        acc.currentMessageLines.push(trimmedMsg);
                    } else {
                        // following lines of the message (except for pagination and last line) (italic)
                        acc.currentMessageLines.push(`_${trimmedMsg}_`);
                    }
                }
                return acc;
            },
            { messages: [], mentions: new Set(), currentMessageLines: [] }
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
