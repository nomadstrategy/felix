require('nocamel');

const discord = require('discord.js');
const fs = require('fs');
const request = require('request-promise');
const q = require('q');

const config = JSON.parse(fs.read_file_sync('../config.json').to_string());

const bot = new discord.Client();

var state = {
    hangman_solver: false
};

var handlers = {

    state_change(message) {
        const content = message.content;
        const channel = message.channel;

        if (content.match(/^felix enable/gi)) {
            var mode = content.split('enable')[1].trim();

            state[mode] = true;

            message.reply(mode + ' enabled');
        }

        if (content.match(/^felix disable/gi)) {
            var mode = content.split('disable')[1].trim();

            state[mode] = false;

            message.reply(mode + ' disabled');
        }
    },

    async video(message) {
        const content = message.content;
        const channel = message.channel;

        var term = content.split('video')[1].trim();

        var video_list = [];

        var page_token = '';

        for (;;) {
            var url = 'https://www.googleapis.com/youtube/v3/search'+
                '?key=' + config.yt_key +
                '&channelId=UCrUL8K81R4VBzm-KOYwrcxQ'+
                '&part=snippet,id'+
                '&order=date'+
                '&maxResults=50';

            if (page_token) {
                url += '&pageToken=' + page_token;
            }

            var videos = await request({
                method: 'get',
                url: url,
                json: true,
                simple: true
            });

            page_token = videos.nextPageToken;

            videos.items.for_each(video => {
                video_list.push({
                    id: video.id.videoId,
                    title: video.snippet.title
                });
            });

            if (!page_token) break;
        }

        video_list = video_list
            .filter(video => {
                return !!~video.title.to_lower_case().index_of(term.to_lower_case())
            });

        if (video_list.length === 0) {
            message.reply('no videos found for: ' + term);
        } else if (video_list.length === 1) {
            var video = video_list[0];
            message.reply('i found a good video: https://www.youtube.com/watch?v=' + video.id);
        } else {
            var msg = 'i found several videos:\n';

            video_list.slice(0, 5).for_each(video => {
                msg += 'https://www.youtube.com/watch?v=' + video.id + '\n';
            });

            message.reply(msg)
        }
    },

    code(message) {
        const content = message.content;
        const channel = message.channel;

        var input_language = content.split('```')[0].split(' ')[2];
        var language = {
            python: 'python3',
            python3: 'python3',
            python2: 'python2',
            js: 'javascript',
            javascript: 'javascript',
            node: 'javascript',
            go: 'go',
            ruby: 'ruby',
            c: 'c',
            cpp: 'cpp',
            'c++': 'cpp',
            cs: 'csharp',
            csharp: 'csharp',
            'c#': 'csharp',
            php: 'php',
            r: 'r',
            nasm: 'nasm',
            asm: 'nasm',
            java: 'java',
            swift: 'swift',
            brainfuck: 'brainfuck',
            bf: 'brainfuck',
        }[input_language.trim().to_lower_case()] || null;

        if (!language) {
            channel.send(input_language + ' is not supported');
            return;
        }

        const code_message = content.replace(/```.+\s/gi, '```');

        const matches = /```((.|\n)+)```/gi.exec(code_message);

        if (!matches) {
            channel.send('no code present')
            return;
        }

        const source = matches[1].trim();

        return request
            ({
                method: 'post',
                url: 'https://emkc.org/api/internal/piston/execute',
                headers: {
                    Authorization: config.emkc_key
                },
                body: {
                    language,
                    source
                },
                json: true
            })
            .then(res => {
                if (!res || res.status !== 'ok' || res.payload.output === undefined) throw null;

                channel.send(
                    'Here is your output <@' + message.author.id + '>\n' +
                    '```\n' + res.payload.output.split('\n').slice(0, 30).join('\n') + '```'
                );
            })
            .catch(err => {
                channel.send('sorry, execution problem')
            });
    }
};

return bot
    .on('guildMemberAdd', member => {
        const channel = member.guild.channels.find(ch => ch.name === 'welcome');

        channel.send(
            'Welcome to the Engineer Man Community Discord Server, ' + member + '. ' +
            'I\'m Felix, the server smart assistant. You can learn more about what I can do by saying `felix help`. ' +
            'You can view the server rules @ <#484103976296644608>. Please be kind and decent to one another. ' +
            'Glad you\'re here!'
        );
    })
    .on('message', async message => {
        var content = message.content;
        var channel = message.channel;

        if (content.match(/^felix video/gi)) {
            return handlers.video(message);
        }

        if (content.match(/^felix (enable|disable)/gi)) {
            return handlers.state_change(message);
        }

        if (content.match(/^felix run (js|javascript|python(2|3)?|node|c|c\+\+|cpp|ruby|go|r|cs|csharp|php|c#|nasm|asm|java|swift|brainfuck|bf)/gi)) {
            return handlers.code(message);
        }

        if (content.match(/^(hi|what's up|yo|hey|hello) felix/gi)) {
            message.reply('hello!');
            return;
        }

        // easter eggs and various content
        switch (content) {
            case 'felix run':
                channel.send(
                    'i can run code!\n\n' +
                    '**here are my supported languages:**'+
                    '\npython2\npython3\njavascript\nruby\ngo\nc\nc++/cpp\ncs/csharp/c#\nr\nasm/nasm\nphp\njava\nswift\nbrainfuck/bf\n\n' +
                    '**you can run code by telling me things like:**\n' +
                    'felix run js\n' +
                    '\\`\\`\\`\nyour code\n\\`\\`\\`'
                );
                break;
            case 'html is a programming language':
                message.reply('no it\'s not, don\'t be silly');
                break;
            case 'you wanna fight, felix?':
                message.reply('bring it on pal (╯°□°）╯︵ ┻━┻');
                break;
            case 'arrays start at 0':
                message.reply('arrays definitely start at 0');
                break;
            case 'arrays start at 1':
                message.reply('arrays do not start at 1, they start at 0 instead');
                break;
        }

        // mod only stuff here
        var roles = message.member && message.member.roles.map(r => r.name) || [];

        var allowed = false;

        ['engineer man', 'fellows', 'staff'].for_each(r => {
            if (~roles.index_of(r)) allowed = true;
        });

        if (!allowed) return null;
    })
    .on('error', console.log)
    .login(config.bot_key);
