class ScreenObject {
  constructor(id) {
    this.id = id;
    this.clear();
  }
  clear(){
    this.x = 0;
    this.y = 0;
    this.w = 0;
    this.h = 0;
    this.data = "";
    this.type = "";
    this.opacity = 1;
    this.visible = false;
    this.onclick = null;
  }
}

module.exports = ScreenObject;
