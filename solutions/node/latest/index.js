const express = require('express');
const fs = require('fs');
const https = require('https');
const socketIO = require('socket.io');

const Screen = require('./app/Screen');
const Audio = require('./app/Audio');

const connections = [];
global.apps = [];

// EXPRESS UYGULAMASI TANIMLA
const app = express();

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});


// HTTPS SUNUCU BAŞLAT
const server = https.createServer({
  key: fs.readFileSync('/etc/letsencrypt/live/metaroom.icu/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/metaroom.icu/fullchain.pem'),
  maxHttpBufferSize: 1e8 // 100 MB
}, app);


// SOCKET IO TANIMLA
const io = socketIO(server);
io.on('connection', (socket) => {
  console.log('===== Bir kullanıcı bağlandı. ====================================================================');

  connections.push(socket);
  socket.join('usr1-screen');

  /*/
  var mysql = require('mysql');

  var con = mysql.createConnection({
    host: "localhost",
    user: "miadb",
    password: "Y5szt3qwT9jBvpXx",
    database: "miadb"
  });

  con.connect(function(err) {
  if (err) throw err;
    con.query("SHOW TABLES", function (err, result, fields) {
      if (err) throw err;
      console.log(result);
    });
  });
  /*/

  socket.emit('get-navigator-infos');
  socket.on('get-navigator-infos', (data) => {
    console.log('get-navigator-infos geldi ',data);
    socket.screen = new Screen(socket, 
      256, 144 // sahte client ekran boyutu
      //data.width, data.height
    );
    socket.screen.orginalW = data.width;
    socket.screen.orginalH = data.height;

    socket.audio = new Audio(socket, data.volume);

    socket.screen.startStream();

    socket.screen.setObject('cam',{type:'cam', x:0, y:0, w:0, h:0, data:''});
    
    //socket.screen.loadApp("desktop");

    socket.screen.setObject('mouseCursor',{type:'mouseCursor', x:0, y:0, w:0, h:0, data:null});


  });

  socket.on('disconnect', () => {
    if(socket.screen){
      socket.screen.remove();
    }
    console.log('===== Bir kullanıcı ayrıldı. =====================================================================');
  });

  socket.on('refresh-screen', (data) => {
    if(socket.screen){
      if(socket.screen.refreshing == false){
        socket.screen.refreshing = true;
        //console.log('on refresh-screen çalıştı.');
        socket.screen.drawFrame(()=>{
          socket.screen.emitFrame();
          socket.screen.refreshing = false;
        });
      }
      else{
        console.log('Refresh bitmemiş');
      }
    }
    
  });

  /*/
  socket.on('play-sound', () => {
    console.log('play-sound');
    socket.audio.emit();
  });
  /*/


  // MICROPHONE
    socket.on('mic-stream', function (audioChunkBase64) {
      if(typeof audioChunkBase64 == 'string'){
        console.log('mic-stream');
        //fs.writeFileSync('mic-stream.base64',audioChunkBase64);
        socket.audio.setObject('mic',{type:'mic', data:audioChunkBase64});
        //socket.audio.micStreamBase64 = audioChunkBase64;
        socket.audio.makeChunk();
      }
    });
  //

  // CAMERA
    socket.on('cam-stream', (image) => {
      if(typeof image == 'string'){
        //console.log('cam-stream');
        socket.screen.setObject('cam',{type:'cam', x:0, y:0, w:socket.screen.width, h:socket.screen.height, data:image/*.split(',')[1]*/});
        
      }
    });
  //

  // AUDIO 
    socket.on('set-volume', (volume) => {
      socket.audio.volume = volume;
      console.log("Yeni ses seviyesi: " + socket.audio.volume);
      //socket.audio.emit();
    });
  //

  // EVENTS

    // 'mouse-move' emiti dinleyin
    socket.on('mouse-move', (data) => {
      //console.log(data);
      if(socket.screen && socket.screen.width && data){
        var mx = Math.floor(socket.screen.width / socket.screen.orginalW * (data.x-5));
        var my = Math.floor(socket.screen.height / socket.screen.orginalH * (data.y-5));
        socket.screen.setObject('mouseCursor',{type:'mouseCursor', x: mx, y: my, data:'randRgb'});
      }
    });
    // Mouse tıklama olaylarını dinleyin
    socket.on('mouse-click', (data) => {
      if(socket.screen && socket.screen.width && socket.screen.orginalW && data){
        data.x = Math.floor(socket.screen.width / socket.screen.orginalW * (data.x-5));
        data.y = Math.floor(socket.screen.height / socket.screen.orginalH * (data.y-5));
        console.log(`Mouse tıklama : ${data.x}_${data.y}_${data.button}`);
        socket.screen.clickDetector(data);
      }
    });

    // Klavye
    socket.on('key-down', (data) => {
      console.log('key-down', data);
      if(socket.screen && socket.screen.keyDownDetector && data && data.key){
        socket.screen.keyDownDetector(data.key);
      }
    });
    socket.on('key-up', (data) => {
      console.log('key-up', data);
      if(socket.screen && socket.screen.keyUpDetector && data && data.key){
        socket.screen.keyUpDetector(data.key);
      }
    });
  
  // EVENTS END


});

server.listen(8443, () => {
  console.log('HTTPS sunucusu ve Socket.IO 8443 portunu dinliyor.');
});
