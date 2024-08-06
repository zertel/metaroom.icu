const fs = require('fs');
const path = require('path');
const { PassThrough } = require('stream');
const ffmpeg = require('fluent-ffmpeg');
const AudioObject = require('./AudioObject');

class Audio{
  constructor(socket) {
    this.socket = socket;
    this.volume = 0;
    this.audioChunkBase64 = "";
    this.micStreamBase64 = "";
    this.objects = {};
    this.working = false;

    console.log(this.socket.id + " idli socket için yeni ses yöneticisi oluşruldu. Volume:" + this.volume);
    
    //setInterval(this.make.bind(this),400);
  }

  setObject(id, newData) {
    if(!this.objects[id]){
      this.objects[id] = new AudioObject(id);
      this.objects[id].type = newData.type;
    }

    if(newData.data){
      this.objects[id].data = newData.data;
      this.objects[id].dataBuff = Buffer.from(newData.data.split(',')[1],'base64');
    }
    //console.log(this.objects[id].type,this.objects[id].dataBuff);
    /*/
    switch(this.objects[id].type){
      case 'mic':
        if(newData.data){
          if(!this.objects[id].datas){
            this.objects[id].datas = [];
          }
          this.objects[id].datas.push(newData.data.split(',')[1])
          /*/
          /*/
          if(this.objects[id].data){
            var oldData = this.objects[id].data.split(',');
            var oldBuff = Buffer.from(oldData[1], 'base64');

            var newData = newData.data.split(',');
            var newBuff = Buffer.from(newData[1], 'base64');

            var arr = [oldBuff, newBuff];
            var mergedBuff = Buffer.concat(arr);
            this.objects[id].data = 'data:audio/webm;codecs=opus;base64,' + mergedBuff.toString("base64");
          }
          else{
            console.log("====== ÖNCE YAZ =============");
            this.objects[id].data = newData.data;
          }
          /*/
          /*/
          console.log(this.objects[id].datas.length);
        }
        else{
          this.objects[id].data = "";
          console.log("mic data boş, temizle.");
        }
        break;

      default:
        this.objects[id].data = newData.data;
    }
    /*/
  }

  mix(newAudioBase64, cb){
    console.log("Audio mix çalıştı.");

    if(newAudioBase64 && typeof newAudioBase64 == 'string'){

      console.log("Birleştir temp:", this.audioChunkBase64.length, 'new:', newAudioBase64.length);
      
      if(newAudioBase64.indexOf(',')<0){
        newAudioBase64 = 'data:audio/webm;base64,' + newAudioBase64;
      }

      this.outputStream = new PassThrough();
      this.outputStream.on('end',()=>{
        console.log("--- outputStream işi bitti. ------------------------");
        this.emit();
        this.working = false;
      });

      //console.log(newAudioBase64);

      var ffm = ffmpeg();

      if(this.audioChunkBase64){
        ffm.input(this.audioChunkBase64)
        .complexFilter(['[0:a]volume=1[a0]', '[1:a]volume=1[a1]', '[a0][a1]amix=inputs=2:duration=first']); // first sortest longest
        console.log("ESKİ DOSYA:", this.audioChunkBase64.split(',')[0]);
      }

      console.log(newAudioBase64.split(',')[0]);
      
      ffm.input(newAudioBase64)
      .format('mp3')
      .on('error', function(err) {
        console.log('Ses birleştirirken bir sorunla karşılaşıldı: ' + err.message);
      })
      .on('end', cb.bind(this))
      //.save('mic-output.mp3');
      .writeToStream(this.outputStream, function(retcode, signal) {
        console.log('Stream, ' + retcode + ' kodu ve ' + signal + ' sinyaliyle bitti.');
      });
      
    }
    else{
      console.log("Audio mix iptal edildi. Yeni ses dosyasının verisi boş.");
      this.working = false;
    }
  }

