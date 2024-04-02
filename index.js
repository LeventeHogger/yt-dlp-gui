const express = require('express');
const path = require('path');
const YTDlpWrap = require('yt-dlp-wrap').default;
const bodyParser = require('body-parser');

const { createServer } = require("http");
const { Server } = require("socket.io");

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {});

const ytRegex = /^((?:https?:)?\/\/)?((?:www|m)\.)?((?:youtube\.com|youtu.be))(\/(?:[\w\-]+\?v=|embed\/|v\/)?)([\w\-]+)(\S+)?$/gm;

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const port = 3000;

const ytDlpWrap = new YTDlpWrap(path.join(__dirname, 'yt-dlp/yt-dlp'));

app.get('/', (req, res) => {
  res.render('index', { thumbnail: undefined, title: undefined, channel: undefined });
})

app.post('/keres', async (req, res) => {
  if (!req.body.ytlink.match(ytRegex))
    return res.redirect('/');

  try {
    let ytLinkSplit = req.body.ytlink.split('&')[0];

    let metadata = await ytDlpWrap.getVideoInfo(ytLinkSplit);
    let fileName = `${metadata.title} [${metadata.display_id}].mp3`;

    res.render('index', { thumbnail: metadata.thumbnail, title: metadata.title, channel: metadata.channel, file: fileName });

    let ki = await ytDlpWrap.execPromise([
      ytLinkSplit,
      '-x',
      '--audio-format',
      'mp3',
      '--ffmpeg-location',
      path.join(__dirname, 'yt-dlp'),
      '-o',
      path.join(__dirname, `public/${fileName}`)
    ]);

    if (ki.includes("ExtractAudio")) {
      try {
        io.emit(req.body.sessionid, fileName);
        console.log(req.body.sessionid);
        console.log("megy");
      } catch (error) {
        console.log(error);
      }
    }

  } catch (err) {
    console.log(err);
    res.redirect('/');
  }
});

httpServer.listen(port);