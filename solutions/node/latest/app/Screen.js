const Jimp = require('jimp');
const sharp = require('sharp');
const fs = require('fs');
const ScreenObject = require('./ScreenObject');
const ImageDriver = require('./ImageDriverJimp');
//const ImageDriver = require('./ImageDriverSharp');
const BasicAnimation = require('./BasicAnimation');
const PerlinNoise = require('./PerlinNoise');

class Screen{
  constructor(socket, width, height) {
    this.active = true;
    this.testScreen = true;

    this.width = width;
    this.height = height;
    this.objects = {};
    this.orderedObjects = [];
    this.pixels = null;
    this.animations = {};
    this.orderedAnimations = [];
    this.temp = {};
    this.currentFrameBase64 = "";
    this.currentFrameNo = 0;
    this.cameraStreamBase64 = "";
    this.microphoneStreamBase64 = "";
    this.screenThemeColor = [0,0,0,0];
    this.waitForDraw = 0;
    this.refreshing = false;
    this.maxFps = 60;
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
    this.clearPixels();
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


      if(this.testScreen){
        this.drawTest();
      }


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


      //for(var x in this.pixels){
        //for(var y in this.pixels[x]){
          //newFrame.px(x,y,this.pixels[x][y],this.width,this.height);
        //}
      //}

      //console.log(this.pixels);
      /*/
      for (let i = 0; i < this.pixels.length; i+3) {
        if(this.pixels[i]>0){
          console.log("i:"+i, "rgb:",[this.pixels[i],this.pixels[i+1],this.pixels[i+2]]);
        }
        //console.log("x:"+(i % this.width) +" y:"+)
      }
      /*/
      
      if(this.objects.mouseCursor){
        let x = this.objects.mouseCursor.x;
        let y = this.objects.mouseCursor.y;

        let rnd = Math.ceil(Math.random()*180);
        this.drawTris( x,y, x+7,y+6, x+4,y+12, [255,255,255], [255,rnd,rnd] ) //x1, y1, x2, y2, x3, y3, clr

        /*
        for(let i=x; i<=x+10; i++){
          for(let j=y; j<=y+10; j++){
            if(this.isInsideTriangle( i,j,  x,y,  x+7,y+6,  x+4,y+12 )){
              let rnd = Math.random()*80;
              this.px(i,j,[255,rnd,rnd]);
            }
          }
        }

        this.drawLine(x, y, x+7, y+6, [0,255,255]);
        this.drawLine(x+7, y+6, x+4, y+12, [0,255,255]);
        this.drawLine(x+4, y+12, x, y, [0,255,255]);
        */
      }

      newFrame.fillRgbPixels(this.pixels);
      this.clearPixels();

      /*      
      if(this.objects.mouseCursor){
        var so = this.objects.mouseCursor;  
        await newFrame.mouseCursor(so.x, so.y);
      }
      */

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

  drawTest(){
    if(!this.temp.testCounter){
      this.temp.testCounter = 0;
    }
    this.temp.testCounter++;

    if(!this.temp.testSwitcher){
      this.temp.testSwitcher = 1;
    }
    if(this.temp.testCounter % 180 == 0){
      this.temp.testSwitcher++;
    }


    let names = ["", "bresenham_lines", "running_1", "color_palette", "running_2", "perlin_noise"];
    if(this.temp.testSwitcher>=names.length){
      this.temp.testSwitcher = 1;
    }

    this.bgEffect(names[this.temp.testSwitcher]);
  }

  bgEffect(name){
    switch(name){

      case "running_1":
        this.setCounter+=5;
        var r = this.setCounter % 255;
        var g = r + 30;
        var b = g + 30;
        for (var y = 1; y <= this.height; y++) {
          for (var x = 1; x <= this.width; x++) {
            r+=Math.ceil(Math.random()*3);
            if(r>255) r = 0;
            g+=Math.ceil(Math.random()*3);
            if(g>255) g = 0;
            b+=Math.ceil(Math.random()*3);
            if(b>255) b = 0;
            this.px(x,y,[r, g, b]);
          }
        }
        break;

      case "running_2":
        this.setCounter+=5;
        var r = this.setCounter % 255;
        var g = r + 30;
        var b = g + 30;
        for (var y = 1; y <= this.height; y++) {
          for (var x = 1; x <= this.width; x++) {
            r+=Math.ceil(Math.random()*5);
            if(r>255) r = 0;
            g+=Math.ceil(Math.random()*5);
            if(g>255) g = 0;
            b+=Math.ceil(Math.random()*5);
            if(b>255) b = 0;
            this.px(x,y,[r, g, b]);
          }
        }
        break;

      case "color_palette":
        this.setCounter+=1;
        var r = this.setCounter % 255;
        var g = r + 30;
        var b = g + 30;
        for (var y = 1; y <= this.height; y++) {
          for (var x = 1; x <= this.width; x++) {
            r+=3;
            if(r>255) r = 0;
            g+=2;
            if(g>255) g = 0;
            b+=1;
            if(b>255) b = 0;
            this.px(x,y,[r, g, b]);
          }
        }
        //console.log(this.pixels);
        break;

      case "bresenham_lines":
        this.setCounter++;
        this.drawLine(Math.ceil(Math.random()*this.width), Math.ceil(Math.random()*this.height), Math.ceil(Math.random()*this.width), Math.ceil(Math.random()*this.height), [0,255,0,255] );
        break;

      case "perlin_noise":
        this.setCounter++;
        const perlin = new PerlinNoise();
        for (let y = 1; y <= this.height; y++) {
            for (let x = 1; x <= this.width; x++) {
                const value = perlin.noise(x / 50, y / 50);
                const color = Math.floor((value + 1) * 128);  // -1 to 1 -> 0 to 255
                this.px(x,y,[color,color,color]);
            }
        }
        break;

      case "px_test":
        this.setCounter++;
        this.px(1,1,[255,3,2]);
        this.px(2,1,[255,3,2]);
        this.px(1,2,[255,3,2]);
        this.px(2,2,[255,3,2]);
        break;

    }
  }

  drawLine(x0, y0, x1, y1, clr) {
    // Bresenham
    let dx = Math.abs(x1 - x0);
    let dy = Math.abs(y1 - y0);
    let sx = (x0 < x1) ? 1 : -1;
    let sy = (y0 < y1) ? 1 : -1;
    let err = dx - dy;

    while(true) {
        this.px(x0, y0, clr);
        if (x0 === x1 && y0 === y1) break;
        let e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x0 += sx; }
        if (e2 < dx) { err += dx; y0 += sy; }
    }
  }

