const Jimp = require('jimp');
const sharp = require('sharp');
const fs = require('fs');
const ScreenObject = require('./ScreenObject');
const ImageDriver = require('./ImageDriverJimp');
//const ImageDriver = require('./ImageDriverSharp');
const BasicAnimation = require('./BasicAnimation');
const BasicApp = require('./BasicApp');

class Screen{
  constructor(socket, width, height) {
    this.active = true;

    this.width = width;
    this.height = height;
    this.objects = {};
    this.orderedObjects = [];
    this.animations = {};
    this.orderedAnimations = [];
    this.currentFrameBase64 = "";
    this.currentFrameNo = 0;
    this.cameraStreamBase64 = "";
    this.microphoneStreamBase64 = "";
    this.screenThemeColor = [0,0,0,0];
    this.waitForDraw = 0;
    this.refreshing = false;
    this.setCounter = 0;
    this.webpOutput = false;
    this.outputQuality = 90;

    this.apps = {};

    this.socket = socket;
    console.log(this.socket.id + " idli socket için " + this.width + "x" + this.height + " ölçülerinde yeni ekran oluşruldu.");
  }
  
  startStream() {
    console.log(this.socket.id + " idli socket için startStream çalıştı.");

    this.stream = true;
    this.drawFrame();
    this.emitFrame();
  }

  setObject(id, newData) {
    if(!this.objects[id]){
      this.objects[id] = new ScreenObject(id);
      this.orderedObjects.push(this.objects[id]);
    }
    this.objects[id].type = newData.type;
    this.objects[id].x = newData.x;
    this.objects[id].y = newData.y;
    this.objects[id].w = newData.w;
    this.objects[id].h = newData.h;
    this.objects[id].data = newData.data;
    this.objects[id].visible = true;
    if(newData.opacity >= 0 && newData.opacity < 1){
      this.objects[id].opacity = newData.opacity;
    }
    if(newData.onclick){
      this.objects[id].onclick = newData.onclick;
    }
    this.setCounter++;
  }

  removeObject(id) {
    if(this.objects[id]){
      //this.objects[id].visible = false;
      this.objects[id].clear();
      this.setCounter++;
    }
  }

  setAnimation(id, options){
    if(!options.screenObjects) return;

    if(!this.animations[id]){
      this.animations[id] = new BasicAnimation(id, this);
      this.orderedAnimations.push(this.animations[id]);
    }

    if(options.loop){
      this.animations[id].loop = options.loop;
    }
    if(options.speed){
      this.animations[id].speed = options.speed;
    }
    if(options.duration){
      this.animations[id].duration = options.duration;
    }

    this.animations[id].screenObjects = options.screenObjects;
    this.animations[id].enabled = true;
  }
  playAnimation(id){
    if(this.animations[id]){
      this.animations[id].play();
    }
  }

  async createImage(options){
    const newImage = new ImageDriver;
    await newImage.create(options);
    return newImage;
  }

  async readImageBase64(fileName){
    //console.log("Screen: async readImageBase64", fileName);
    const newImage = new ImageDriver;
    //console.log(newImage);
    return await newImage.readBase64(fileName);
  }
  
  async drawFrame(cb){    
    //console.log("--> drawFrame(" + this.setCounter + "):" + this.socket.id + " idli socket için çalıştı.");

    if(!this.active){
      console.log('<-- drawFrame durdu, screen pasif.');
      return false;
    }

    if(this.emitedFrameNo != this.setCounter /*newFrame.hash()*/){
      // Yeni resim oluşturun
      // this.width = 106;
      // this.height = 60;
      ////const newFrame = await Jimp.create(this.width, this.height, this.screenThemeColor);
      const newFrame = await this.createImage({
        width: this.width,
        height: this.height,
        background: this.screenThemeColor //[0,0,0,0] //r,g,b,a
      });

      //Jimp.create(this.width, this.height, this.screenThemeColor).then(image => {
        // Resmi işleyin ve değiştirin
      if(this.orderedObjects.length > 0){
        for (let i = 0; i < this.orderedObjects.length; i++) {
          var so = this.orderedObjects[i];
          if(so.visible && so.opacity>0){   
            switch(so.type){
                
              case 'mouseCursor':
                break;

              case 'tris':
                break;


              case 'box':
                await newFrame.box(so.x, so.y, so.w, so.h, so.data, so.opacity);
                break;

              case 'cam':
                if(so.data){
                  await newFrame.compositeBase64(so.data, so.x, so.y, so.w, so.h);
                  so.clear();
                }
                break;

              default:
                await newFrame.compositeBase64(so.data, so.x, so.y, so.w, so.h, so.opacity);
            }
          }
        }
      
        
        if(this.objects.mouseCursor){
          var so = this.objects.mouseCursor;  
          await newFrame.mouseCursor(so.x, so.y);
        }
        


        await newFrame['getBase64' + (this.webpOutput ? 'Webp' : '')]((buffer) => {
          //console.log("Screen: newFrame.getBase64((buffer)", buffer);
          this.currentFrameBase64 = buffer;
          this.currentFrameNo = this.setCounter; //newFrame.hash();
          //this.currentFrameNo = Math.random();
          if(cb)cb();
        }, this.outputQuality);

      }
      else{
        console.log("orderedObjects boş.")
      }


    }
    else{
      //console.log("hash aynı, boş emit gönder");
      this.currentFrameBase64 = "";
      this.currentFrameNo = this.setCounter;
      if(cb)cb();
    } 





    /*/
    const pixels = image.bitmap.data;
    for (let i = 0; i < pixels.length; i++) {
      pixels[i] = i % 255;
    }
    /*/

    /*/ PERFORMANS TESTİ
    for (var i = 0; i < pixels.length; i+=4) {
      pixels[i] = Math.floor(Math.random() * 256);
      pixels[i+1] = Math.floor(Math.random() * 256);
      pixels[i+2] = Math.floor(Math.random() * 256);
      pixels[i+3] = 255;
    }
    /*/

    // image.quality(1).write('image.png');

      

    //});
    //console.log("<-- drawFrame bitti.");

  }

