const WebTorrent = require('webtorrent')
const {WebProperty, verify} = require('webproperty/managed.js')
const fs = require('fs')
const path = require('path')

class TorrentProperty {
    constructor(opt){
        if(!opt){
            opt.storage = __dirname + '/storage'
            opt.takeOutInActive = false
        } else {
            if(!opt.storage){
                opt.storage = __dirname + '/storage'
            }
            if(!opt.takeOutInActive){
                opt.takeOutInActive = false
            }
        }
        // this.redo = []
        this.storage = opt.storage
        this.takeOutInActive = opt.takeOutInActive
        this.webtorrent = new WebTorrent({dht: {verify}})
        this.webproperty = new WebProperty({dht: this.webtorrent.dht, takeOutInActive: this.takeOutInActive})
        this.startUp()
        this.webtorrent.on('error', error => {
            console.log(error)
        })
        this.webproperty.on('update', data => {
            this.webtorrent.remove(data.old, {destroyStore: true}, error => {
                if(error){
                    console.log(error)
                    // this.redo.push(data.old)
                }
                this.webtorrent.add(data.new.infoHash, {path: this.storage + path.sep + data.new.address, destroyStoreOnDestroy: true}, torrent => {
                    torrent.address = data.new.address
                    torrent.seq = data.new.seq
                    torrent.isActive = data.new.isActive
                    torrent.own = data.new.own
                    // console.log('the following torrent has been updated: ' + torrent.address)
                })
            })
        })
        if(this.takeOutInActive){
            this.webproperty.on('inactive', data => {
                this.webtorrent.remove(data.infoHash, {destroyStore: true}, error => {
                    if(error){
                        console.log(error)
                        // this.redo.push(data.infoHash)
                    }
                })
            })
        }
        // this.startRedo()
    }
    async startUp(){
        if(fs.existsSync(this.storage)){
            let props = this.webproperty.getAll(null)
            let dirs = fs.readFileSync(this.storage)
            let has = props.filter(data => {return dirs.includes(data.address)})
            props = props.map(data => {return data.address})
            let hasNot = dirs.filter(data => {return !props.includes(data)})
            if(hasNot.length){
                for(let i = 0;i < hasNot.length;i++){
                    fs.rmSync(this.storage + path.sep + hasNot[i], {recursive: true, force: true})
                }
            }
            if(has.length){
                for(let i = 0;i < has.length;i++){
                    await new Promise((resolve) => {
                        this.webtorrent.seed(this.storage + path.sep + has[i].address, {path: this.storage + path.sep + has[i].address, destroyStoreOnDestroy: true}, torrent => {
                            torrent.address = has[i].address
                            torrent.seq = has[i].seq
                            torrent.isActive = has[i].isActive
                            torrent.own = has[i].own
                            resolve(torrent)
                        })
                    })
                }
            }
        } else {
            fs.mkdirSync(this.storage, {recursive: true})
        }
    }
    // async startRedo(){
    //     for(let i = 0;i < this.redo.length;i++){
    //         await new Promise((resolve, reject) => {
    //             this.webtorrent.remove(this.redo[i], {destroyStore: true}, error => {
    //                 if(error){
    //                     reject(false)
    //                 } else {
    //                     resolve(true)
    //                 }
    //             })
    //         })
    //     }
    //     this.redo = []
    //     setTimeout(() => {
    //         this.startRedo()
    //     }, 3600000)
    // }
    download(address, callback){
        if(!callback){
            callback = function(){}
        }
        this.webproperty.resolve(this.webproperty.addressFromLink(address), (error, data) => {
            if(error){
                return callback(error)
            } else {
                this.webtorrent.add(data.infoHash, {path: this.storage + path.sep + data.address, destroyStoreOnDestroy: true}, torrent => {
                    torrent.address = data.address
                    torrent.seq = data.seq
                    torrent.isActive = data.isActive
                    torrent.own = data.own
                    return callback(null, {torrent, data})
                })
            }
        })
    }
    upload(folder, keypair, seq, callback){
        if(!callback){
            callback = function(){}
        }
        if((!keypair) || (!keypair.address || !keypair.secret)){
            keypair = this.webproperty.createKeypair(null)
        }
        this.webtorrent.seed(folder, {path: this.storage + path.sep + keypair.address, destroyStoreOnDestroy: true}, torrent => {
            this.webproperty.publish(keypair, torrent.infoHash, seq, (error, data) => {
                if(error){
                    this.webtorrent.remove(torrent.infoHash, {destroyStore: true})
                    return callback(error)
                } else {
                    torrent.address = data.address
                    torrent.seq = data.seq
                    torrent.isActive = data.isActive
                    torrent.own = data.own
                    return callback(null, {torrent, data})
                }
            })
        })
    }
    rubbish(address, callback){
        if(!callback){
            callback = function(){}
        }
        this.webproperty.shred(this.webproperty.addressFromLink(address), (resError, resProp) => {
            if(resError){
                return callback(resError)
            } else {
                this.webtorrent.remove(resProp.infoHash, {destroyStore: true}, error => {
                    if(error){
                        return callback(error)
                    } else {
                        callback(null, 'torrent has been deleted')
                    }
                })
            }
        })
    }
}

module.exports = TorrentProperty