  make(){
    if(this.working == false){

      console.log("Audio make çalıştı.");

      if(this.volume <= 0){
        console.log('<-- Audio make iptal, ses kapalı.');
        return false;
      }

      if(!this.objects){
        console.log('<-- Audio make iptal, hiç ses objesi tanımlanmamış.');
        return false;
      }

      this.audioChunkBase64 = '';
      this.working = true;

      for(var oid in this.objects){
        console.log(oid +" i birleştir");
        if(this.objects[oid].data || this.objects[oid].datas){

          if(this.objects[oid].datas){
            console.log("DATAS dolu.", oid);
            var arr = [];
            for (var i = 0; i < this.objects[oid].datas.length; i++) {
              arr.push(Buffer.from(this.objects[oid].datas[i], 'base64'));
            }
            console.log("ARR: ",arr.length);
            var mergedBuff = Buffer.concat(arr);
            this.objects[oid].data = 'data:audio/webm;codecs=opus;base64,' + mergedBuff.toString("base64");
            this.objects[oid].datas = [];
          }

          this.mix(this.objects[oid].data, function(){
            const buffer = this.outputStream.read();
            if(buffer){
              this.audioChunkBase64 = 'data:audio/webm;base64,' + buffer.toString('base64');
              this.currentChunkNo = Math.random();
              console.log("--- ffmpeg mix bitti", this.currentChunkNo);
              this.objects[oid].data = "";
            }
          });
        }
        else{
          console.log("--- ses objesi boş.");
        }
      }

    }
    else{
      console.log("Audio make çalışamadı! MIX bitmemiş.");
    }

    /*/
      var newSound = fs.readFileSync('/var/www/npmdnm/mic-stream-1.base64', 'utf8');
      if(!this.micStreamBase64) return 0;

      this.mix(this.audioChunkBase64,this.micStreamBase64,function(){
        console.log("ffmpeg bg mix bitti");
        // OutputStream is a writable stream that stores the data in RAM
        const buffer = this.outputStream.read();
        // Convert the buffer to base64 data
        this.audioChunkBase64 = 'data:audio/webm;base64,' + buffer.toString('base64');
        this.currentChunkNo = Math.random();
        //console.log(base64Data);
        this.mix(this.audioChunkBase64, this.micStreamBase64,function(){
          console.log("ffmpeg mic mix bitti");
          // OutputStream is a writable stream that stores the data in RAM
          const buffer = this.outputStream.read();
          // Convert the buffer to base64 data
          this.audioChunkBase64 = buffer.toString('base64');

          //this.audioChunkBase64 = this.micStreamBase64;
          this.currentChunkNo = Math.random();
          console.log(base64Data);
        }.bind(this));
      });
    /*/
    
  }
  
  makeChunk(){

    if(this.working == false){

      console.log("Audio make CHUNK çalıştı.");

      if(this.volume <= 0){
        console.log('<-- Audio make CHUNK iptal, ses kapalı.');
        return false;
      }

      if(!this.objects){
        console.log('<-- Audio make CHUNK iptal, hiç ses objesi tanımlanmamış.');
        return false;
      }

      this.audioChunkBase64 = '';
      this.working = true;

      var piecesArr = [];
      let chunkIndex = 0;
      const chunkSize = 4096;
      for(var oid in this.objects){
        console.log(oid +"'den CHUNK AL");
        if(this.objects[oid].dataBuff){
          piecesArr.push(this.objects[oid].dataBuff.slice(chunkIndex * chunkSize, (chunkIndex + 1) * chunkSize));
        }
      }
      //console.log(typeof this.objects[oid].dataBuff);
      //this.objects[oid].dataBuff = this.objects[oid].dataBuff.slice((chunkIndex + 1) * chunkSize);
      //console.log(typeof this.objects[oid].dataBuff);
      chunkIndex++;

      console.log(piecesArr.length, "adet", piecesArr);

      if(piecesArr){
        if(piecesArr.length == 1){
          this.audioChunkBase64 = 'data:audio/webm;base64,' + piecesArr[0].toString('base64');
          this.currentChunkNo = Math.random();
          this.emit();
        }
      }

      //--------------------- ENCODER -----------------------//

      /*/
      this.outputStream = new PassThrough();
      this.outputStream.on('end',()=>{
        console.log("--- CHUNK outputStream işi bitti. ------------------------");
        this.emit();
        this.working = false;
      });
      var ffm = ffmpeg();

      if(this.audioChunkBase64){
        ffm.input(this.audioChunkBase64)
        .complexFilter(['[0:a]volume=1[a0]', '[1:a]volume=1[a1]', '[a0][a1]amix=inputs=2:duration=first']); // first sortest longest
        console.log("ESKİ DOSYA:", this.audioChunkBase64.split(',')[0]);
      }

      console.log(newAudioBase64.split(',')[0]);
      
      ffm.input(newAudioBase64)
      .format('mp3')
      .on('error', function(err) {
        console.log('Ses birleştirirken bir sorunla karşılaşıldı: ' + err.message);
      })
      .on('end', cb.bind(this))
      //.save('mic-output.mp3');
      .writeToStream(this.outputStream, function(retcode, signal) {
        console.log('Stream, ' + retcode + ' kodu ve ' + signal + ' sinyaliyle bitti.');
      });
      /*/


    }
    else {
      console.log('<-- Audio make CHUNK önceki işlem henüz bitmemiş.');
      return false;
    }
  }

  emit(){
    console.log("Audio emit çalıştı.");
    if(!this.volume){
      console.log('<-- audio emit iptal, ses kapalı.');
      return false;
    }

    if(this.currentChunkNo == this.emitedChunkNo){
      console.log('<-- audio emit başarısız, bu ses zaten gönderilmiş.');
      //setTimeout(this.emitFrame.bind(this), 1000);
      return false;
    }

    if(this.audioChunkBase64 != ""){
      if(this.audioChunkBase64 != ""){
        this.socket.emit('play-sound',{
          audioChunkBase64: this.audioChunkBase64, 
          volume:this.volume
        });
        console.log('EMITED: play-sound');
        //console.log(this.audioChunkBase64);
        this.emitedChunkNo = this.currentChunkNo;
        this.working = false;
      }
      else{
        console.log('play-sound emiti iptal edildi, veri boş.');
      }
    }
    else{
      console.log('play-sound emiti iptal edildi, volume değeri sıfır.');
    }
  }
}

module.exports = Audio;