  emitFrame(cb){
    //console.log('--> ' + this.socket.id + ' idli socket için emitFrame çalıştı.');

    if(!this.active){
      console.log('<-- emitFrame durdu, screen pasif.');
      return false;
    }

    if(!this.stream){
      console.log('<-- emitFrame stream durduruldu.');
      return false;
    }

    /*/
    if(this.currentFrameBase64 == ""){
      //console.log('<-- emitFrame başarısız, frame boş.');
      setTimeout(this.emitFrame.bind(this), 1000);
      return false;
    }

    if(this.currentFrameNo == this.emitedFrameNo){
      //console.log('<-- emitFrame başarısız, bu frame zaten gönderilmiş.');
      setTimeout(this.emitFrame.bind(this), 1000);
      return false;
    }

    if(this.waitForEmit > 0){
      console.log('<-- emitFrame başarısız, bekleme süresi var: ' + this.waitForEmit);
      this.waitForEmit -= 10;
      setTimeout(this.emitFrame.bind(this), 10);
      return false;
    }
    /*/

    this.socket./*to('screen').*/emit('refresh-screen', this.currentFrameBase64);
    this.emitedFrameNo = this.currentFrameNo;
  }

  remove(){
    console.log("Screen remove");
    this.active = false;
    this.currentFrameBase64 = "";
    this.cameraStreamBase64 = "";
    this.microphoneStreamBase64 = "";
    for(var appId in this.apps){
      clearInterval(this.apps[appId].intervalId);
    }
  }

  clickDetector(data) {
    //console.log(data);
    for (var i = this.orderedObjects.length - 1; i >= 0; i--) {
      var so = this.orderedObjects[i];      
      if(so.type != 'mouseCursor' && data.x > so.x && data.x < (so.x+so.w) && data.y > so.y && data.y < (so.y+so.h)){
        if(so.onclick){
          so.onclick(so, data);
        }
        else{
          console.log("İşlevsiz objeye tıklandı. ",so.id);
        }
        break;
      }
    }
  }


  keyDownDetector(key) {
    //console.log('keyDownDetector() çalıştı.');
    for(var appId in this.apps){
      if(this.apps[appId].enabled && this.apps[appId].onKeyDown){
        this.apps[appId].onKeyDown(key);
      }
    }
  }
  keyUpDetector(key) {
    //console.log('keyUpDetector() çalıştı.');
    for(var appId in this.apps){
      if(this.apps[appId].enabled && this.apps[appId].onKeyDown){
        this.apps[appId].onKeyUp(key);
      }
    }
  }

  loadApp(appId){
    if(!global.apps[appId]){
      global.apps[appId] = require('./../apps/'+appId+'/'+appId+'.js');
      console.log(appId + " idli uygulamanın çekirdeği yüklendi.", global.apps[appId]);
    }
    else{
      console.log("Uygulama çekirdeği zaten yüklenmiş.");
    }

    if(!this.apps[appId]){
      this.apps[appId] = new global.apps[appId](this);
    }
    else{
      console.log("Uygulama daha önce bu ekrana yüklenmiş.");
      this.apps[appId].clear();
    }

    if(this.apps[appId].enabled == true){
      this.apps[appId].start();
      this.apps[appId].render();
      //this.apps[appId].update();
      this.apps[appId].intervalId = setInterval(function(){
        this.update();
        this.render();
      }.bind(this.apps[appId]),(1000/30) * (100/this.apps[appId].speed));
    }
  }

  loadAppWithAssetId(assetId){
    var dataText = fs.readFileSync('/var/www/ezis/asset/1000/8.dat').toString();
    var data = JSON.parse(dataText);
    var appId = assetId;

    //if(!global.apps[appId]){
      this.apps[appId] = new BasicApp(appId, this);
      if(data.width){
        this.apps[appId].width = data.width;
      }
      if(data.height){
        this.apps[appId].height = data.height;
      }
      this.apps[appId].bgColor = data.bgColor;
      this.apps[appId].speed = data.speed;
      console.log(appId + " idli uygulamanın çekirdeği yüklendi.");
    //}
    //else{
    //  console.log("Uygulama çekirdeği zaten yüklenmiş.");
    //}

    if(this.apps[appId].enabled == true){
      //this.apps[appId].start();
      this.apps[appId].render();
      //this.apps[appId].update();
      this.apps[appId].intervalId = setInterval(function(){
        //this.apps[appId].update();
        this.apps[appId].render();
      }.bind(this.apps[appId]),(1000/30) * (100/this.apps[appId].speed));
    }

    this.apps[appId].onKeyUp = (key) => {
      console.log(this.name + " KEY UP " + key);
      if(key == "Escape"){
        //this.loadApp('desktop');
        //this.apps[appId].exit();
      }
    }

  }

  hexToRgba(hex) {
    if(hex.length == 7){
      hex += 'FF';
    }
    // Hexadecimal renk kodunu 6 haneli bir diziye dönüştürür
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);

    // Dönüştürülen diziyi RGB değerlerine ayrıştırır
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    var a = parseInt(result[4], 16);

    // RGB değerlerini bir obje olarak döndürür
    return [ r, g, b, a ];
  }

}

module.exports = Screen;
