const WebTorrent = require('webtorrent')
const {WebProperty, verify} = require('webproperty/lookup.js')
const fs = require('fs')
const path = require('path')

class TorrentProperty {
    constructor(opt){
        if(!opt){
            opt = {}
            opt.storage = path.resolve('./storage')
            opt.start = {clear: true, share: true}
            opt.load = false
        } else {
            if(!opt.storage){
                opt.storage = path.resolve('./storage')
            }
            if(!opt.start){
                opt.start = {clear: true, share: true}
            }
            if(!opt.load){
                opt.load = false
            }
        }
        this.storage = opt.storage
        if(!fs.existsSync(this.storage)){
            fs.mkdirSync(this.storage)
        }
        this.atStart = opt.start
        this.atLoad = opt.load
        this.webtorrent = new WebTorrent({dht: {verify}})
        this.webproperty = new WebProperty({dht: this.webtorrent.dht})
        this.webproperty.on('error', error => {
            console.log(error)
        })
        this.webtorrent.on('error', error => {
            console.log(error)
        })
        this.start().catch(error => {
            console.log(error)
        })
    }
    async start(){
        if(this.atStart.clear || this.atStart.share){
            let dirs = await new Promise((resolve, reject) => {
                fs.readdir(this.storage, {withFileTypes: true}, (error, data) => {
                    if(error){
                        reject([])
                    } else if(data){
                        resolve(data)
                    } else if(!data){
                        reject([])
                    }
                })
            })
            for(let i = 0;i < dirs.length;i++){
                if(this.atStart.clear){
                    await new Promise((resolve, reject) => {
                        fs.rm(dirs[i], {recursive: true, force: true}, error => {
                            if(error){
                                reject(false)
                            } else {
                                resolve(true)
                            }
                        })
                    })
                }
                if(this.atStart.share){
                    await new Promise((resolve) => {
                        this.webtorrent.seed(dirs[i], {destroyStoreOnDestroy: true}, torrent => {
                            resolve(torrent)
                        })
                    })
                }
            }
        }
    }

    async takeOut(){
        for(let i = 0;i < this.webtorrent.torrents.length;i++){
            await new Promise((resolve, reject) => {
                this.webtorrent.remove(this.webtorrent.torrents[i].infoHash, {destroyStore: true}, error => {
                    if(error){
                        reject(false)
                    } else {
                        resolve(true)
                    }
                })
            })
        }
        let dirs = await new Promise((resolve, reject) => {
            fs.readdir(this.storage, {withFileTypes: true}, (error, data) => {
                if(error){
                    reject([])
                } else if(data){
                    resolve(data)
                } else if(!data){
                    reject([])
                }
            })
        })
        for(let i = 0;i < dirs.length;i++){
            await new Promise((resolve, reject) => {
                fs.rm(dirs[i], {recursive: true, force: true}, error => {
                    if(error){
                        reject(false)
                    } else {
                        resolve(true)
                    }
                })
            })
        }
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
                this.webtorrent.remove(this.webtorrent.torrents[i].infoHash, {destroyStore: true})
            }
        }
        this.webproperty.resolve(this.webproperty.addressFromLink(address), (error, data) => {
            if(error){
                return callback(error)
            } else {
                this.webtorrent.add(data.infoHash, {path: this.storage, destroyStoreOnDestroy: true}, torrent => {
                    torrent.address = data.address
                    torrent.seq = data.seq
                    torrent.active = data.active
                    torrent.magnetLink = data.magnet
                    torrent.signed = data.signed
                    return callback(null, torrent)
                })
            }
        })
    }
    publish(keypair, infoHash, seq, callback){
        if(!callback){
            callback = () => {}
        }
        if((!keypair) || (!keypair.address || !keypair.secret)){
            keypair = this.webproperty.createKeypair(null)
        }
        if(!infoHash){
            return callback(new Error('must have infohash'))
        }
        this.webproperty.publish(keypair, infoHash, seq, (error, data) => {
            if(error){
                return callback(error)
            } else {
                callback(null, data)
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
                this.webtorrent.remove(data.infoHash, {destroyStore: true}, error => {
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