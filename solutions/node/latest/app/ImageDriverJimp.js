const Jimp = require('jimp');
const sharp = require('sharp'); // webp çıktısı için

class ImageDriverJimp {
  constructor(options){
    //this.base64Temp = "";
    this.jimpImage = null;
  }
  async create(options){
    //console.log("async create", options);
    this.options = options;
    this.jimpImage = await Jimp.create(options.width, options.height, this.color(options.background));
  }
  async readBase64(fileName){
    //console.log("ImageDriverJimp: async readBase64", fileName);
    var jimpImage = await Jimp.read(fileName);
    //console.log("jimpImage", jimpImage);
    return await jimpImage.getBase64Async('image/png');
  }

  async compositeBase64(bufferBase64, x, y, w, h, opacity){
    if(!bufferBase64) return;
    //console.log("async compositeBase64", x, y, w, h, opacity)
    var imageData = bufferBase64.split(',')[1];
    var altBuffer = Buffer.from(imageData, 'base64');
    var altImage = await Jimp.read(altBuffer);
    if(w || h){
      altImage.resize(w, h);
    }
    if(opacity >= 0 && opacity<1){
      altImage.opacity(opacity);
    }
    await this.jimpImage.composite(altImage, x, y);
  }

  async getBase64Webp(cb, quality){
    await this.jimpImage.getBuffer('image/png',async (err, buffer)=>{
      const webpOptions = quality < 100 ? {quality:quality} : {lossless:true}
      await sharp(buffer).webp(webpOptions).toBuffer().then((bigImageBuffer) => {
        const base64Image = 'data:image/webp;base64,' + bigImageBuffer.toString('base64');
        cb(base64Image);
      });
    });
  }

  async getBase64(cb){
    //console.log("ImageDriverJimp: async getBase64");

    //await this.getBase64Sharp(cb);

    cb(await this.jimpImage.getBase64Async('image/png'));
  }

  async box(x, y, w, h, rgba){
    var box = await Jimp.create(w, h, this.color(rgba));
    await this.jimpImage.composite(box, x, y);
  }


  // Bir noktanın üçgen içinde olup olmadığını kontrol eden işlev 
  isInsideTriangle(x, y, x1, y1, x2, y2, x3, y3) {
    var area = 0.5 * (-y2 * x3 + y1 * (-x2 + x3) + x1 * (y2 - y3) + x2 * y3);
    var s = 1 / (2 * area) * (y1 * x3 - x1 * y3 + (y3 - y1) * x + (x1 - x3) * y);
    var t = 1 / (2 * area) * (x1 * y2 - y1 * x2 + (y1 - y2) * x + (x2 - x1) * y);
    return s > 0 && t > 0 && 1 - s - t > 0;
  }

  async mouseCursor(x,y){
    const fillColor = 0x00FF0099 + Math.ceil(Math.random()*100); 
    const fillColor2 = 0x00AA00ff;
    await this.jimpImage.scan(x, y, 130, 130, (_x, _y, idx) => {
        if (this.isInsideTriangle(_x, _y, x+1, y+1, x+7, y+6, x+4, y+12)) {
            this.jimpImage.bitmap.data[idx] = (fillColor2 >> 24) & 0xFF; // R
            this.jimpImage.bitmap.data[idx + 1] = (fillColor2 >> 16) & 0xFF; // G
            this.jimpImage.bitmap.data[idx + 2] = (fillColor2 >> 8) & 0xFF; // B
            this.jimpImage.bitmap.data[idx + 3] = fillColor2 & 0xFF; // A
        }
        if (this.isInsideTriangle(_x, _y, x, y, x+12, y+7, x+5, y+8)) {
            this.jimpImage.bitmap.data[idx] = (fillColor >> 24) & 0xFF; // R
            this.jimpImage.bitmap.data[idx + 1] = (fillColor >> 16) & 0xFF; // G
            this.jimpImage.bitmap.data[idx + 2] = (fillColor >> 8) & 0xFF; // B
            this.jimpImage.bitmap.data[idx + 3] = fillColor & 0xFF; // A
        }
    });
  }

  color(rgba){

    if(rgba == 'randRgb'){
      rgba = [
        Math.floor(Math.random()*256),
        Math.floor(Math.random()*256),
        Math.floor(Math.random()*256),
        255
      ]
    }
    else if(typeof rgba == 'string'){
      rgba = this.hexToRgba(rgba);
    }
    else if(typeof rgba == 'object' && rgba.length < 3){
      rgba = [255, 255, 255, 255];
    }
    else if(typeof rgba == 'object' && rgba.length < 4){
      rgba[3] = 255;
    }
    else{
      rgba = [0, 0, 0, 0];
    }
    
    return Jimp.rgbaToInt(rgba[0],rgba[1],rgba[2],rgba[3]);

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
    const a = parseInt(result[4], 16);

    // RGB değerlerini bir obje olarak döndürür
    return [ r, g, b, a ];
  }
}

module.exports = ImageDriverJimp;
