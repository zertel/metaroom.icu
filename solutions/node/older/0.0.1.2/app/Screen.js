const Jimp = require('jimp');
const sharp = require('sharp');
const fs = require('fs');
const ScreenObject = require('./ScreenObject');
const ImageDriver = require('./ImageDriverJimp');
//const ImageDriver = require('./ImageDriverSharp');
const BasicAnimation = require('./BasicAnimation');

class Screen{
  constructor(socket, width, height) {
    this.active = true;

    this.width = width;
    this.height = height;
    this.objects = {};
    this.orderedObjects = [];
    this.pixels = {};
    this.animations = {};
    this.orderedAnimations = [];
    this.currentFrameBase64 = "";
    this.currentFrameNo = 0;
    this.cameraStreamBase64 = "";
    this.microphoneStreamBase64 = "";
    this.screenThemeColor = [0,0,0,0];
    this.waitForDraw = 0;
    this.refreshing = false;
    this.maxFps = 20;
    this.setCounter = 0;
    this.outputOptions = {
      format: "webp",
      quality: 1,
      //lossless: true,
      effort: 6 //0-6 zip step
    };

    this.apps = {};

    this.socket = socket;
    console.log(this.socket.id + " idli socket için " + this.width + "x" + this.height + " ölçülerinde yeni ekran oluşruldu.");

    //this.loadApp('welcome')
  }
  
  startStream() {
    //console.log(this.socket.id + " idli socket için startStream çalıştı.");

    this.stream = true;
    this.drawFrame();
    this.emitFrame();

    setTimeout((function(){
      this.startStream();
    }).bind(this),1000/this.maxFps);
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
      //console.log('<-- drawFrame durdu, screen pasif.');
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
                newFrame.drawTris(so.data.x1, so.data.y1, so.data.x2, so.data.y2, so.data.x3, so.data.y3, so.data.color);
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

      }
      //else{
      //  console.log("orderedObjects boş.")
      //}


      for(var x in this.pixels){
        for(var y in this.pixels[x]){
          newFrame.px(x,y,this.pixels[x][y],this.width,this.height);
        }
      }
      this.pixels = {};

      if(this.objects.mouseCursor){
        var so = this.objects.mouseCursor;  
        await newFrame.mouseCursor(so.x, so.y);
      }

      await newFrame.getBase64(this.outputOptions, (buffer) => {
        //console.log("Screen: newFrame.getBase64((buffer)", buffer);
        this.currentFrameBase64 = buffer;
        this.currentFrameNo = this.setCounter; //newFrame.hash();
        //this.currentFrameNo = Math.random();
        if(cb)cb();
      });

    }
    else{
      //console.log("hash aynı, boş emit gönder");
      this.currentFrameBase64 = "";
      this.currentFrameNo = this.setCounter;
      if(cb)cb();
    } 


    //console.log("<-- drawFrame bitti.");

  }

  emitFrame(cb){
    //console.log('--> ' + this.socket.id + ' idli socket için emitFrame çalıştı.');

    if(!this.active){
      //console.log('<-- emitFrame durdu, screen pasif.');
      return false;
    }

    if(!this.stream){
      //console.log('<-- emitFrame stream durduruldu.');
      return false;
    }


    if(this.currentFrameBase64.length > 0){      
      if(this.outputOptions.quality > 1 && this.currentFrameBase64.length > 22 * 1024){
        this.outputOptions.quality -= 10;
        if(this.outputOptions.quality < 1){
          this.outputOptions.quality = 1;
        }
        console.log(this.currentFrameBase64.length,'--> boyut çok büyük, kaliteyi düşür. ',this.outputOptions.quality);
        return false;
      }
      else if(this.outputOptions.quality < 80 && this.currentFrameBase64.length < 4 * 1024){
        this.outputOptions.quality += 10;
        if(this.outputOptions.quality > 80){
          this.outputOptions.quality = 80;
        }
        console.log(this.currentFrameBase64.length,'--> boyut çok küçük, kaliteyi yükselt. ',this.outputOptions.quality);
        return false;
      }
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

  loadApp(appName){
    const appLoader = new AppLoader;
    appLoader.loadWithDb(this, appName);
  }

  px(x,y,rgba){
    if(!this.pixels[x]){
      this.pixels[x] = {};
    }
    this.pixels[x][y] = rgba;
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
