class AudioObject {
  constructor(id) {
    this.id = id;
    this.data = "";
    this.type = "";
  }
  clear(){
    this.data = "";
  }
}

module.exports = AudioObject;
