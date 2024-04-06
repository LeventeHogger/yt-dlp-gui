const express = require('express');
const path = require('path');
const fs = require('fs');
const sanitize = require("sanitize-filename");
const YTDlpWrap = require('yt-dlp-wrap').default;
const bodyParser = require('body-parser');

const ffmpeg = require('fluent-ffmpeg');

//kommenteld ki ha nem docker production
ffmpeg.setFfmpegPath(path.join(__dirname, 'ffmpeg'));
ffmpeg.setFfprobePath(path.join(__dirname, 'ffprobe'));

const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {});

const ytRegex = /^((?:https?:)?\/\/)?((?:www|m)\.)?((?:youtube\.com|youtu.be))(\/(?:[\w\-]+\?v=|embed\/|v\/)?)([\w\-]+)(\S+)?$/gm;

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const port = 3000;

const ytDlpWrap = new YTDlpWrap(path.join(__dirname, 'yt-dlp'));

app.get('/', (req, res) => {
  res.render('index', { thumbnail: undefined, title: undefined, channel: undefined });
});

app.post('/keres', async (req, res) => {
  if (req.body.ytlink == '')
    req.body.ytlink = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

  try {
    if (!req.body.ytlink.match(ytRegex))
      return res.redirect('/');

    let ytLinkSplit = req.body.ytlink.split('&')[0];
    let sessionId = req.body.sessionid;

    const metadata = await ytDlpWrap.getVideoInfo(ytLinkSplit);
    const fileName = `${metadata.title} [${metadata.display_id}].mp4`;
    const fullPath = path.join(__dirname, `public/${fileName}`);

    res.render('index', { thumbnail: metadata.thumbnail, title: metadata.title, channel: metadata.channel, file: fileName });

    ytDlpWrap
      .exec([ytLinkSplit, '-f', 'best', '-o', fullPath,
      ])
      .on('progress', (progress) => {
        console.log('Letöltés %:', progress.percent)
        io.emit(sessionId, null, progress, 'download');
      })
      .on('error', (error) => console.error(error))
      .on('close', () => {
        console.log('Letöltés kész,', `süti: ${req.body.sessionid}`);
        convert(fullPath, sanitize(fileName.replace(/\.\w+$/, 'mp4', 'mp3').replaceAll('#', '')), sessionId);
        console.log('Konvert start');
      });

  } catch (err) {
    console.log(err);
    res.redirect('/');
  }
});

function convert(source, dest, sessionId) {
  const command = ffmpeg(source)
    .format('mp3')
    .on('progress', (progress) => {
      if (progress.percent > 0) {
        io.emit(sessionId, null, progress, 'convert');
        console.log('Konvertálás %:', roundToDecimalPlaces(progress.percent, 1));
      }
    })
    .on('end', (stdout, stderr) => {
      io.emit(sessionId, dest, 100, 'done');
      console.log('Siker!');
      fs.unlink(source, (err) => err ? console.log(err) : console.log('MP4 törölve'));
    })

  command.save(path.join(__dirname, `public/${dest}`));
}

function roundToDecimalPlaces(num, decimalPlaces) {
  const factor = Math.pow(10, decimalPlaces);
  return Math.round(num * factor) / factor;
}

httpServer.listen(port);