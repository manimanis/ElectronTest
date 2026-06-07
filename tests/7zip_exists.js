const sevenZip = require('7zip-bin')
const fs = require('fs')
const path = require("path")

function get7ZipPath() {
    let sevenZipPath = sevenZip.path7za
    sevenZipPath = "C:\\Users\\Cyberbox\\AppData\\Local\\Temp\\3EluUp4YRGlMskYcSDuMMzx5bGt\\resources\\app.asar\\node_modules\\7zip-bin\\win\\x64\\7za.exe"
  
    sevenZipPath = sevenZipPath.replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`)
  
    return sevenZipPath
  }

console.log(get7ZipPath())
console.log(path.sep)