  floodFill(x, y, newColor, oldColor) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;

    const index = ((y-1) * this.width + (x-1)) * 3;
    if ([this.pixels[index], this.pixels[index+1], this.pixels[index+2]] !== oldColor) return;
    
    this.px(x, y, newColor);
    
    floodFill(x + 1, y, newColor, oldColor);
    floodFill(x - 1, y, newColor, oldColor);
    floodFill(x, y + 1, newColor, oldColor);
    floodFill(x, y - 1, newColor, oldColor);
  }

  isInsideTriangle(x, y, x1, y1, x2, y2, x3, y3) {
    var area = 0.5 * (-y2 * x3 + y1 * (-x2 + x3) + x1 * (y2 - y3) + x2 * y3);
    var s = 1 / (2 * area) * (y1 * x3 - x1 * y3 + (y3 - y1) * x + (x1 - x3) * y);
    var t = 1 / (2 * area) * (x1 * y2 - y1 * x2 + (y1 - y2) * x + (x2 - x1) * y);
    return s > 0 && t > 0 && 1 - s - t > 0;
  }

   // Üçgen çizen fonksiyon
  drawTris(x1, y1, x2, y2, x3, y3, clrLine, clrFill) {
    
    // İçini doldur
    if(clrFill){
      this.fillTris(x1, y1, x2, y2, x3, y3, clrFill);
    }

    // Üçgenin kenarlarını çiz
    if(clrLine){
      this.drawLine(x1, y1, x2, y2, clrLine);
      this.drawLine(x2, y2, x3, y3, clrLine);
      this.drawLine(x3, y3, x1, y1, clrLine);
    }
  }

  // Üçgenin içini dolduran fonksiyon
  fillTris(x1, y1, x2, y2, x3, y3, clr) {

      // Üçgenin köşe noktalarını y koordinatlarına göre sırala
      if (y1 > y2) { [x1, y1, x2, y2] = [x2, y2, x1, y1]; }
      if (y2 > y3) { [x2, y2, x3, y3] = [x3, y3, x2, y2]; }
      if (y1 > y2) { [x1, y1, x2, y2] = [x2, y2, x1, y1]; }

      // Çizim yaparken kullanacağımız yardımcı değişkenler
      let totalHeight = y3 - y1;

      for (let i = 0; i < totalHeight; i++) {
          let secondHalf = i > y2 - y1 || y2 === y1;
          let segmentHeight = secondHalf ? y3 - y2 : y2 - y1;
          let alpha = i / totalHeight;
          let beta = (i - (secondHalf ? y2 - y1 : 0)) / segmentHeight;

          let ax = x1 + (x3 - x1) * alpha;
          let ay = y1 + i;
          let bx = secondHalf ? x2 + (x3 - x2) * beta : x1 + (x2 - x1) * beta;
          let by = y1 + i;

          if (ax > bx) { [ax, bx] = [bx, ax]; }

          for (let j = ax; j <= bx; j++) {
              //console.log(j, ay, clr);
              this.px(j, ay, clr);
          }
      }
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

  clearPixels(){
    this.pixels = new Uint8Array(this.width * this.height * 3);
  }

  px(x,y,rgb){
    x=Math.ceil(x);
    y=Math.ceil(y);

    const index = ((y-1) * this.width + (x-1)) * 3;
    //console.log(index);
    this.pixels[index] = rgb[0];
    this.pixels[index+1] = rgb[1];
    this.pixels[index+2] = rgb[2];
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

  mixColors(color1, color2, ratio = 0.5) {
    return [
        Math.round(color1[0] * (1 - ratio) + color2[0] * ratio),
        Math.round(color1[1] * (1 - ratio) + color2[1] * ratio),
        Math.round(color1[2] * (1 - ratio) + color2[2] * ratio)
    ];
  }

}

module.exports = Screen;
