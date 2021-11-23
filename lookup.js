const WebTorrent = require('webtorrent')
const {WebProperty, verify} = require('webproperty/lookup.js')
const fs = require('fs')

class TorrentProperty {
    constructor(opt){
        if(!opt){
            opt = {}
            opt.storage = __dirname + '/storage'
        } else {
            if(!opt.storage){
                opt.storage = __dirname + '/storage'
            }
        }
        this.storage = opt.storage
        this.webtorrent = new WebTorrent({dht: {verify}})
        this.webproperty = new WebProperty({dht: this.webtorrent.dht})
        this.start()
        this.webproperty.on('error', error => {
            console.log(error)
        })
        this.webtorrent.on('error', error => {
            console.log(error)
        })
    }
    start(){
        if(fs.existsSync(this.storage)){
            if(fs.readdirSync(this.storage).length){
                this.webtorrent.seed(this.storage, {path: this.storage, destroyStoreOnDestroy: true}, torrent => {
                    console.log('started', torrent)
                })
            }
        } else {
            fs.mkdirSync(this.storage, {recursive: true})
        }
    }
    download(address, callback){
        if(!callback){
            callback = () => {}
        }
        for(let i = 0;i < this.webtorrent.torrents.length;i++){
            this.webtorrent.remove(this.webtorrent.torrents[i].infoHash, {destroyStore: true})
        }
        this.webproperty.resolve(this.webproperty.addressFromLink(address), (error, data) => {
            if(error){
                return callback(error)
            } else {
                this.webtorrent.add(data.infoHash, {path: this.storage, destroyStoreOnDestroy: true}, torrent => {
                    torrent.address = data.address
                    torrent.seq = data.seq
                    return callback(null, torrent)
                })
            }
        })
    }
    upload(keypair, infoHash, seq, callback){
        if(!callback){
            callback = () => {}
        }
        if((!keypair) || (!keypair.address || !keypair.secret)){
            return callback(new Error('must have keypair'))
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
}

module.exports = TorrentProperty