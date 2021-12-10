const WebTorrent = require('webtorrent')
const {WebProperty, verify} = require('webproperty/lookup.js')
const fs = require('fs')
const path = require('path')
const EventEmitter = require('events').EventEmitter

let storage = null
let atStart = null
let atLoad = null
let check = null
let webtorrent = null
let webproperty = null
let clean = null

async function startUp(self){
    if(atStart){
        let dirs = await new Promise((resolve, reject) => {
            fs.readdir(storage, {withFileTypes: true}, (error, data) => {
                if(error){
                    self.emit('error', error)
                    reject([])
                } else if(data){
                    resolve(data)
                } else if(!data){
                    reject([])
                }
            })
        })
        if(atStart.clear){
            for(let i = 0;i < dirs.length;i++){
                await new Promise((resolve, reject) => {
                    fs.rm(storage + path.sep + dirs[i], {recursive: true, force: true}, error => {
                        if(error){
                            self.emit('error', error)
                            reject(false)
                        } else {
                            resolve(true)
                        }
                    })
                })
            }
        } else if(atStart.share){
            for(let i = 0;i < dirs.length;i++){
                await new Promise((resolve) => {
                    webtorrent.seed(storage + path.sep + dirs[i], {destroyStoreOnDestroy: clean}, torrent => {
                        torrent.address = dirs[i]
                        resolve(torrent)
                    })
                })
            }
        }
        dirs = null
    }
}

class TorrentProperty extends EventEmitter {
    constructor(opt){
        super()
        if(!opt){
            opt = {}
            opt.storage = path.resolve('./storage')
            opt.start = {clear: true, share: false}
            opt.load = false
            opt.check = false
            opt.clean = false
        } else {
            if(!opt.storage){
                opt.storage = path.resolve('./storage')
            }
            if(!opt.start){
                opt.start = {clear: true, share: false}
            }
            if(!opt.load){
                opt.load = false
            }
            if(!opt.check){
                opt.check = false
            }
            if(!opt.clean){
                opt.clean = false
            }
        }
        storage = path.resolve(opt.storage)
        atStart = opt.start
        atLoad = opt.load
        check = opt.check
        clean = opt.clean
        webtorrent = new WebTorrent({dht: {verify}})
        webproperty = new WebProperty({dht: this.webtorrent.dht, check: this.check})
        if(!fs.existsSync(this.storage)){
            fs.mkdirSync(this.storage)
        }
        this.webproperty.on('error', error => {
            this.emit('error', error)
        })
        this.webtorrent.on('error', error => {
            this.emit('error', error)
        })
        startUp(this).catch(error => {
            this.emit('error', error)
        })
    }

    keepActive(address, callback){
        if(!callback || typeof(callback) !== 'function'){
            callback = function(){}
        }
        this.webproperty.current(address, (error, data) => {
            if(error){
                return callback(error)
            } else {
                return callback(null, data)
            }
        })
    }
    load(address, callback){
        if(!callback){
            callback = () => {}
        }
        if(this.atLoad){
            for(let i = 0;i < this.webtorrent.torrents.length;i++){
                this.webtorrent.remove(this.webtorrent.torrents[i].infoHash, {destroyStore: clean})
            }
        }
        this.webproperty.resolve(this.webproperty.addressFromLink(address), (error, data) => {
            if(error){
                return callback(error)
            } else {
                this.webtorrent.add(data.infoHash, {path: this.storage, destroyStoreOnDestroy: clean}, torrent => {
                    delete data.infoHash
                    for(let prop in data){
                        torrent[prop] = data[prop]
                    }
                    return callback(null, torrent)
                })
            }
        })
    }
    remove(address, callback){
        if(!callback){
            callback = () => {}
        }
        this.webproperty.resolve(this.webproperty.addressFromLink(address), (error, data) => {
            if(error){
                return callback(error)
            } else {
                this.webtorrent.remove(data.infoHash, {destroyStore: clean}, error => {
                    if(error){
                        return callback(error)
                    } else {
                        return callback(null, data)
                    }
                })
            }
        })
    }
}

module.exports = TorrentProperty